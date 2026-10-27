"""Deck-aware Actor (DESIGN §3): 1 global token + 23 action tokens (roll + 22 effect classes), attention 3x128x4.

Rule feature tables (exact, from game tables): for each position p and action a, the landing distribution over dice sums
(roll / multiplier cards) or the deterministic landing (move / stage cards), and draw-on-landing flags.
Learned position embedding E_pos is shared by the global token (current p) and the action tokens (probability-weighted
landing positions via EmbeddingBag). nodeck=True removes every deck-derived input (deck class counts, deck size).
"""
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F

WAYS = np.array([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1], np.float64) / 36.0  # dice sum 2..12


class Board:
    """Exact rule tables -> per (p, a): 11 landing slots with weights, draw flags; plus scalar features."""
    def __init__(self, N, LAND, ROLL, NEXT, ctype, cval, cap, idmap):
        P = N + 1
        land = np.zeros((P, 23, 11), np.int64); w = np.zeros((P, 23, 11)); draw = np.zeros((P, 23, 11))
        for p in range(P):
            for a in range(23):
                for k in range(11):
                    sm = k + 2
                    if a == 0: code = ROLL[p * 11 + sm - 2]; wt = WAYS[k]
                    elif ctype[a] == 2: code = LAND[p + cval[a] * sm + 3]; wt = WAYS[k]
                    elif ctype[a] == 1: code = LAND[p + cval[a] + 3]; wt = 1.0 if k == 0 else 0.0
                    else: code = NEXT[p]; wt = 1.0 if k == 0 else 0.0
                    land[p, a, k] = code & 4095; draw[p, a, k] = (code >> 12) & 1; w[p, a, k] = wt
        self.N, self.cap, self.idmap = N, np.asarray(cap), np.asarray(idmap)
        self.land, self.w = land, w
        gain = ((land - np.arange(P)[:, None, None]) * w).sum(-1) / 100.0
        pdraw = (draw * w).sum(-1)
        self.scal = np.stack([gain, pdraw], -1).astype(np.float32)  # (P,23,2)
        # deck bit i (card id i+1) -> class one-hot (30,22)
        self.bit2cls = np.zeros((30, 22), np.float32)
        for i in range(30): self.bit2cls[i, idmap[i + 1] - 1] = 1

    def to(self, dev):
        self.t_land = torch.as_tensor(self.land.reshape(-1, 11), device=dev)
        self.t_w = torch.as_tensor(self.w.reshape(-1, 11), dtype=torch.float32, device=dev)
        self.t_scal = torch.as_tensor(self.scal, device=dev)
        self.t_cap = torch.as_tensor(np.maximum(self.cap[1:], 1), dtype=torch.float32, device=dev)
        return self

    @staticmethod
    def from_kernel(K):
        return Board(K.N, K.LAND, K.ROLL, K.NEXT, K.ctype, K.cval, K.cap, K.idmap)


def counts_from_raw(board, h, n, deck):
    """h (R,5) card ids, n (R,), deck (R,) bitmask -> hand class counts (R,22), deck class counts (R,22) uint8."""
    R = len(n); flat = []
    for j in range(5):
        live = np.where(n > j)[0]; flat.append(live * 22 + board.idmap[h[live, j].astype(np.int64)] - 1)
    hc = np.bincount(np.concatenate(flat), minlength=R * 22).reshape(R, 22).astype(np.uint8)
    bits = ((deck[:, None].astype(np.uint64) >> np.arange(30, dtype=np.uint64)) & 1).astype(np.float32)
    dc = (bits @ board.bit2cls).astype(np.uint8)
    return hc, dc


class Actor(nn.Module):
    def __init__(self, board, d=128, layers=3, heads=4, nodeck=False):
        super().__init__()
        self.board, self.nodeck = board, nodeck
        P = board.N + 1
        self.pos = nn.EmbeddingBag(P, d, mode="sum")
        self.r_emb = nn.Embedding(101, d); self.b_emb = nn.Embedding(2, d); self.act_emb = nn.Embedding(23, d)
        self.g_lin = nn.Linear(1 if nodeck else 2, d)
        self.a_lin = nn.Linear(2 + (3 if nodeck else 4), d)
        enc = nn.TransformerEncoderLayer(d, heads, 4 * d, 0.0, batch_first=True, norm_first=True)
        self.enc = nn.TransformerEncoder(enc, layers, enable_nested_tensor=False)
        self.norm = nn.LayerNorm(d); self.head = nn.Linear(d, 1)

    def forward(self, p, r, b, n, hc, dc):
        """p,r,b,n: (B,) long; hc, dc: (B,22) float counts. Returns masked logits (B,23)."""
        B = p.shape[0]; x = self.encode(p, r, b, n, hc, dc)
        logits = self.head(self.norm(x[:, 1:])).squeeze(-1)
        legal = torch.cat([torch.ones(B, 1, dtype=torch.bool, device=p.device), hc > 0], 1)
        return logits.masked_fill(~legal, float("-inf"))

    def encode(self, p, r, b, n, hc, dc):
        """Token encoder: (B, 24, d) = global token + 23 action tokens after attention."""
        B = p.shape[0]; bd = self.board
        g = F.embedding(p, self.pos.weight) + self.r_emb(r) + self.b_emb(b)
        gx = [n.float()[:, None] / 5]
        if not self.nodeck: gx.append(dc.sum(1, keepdim=True) / 30)
        g = g + self.g_lin(torch.cat(gx, 1))
        idx = (p[:, None] * 23 + torch.arange(23, device=p.device)[None]).reshape(-1)
        land = bd.t_land[idx]; w = bd.t_w[idx]
        a_pos = self.pos(land.reshape(-1), offsets=torch.arange(0, land.numel(), 11, device=p.device),
                         per_sample_weights=w.reshape(-1)).view(B, 23, -1)
        scal = bd.t_scal[p]  # (B,23,2)
        z = torch.zeros(B, 1, device=p.device)
        hcn = torch.cat([z, hc / bd.t_cap], 1); hpos = torch.cat([z, (hc > 0).float()], 1); h5 = torch.cat([z, hc / 5], 1)
        feats = [scal, hcn[..., None], hpos[..., None], h5[..., None]]
        if not self.nodeck: feats.append(torch.cat([z, dc / bd.t_cap], 1)[..., None])
        a = a_pos + self.act_emb.weight[None] + self.a_lin(torch.cat(feats, -1))
        return self.enc(torch.cat([g[:, None], a], 1))


def obs_to_tensors(o, dev):
    """Kernel obs rows (50 int32: p,t,b,n,deckcount,done,hc[22],dc[22]) -> model inputs."""
    t = torch.as_tensor(o, device=dev)
    return (t[:, 0].long(), (100 - t[:, 1]).clamp(0, 100).long(), t[:, 2].long(), t[:, 3].long(),
            t[:, 6:28].float(), t[:, 28:50].float())


class ValueNet(Actor):
    """V_theta(s) = p + g(r,b) + 30*head(global token). Run in fp32 (values ~1800 need sub-point precision)."""
    def __init__(self, board, **kw):
        super().__init__(board, **kw)
        self.vhead = nn.Linear(self.head.in_features, 1); self.g = nn.Embedding(202, 1); nn.init.zeros_(self.g.weight)

    def forward(self, p, r, b, n, hc, dc, prec="fp32"):
        """prec: fp32 | tf32 | bf16 | fp16 (low-precision encoder; the output head and base always in fp32). fp16 is used by LYRA v2."""
        base = p.float() + self.g(r * 2 + b).squeeze(-1)
        if prec in ("bf16", "fp16"):
            with torch.autocast("cuda", torch.bfloat16 if prec == "bf16" else torch.float16):
                x0 = self.encode(p, r, b, n, hc, dc)[:, 0]
            x0 = x0.float()
        else:
            x0 = self.encode(p, r, b, n, hc, dc)[:, 0]
        return base + 30 * self.vhead(self.norm(x0)).squeeze(-1)
