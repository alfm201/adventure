#pragma once
#include "../cancellation.hpp"

namespace vela_v5 {
#ifdef __EMSCRIPTEN__
EM_ASYNC_JS(void, next_worker_task, (), {
  if (typeof setImmediate === 'function') {
    await new Promise(resolve => setImmediate(resolve));
  } else {
    const channel = Module.velaYieldChannel ||= new MessageChannel();
    await new Promise(resolve => {
      channel.port1.onmessage = resolve;
      channel.port2.postMessage(0);
    });
  }
});

class SearchSlice {
  double start = emscripten_get_now();
public:
  void checkpoint() {
    if (emscripten_get_now() - start < 12) return;
    next_worker_task();
    if (search_cancelled()) throw SearchCancelled{};
    start = emscripten_get_now();
  }
};
#else
struct SearchSlice { void checkpoint() {} };
#endif
}
