#!/usr/bin/env bash
# 배포용 모델 파일 만들기. 잔차 가중치(m2.bin.npz) → 작은 파일(.m2s) → Hinge와 합친 모델(vela-v5.bin).
# 사용: bash research/vela-v5/training/export.sh [가중치.npz]
#   인자를 주지 않으면 이 폴더의 m2.bin.npz(배포한 가중치)를 쓴다.
#   배포 파일은 이 폴더의 m2.m2s로 만든다. 방금 만든 work/m2.m2s는 그것과 같은지 견주어 보는 용도다.
set -eu
cd "$(dirname "$0")"
ROOT=../../..
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
mkdir -p finalrun/base work
[ -f finalrun/base/hinge_k256_e1.bin ] || gzip -dc "$ROOT/public/models/vela-v4.2/model.bin.gz" > finalrun/base/hinge_k256_e1.bin
python export/make_m2s.py finalrun/base/hinge_k256_e1.bin "${1:-m2.bin.npz}" work/m2.m2s
cmp work/m2.m2s m2.m2s && echo "work/m2.m2s = m2.m2s" || echo "work/m2.m2s differs from m2.m2s (끝자리 차이일 수 있다. 배포에는 m2.m2s를 쓴다)"
python export/pack_model.py finalrun/base/hinge_k256_e1.bin m2.m2s work/vela-v5.bin
echo "다음: python scripts/vela/delivery.py --pack research/vela-v5/training/work/vela-v5.bin  (저장소 루트에서)"
