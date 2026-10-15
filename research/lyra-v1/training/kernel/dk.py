"""ctypes wrapper for dk.dll (deck_actor_20261011 shared kernel)."""
import ctypes as C, os, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("LYRA_TEACHER_MODEL", "")
TREC = np.dtype([("game", "<u4"), ("step", "<u2"), ("p", "<u2"), ("t", "u1"), ("b", "u1"), ("n", "u1"), ("flags", "u1"),
                 ("h", "u1", 5), ("deck", "<u4"), ("cls", "i1"), ("pad", "u1", 2), ("mask", "<u4"), ("q", "<f4", 23),
                 ("f", "<f4"), ("mu", "<f4")])
assert TREC.itemsize == 128


def mix(x):
    x = np.asarray(x, dtype=np.uint64) & 0xFFFFFFFF
    x ^= x >> 16; x = (x * 0x7FEB352D) & 0xFFFFFFFF
    x ^= x >> 15; x = (x * 0x846CA68B) & 0xFFFFFFFF
    x ^= x >> 16
    return x.astype(np.uint32)


def _p(a, t):
    return a.ctypes.data_as(C.POINTER(t))


class Kernel:
    def __init__(self, threads=10, model=MODEL, dll="dk.dll"):
        if os.name != "nt": dll = "lib" + dll.replace(".dll", ".so")               # Linux build (kernel/build_linux.sh)
        threads = int(os.environ.get("DK_THREADS", threads))                # override for rented machines; unset = unchanged
        self.lib = L = C.CDLL(os.path.join(HERE, dll))
        L.dk_init.argtypes = [C.c_wchar_p, C.c_int]
        L.dk_error.restype = C.c_char_p
        for name in ("dk_env_step", "dk_env_teacher", "dk_teacher_games", "dk_label_states", "dk_env_bad"):
            getattr(L, name).restype = C.c_longlong
        L.dk_teacher_games.argtypes = [C.c_uint32, C.c_int, C.c_int, C.c_wchar_p, C.POINTER(C.c_double), C.c_int]
        if L.dk_init(model, threads) != 0:
            raise RuntimeError(L.dk_error().decode())
        self.threads = threads
        idmap = np.zeros(31, np.int32); ct, cv, cap, rep = (np.zeros(23, np.int32) for _ in range(4))
        L.dk_classes(_p(idmap, C.c_int32), _p(ct, C.c_int32), _p(cv, C.c_int32), _p(cap, C.c_int32), _p(rep, C.c_int32))
        self.idmap, self.ctype, self.cval, self.cap, self.rep = idmap, ct, cv, cap, rep
        sz = np.zeros(4, np.int32); L.dk_table_sizes(_p(sz, C.c_int32))
        self.N = int(sz[0]); self.LAND, self.ROLL, self.NEXT = (np.zeros(int(k), np.int32) for k in sz[1:])
        L.dk_tables(_p(self.LAND, C.c_int32), _p(self.ROLL, C.c_int32), _p(self.NEXT, C.c_int32))
        self.n = 0

    def _chk(self, r):
        if r < 0:
            raise RuntimeError(self.lib.dk_error().decode())
        return r

    # ---- batched env ----
    def reset(self, seeds, mode=1):
        seeds = np.ascontiguousarray(seeds, np.uint32); self.n = len(seeds)
        self.lib.dk_env_reset(self.n, _p(seeds, C.c_uint32), mode)

    def obs(self):
        o = np.zeros((self.n, 50), np.int32); self.lib.dk_env_obs(_p(o, C.c_int32)); return o

    def raw(self):
        o = np.zeros((self.n, 11), np.int32); self.lib.dk_env_raw(_p(o, C.c_int32)); return o

    def step(self, cls):
        cls = np.ascontiguousarray(cls, np.int32)
        fb, mu = np.zeros(self.n), np.zeros(self.n); done, score = np.zeros(self.n, np.int32), np.zeros(self.n, np.int32)
        ill = self._chk(self.lib.dk_env_step(_p(cls, C.c_int32), _p(fb, C.c_double), _p(mu, C.c_double), _p(done, C.c_int32), _p(score, C.c_int32)))
        if ill:
            raise RuntimeError(f"{ill} illegal actions")
        return fb, mu, done, score

    def summary(self):
        o = np.zeros((self.n, 4)); self.lib.dk_env_summary(_p(o, C.c_double)); return o  # w0, sumd, mart, steps

    def bad(self):
        return self.lib.dk_env_bad()

    def teacher(self):
        cls = np.zeros(self.n, np.int32); q = np.zeros((self.n, 23), np.float32); mask = np.zeros(self.n, np.uint32)
        bad = self._chk(self.lib.dk_env_teacher(_p(cls, C.c_int32), _p(q, C.c_float), _p(mask, C.c_uint32)))
        return cls, q, mask, bad

    def label_states(self, raw):
        raw = np.ascontiguousarray(raw, np.int32); n = len(raw)
        cls = np.zeros(n, np.int32); q = np.zeros((n, 23), np.float32); mask = np.zeros(n, np.uint32)
        bad = self._chk(self.lib.dk_label_states(n, _p(raw, C.c_int32), _p(cls, C.c_int32), _p(q, C.c_float), _p(mask, C.c_uint32)))
        return cls, q, mask, bad

    # ---- full Hinge games ----
    def teacher_games(self, seed_base, n, mode=1, recpath=None, chunk=2000):
        g = np.zeros((n, 6))
        bad = self._chk(self.lib.dk_teacher_games(seed_base, n, mode, recpath, _p(g, C.c_double), chunk))
        return g, bad  # cols: seed, score, steps, w0, sumd, mart


def _children(self, raw, cls):
    """-> off (n+1,), child raw (m,11), prob (m,) for class actions on raw states."""
    raw = np.ascontiguousarray(raw, np.int32); cls = np.ascontiguousarray(cls, np.int32); n = len(raw)
    self.lib.dk_children.restype = C.c_longlong
    cap = n * 64
    while True:
        off = np.zeros(n + 1, np.int32); craw = np.zeros((cap, 11), np.int32); prob = np.zeros(cap)
        k = self.lib.dk_children(n, _p(raw, C.c_int32), _p(cls, C.c_int32), _p(off, C.c_int32), _p(craw, C.c_int32), _p(prob, C.c_double), C.c_longlong(cap))
        if k == -(2**63): raise RuntimeError(self.lib.dk_error().decode())
        if k >= 0: return off, craw[:k], prob[:k]
        cap = -k


def _leaf(self, raw):
    raw = np.ascontiguousarray(raw, np.int32); out = np.zeros(len(raw)); self.lib.dk_leaf(len(raw), _p(raw, C.c_int32), _p(out, C.c_double)); return out


Kernel.children = _children
Kernel.leaf = _leaf


def _v2(self, raw):
    raw = np.ascontiguousarray(raw, np.int32); out = np.zeros(len(raw))
    self.lib.dk_v2.restype = C.c_longlong
    if self.lib.dk_v2(len(raw), _p(raw, C.c_int32), _p(out, C.c_double)) < 0: raise RuntimeError(self.lib.dk_error().decode())
    return out


Kernel.v2 = _v2
