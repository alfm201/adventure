(() => {
  'use strict';

  const current = document.currentScript?.src
    ? new URL(document.currentScript.src, window.location.href)
    : null;
  const version = current?.searchParams.get('v') || String(Date.now());
  const engineUrl = new URL(`./fq1_webgpu.js?v=${encodeURIComponent(version)}`, window.location.href).href;

  // GPUQueue.writeBuffer() interprets dataOffset/size as element counts for
  // TypedArray sources, not byte counts. The first raw-WebGPU FQ1 build passed
  // count * Uint32Array.BYTES_PER_ELEMENT. Normalize only that recognizable
  // byte-count form so unrelated, already-correct calls remain unchanged.
  const queuePrototype = globalThis.GPUQueue?.prototype;
  if (queuePrototype && !queuePrototype.__fq1TypedArraySizeFix) {
    const nativeWriteBuffer = queuePrototype.writeBuffer;
    Object.defineProperty(queuePrototype, '__fq1TypedArraySizeFix', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    });
    queuePrototype.writeBuffer = function (buffer, bufferOffset, data, dataOffset, size) {
      if (ArrayBuffer.isView(data) && !(data instanceof DataView) && size !== undefined) {
        const elementOffset = Number(dataOffset) || 0;
        const remainingElements = Math.max(0, data.length - elementOffset);
        const bytesPerElement = Number(data.BYTES_PER_ELEMENT) || 1;
        if (
          size > remainingElements &&
          size % bytesPerElement === 0 &&
          size / bytesPerElement <= remainingElements
        ) {
          size /= bytesPerElement;
        }
      }
      return nativeWriteBuffer.call(this, buffer, bufferOffset, data, dataOffset, size);
    };
  }

  let resolveEngine;
  let rejectEngine;
  const engineReady = new Promise((resolve, reject) => {
    resolveEngine = resolve;
    rejectEngine = reject;
  });

  const proxy = class FQ1WebGPUEngineEntry {
    static async create(...args) {
      const Engine = await engineReady;
      return Engine.create(...args);
    }
  };
  window.FQ1WebGPUEngine = proxy;

  const script = document.createElement('script');
  script.src = engineUrl;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.addEventListener('load', () => {
    const Engine = window.FQ1WebGPUEngine;
    if (!Engine || Engine === proxy || typeof Engine.create !== 'function') {
      rejectEngine(new Error('FQ1 raw WebGPU 엔진을 초기화하지 못했습니다.'));
      return;
    }
    resolveEngine(Engine);
  }, { once: true });
  script.addEventListener('error', () => {
    rejectEngine(new Error(`FQ1 raw WebGPU 엔진 로드 실패: ${engineUrl}`));
  }, { once: true });
  document.head.appendChild(script);
})();
