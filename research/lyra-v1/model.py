"""V20 model/board definitions and the existing FP32 browser encoder export.
Extracted from deck_actor_20261011/src/actor.py and the frozen LYRA converter.
"""
import numpy as np
import torch
from torch import nn
import torch.nn.functional as F

WAYS = np.array([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1], np.float64) / 36.0


class Board:
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


class ValueNet(Actor):
    def __init__(self, board, **kw):
        super().__init__(board, **kw)
        self.vhead = nn.Linear(self.head.in_features, 1); self.g = nn.Embedding(202, 1); nn.init.zeros_(self.g.weight)

    def forward(self, p, r, b, n, hc, dc, prec="fp32"):
        """prec: fp32 | tf32 | bf16 (bf16 encoder; the output head and base always in fp32)."""
        base = p.float() + self.g(r * 2 + b).squeeze(-1)
        if prec == "bf16":
            with torch.autocast("cuda", torch.bfloat16):
                x0 = self.encode(p, r, b, n, hc, dc)[:, 0]
            x0 = x0.float()
        else:
            x0 = self.encode(p, r, b, n, hc, dc)[:, 0]
        return base + 30 * self.vhead(self.norm(x0)).squeeze(-1)


class Encoder(nn.Module):
 def __init__(self,V,prune_last=True):
  super().__init__();self.layers=V.enc.layers;self.norm=V.norm;self.head=V.vhead;self.prune_last=prune_last
 def forward(self,tokens,base):
  x=tokens
  for layer in self.layers[:-1]:x=layer(x)
  l=self.layers[-1]
  if self.prune_last:
   y=l.norm1(x)
   x=x[:,:1,:]+l.self_attn(y[:,:1,:],y,y,need_weights=False)[0]
   x=x+l._ff_block(l.norm2(x))
  else:x=l(x)
  return base+30*self.head(self.norm(x[:,0,:])).squeeze(-1)
