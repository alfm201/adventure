"""Generate initial value-training rows from Hinge teacher decisions."""
import os, sys, time, json, numpy as np
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(H, "..", "kernel"))
sys.path.insert(0, os.path.join(H, ".."))
from artifacts import save_npz
from dk import Kernel, TREC

def raw_of(x):
    r = np.zeros((len(x), 11), np.int32)
    r[:, 0] = x["p"]; r[:, 1] = x["t"]; r[:, 2] = x["b"]; r[:, 3] = x["n"]; r[:, 4:9] = x["h"]; r[:, 9] = x["deck"].view(np.int32)
    return r


def legal_pairs(K, raw):
    """(parent index, class) for roll + each distinct class in hand."""
    pi, cl = [], []
    for i in range(len(raw)):
        cs = {0} | {int(K.idmap[raw[i, 4 + j]]) for j in range(raw[i, 3])}
        for c in sorted(cs): pi.append(i); cl.append(c)
    return np.array(pi, np.int64), np.array(cl, np.int32)



def main():
    ROOT = os.path.join(H, ".."); OUT = os.path.join(ROOT, "data", "v0"); os.makedirs(OUT, exist_ok=True)
    K = Kernel(threads=10); rng = np.random.default_rng(20261012); t0 = time.time()
    a = np.fromfile(os.path.join(ROOT, "data", "g1_teacher", "teacher.trec"), dtype=TREC)


    # ---- training rows ----
    tr_idx = np.where(a["game"] < 95000)[0]; par = np.sort(rng.choice(tr_idx, 800000, replace=False))
    praw = raw_of(a[par]); pi, cl = legal_pairs(K, praw)
    rows, PER = [], 8
    for s in range(0, len(pi), 200000):
        R = praw[pi[s:s + 200000]]; off, craw, prob = K.children(R, cl[s:s + 200000])
        Cs = np.cumsum(prob); base = np.r_[0.0, Cs][off[:-1]]
        u = base[:, None] + rng.random((len(R), PER)) * (Cs[off[1:] - 1] - base)[:, None]
        j = np.minimum(np.searchsorted(Cs, u, side="right"), (off[1:] - 1)[:, None]).reshape(-1)
        rows.append(craw[j])
        print(f"pairs {min(s + 200000, len(pi))}/{len(pi)} {time.time() - t0:.0f}s", flush=True)
    X = np.concatenate(rows); X = X[X[:, 10] == 0]      # drop terminal children (value is exactly p)
    y = K.v2(X).astype(np.float32)
    save_npz(os.path.join(OUT, "train.npz"), raw=X, y=y)
    print("train rows", len(X), "V2 mean", float(y.mean()), f"{time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
