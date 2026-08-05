(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if ((params.get('model') || '').toUpperCase() !== 'FQ1') return;

  const current = document.currentScript?.src
    ? new URL(document.currentScript.src, window.location.href)
    : null;
  const version = current?.searchParams.get('v') || String(Date.now());

  // GPUQueue.writeBuffer uses element counts for TypedArray dataOffset/size.
  // Normalize the previous FQ1 byte-count call (count * 4) without touching
  // correctly sized calls.
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

  // fq1_mode.js originally generated internal ?build= asset URLs. Rewrite them
  // at construction time so every FQ1 JavaScript asset is requested with ?v=.
  const NativeURL = globalThis.URL;
  class FQ1VersionURL extends NativeURL {
    constructor(input, base) {
      super(input, base);
      if (this.searchParams.has('build')) {
        const value = this.searchParams.get('build');
        this.searchParams.delete('build');
        this.searchParams.set('v', value);
      }
    }
  }
  FQ1VersionURL.createObjectURL = NativeURL.createObjectURL?.bind(NativeURL);
  FQ1VersionURL.revokeObjectURL = NativeURL.revokeObjectURL?.bind(NativeURL);
  FQ1VersionURL.canParse = NativeURL.canParse?.bind(NativeURL);
  FQ1VersionURL.parse = NativeURL.parse?.bind(NativeURL);
  globalThis.URL = FQ1VersionURL;

  const modeScript = document.createElement('script');
  modeScript.src = new NativeURL(`./fq1_mode.js?v=${encodeURIComponent(version)}`, window.location.href).href;
  modeScript.async = false;
  modeScript.crossOrigin = 'anonymous';
  modeScript.addEventListener('load', () => {
    globalThis.URL = NativeURL;

    const originalShowModal = window.showComputeModeModal;
    if (typeof originalShowModal === 'function') {
      window.showComputeModeModal = function (...args) {
        const result = originalShowModal.apply(this, args);
        queueMicrotask(() => {
          const modal = document.getElementById('adventure-compute-modal');
          if (!modal) return;

          modal.querySelectorAll('span').forEach(node => {
            if (node.textContent.trim() === '비활성화') node.textContent = '사용 불가';
          });
          modal.querySelectorAll('div').forEach(node => {
            if (node.textContent.trim() === '주소에 v 파라미터를 붙이지 않아도 최신 FQ1 모드와 WebGPU 엔진을 불러옵니다.') {
              node.remove();
            }
          });
        });
        return result;
      };
    }
  }, { once: true });
  modeScript.addEventListener('error', () => {
    globalThis.URL = NativeURL;
    console.error(`FQ1 mode load failed: ${modeScript.src}`);
  }, { once: true });
  document.head.appendChild(modeScript);
})();
