(() => {
  if (new URLSearchParams(location.search).get('mode') !== 'test') return;

  const startedAt = performance.now();
  const lines = [];
  let root;
  let pre;

  const errText = error => error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error ?? 'unknown error');

  const json = value => {
    try {
      return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? String(item) : item);
    } catch {
      return String(value);
    }
  };

  function ensureUi() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'gpu-test-diagnostic';
    root.style.cssText = 'position:fixed;z-index:30000;left:8px;right:8px;bottom:8px;max-height:58vh;display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid #475569;border-radius:8px;background:rgba(15,23,42,.96);color:#e2e8f0;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;box-shadow:0 12px 36px rgba(0,0,0,.45)';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';
    const title = document.createElement('strong');
    title.textContent = 'WebGPU 진단 · ?mode=test';
    const copy = document.createElement('button');
    copy.textContent = '전체 복사';
    copy.style.cssText = 'padding:6px 10px;border:0;border-radius:6px;background:#2563eb;color:white;font-weight:700';
    copy.onclick = async () => {
      const value = lines.join('\n');
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      copy.textContent = '복사 완료';
      setTimeout(() => copy.textContent = '전체 복사', 1000);
    };
    header.append(title, copy);
    pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;user-select:text';
    root.append(header, pre);
    document.body.appendChild(root);
  }

  function diag(stage, message, extra) {
    ensureUi();
    const ms = (performance.now() - startedAt).toFixed(1).padStart(7, ' ');
    const suffix = extra === undefined ? '' : ` · ${json(extra)}`;
    lines.push(`[+${ms}ms] ${stage} ${message}${suffix}`);
    pre.textContent = lines.join('\n');
    pre.scrollTop = pre.scrollHeight;
    console.log('[GPU TEST]', stage, message, extra ?? '');
  }

  // Global function declarations are often writable but non-configurable.
  // Try defineProperty first, then direct assignment so adventure.js globals can
  // still be observed without changing normal-mode code.
  function wrapMethod(target, name, makeWrapper) {
    if (!target || typeof target[name] !== 'function') return false;
    const original = target[name].bind(target);
    const wrapped = makeWrapper(original);
    try {
      Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapped });
      return true;
    } catch (_) {
      try {
        target[name] = wrapped;
        if (target[name] === wrapped) return true;
      } catch (_) {}
    }
    diag('DIAG', `${name} hook 실패`, 'property is not writable');
    return false;
  }

  function instrumentBuffer(buffer, descriptor) {
    const mapRead = typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage.MAP_READ : 1;
    if (!buffer || typeof buffer.mapAsync !== 'function' || !(Number(descriptor?.usage || 0) & mapRead)) return;
    wrapMethod(buffer, 'mapAsync', original => async (...args) => {
      diag('S9 mapAsync', '시작', { size: descriptor?.size, args });
      try {
        const result = await original(...args);
        diag('S9 mapAsync', '성공');
        return result;
      } catch (error) {
        diag('FAIL mapAsync', errText(error));
        throw error;
      }
    });
  }

  function instrumentDevice(device) {
    if (!device) return;
    const limits = device.limits || {};
    diag('S3 requestDevice', '성공', {
      maxBufferSize: limits.maxBufferSize,
      maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
      maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
    });
    device.lost?.then?.(info => diag('FAIL device.lost', info?.reason || 'unknown', info?.message || ''));

    wrapMethod(device, 'createShaderModule', original => descriptor => {
      diag('S4 shader', 'createShaderModule');
      try {
        const result = original(descriptor);
        diag('S4 shader', '생성 호출 성공');
        return result;
      } catch (error) {
        diag('FAIL shader', errText(error));
        throw error;
      }
    });

    for (const name of ['createComputePipelineAsync', 'createComputePipeline']) {
      wrapMethod(device, name, original => async descriptor => {
        diag('S5 pipeline', `${name} 시작`);
        try {
          const result = await original(descriptor);
          diag('S5 pipeline', '성공');
          return result;
        } catch (error) {
          diag('FAIL pipeline', errText(error));
          throw error;
        }
      });
    }

    wrapMethod(device, 'createBuffer', original => descriptor => {
      try {
        const result = original(descriptor);
        instrumentBuffer(result, descriptor);
        return result;
      } catch (error) {
        diag('FAIL createBuffer', errText(error), { size: descriptor?.size, usage: descriptor?.usage });
        throw error;
      }
    });

    if (device.queue) {
      wrapMethod(device.queue, 'submit', original => buffers => {
        diag('S8 queue.submit', '시작', { commandBuffers: buffers?.length || 0 });
        try {
          const result = original(buffers);
          diag('S8 queue.submit', '호출 성공');
          return result;
        } catch (error) {
          diag('FAIL queue.submit', errText(error));
          throw error;
        }
      });
    }
  }

  function instrumentAdapter(adapter) {
    const info = adapter?.info || {};
    diag('S2 requestAdapter', '성공', {
      vendor: info.vendor,
      architecture: info.architecture,
      device: info.device,
      description: info.description,
    });
    wrapMethod(adapter, 'requestDevice', original => async (...args) => {
      diag('S3 requestDevice', '시작', args[0] || {});
      try {
        const device = await original(...args);
        instrumentDevice(device);
        return device;
      } catch (error) {
        diag('FAIL requestDevice', errText(error));
        throw error;
      }
    });
  }

  function instrumentGpu() {
    if (!navigator.gpu) {
      diag('FAIL navigator.gpu', 'navigator.gpu 없음');
      return;
    }
    diag('S1 navigator.gpu', '존재');
    wrapMethod(navigator.gpu, 'requestAdapter', original => async (...args) => {
      diag('S2 requestAdapter', '시작', args[0] || {});
      try {
        const adapter = await original(...args);
        if (!adapter) {
          diag('FAIL requestAdapter', 'adapter=null');
          return null;
        }
        instrumentAdapter(adapter);
        return adapter;
      } catch (error) {
        diag('FAIL requestAdapter', errText(error));
        throw error;
      }
    });
  }

  function instrumentWorkbench() {
    const wb = window.gpuRolloutWorkbench;
    if (!wb) {
      diag('FAIL workbench', 'window.gpuRolloutWorkbench 없음');
      return;
    }
    diag('S6 workbench', 'gpuRolloutWorkbench 존재');
    wrapMethod(wb, 'prepareGpuReadbackMode', original => async args => {
      diag('S7 prepare', 'prepareGpuReadbackMode 시작');
      try {
        const result = await original(args);
        diag('S7 prepare', `성공 (${result})`);
        return result;
      } catch (error) {
        diag('FAIL prepare', errText(error));
        throw error;
      }
    });
    for (const name of ['runGpu', 'runGpuAllActions']) {
      wrapMethod(wb, name, original => async args => {
        diag('S8 self-test', `${name} 시작`, {
          rolloutCount: args?.rolloutCount,
          action: args?.action,
          actionCount: args?.sample?.actionCount,
        });
        try {
          const result = await original(args);
          diag('S8 self-test', `${name} 성공`, {
            count: result?.count,
            bestAction: result?.bestAction,
            elapsedMs: result?.elapsedMs,
          });
          return result;
        } catch (error) {
          diag('FAIL self-test', `${name}: ${errText(error)}`);
          throw error;
        }
      });
    }
  }

  function instrumentAdventureSelfTest() {
    if (typeof window.verifyGpuEngineOnLoad === 'function') {
      wrapMethod(window, 'verifyGpuEngineOnLoad', original => async (...args) => {
        diag('S10 verifyGpuEngineOnLoad', '시작');
        try {
          const result = await original(...args);
          diag('S10 verifyGpuEngineOnLoad', '반환', result);
          if (result?.ok === false) diag('FINAL self-test FAIL', String(result.reason || '(reason 없음)'));
          else if (result?.ok === true) diag('FINAL self-test PASS', 'ok=true');
          return result;
        } catch (error) {
          diag('FAIL verifyGpuEngineOnLoad', errText(error));
          throw error;
        }
      });
    } else {
      diag('DIAG', 'verifyGpuEngineOnLoad hook 대상 없음');
    }

    if (typeof window.markGpuUnavailable === 'function') {
      wrapMethod(window, 'markGpuUnavailable', original => reason => {
        diag('FINAL GPU unavailable', String(reason || '(reason 없음)'));
        return original(reason);
      });
    } else {
      diag('DIAG', 'markGpuUnavailable hook 대상 없음');
    }
  }

  window.addEventListener('error', event => diag('WINDOW error', event.message || errText(event.error)));
  window.addEventListener('unhandledrejection', event => diag('WINDOW rejection', errText(event.reason)));

  ensureUi();
  diag('S0 bootstrap', '진단 시작', {
    href: location.href,
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
  });
  instrumentGpu();
  instrumentWorkbench();
  instrumentAdventureSelfTest();
})();
