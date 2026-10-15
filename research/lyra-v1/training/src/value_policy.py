"""Value policy: pi(s) = argmax_a sum_s' P(s'|s,a) V(s') with exact class-merged transitions (dk_children); terminal
children = p. V = ValueNet (fp32) or an exact kernel value ('v2' / 'leaf'). Training self-play and Bellman target helpers; no evaluation runner."""
import argparse, json, os, sys, time, numpy as np, torch
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H); sys.path.insert(0, os.path.join(H, "..", "kernel"))
from actor import ValueNet
from train_g1 import load_board
from train_v0 import raw_features, tensors, batch
from dk import Kernel, mix
torch.backends.cuda.matmul.allow_tf32 = False; torch.backends.cudnn.allow_tf32 = False


PREC = "fp32"   # module-level precision for ValueNet inference: fp32 | tf32 | bf16


@torch.no_grad()
def value_of(V, K, board, raw, dev, bs=int(os.environ.get("VP_BS", 8192))):   # VP_BS: larger batches on big rented GPUs
    if V == "v2": return K.v2(raw)
    if V == "leaf": return K.leaf(raw)
    torch.backends.cuda.matmul.allow_tf32 = PREC == "tf32"; torch.backends.cudnn.allow_tf32 = PREC == "tf32"
    D = raw_features(board, raw); T = tensors(D, dev); out = np.zeros(len(raw))
    for i in range(0, len(raw), bs):
        j = torch.arange(i, min(i + bs, len(raw)), device=dev); out[i:i + bs] = V(*batch(T, j), prec="bf16" if PREC == "bf16" else "fp32").double().cpu().numpy()
    return np.where(raw[:, 10] == 1, raw[:, 0], out)


def legal_pairs(K, raw):
    pi, cl = [], []
    for i in range(len(raw)):
        cs = {0} | {int(K.idmap[raw[i, 4 + j]]) for j in range(raw[i, 3])}
        for c in sorted(cs): pi.append(i); cl.append(c)
    return np.array(pi, np.int64), np.array(cl, np.int32)


def greedy(K, V, board, raw, dev):
    """Greedy class per state and its Q, plus all (state, class, Q) pairs."""
    pi, cl = legal_pairs(K, raw); off, craw, prob = K.children(raw[pi], cl)
    q = np.add.reduceat(prob * value_of(V, K, board, craw, dev), off[:-1])
    order = np.lexsort((-q, pi)); first = order[np.r_[True, pi[order][1:] != pi[order][:-1]]]
    act = np.zeros(len(raw), np.int32); act[pi[first]] = cl[first]; vmax = np.zeros(len(raw)); vmax[pi[first]] = q[first]
    return act, vmax, (pi, cl, q)


def load_value(path, board, dev, d=256, layers=6, heads=8):
    m = ValueNet(board, d=d, layers=layers, heads=heads).to(dev)
    sd = torch.load(path, map_location=dev, weights_only=False); m.load_state_dict(sd["model"] if "model" in sd else sd); m.eval(); return m


@torch.no_grad()
def pruned_backup(K, V, board, raw, dev, actor, topk=2):
    """Targets max_a sum P V(s') with a restricted to the actor's top-k legal classes (VI2_PROTOCOL). Terminal rows -> p."""
    T = tensors(raw_features(board, raw), dev)
    lg = torch.cat([actor(*batch(T, torch.arange(i, min(i + 8192, len(raw)), device=dev))).float() for i in range(0, len(raw), 8192)]).cpu().numpy()
    top = np.argsort(-lg, 1)[:, :topk]
    pi, cl = legal_pairs(K, raw); keep = np.zeros(len(pi), bool)
    for j in range(topk): keep |= cl == top[pi, j]
    pi, cl = pi[keep], cl[keep]
    off, craw, prob = K.children(raw[pi], cl); q = np.add.reduceat(prob * value_of(V, K, board, craw, dev), off[:-1])
    out = np.full(len(raw), -1e300); np.maximum.at(out, pi, q)
    return np.where(raw[:, 10] == 1, raw[:, 0], out)
