"""G1 imitation: Actor <- Hinge+2-step soft targets softmax(qrel/T) over evaluated classes (DESIGN §5, §6 G1).

Holdout = games >= holdout_from (by game). Metrics: argmax agreement, teacher regret of the actor's argmax
(-qrel[pred], points) per decision and summed per holdout game (a decision-level proxy, not a game result).
"""
import argparse, json, math, os, sys, time, numpy as np, torch
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H); sys.path.insert(0, os.path.join(H, "..", "kernel"))
sys.path.insert(0, os.path.join(H, ".."))
from artifacts import save_json, save_npz, save_torch, valid_npz
from actor import Actor, Board, counts_from_raw
from dk import TREC

ROOT = os.path.join(H, "..")


def load_board():
    z = np.load(os.path.join(ROOT, "..", "board.npz"))
    return Board(int(z["N"]), z["LAND"], z["ROLL"], z["NEXT"], z["ctype"], z["cval"], z["cap"], z["idmap"])


def load_records(paths, board, dev, max_game=None):
    """TRec files -> dict of GPU tensors (non-empty hands only)."""
    cache = paths[0] + ".proc.npz" if len(paths) == 1 else None
    if cache and valid_npz(cache, {"p", "r", "b", "n", "hc", "dc", "q", "cls", "game"}, source=paths[0]) and max_game is None:
        with np.load(cache) as z: D = {k: z[k] for k in z.files}
        T = {k: torch.as_tensor(v, device=dev) for k, v in D.items()}
        for k in ("p", "r", "b", "n", "cls", "game"): T[k] = T[k].long()
        return T
    parts = []
    for path in paths:
        a = np.fromfile(path, dtype=TREC)
        a = a[a["n"] > 0]
        if max_game is not None: a = a[a["game"] < max_game]
        parts.append(a)
    a = np.concatenate(parts)
    hc, dc = counts_from_raw(board, a["h"], a["n"].astype(np.int64), a["deck"])
    q = a["q"].astype(np.float32)
    D = dict(p=a["p"].astype(np.int64), r=(100 - a["t"].astype(np.int64)).clip(0, 100), b=a["b"].astype(np.int64),
             n=a["n"].astype(np.int64), hc=hc, dc=dc, q=q, cls=a["cls"].astype(np.int64), game=a["game"].astype(np.int64))
    if cache and max_game is None:
        save_npz(cache, p=D["p"].astype(np.int16), r=D["r"].astype(np.uint8), b=D["b"].astype(np.uint8), n=D["n"].astype(np.uint8),
                 hc=hc, dc=dc, q=q, cls=D["cls"].astype(np.int8), game=D["game"].astype(np.int32))
    T = {k: torch.as_tensor(v, device=dev) for k, v in D.items()}
    T["hc"], T["dc"] = T["hc"].to(torch.uint8), T["dc"].to(torch.uint8)
    return T


def batch(T, idx):
    return (T["p"][idx], T["r"][idx], T["b"][idx], T["n"][idx], T["hc"][idx].float(), T["dc"][idx].float())


def soft_ce(logits, q, temp):
    tq = torch.nan_to_num(q / temp, nan=float("-inf"))
    tgt = torch.softmax(tq, 1); logp = torch.log_softmax(logits.float(), 1)
    return -torch.where(tgt > 0, tgt * logp, torch.zeros_like(tgt)).sum(1).mean()


@torch.no_grad()
def evaluate(model, T, idx, bs=16384):
    model.eval(); agree = reg = ent = kl = 0.0; n = 0
    for i in range(0, len(idx), bs):
        j = idx[i:i + bs]
        with torch.autocast("cuda", torch.bfloat16):
            lg = model(*batch(T, j)).float()
        pred = lg.argmax(1); q = T["q"][j]
        agree += (pred == T["cls"][j]).sum().item()
        reg += (-q.gather(1, pred[:, None]).squeeze(1)).sum().item()
        lp = torch.log_softmax(lg, 1); pr = lp.exp()
        ent += (-torch.where(pr > 0, pr * lp, torch.zeros_like(pr)).sum(1)).sum().item()
        tgt = torch.softmax(torch.nan_to_num(q, nan=float("-inf")), 1)  # T=1 reference for KL reporting
        kl += torch.where(tgt > 0, tgt * (torch.log(tgt.clamp_min(1e-30)) - lp), torch.zeros_like(tgt)).sum(1).sum().item()
        n += len(j)
    model.train(); return dict(agree=agree / n, regret_per_dec=reg / n, regret_sum=reg, entropy=ent / n, kl_T1=kl / n, n=n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", nargs="+", default=[os.path.join(ROOT, "data", "g1_teacher", "teacher.trec")])
    ap.add_argument("--temp", type=float, default=1.0); ap.add_argument("--epochs", type=float, default=4)
    ap.add_argument("--bs", type=int, default=4096); ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--wd", type=float, default=0.01); ap.add_argument("--nodeck", action="store_true")
    ap.add_argument("--holdout_from", type=int, default=95000); ap.add_argument("--train_games", type=int, default=None)
    ap.add_argument("--max_game", type=int, default=None); ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--init", default=None); ap.add_argument("--out", required=True)
    ap.add_argument("--d", type=int, default=128); ap.add_argument("--layers", type=int, default=3); ap.add_argument("--heads", type=int, default=4)
    ap.add_argument("--resume", action="store_true", help="continue from <out>/ckpt.pt")
    ap.add_argument("--ckpt_every", type=int, default=500, help="also checkpoint every N steps (plus every eval)")
    ap.add_argument("--stop_at_step", type=int, default=None, help="test hook: behave as if PAUSE appeared at this step")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    torch.manual_seed(a.seed); dev = "cuda"; t0 = time.time()
    ckpt_path = os.path.join(a.out, "ckpt.pt"); pause_path = os.path.join(a.out, "PAUSE")
    if a.resume and os.path.exists(pause_path): os.remove(pause_path)  # a stale PAUSE would stop the job again immediately
    board = load_board().to(dev); T = load_records(a.data, board, dev, a.max_game)
    g = T["game"]; tr = torch.where(g < (a.train_games or a.holdout_from))[0]; ho = torch.where(g >= a.holdout_from)[0]
    ho_games = int(torch.unique(g[ho]).numel())
    model = Actor(board, d=a.d, layers=a.layers, heads=a.heads, nodeck=a.nodeck).to(dev)
    if a.init and not a.resume: model.load_state_dict(torch.load(a.init, map_location=dev))
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=a.wd)
    steps = int(math.ceil(len(tr) / a.bs * a.epochs)); warm = min(1000, steps // 10)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1, s / steps))))
    gen = torch.Generator(device=dev); gen.manual_seed(a.seed)
    step = 0; pos = 0; elapsed0 = 0.0; ev_every = max(1, steps // 8); m = None
    if a.resume:
        ck = torch.load(ckpt_path, map_location=dev, weights_only=False)
        same = {k: ck["args"][k] for k in ("data", "temp", "epochs", "bs", "lr", "wd", "nodeck", "holdout_from", "train_games", "max_game", "seed", "d", "layers", "heads")}
        if same != {k: getattr(a, k) for k in same}: raise SystemExit(f"resume config mismatch: {same}")
        model.load_state_dict(ck["model"]); opt.load_state_dict(ck["opt"]); sched.load_state_dict(ck["sched"])
        step, pos, elapsed0, m = ck["step"], ck["pos"], ck["elapsed"], ck.get("m")
        gen.set_state(ck["perm_gen_state"].to(gen.get_state().device) if hasattr(ck["perm_gen_state"], "to") else ck["perm_gen_state"])
    perm_gen_state = gen.get_state().clone(); perm = tr[torch.randperm(len(tr), device=dev, generator=gen)]
    log = open(os.path.join(a.out, "train_log.jsonl"), "a" if a.resume else "w")
    print(f"rows train={len(tr)} holdout={len(ho)} ({ho_games} games) steps={steps} params={sum(p.numel() for p in model.parameters())} load={time.time()-t0:.0f}s"
          + (f" RESUMED at step {step}" if a.resume else ""), flush=True)

    def save_ckpt():
        save_torch(ckpt_path, dict(model=model.state_dict(), opt=opt.state_dict(), sched=sched.state_dict(), step=step, pos=pos, m=m,
                        perm_gen_state=perm_gen_state, elapsed=elapsed0 + time.time() - t0, args=vars(a)))

    while step < steps:
        if pos + a.bs > len(perm):
            perm_gen_state = gen.get_state().clone(); perm = tr[torch.randperm(len(tr), device=dev, generator=gen)]; pos = 0
        j = perm[pos:pos + a.bs]; pos += a.bs
        with torch.autocast("cuda", torch.bfloat16):
            lg = model(*batch(T, j))
        loss = soft_ce(lg, T["q"][j], a.temp)
        opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step(); step += 1
        if step % ev_every == 0 or step == steps:
            m = evaluate(model, T, ho); m.update(step=step, epoch=step * a.bs / len(tr), loss=loss.item(), sec=elapsed0 + time.time() - t0, regret_per_game=m["regret_sum"] / ho_games)
            log.write(json.dumps(m) + "\n"); log.flush()
            print(f"step {step}/{steps} ep {m['epoch']:.2f} loss {loss.item():.4f} agree {m['agree']:.4f} regret/dec {m['regret_per_dec']:.4f} regret/game {m['regret_per_game']:.2f} H {m['entropy']:.3f} {m['sec']:.0f}s", flush=True)
            save_ckpt()
        elif step % a.ckpt_every == 0:
            save_ckpt()
        if step < steps and (step == a.stop_at_step or (step % 50 == 0 and os.path.exists(pause_path))):
            save_ckpt(); print(f"PAUSED at step {step} (checkpoint saved; rerun with --resume)", flush=True); sys.exit(3)
    save_torch(os.path.join(a.out, "model.pt"), model.state_dict())
    save_json(os.path.join(a.out, "config.json"), dict(vars(a), final=m))


if __name__ == "__main__":
    main()
