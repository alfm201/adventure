"""VELA v5 모델 파일을 만든다. 사용: python export/pack_model.py HINGE.bin RESID.m2s OUT.bin

형식(리틀 엔디언):
  0   char[8]  "VELA5MDL"
  8   uint32   version = 1
  12  uint32   sectionCount = 2
  16  섹션 표: { char[8] name, uint64 offset, uint64 bytes } x sectionCount
  64  "HINGE"    : Hinge 모델(hinge_k256_e1.bin 그대로, v4.2·v4.3 배포 모델과 같은 바이트)
      "RESIDM2S" : 잔차 가중치(.m2s, export/make_m2s.py가 만든 형식)
섹션 시작은 64바이트 경계에 맞추고 사이는 0으로 채운다. 끝에는 채우지 않는다.
--check를 주면 만든 파일을 다시 읽어 두 섹션이 원본과 같은지 확인한다.
"""
import hashlib, struct, sys

ALIGN = 64


def pack(hinge_path, resid_path, out_path):
    hinge = open(hinge_path, "rb").read()
    resid = open(resid_path, "rb").read()
    sections = [(b"HINGE", hinge), (b"RESIDM2S", resid)]
    header = 16 + 24 * len(sections)
    assert header <= ALIGN
    offsets, pos = [], ALIGN
    for _, data in sections:
        offsets.append(pos)
        pos = (pos + len(data) + ALIGN - 1) // ALIGN * ALIGN
    buf = bytearray(offsets[-1] + len(sections[-1][1]))
    buf[0:8] = b"VELA5MDL"
    struct.pack_into("<II", buf, 8, 1, len(sections))
    for k, ((name, data), off) in enumerate(zip(sections, offsets)):
        struct.pack_into("<8sQQ", buf, 16 + 24 * k, name.ljust(8, b"\0"), off, len(data))
        buf[off:off + len(data)] = data
    open(out_path, "wb").write(buf)
    return bytes(buf), sections, offsets


def unpack(raw):
    assert raw[0:8] == b"VELA5MDL"
    version, count = struct.unpack_from("<II", raw, 8)
    assert version == 1
    out = {}
    for k in range(count):
        name, off, size = struct.unpack_from("<8sQQ", raw, 16 + 24 * k)
        out[name.rstrip(b"\0").decode()] = raw[off:off + size]
    return out


if __name__ == "__main__":
    hinge_path, resid_path, out_path = sys.argv[1:4]
    raw, sections, offsets = pack(hinge_path, resid_path, out_path)
    got = unpack(open(out_path, "rb").read())
    for (name, data), off in zip(sections, offsets):
        assert got[name.decode()] == data
        print(f"{name.decode():9s} offset {off:>10d} bytes {len(data):>10d} sha256 {hashlib.sha256(data).hexdigest()}")
    print(f"file      bytes {len(raw)} sha256 {hashlib.sha256(raw).hexdigest()}")
