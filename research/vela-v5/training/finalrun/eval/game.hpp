#pragma once

#include "core.hpp"

#include <cstdint>
#include <stdexcept>
#include <string_view>

namespace adventure_eval {

enum class TapeMode { split, shared, lyra_archive };
constexpr uint32_t kDevelopmentBase = 2110000000u;
constexpr uint32_t kSealedBase = 2190000000u;
constexpr uint32_t kLyraArchiveBase = 1878000000u;
constexpr uint32_t kSplitDiceSalt = 0x243f6a88u;
constexpr uint32_t kSplitDrawSalt = 0xbb67ae85u;
constexpr int kEpisodeBound = 1078;
constexpr uint32_t kFullDeck = (1u << 30) - 1;

inline std::string_view tape_name(TapeMode mode) {
  if (mode == TapeMode::split) return "split-mulberry32-v1";
  if (mode == TapeMode::shared) return "shared-mulberry32-v1";
  return "lyra-tape-mode1";
}

class Tape {
 public:
  Tape(uint32_t seed, TapeMode mode)
      : mode_(mode),
        dice_(mode == TapeMode::split ? mix(seed ^ kSplitDiceSalt) : seed),
        draw_(mix(seed ^ kSplitDrawSalt)), archive_key_(seed) {}

  int die() {
    if (mode_ == TapeMode::lyra_archive)
      return archive_pick(6, 0x243f6a8885a308d3ULL, dice_index_++) + 1;
    return dice_.pick(6) + 1;
  }

  int draw(int count) {
    if (mode_ == TapeMode::lyra_archive)
      return archive_pick(count, 0x13198a2e03707344ULL, draw_index_++);
    return (mode_ == TapeMode::split ? draw_ : dice_).pick(count);
  }

 private:
  static constexpr uint64_t kMix64Step = 0x9e3779b97f4a7c15ULL;

  // Tape mode 1 from the original LYRA evaluation kernel (support.hpp).
  int archive_pick(int count, uint64_t domain, uint64_t index) const {
    uint64_t word = (archive_key_ ^ domain ^ (index * kMix64Step)) + kMix64Step;
    word = (word ^ (word >> 30)) * 0xbf58476d1ce4e5b9ULL;
    word = (word ^ (word >> 27)) * 0x94d049bb133111ebULL;
    word ^= word >> 31;
    return ((word >> 32) * count) >> 32;
  }

  TapeMode mode_;
  RNG dice_;
  RNG draw_;
  uint64_t archive_key_, dice_index_ = 0, draw_index_ = 0;
};

struct GameResult {
  int score = 1;
  int actions = 0;
  int rolls = 0;
  int draws = 0;
  double luck = 0;
  uint64_t trace = 14695981039346656037ULL;
};

struct NoMonitor {
  double operator()(const State&, int, const State&) const { return 0.; }
};

inline void trace_field(uint64_t& trace, uint32_t field) {
  trace = (trace ^ field) * 1099511628211ULL;
}

// Contract: policies receive the current public state, with no access to Tape.
inline void advance(State& state, int action, Tape& tape, GameResult& result) {
  if (state.terminal()) throw std::logic_error("action after game termination");
  if (action < 0 || action > state.n) throw std::logic_error("illegal action");

  int id = 0;
  if (action) {
    id = state.h[action - 1];
    for (int slot = action; slot < state.n; ++slot)
      state.h[slot - 1] = state.h[slot];
    --state.n;
    state.h[state.n] = 0;
  }

  int landing;
  if (!id || CTYPE[id] == 2) {
    const int d1 = tape.die();
    const int d2 = tape.die();
    ++result.rolls;
    if (state.b) {
      state.b = 0;
    } else {
      state.b = d1 == d2;
      ++state.t;
    }
    const int sum = d1 + d2;
    landing = id ? LAND[state.p + CVAL[id] * sum + 3]
                 : ROLL[state.p * 11 + sum - 2];
  } else {
    landing = CTYPE[id] == 3 ? NEXT[state.p] : LAND[state.p + CVAL[id] + 3];
  }

  state.p = landing & 4095;
  if ((landing & 4096) && state.n < 5) {
    const int bit = nthbit(state.deck, tape.draw(__builtin_popcount(state.deck)));
    state.h[state.n++] = bit + 1;
    state.deck &= ~(1u << bit);
    if (!state.deck) state.deck = kFullDeck;
    ++result.draws;
  }
  ++result.actions;
  trace_field(result.trace, action);
  trace_field(result.trace, state.p);
  trace_field(result.trace, state.t * 2 + state.b);
  trace_field(result.trace, state.deck);
  uint32_t packed = 0;
  for (int slot = 0; slot < state.n; ++slot)
    packed |= uint32_t(state.h[slot]) << (slot * 5);
  trace_field(result.trace, packed);
}

template <class Policy, class Monitor>
GameResult play(uint32_t seed, TapeMode mode, Policy&& policy, Monitor&& monitor) {
  State state;
  Tape tape(seed, mode);
  GameResult result;
  while (!state.terminal()) {
    if (result.actions >= kEpisodeBound)
      throw std::logic_error("episode exceeded the proven action bound");
    const State before = state;
    const int action = policy(before);
    advance(state, action, tape, result);
    result.luck += monitor(before, action, state);
  }
  result.score = state.p;
  if (!std::isfinite(result.luck)) throw std::logic_error("non-finite luck");
  return result;
}

template <class Policy>
GameResult play(uint32_t seed, TapeMode mode, Policy&& policy) {
  return play(seed, mode, std::forward<Policy>(policy), NoMonitor{});
}

}  // namespace adventure_eval
