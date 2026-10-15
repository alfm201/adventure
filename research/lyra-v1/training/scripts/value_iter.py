"""Value iteration data step (V1_PROTOCOL.md): self-play with pi_k = 1-step + V_theta_k, sample parents/children,
targets V_{k+1}(s') = max_a sum P(s''|s',a) V_theta_k(s'') (exact transitions, configurable precision). Mixes in an equal-size random
subset of the V0 training rows. Writes data/v{k+1}/train.npz (raw, y) and meta.json."""
import argparse, json, os, sys, time, numpy as np, torch
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(H, "..", "src")); sys.path.insert(0, os.path.join(H, "..", "kernel"))
sys.path.insert(0, os.path.join(H, ".."))
from artifacts import save_json, save_npz, valid_npz
import value_policy as vp
from value_policy import load_value, greedy, legal_pairs, pruned_backup
from actor import Actor
from train_g1 import load_board
from dk import Kernel, mix

ap = argparse.ArgumentParser()
ap.add_argument("--value", required=True); ap.add_argument("--k1", type=int, required=True, help="index of the new value (k+1)")
ap.add_argument("--seed_base", type=int, required=True); ap.add_argument("--games", type=int, default=10000)
ap.add_argument("--parents", type=int, default=200000); ap.add_argument("--per", type=int, default=8); ap.add_argument("--rng", type=int, default=20261013)
ap.add_argument("--envs", type=int, default=2000)
ap.add_argument("--prec", default="tf32"); ap.add_argument("--no_mix", action="store_true"); ap.add_argument("--mix_frac", type=float, default=0.5, help="share of stale V0 (V2) rows in the final training set"); ap.add_argument("--prune_actor", default=None)
a = ap.parse_args(); vp.PREC = a.prec; dev = "cuda"; t0 = time.time(); ROOT = os.path.join(H, ".."); OUT = os.path.join(ROOT, "data", f"v{a.k1}"); os.makedirs(OUT, exist_ok=True)
K = Kernel(threads=10); board = load_board(); board.to(dev); V = load_value(a.value, board, dev); rng = np.random.default_rng(a.rng)

STAGE = os.path.join(OUT, "stage_children.npz"); PART = os.path.join(OUT, "stage_targets.npz")
reuse_children = valid_npz(STAGE, {"X", "scores", "par_n"})
if reuse_children:   # resume: self-play + children already done (same seeds -> identical data)
    with np.load(STAGE) as z0: X = z0["X"]; scores = [z0["scores"]]; par_n = int(z0["par_n"])
    print(f"resumed stage: {len(X)} children", flush=True)
else:
    X = None
# 1. self-play
states, scores = ([], []) if X is None else ([], scores)
for g0 in (range(0, a.games, a.envs) if X is None else []):
    n = min(a.envs, a.games - g0); K.reset(mix(a.seed_base + g0 + np.arange(n)), mode=1)
    while True:
        o = K.obs(); live = np.where(o[:, 5] == 0)[0]
        if len(live) == 0: break
        raw = K.raw(); states.append(raw[live]); act = np.zeros(n, np.int32)
        act[live], _, _ = greedy(K, V, board, raw[live], dev); K.step(act)
    scores.append(K.obs()[:, 0]); print(f"self-play {g0 + n}/{a.games} mean {np.concatenate(scores).mean():.1f} {time.time() - t0:.0f}s", flush=True)
if X is None:
    S = np.concatenate(states); S[:, 10] = 0
    # 2-3. parents and sampled children
    par = S[np.sort(rng.choice(len(S), min(a.parents, len(S)), replace=False))]; pi, cl = legal_pairs(K, par); rows = []
    par_n = len(par)
else:
    pi = []
for s in range(0, len(pi), 200000):
    R = par[pi[s:s + 200000]]; off, craw, prob = K.children(R, cl[s:s + 200000])
    Cs = np.cumsum(prob); base = np.r_[0.0, Cs][off[:-1]]
    u = base[:, None] + rng.random((len(R), a.per)) * (Cs[off[1:] - 1] - base)[:, None]
    j = np.minimum(np.searchsorted(Cs, u, side="right"), (off[1:] - 1)[:, None]).reshape(-1); rows.append(craw[j])
if X is None:
    X = np.concatenate(rows); X = X[X[:, 10] == 0]; print(f"children {len(X)} {time.time() - t0:.0f}s", flush=True)
    save_npz(STAGE, X=X, scores=np.concatenate(scores), par_n=par_n)

# 4. targets: 1-step backup of V_theta_k (checkpointed every 25 chunks; rerun resumes)
y = np.zeros(len(X)); start = 0
if reuse_children and valid_npz(PART, {"y", "done"}):
    with np.load(PART) as zp: start = int(zp["done"]); y[:start] = zp["y"][:start]   # close the file: Windows blocks os.replace on open files
    print(f"resumed targets at {start}", flush=True)
ACT = None
if a.prune_actor:
    ACT = Actor(board, d=256, layers=6, heads=8).to(dev); ACT.load_state_dict(torch.load(os.path.join(ROOT, a.prune_actor), map_location=dev)); ACT.eval()
for s in range(start, len(X), 20000):
    if ACT is None: _, y[s:s + 20000], _ = greedy(K, V, board, X[s:s + 20000], dev)
    else: y[s:s + 20000] = pruned_backup(K, V, board, X[s:s + 20000], dev, ACT)
    if (s // 20000) % 25 == 0:
        save_npz(PART, y=y, done=min(s + 20000, len(X)))
        print(f"targets {s + 20000}/{len(X)} {time.time() - t0:.0f}s", flush=True)

# 5. mix V0 rows (coverage of the teacher distribution)
if a.no_mix:
    save_npz(os.path.join(OUT, "train.npz"), raw=X, y=y.astype(np.float32))
else:
    nmix = int(round(len(X) * a.mix_frac / (1 - a.mix_frac)))
    z = np.load(os.path.join(ROOT, "data", "v0", "train.npz")); m = np.random.default_rng(a.rng + 1).choice(len(z["y"]), nmix, replace=False)  # own rng: same subset after resume
    save_npz(os.path.join(OUT, "train.npz"), raw=np.concatenate([X, z["raw"][m]]), y=np.concatenate([y.astype(np.float32), z["y"][m]]))
save_json(os.path.join(OUT, "meta.json"), dict(value_in=a.value, seed_base=a.seed_base, games=a.games, selfplay_mean=float(np.concatenate(scores).mean()), parents=int(par_n),
               new_rows=int(len(X)), mixed_v0_rows=0 if a.no_mix else int(round(len(X) * a.mix_frac / (1 - a.mix_frac))), pruned=bool(a.prune_actor), seconds=time.time() - t0))
print("done", f"{time.time() - t0:.0f}s")
