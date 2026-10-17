# Licensing and permissions

This document defines the scope of the project's [Zero-Clause BSD license (0BSD)](LICENSE) and the separate permissions below. Third-party materials retain their own terms; their presence in this repository does not make them 0BSD.

## Source code and documentation

The source code and documentation in this repository are licensed under 0BSD, except for the third-party components identified below and portions carrying separate license or copyright notices, which retain their applicable terms. Models, images, audio and recognition data are governed by their respective sections below. For code and documentation covered by 0BSD, commercial use, modification and redistribution are permitted without attribution or a requirement to retain the 0BSD license notice.

## Author-owned models and images

To the extent of rights held by the author, permission is granted, free of charge, to use, copy, modify, create derivative works from, bundle and redistribute the following materials for any purpose, including commercial use and paid distribution:

- AI models released by the author as part of Adventure, including VELA, LYRA, their score predictors, and future author-owned versions, architectures and model families. This covers author-owned weights and associated original model data, including those distributed through GitHub Releases.
- Exactly these original image files: [`public/assets/81.png`](public/assets/81.png) and [`public/assets/82.png`](public/assets/82.png).

No attribution or additional permission from the author is required. These permissions are non-exclusive and do not restrict the author's future development or distribution. They do not cover third-party base models, runtimes, training materials or other third-party content bundled with a model.

## Game artwork and recognition templates

No permission is granted by the author for other images or media unless expressly listed in this document or separately authorized. In particular, the following are excluded from the author's grants:

- `public/assets/1.png` through `public/assets/80.png`, including artwork used by `old/v1/`.
- [`public/recognition/game.json`](public/recognition/game.json) and [`public/recognition/characters.json`](public/recognition/characters.json), which contain templates or samples derived from game screens and artwork.
- Third-party game content, characters, names, logos and trademarks, wherever reproduced or embedded.

This does not assert ownership or copyright protection over every coordinate, number or feature in a template. It means the project author does not grant rights to the underlying third-party content. The original recognition algorithms remain covered by the source-code license above. Users must obtain any permission required from the relevant rights holders before reusing or distributing excluded materials.

## Third-party software

| Component | Files | Applicable terms |
| --- | --- | --- |
| fflate | `src/vendor/fflate/` | [MIT license and copyright notice](src/vendor/fflate/LICENSE) |
| ONNX Runtime Web 1.30.0 | `public/runtime/onnxruntime-web/1.30.0/` and ONNX Runtime WASM files inside the LYRA package | [Microsoft MIT license](public/runtime/onnxruntime-web/1.30.0/LICENSE) and applicable [third-party notices](public/runtime/onnxruntime-web/1.30.0/ThirdPartyNotices.txt), including Apache 2.0 components |

Retain the applicable license texts, copyright notices and modification notices when redistributing these components. ONNX Runtime's upstream notice file covers the wider project; individual entries apply only to components included in the distributed build. The local runtime modification is described in [LYRA-CACHE.md](public/runtime/onnxruntime-web/1.30.0/LYRA-CACHE.md).

`public/models/lyra-v1/lyra-v1.bin.gz` is a mixed package: `lyra-v20-fp32.onnx` and `features.bin` are author-owned model data; `ort-wasm-simd-threaded.wasm` and `ort-wasm-simd-threaded.jsep.wasm` are third-party runtime files. When distributing this package separately, also provide its accompanying [LICENSES.txt](public/models/lyra-v1/LICENSES.txt). The whole package must not be described as exclusively author-owned or notice-free.

## AI-generated voice guidance

The eight voice packs listed below contain prerecorded AI-generated guidance made with Google Gemini 3.8 Flash TTS using the Aoede and Puck preset voices. They are generated audio, not Google model weights, and are not covered by the source-code 0BSD license or the author-owned model grant.

- `public/voice/ko-F-c094512199be.voice`
- `public/voice/ko-M-2422fcd64293.voice`
- `public/voice/en-F-99c123392dda.voice`
- `public/voice/en-M-61308f90e2ca.voice`
- `public/voice/ja-F-711302b79879.voice`
- `public/voice/ja-M-5f40f52a1f90.voice`
- `public/voice/zh-F-ea1f80e56993.voice`
- `public/voice/zh-M-76802261422a.voice`

To the extent of rights held by the author in these generated recordings, the author permits their use, copying, modification and redistribution, including commercial use and paid distribution, without requiring attribution to the project author or additional permission from the author. This grant does not license Google's models, voice technology, trademarks or any third-party rights, or override applicable law or terms binding on a user. It does not authorize removal or falsification of legally required notices or origin information.

Google's [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms), together with the [Google APIs Terms](https://developers.google.com/terms), govern use of the generation service. Google states that it does not claim ownership of generated content; that statement is not a guarantee that every output is free of third-party rights. Merely playing these prerecorded files does not call the Gemini API. Retaining a clear AI-generated origin description is recommended; no Google endorsement is implied.

## Warranty and previous permissions

The author's models, original images and generated audio are provided "AS IS", without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose and noninfringement. To the extent permitted by law, the author is not liable for claims or damages arising from their use or distribution. Third-party disclaimers continue to apply to third-party materials.

Nothing here withdraws permissions previously granted by the author. Earlier public statements are available in [Issue #3](https://github.com/alfm201/adventure/issues/3), [Issue #4](https://github.com/alfm201/adventure/issues/4) and [Issue #5](https://github.com/alfm201/adventure/issues/5). None of these grants extends to rights the author does not hold.
