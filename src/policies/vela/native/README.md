# VELA v4 WASM 빌드

이 폴더에는 VELA v4의 C++ 원본과 환경 테이블이 있습니다. 빌드에는 Python 3와 **Emscripten 4.0.23**이 필요합니다. 아래 명령은 프로젝트 루트에서 실행합니다.

## 도구 준비

Git과 `python` 명령을 사용할 수 있는 환경에서 SDK를 처음 설치할 때:

```powershell
git clone https://github.com/emscripten-core/emsdk.git .tools/emsdk-main
python .tools/emsdk-main/emsdk.py install 4.0.23
python .tools/emsdk-main/emsdk.py activate 4.0.23
```

이미 해당 버전의 SDK가 준비되어 있으면 이 단계는 생략합니다.

## 빌드

```powershell
python scripts/vela/build.py
```

다음 파일을 생성하거나 갱신합니다.

- `src/policies/vela/vela.mjs`: JS 로더
- `src/policies/vela/vela.wasm`: WASM 실행 파일
- `public/models/vela-v4/manifest.json`: 실행 파일 크기와 SHA-256 등 메타데이터

빌드할 때 모델 압축 파일은 필요하지 않습니다. 로컬에서 VELA를 실행할 때는 모델 파일이 별도로 필요합니다. 배포 시에는 위 세 파일을 함께 반영합니다.

## 소스 구성

- `bridge.cpp`: 브라우저에서 호출하는 함수와 입출력
- `inference.hpp`: 모델 테이블 접근과 행동 평가
- `tables.hpp`: 환경 전이 테이블
- `deck-coefficients.hpp`: 잔여 덱 보정 계수

빌드 스크립트는 `scripts/vela/build.py`, manifest 갱신 코드는 `scripts/vela/delivery.py`에 있습니다.
