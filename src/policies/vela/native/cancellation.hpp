#pragma once
struct SearchCancelled {};
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
EM_JS(int, search_cancelled, (), { return !!Module.searchCancelled; });
static unsigned pollCount = 0;
static double lastYield = 0;
static bool cooperative = false;
inline void pollSearch(bool force = false) {
  if (!cooperative || (!force && (++pollCount & 255))) return;
  if (emscripten_get_now() - lastYield >= 12) {
    emscripten_sleep(0);
    lastYield = emscripten_get_now();
  }
  if (search_cancelled()) throw SearchCancelled{};
}
inline void beginSearch(bool enabled) {
  cooperative = enabled; pollCount = 0; lastYield = emscripten_get_now();
}
#else
inline void pollSearch(bool = false) {}
inline void beginSearch(bool) {}
#endif
