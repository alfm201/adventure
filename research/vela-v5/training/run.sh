#!/usr/bin/env bash
# VELA v5 잔차의 학습. 원 연구의 명령·시드·순서 그대로다.
# 준비: 저장소 루트의 public/models/vela-v4.2/model.bin.gz (Hinge 모델, GitHub Releases의 vela-v4.2), g++(C++20), Python(NumPy, SciPy).
# 사용: bash research/vela-v5/training/run.sh        결과: work/m2.bin.npz (잔차 가중치), work/m2.bin (엔진용 표)
set -eu
cd "$(dirname "$0")"
ROOT=../../..
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
mkdir -p finalrun/base engine_probe/src/policies/vela work
[ -f finalrun/base/hinge_k256_e1.bin ] || gzip -dc "$ROOT/public/models/vela-v4.2/model.bin.gz" > finalrun/base/hinge_k256_e1.bin
# 소스가 기대하는 경로에 실행 엔진의 헤더(src/policies/vela/native)를 복사해 둔다
rm -rf engine_probe/src/policies/vela/native && cp -r "$ROOT/src/policies/vela/native" engine_probe/src/policies/vela/native
inc=engine_probe/src/policies/vela/native; w=onward/residual
FLAGS=(-std=c++20 -O3 -march=native -fopenmp-simd -pthread -I"$inc"); EXTRA=()
case "$(uname -s)" in MINGW*|MSYS*) FLAGS+=(-static -Iwin); EXTRA=(win/mman_win.cpp);; esac   # Windows(MSYS2)에는 mmap이 없어 대체 구현을 쓴다

# 1) Hinge에서 추론용 표 두 개 (rank 48은 학습 특징, rank 256은 정책 실행)
python finalrun/warm/project.py finalrun/base/hinge_k256_e1.bin finalrun/warm/r48.bin --rank 48
python finalrun/warm/project.py finalrun/base/hinge_k256_e1.bin finalrun/warm/r256.bin --rank 256
for src in collect recollect branch_train; do g++ "${FLAGS[@]}" "$w/$src.cpp" "${EXTRA[@]}" -o "$w/$src"; done

# 2) 1단계: Hinge 정책이 둔 24,000판
"$w/collect" finalrun/warm/r256.bin work/train0.dat 0 6000 1746300000
"$w/collect" finalrun/warm/r256.bin work/train1.dat 6000 18000 1746300000
python "$w/train.py" work/train0.dat work/train1.dat --out work/m0.bin --steps 3200

# 3) 2단계: 1단계 정책(1-step)이 둔 10,000판, 다단계 표적과 위치별 임베딩
"$w/recollect" work/m0.bin work/r1.dat 0 10000 1746400000 1 1
python "$w/train.py" work/r1.dat --out work/m1.bin --updated --mc .05 --decay .88 --steps 5000 --init work/m0.bin.npz
python "$w/train.py" work/r1.dat --out work/m1p.bin --updated --mc .015 --decay .69 --steps 6000 --init work/m1.bin.npz --position

# 4) 3단계: 2단계의 2-step 정책이 둔 3,200판 + 짧은 분기 180,000개, Hinge 손패 인자의 투영
"$w/recollect" work/m1.bin work/r2a.dat 0 3200 1746500000 2 1
"$w/branch_train" work/m1.bin work/train1.dat work/r2b.dat 180000 1746600000
python "$w/train.py" work/r2a.dat work/r2b.dat --out work/m2.bin --updated --mc .02 --decay .90 --steps 6000 --init work/m1p.bin.npz --position --hand-latent
echo "TRAINING_DONE"
