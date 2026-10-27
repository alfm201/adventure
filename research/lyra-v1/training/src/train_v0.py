"""V0: fit ValueNet to exact V2 targets (V0_PROTOCOL.md). fp32 (LYRA v1) or --amp fp16 (LYRA v2), resume/PAUSE supported."""
import argparse, json, math, os, sys, time, numpy as np, torch
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H); sys.path.insert(0, os.path.join(H, "..", "kernel"))
sys.path.insert(0, os.path.join(H, ".."))
from artifacts import save_json, save_npz, save_torch, valid_npz
from actor import ValueNet, counts_from_raw
from train_g1 import load_board
ROOT = os.path.join(H, "..")
torch.backends.cuda.matmul.allow_tf32 = False; torch.backends.cudnn.allow_tf32 = False


def raw_features(board, raw, chunk=2000000):
    hc = np.zeros((len(raw), 22), np.uint8); dc = np.zeros((len(raw), 22), np.uint8)
    for i in range(0, len(raw), chunk):
        r = raw[i:i + chunk]; hc[i:i + chunk], dc[i:i + chunk] = counts_from_raw(board, r[:, 4:9].astype(np.uint8), r[:, 3].astype(np.int64), r[:, 9].view(np.uint32))
    return dict(p=raw[:, 0].astype(np.int16), r=(100 - raw[:, 1]).clip(0, 100).astype(np.uint8), b=raw[:, 2].astype(np.uint8), n=raw[:, 3].astype(np.uint8), hc=hc, dc=dc)


def tensors(D, dev):
    """Keep compact dtypes on the GPU (25M+ rows); widen per batch."""
    return {k: torch.as_tensor(v, device=dev) for k, v in D.items()}


def batch(T, j):
    return (T["p"][j].long(), T["r"][j].long(), T["b"][j].long(), T["n"][j].long(), T["hc"][j].float(), T["dc"][j].float())


@torch.no_grad()
def predict(model, T, idx, bs=4096):
    model.eval(); out = torch.cat([model(*batch(T, idx[i:i + bs])) for i in range(0, len(idx), bs)]); model.train()
    torch.cuda.empty_cache(); return out   # release eval activations (VRAM saturation slows training ~4x)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=float, default=2); ap.add_argument("--bs", type=int, default=2048); ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--wd", type=float, default=0.01); ap.add_argument("--d", type=int, default=256); ap.add_argument("--layers", type=int, default=6); ap.add_argument("--heads", type=int, default=8)
    ap.add_argument("--seed", type=int, default=1); ap.add_argument("--data", default=os.path.join(ROOT, "data", "v0", "train.npz"))
    ap.add_argument("--out", required=True); ap.add_argument("--resume", action="store_true"); ap.add_argument("--init", default=None, help="start from these weights (skips g init)")
    ap.add_argument("--amp", default="fp32", choices=["fp32", "fp16"], help="fp16: encoder autocast + GradScaler, head/base fp32 (LYRA v2)")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True); torch.manual_seed(a.seed); dev = "cuda"; t0 = time.time()
    ckpt = os.path.join(a.out, "ckpt.pt"); pause = os.path.join(a.out, "PAUSE")
    if a.resume and os.path.exists(pause): os.remove(pause)
    board = load_board(); cache = a.data + ".feat.npz"
    if valid_npz(cache, {"p", "r", "b", "n", "hc", "dc", "y"}, source=a.data):
        with np.load(cache) as z: D = {k: z[k] for k in z.files}
    else:
        with np.load(a.data) as z: D = raw_features(board, z["raw"]); D["y"] = z["y"]
        save_npz(cache, **D)
    board.to(dev); T = tensors(D, dev); N = len(D["y"])
    g = torch.Generator(device=dev); g.manual_seed(a.seed); allp = torch.randperm(N, device=dev, generator=g)
    va = allp[:N // 100].clone(); tr = allp[N // 100:].clone()
    model = ValueNet(board, d=a.d, layers=a.layers, heads=a.heads).to(dev)
    if a.init and not a.resume:
        sd = torch.load(a.init, map_location=dev, weights_only=False); model.load_state_dict(sd["model"] if "model" in sd else sd)
    with torch.no_grad():  # init g(r,b) to the mean of (V2 - p) per (r,b) (fresh start only)
        key = (T["r"].long() * 2 + T["b"].long()); diff = T["y"] - T["p"].float()
        s = torch.zeros(202, device=dev).index_add_(0, key, diff); c = torch.zeros(202, device=dev).index_add_(0, key, torch.ones_like(diff))
        if not a.init: model.g.weight[:, 0] = torch.where(c > 0, s / c.clamp_min(1), 0)
        del key, diff, s, c
    del allp; torch.cuda.empty_cache()
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=a.wd); scaler = torch.amp.GradScaler("cuda", enabled=a.amp == "fp16")
    steps = int(math.ceil(len(tr) / a.bs * a.epochs)); warm = min(1000, steps // 10)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1, s / steps))))
    gen = torch.Generator(device=dev); gen.manual_seed(a.seed + 1); step = pos = 0; el0 = 0.0
    if a.resume:
        ck = torch.load(ckpt, map_location=dev, weights_only=False); model.load_state_dict(ck["model"]); opt.load_state_dict(ck["opt"]); sched.load_state_dict(ck["sched"])
        step, pos, el0 = ck["step"], ck["pos"], ck["elapsed"]; gen.set_state(ck["perm_gen_state"].cpu())
        if "scaler" in ck: scaler.load_state_dict(ck["scaler"])
    pgs = gen.get_state().clone(); perm = tr[torch.randperm(len(tr), device=dev, generator=gen)]
    log = open(os.path.join(a.out, "log.jsonl"), "a" if a.resume else "w")
    print(f"rows train={len(tr)} val={len(va)} steps={steps} y_sd={T['y'][va].std().item():.2f}", flush=True)

    def save():
        save_torch(ckpt, dict(model=model.state_dict(), opt=opt.state_dict(), sched=sched.state_dict(), step=step, pos=pos, perm_gen_state=pgs, elapsed=el0 + time.time() - t0, args=vars(a), scaler=scaler.state_dict()))

    ev = max(1, steps // 10)
    while step < steps:
        if pos + a.bs > len(perm): pgs = gen.get_state().clone(); perm = tr[torch.randperm(len(tr), device=dev, generator=gen)]; pos = 0
        j = perm[pos:pos + a.bs]; pos += a.bs
        if a.amp == "fp16":
            loss = (((model(*batch(T, j), prec="fp16") - T["y"][j]) / 30) ** 2).mean()
            opt.zero_grad(set_to_none=True); scaler.scale(loss).backward(); scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); scaler.step(opt); scaler.update()
        else:
            loss = (((model(*batch(T, j)) - T["y"][j]) / 30) ** 2).mean()
            opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
        sched.step(); step += 1
        if step % ev == 0 or step == steps:
            pr = predict(model, T, va); err = (pr - T["y"][va]); m = dict(step=step, epoch=step * a.bs / len(tr), val_rmse=err.pow(2).mean().sqrt().item(), val_mae=err.abs().mean().item(), sec=el0 + time.time() - t0)
            log.write(json.dumps(m) + "\n"); log.flush(); print(m, flush=True); save()
        elif step % 500 == 0: save()
        if step < steps and step % 50 == 0 and os.path.exists(pause): save(); print("PAUSED", flush=True); sys.exit(3)
    save_torch(os.path.join(a.out, "model.pt"), model.state_dict()); save_json(os.path.join(a.out, "config.json"), vars(a))


if __name__ == "__main__":
    main()
