#include "policy.hpp"

namespace {
std::unique_ptr<warm::Model> hinge;
std::unique_ptr<res::Model> residual;
std::unique_ptr<res::Planner> planner;
constexpr int budget = 8000;
int input[10], nodes, depth;
double values[6];
std::string error;
} // namespace
extern "C" {
int *state_ptr() { return input; }
double *values_ptr() { return values; }
const char *last_error() { return error.c_str(); }
int last_depth() { return depth; }
int last_nodes() { return nodes; }
int last_capped() { return nodes > budget; }
int init_model(const char *data, unsigned bytes) {
  try {
    planner.reset();
    residual.reset();
    hinge.reset();
    auto package = vela_v5::read_package(std::as_bytes(std::span(data, bytes)));
    vela_v5::Inputs inputs(package);
    vela_build_progress(0);
    hinge = std::make_unique<warm::Model>(inputs);
    residual = std::make_unique<res::Model>(*hinge, inputs);
    vela_build_progress(98);
    planner = std::make_unique<res::Planner>(*residual, 1.f);
    vela_build_progress(100);
    return 1;
  } catch (const std::bad_alloc &) {
    error = "Insufficient memory";
  } catch (const std::exception &e) {
    error = e.what();
  }
  planner.reset();
  residual.reset();
  hinge.reset();
  return 0;
}

int evaluate_state() {
  try {
    if (!planner)
      throw std::runtime_error("Model is not ready");
    nodes = 0;
    depth = 2;
    State s;
    s.p = input[0];
    s.t = input[1];
    s.b = input[2];
    s.n = input[3];
    s.deck = input[9];
    if (s.p < 1 || s.p > N || s.t < 0 || s.t > 100 || s.b < 0 || s.b > 1 || s.n < 0 || s.n > 5 ||
        !s.deck || s.deck > 0x3fffffff)
      throw std::runtime_error("Invalid state");
    for (int i = 0; i < s.n; i++) {
      s.h[i] = input[4 + i];
      if (s.h[i] < 1 || s.h[i] > 30)
        throw std::runtime_error("Invalid card");
    }
    std::fill_n(values, 6, 0.0);
    if (s.terminal()) {
      std::fill_n(values, s.n + 1, s.p);
      return 0;
    }
    planner->limit = 0;
    if (!s.n) {
      values[0] = planner->q2(s, 0, hinge->codec.hand(s));
      return 0;
    }
    planner->depthReached = 2;
    const int best = planner->choose(s, budget);
    nodes = planner->used;
    depth = planner->depthReached;
    for (int i = 0; i <= s.n; ++i)
      values[i] = planner->lastQs[i];
    return best;
  } catch (const SearchCancelled &) {
    planner->limit = 0;
    return -2;
  } catch (const std::exception &e) {
    error = e.what();
    return -1;
  }
}
}
