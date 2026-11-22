#pragma once
#include "../core.hpp"
#include "package.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
EM_JS(void, vela_build_progress, (int percent), {
  if (Module.onTableProgress)
    Module.onTableProgress(percent);
});
#else
inline void vela_build_progress(int) {}
#endif

namespace vela_v5 {
constexpr int NP = N + 1, NR = 101, K = 256, T = 16, HANDS = 80730, GB = 28, HB = 18, HANDIN = 76;
struct Inputs {
  const float *base, *time;
  const int16_t *phi, *g;
  float scale, scale2;
  std::span<const std::byte> small;
  explicit Inputs(Package package) : small(package.residual) {
    const auto *p = package.hinge.data();
    const int32_t header[8] = {0x56435332, 100, NP, 0, K, T, 0, 0};
    if (std::memcmp(p, header, sizeof(header)))
      throw std::runtime_error("Invalid Hinge header");
    p += sizeof(header);
    base = reinterpret_cast<const float *>(p);
    p += sizeof(float) * (NR * 2 * NP + 1);
    std::memcpy(&scale, p, 4);
    p += 4;
    phi = reinterpret_cast<const int16_t *>(p);
    p += sizeof(int16_t) * HANDS * K;
    time = reinterpret_cast<const float *>(p);
    p += sizeof(float) * NR * T;
    std::memcpy(&scale2, p, 4);
    p += 4;
    g = reinterpret_cast<const int16_t *>(p);
  }
};
} // namespace vela_v5

namespace warm {
using namespace vela_v5;
struct Model {
  static constexpr int k = K;
  std::vector<float> base, hand, geo;
  Codec codec;
  std::vector<std::array<int, 23>> add;
  explicit Model(const Inputs &in)
      : base(in.base, in.base + NR * 2 * NP), hand(HANDS * K), geo(size_t(NR) * 2 * NP * K),
        add(14950) {
    const size_t geo_plane = size_t(2) * NP * K;
    for (size_t i = 0; i < hand.size(); ++i)
      hand[i] = float(in.phi[i]) * in.scale;
    alignas(16) float gt[T][K];
    for (int b = 0; b < 2; ++b)
      for (int p = 0; p < NP; ++p) {
        if ((p & 63) == 0)
          vela_build_progress((b * NP + p) * 48 / (2 * NP));
        const int16_t *src = in.g + (size_t(b) * NP + p) * K * T;
        for (int j = 0; j < K; ++j)
          for (int k = 0; k < T; ++k)
            gt[k][j] = float(src[j * T + k]) * in.scale2;
        for (int r = 0; r < NR; ++r) {
          float *dst = geo.data() + size_t(r) * geo_plane + (size_t(b) * NP + p) * K;
          for (int k = 0; k < T; ++k)
            for (int j = 0; j < K; ++j)
              dst[j] += gt[k][j] * in.time[r * T + k];
        }
      }
    const auto fill = [&](auto self, int at, int n, int low, int *c) -> void {
      if (at < n) {
        for (int j = low; j <= 22; j++) {
          c[at] = j;
          self(self, at + 1, n, j, c);
        }
        return;
      }
      int h = codec.rank(c, n);
      for (int j = 1; j <= 22; j++) {
        int d[5];
        std::copy(c, c + n, d);
        d[n] = j;
        std::sort(d, d + n + 1);
        add[h][j] = codec.rank(d, n + 1);
      }
    };
    int c[5];
    for (int n = 0; n < 5; n++)
      fill(fill, 0, n, 1, c);
  }
};
} // namespace warm

namespace vela_v5 {
inline void build_residual(const Inputs &in, float (&a)[48][76], float (&b0)[48],
                           float (&c0)[20][48], float (&d0)[20],
                           std::vector<std::array<float, 48>> &hands,
                           std::vector<std::array<float, 20>> &geom) {
  constexpr int F = 65, WG = 60, D = 20, I = 94, H = 48;
  const int32_t header[8] = {0x3153324D, F, WG, D, I, H, GB, HB};
  if (std::memcmp(in.small.data(), header, sizeof(header)))
    throw std::runtime_error("Invalid M2 header");
  const auto *cursor = reinterpret_cast<const float *>(in.small.data() + sizeof(header));
  auto block = [&](size_t size) {
    auto result = cursor;
    cursor += size;
    return result;
  };
  const auto W0 = block(size_t(F) * WG), W1 = block(WG), W2 = block(size_t(WG) * D), W3 = block(D),
             W4 = block(size_t(I) * H), W5 = block(H), W6 = block(size_t(H) * D), W7 = block(D),
             mean = block(F), scl = block(F), position = block(size_t(NP) * D),
             hnorm = block(2 * HB), bp = block(size_t(K) * GB), hp = block(size_t(K) * HB),
             sincos = block(size_t(NP) * 12);
  if (reinterpret_cast<const std::byte *>(cursor) != in.small.data() + in.small.size())
    throw std::runtime_error("Invalid M2 weights");
  for (int t = 0; t < H; t++) {
    for (int i = 0; i < HANDIN; i++)
      a[t][i] = W4[size_t(i) * H + t];
    b0[t] = W5[t];
  }
  for (int d = 0; d < D; d++) {
    for (int t = 0; t < H; t++)
      c0[d][t] = W6[size_t(t) * D + d];
    d0[d] = W7[d];
  }
  vela_build_progress(48);
  for (int i = 0; i < HANDS; ++i) {
    float lat[HB] = {};
    const int16_t *src = in.phi + size_t(i) * K;
    for (int j = 0; j < K; ++j) {
      const float x = float(src[j]) * in.scale;
      const float *w = hp + size_t(j) * HB;
#pragma omp simd
      for (int c = 0; c < HB; ++c)
        lat[c] += x * w[c];
    }
    float *o = hands[i].data();
    for (int t = 0; t < H; ++t)
      o[t] = 0.f;
    for (int c = 0; c < HB; ++c) {
      const float v = std::min(6.f, std::max(-6.f, (lat[c] - hnorm[c]) / hnorm[HB + c]));
      const float *w = W4 + size_t(HANDIN + c) * H;
#pragma omp simd
      for (int t = 0; t < H; ++t)
        o[t] += v * w[t];
    }
  }
  vela_build_progress(51);

  // --- geometry: (b, p)마다 보드 인자 28개를 만들고 남은 굴림 r마다 특징 65개 → 은닉 → 성분 D
  std::vector<int> A(size_t(9) * NP);
  const int offs[7] = {-3, -1, 1, 3, 5, 8, 11};
  for (int p = 0; p < NP; ++p) {
    A[p] = ROLL[p * 11 + 5];
    A[NP + p] = NEXT[p];
    for (int c = 0; c < 7; ++c)
      A[size_t(2 + c) * NP + p] = LAND[p + 3 + offs[c]];
  }
  std::vector<float> hid(WG), o(D);
  float *__restrict hp_ = hid.data();
  float *__restrict op_ = o.data();
  for (int b = 0; b < 2; ++b)
    for (int p = 0; p < NP; ++p) {
      if ((p & 63) == 0)
        vela_build_progress(51 + (b * NP + p) * 47 / (2 * NP));
      float g28[T][GB] = {};
      const int16_t *src = in.g + (size_t(b) * NP + p) * K * T;
      for (int j = 0; j < K; ++j) {
        const float *w = bp + size_t(j) * GB;
        for (int k = 0; k < T; ++k) {
          const float x = float(src[j * T + k]) * in.scale2;
#pragma omp simd
          for (int c = 0; c < GB; ++c)
            g28[k][c] += x * w[c];
        }
      }
      for (int r = 0; r < NR; ++r) {
        const int t = r * 2 + b;
        const float *v = in.base + size_t(t) * NP;
        float x[GB + 37];
        for (int c = 0; c < GB; ++c)
          x[c] = 0.f;
        for (int k = 0; k < T; ++k) {
          const float w = in.time[r * T + k];
#pragma omp simd
          for (int c = 0; c < GB; ++c)
            x[c] += g28[k][c] * w;
        }
        const double rr = r;
        x[GB + 0] = float(rr / 100);
        x[GB + 1] = float(std::sqrt(rr + .1) / 10);
        x[GB + 2] = float(1 / (1 + rr / 4));
        x[GB + 3] = float(b);
        x[GB + 4] = float(double(p) / 2898);
        x[GB + 5] = float(std::min(1.0, double(2898 - p) / double(1 + r * 18)));
        x[GB + 6] = float(double(v[p]) - double(p) - double(18 * r));
        for (int s = 0; s < 12; ++s)
          x[GB + 7 + s] = sincos[size_t(p) * 12 + s];
        for (int a = 0; a < 9; ++a) {
          const int code = A[size_t(a) * NP + p];
          x[GB + 19 + 2 * a] = (code & 4096) ? 1.f : 0.f;
          x[GB + 20 + 2 * a] = v[code & 4095] - v[p];
        }
        for (int q = 0; q < WG; ++q)
          hp_[q] = 0.f;
        for (int f = 0; f < F; ++f) {
          const float xv = std::min(6.f, std::max(-6.f, (x[f] - mean[f]) / scl[f]));
          const float *w = W0 + size_t(f) * WG;
#pragma omp simd
          for (int q = 0; q < WG; ++q)
            hp_[q] += xv * w[q];
        }
        for (int d = 0; d < D; ++d)
          op_[d] = 0.f;
        for (int q = 0; q < WG; ++q) {
          const float hv = std::max(hp_[q] + W1[q], 0.f);
          const float *w = W2 + size_t(q) * D;
#pragma omp simd
          for (int d = 0; d < D; ++d)
            op_[d] += hv * w[d];
        }
        const double decay = std::min(1.0, double(r + b) * .25);
        float *dst = geom[size_t(t) * NP + p].data();
        for (int d = 0; d < D; ++d) {
          const float lin = op_[d] + W3[d];
          dst[d] = float(double(lin) + double(position[size_t(p) * D + d]) * decay) * 10.f;
        }
      }
    }
}
} // namespace vela_v5
