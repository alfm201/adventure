"""DAgger x1 (DESIGN G1): play the G1 actor (argmax) on 5,000 games (seeds mix(964e6+i)), label every visited state with
Hinge 2-step Q2 (DESIGN §5 rules, dk_label_states), write TRec rows to data/dagger/dagger.trec (game ids 0..4999)."""
import os, sys, time, json, numpy as np, torch
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(H, "..", "src")); sys.path.insert(0, os.path.join(H, "..", "kernel"))
sys.path.insert(0, os.path.join(H, ".."))
from artifacts import atomic_path, save_json
from actor import Actor, obs_to_tensors
from train_g1 import load_board
from dk import Kernel, mix, TREC

model_path = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
out = os.path.join(H, "..", "data", "dagger"); os.makedirs(out, exist_ok=True); dev = "cuda"; t0 = time.time()
K = Kernel(threads=10); board = load_board().to(dev)
model = Actor(board).to(dev); model.load_state_dict(torch.load(model_path, map_location=dev)); model.eval()
K.reset(mix(964000000 + np.arange(n)), mode=1); raws, games, steps = [], [], []; step = 0
with torch.no_grad():
    while True:
        o = K.obs(); live = o[:, 5] == 0
        if not live.any(): break
        r = K.raw(); idx = np.where(live)[0]; raws.append(r[idx]); games.append(idx); steps.append(np.full(len(idx), step))
        with torch.autocast("cuda", torch.bfloat16):
            a = model(*obs_to_tensors(o, dev)).float().argmax(1).int().cpu().numpy()
        a[~live] = 0; K.step(a); step += 1
score = K.obs()[:, 0]; raw = np.concatenate(raws); gid = np.concatenate(games); st = np.concatenate(steps)
cls, q, mask, bad = K.label_states(raw)
rec = np.zeros(len(raw), TREC)
rec["game"] = gid; rec["step"] = st; rec["p"] = raw[:, 0]; rec["t"] = raw[:, 1]; rec["b"] = raw[:, 2]; rec["n"] = raw[:, 3]
rec["flags"] = (raw[:, 3] == 0); rec["h"] = raw[:, 4:9]; rec["deck"] = raw[:, 9].astype(np.uint32); rec["cls"] = cls; rec["mask"] = mask; rec["q"] = q
if bad: raise RuntimeError(f"Teacher label violations: {bad}")
with atomic_path(os.path.join(out, "dagger.trec")) as temporary: rec.tofile(temporary)
meta = dict(games=n, seed_base=964000000, model=model_path, rows=len(rec), label_violations=int(bad), actor_mean_score=float(score.mean()), seconds=time.time() - t0)
save_json(os.path.join(out, "meta.json"), meta); print(meta)
