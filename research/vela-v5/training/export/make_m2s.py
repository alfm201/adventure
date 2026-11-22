"""잔차 가중치(.npz)를 배포용 작은 파일(.m2s)로 바꾼다.

사용: OPENBLAS_NUM_THREADS=1 python export/make_m2s.py HINGE.bin WEIGHTS.npz OUT.m2s

.m2s에는 실행 엔진이 잔차 표를 다시 만드는 데 필요한 것만 들어 있다.
  int32 x8 [매직 M2S1, F, WG, D, I, H, 28, 18] 뒤에 float32로
  W0[F x WG] W1[WG] W2[WG x D] W3[D] W4[I x H] W5[H] W6[H x D] W7[D] mean[F] scale[F] position[2899 x D] hnorm[2 x 18]
  base_project[256 x 28] hand_project[256 x 18] sincos[2899 x 12]
base_project와 hand_project는 Hinge의 256개 인자를 보드 쪽 28성분, 손패 쪽 18성분으로 줄이는 투영이다.
finalrun/warm/project.py의 rank 48 경로와 같은 절차(같은 난수 시드)로 구한다.
고유값 분해와 사인·코사인의 끝자리는 실행 환경마다 달라질 수 있어서, 배포에는 이 폴더의 m2.m2s를 그대로 쓴다.
"""
import sys
import numpy as np

hinge_path, npz_path, out_path = sys.argv[1:4]
with open(hinge_path, 'rb') as f:
    def read(dtype, n):
        a = np.fromfile(f, dtype=dtype, count=n)
        assert len(a) == n
        return a
    hdr = read('<i4', 8)
    assert hdr.tolist() == [0x56435332, 100, 2899, 0, 256, 16, 0, 0]
    read('<f4', 101 * 2 * 2899)
    read('<f4', 1)
    scale = read('<f4', 1)[0]
    phi = read('<i2', 80730 * 256).reshape(80730, 256).astype('f') * scale
    tm = read('<f4', 101 * 16).reshape(101, 16)
    scale = read('<f4', 1)[0]
    g = read('<i2', 2 * 2899 * 256 * 16).reshape(2, 2899, 256, 16).astype('f') * scale
    assert not f.read(1)

# 투영 (project.py --rank 48과 같은 순서)
k = 48
rng = np.random.default_rng(198100)
handids = np.concatenate([rng.integers(l, h, 4096) for l, h in zip([1, 23, 276, 2300, 14950], [23, 276, 2300, 14950, 80730])])
sample = phi[handids].astype('d')
w, u = np.linalg.eigh(sample.T @ sample / len(sample))
w = np.maximum(w, w.max() * 1.e-10)
M = u * np.sqrt(w)
sr = rng.integers(0, 101, 24000)
sb = rng.integers(0, 2, 24000)
sp = rng.integers(1, 2899, 24000)
x = np.empty((len(sr), 256), 'f')
for i in range(0, len(x), 200):
    sl = slice(i, i + 200)
    x[sl] = np.einsum('ijkt,it->ijk', g[sb[sl], sp[sl]][:, None, :, :], tm[sr[sl]])[:, 0, :]
weighted = x.astype('d') @ M
ev, v = np.linalg.eigh(weighted.T @ weighted)
P = v[:, ::-1][:, :k]
base_project = (M @ P).astype('f')[:, :28].copy()
hand_project = ((u / np.sqrt(w)) @ P).astype('f')[:, :18].copy()

z = np.load(npz_path)
W = [z[str(i)] for i in range(8)]
F, WG = W[0].shape
D = W[3].shape[0]
I, H = W[4].shape
assert z['position'].shape == (2899, D)
pos = np.arange(2899)
sincos = np.stack([fn(pos / s) for s in [48, 135, 340, 770, 1600, 4000] for fn in (np.sin, np.cos)], 1).astype('<f4')
with open(out_path, 'wb') as f:
    np.array([0x3153324D, F, WG, D, I, H, 28, 18], '<i4').tofile(f)
    for a in W + [z['mean'], z['scale'], z['position'], z['hnorm'], base_project, hand_project, sincos]:
        np.ascontiguousarray(a, '<f4').tofile(f)
print(out_path, sum(1 for _ in open(out_path, 'rb').read()), 'bytes')
