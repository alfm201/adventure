# La Tale Adventures Helper | AI Dice & Card Strategy Recommendations

[한국어](../../README.md) · **English** · [日本語](README.ja.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md)

A web app that helps you choose your next dice or card action in La Tale Adventures. **Assist** reads the game screen you share, **Manual** lets you enter the game state yourself, and **Automatic** simulates the dice rolls and card actions you choose. You still control the actual game yourself.

Assist mode offers **voice guidance** in Korean, English, Japanese and Chinese, with female and male voices. You can check a voice pack's size before downloading it, then choose whether to keep it in browser storage. Saved packs can be deleted at any time. The prerecorded AI voices were generated with Gemini 3.8 Flash TTS.

## Choose a model

- **LYRA · v2:** Neural network with 1-step search on CPU or GPU
- **VELA · v5:** Evaluates future states on CPU, searching deeper in close decisions
- **X36 · G3:** Compares actions through repeated simulations on CPU or GPU

<table>
<thead>
<tr><th nowrap>Model</th><th nowrap align="right">Average score</th><th nowrap>Mean type</th></tr>
</thead>
<tbody>
<tr><td nowrap><b>LYRA · v2</b></td><td nowrap align="right">About 1,880.1</td><td nowrap>Adjusted mean</td></tr>
<tr><td nowrap><b>VELA · v5</b></td><td nowrap align="right">About 1,880.7</td><td nowrap>Adjusted mean</td></tr>
<tr><td nowrap><b>X36 · G3</b></td><td nowrap align="right">About 1,860.0</td><td nowrap>Raw mean</td></tr>
</tbody>
</table>

**Results by search**

<table>
<thead>
<tr><th nowrap>Model</th><th nowrap>Search</th><th nowrap align="right">Average score</th><th nowrap>Decision time</th></tr>
</thead>
<tbody>
<tr><td nowrap rowspan="2"><b>LYRA · v2</b></td><td nowrap>Default search</td><td nowrap align="right">About 1,880.1</td><td nowrap>Mostly instant</td></tr>
<tr><td nowrap>Deep search</td><td nowrap align="right">About 1,881.0</td><td nowrap>Several seconds or more</td></tr>
</tbody>
</table>

These scores are reference figures from different evaluations. Adjusted means use a martingale control variate (Martingale CV) based on each model to reduce luck-driven error in the estimated average. All scores by search are adjusted means. LYRA defaults to Default search, and the model table shows the default. Deeper search takes longer per decision, and computation time also depends on your device and the game state. VELA v5 has a single search setting and uses the same computation budget for every decision.

VELA is selected by default. LYRA is a research model that can run on CPU or GPU. With device selection set to Automatic, it uses an available GPU first and falls back to CPU if initialization or inference fails.

VELA loads a model package of about **70 MB** on first use; LYRA loads about **68 MB**. After loading, VELA builds its search tables; about 1.5 GB of free memory is recommended. On the hosted site, you can allow the app to save the model in your browser for future visits. VELA removes incompatible older models after checking current metadata; LYRA clears its previous package after the new one has been verified and saved. When running locally, it reads the project's model files without saving an extra browser copy. LYRA uses the same package for both CPU and GPU.

Action values help you compare the available choices. The expected final score estimates your result if you keep following the selected model's recommendations. VELA v5 and LYRA v2 each use a score predictor trained for their own policy. Once the game ends, the actual score is displayed. You can also cancel model selection and use the app without recommendations.

## Run on your PC

With **Node.js 22 or later**, no package installation or build is required.

1. Download and extract the project.
2. Download your chosen model from **GitHub Releases** and place it at the following path **without extracting it**. Skip this step if you only use X36 · G3.
   - **[VELA v5](https://github.com/alfm201/adventure/releases/tag/vela-v5):** `vela-v5.bin.gz` → `public/models/vela-v5/vela-v5.bin.gz`
   - **[LYRA v2](https://github.com/alfm201/adventure/releases/tag/lyra-v2):** `lyra-v2.bin.gz` → `public/models/lyra-v2/lyra-v2.bin.gz`
3. Open a terminal in the project folder and run:

   ```sh
   node scripts/serve.mjs
   ```

4. Open **[http://127.0.0.1:4173/](http://127.0.0.1:4173/)** in your browser. You can set a different port with the `PORT` environment variable.

You can also use `npm start`. Keep the terminal open while using the app; press `Ctrl+C` to stop it. Opening `index.html` directly with `file://` is not supported.

## Download and reuse models

Our VELA and LYRA models may be freely used in other services. See [Licensing and permissions](../../LICENSING.md) for terms covering third-party components included in the packages.

Model files remain available on [GitHub Releases](https://github.com/alfm201/adventure/releases). To download from Cloudflare, send a `GET` request to `https://adventure.alfm201.workers.dev` using one of these paths:

- **VELA v5:** [/models/vela-v5/vela-v5.bin.gz](https://adventure.alfm201.workers.dev/models/vela-v5/vela-v5.bin.gz)
- **LYRA v2:** [/models/lyra-v2/lyra-v2.bin.gz](https://adventure.alfm201.workers.dev/models/lyra-v2/lyra-v2.bin.gz)

The LYRA package includes third-party runtime notices in `LICENSES.txt`. Keep this file when redistributing the package.

If a single service generates several thousand or more model download requests per day, we would appreciate it if you hosted the model files yourself.

## Help

Your browser automatically caches the images. Updates to the page code reuse cached images; if an image changes, only that file is downloaded again. Clearing site data also clears the cached images. If you edit the images, see the [image cache guide](../../src/content/IMAGE_CACHE.md) (Korean) for instructions on generating and checking the hash list.

Open **Help** in the app for controls and keyboard shortcuts. If something goes wrong, choose **Save diagnostics → Save file** at the bottom of Help, then share the file along with a description of the problem. Diagnostic files are not sent automatically.

## Model research and builds

The [research overview](../../research/README.md) traces X36 → VELA → LYRA, with the main transitions and evaluation results. [Environment and computational cost](../../research/topics/environment.md) covers the finite-resource MDP formulation, state space, search branching and Oracle experiments (in Korean).

Start with the [reproduction guide](../../research/reproduction/README.md) for model generation, training and conversion. The [LYRA v2 section](../../research/reproduction/README.md#lyra-v2--m₄₀-neural-value-model) covers M₄₀ training and conversion to the browser's FP32 model format. The app uses M₄₀ with 1-step expectimax.

For VELA v5 residual training and model packaging, see the [VELA v5 section](../../research/reproduction/README.md#vela-v5--deck-conditioned-residual-with-a-fixed-search-budget) and the [VELA v5 report](../../research/vela-v5/report-ko.md). For VELA v4.2 FULL100 generation, Hinge training and a summary of the results, see the [VELA v4.2 section](../../research/reproduction/README.md#vela-v42--compact100-hinge) and its linked report. WASM build instructions are in the [build guide](../../src/policies/vela/native/README.md). The original FULL100 table is not required to run the app. The model-specific and WASM build guides are in Korean.

[AI play strategy analysis (PDF)](../reports/Adventure_AI_Play_Strategy_Analysis_en.pdf): A report that answers "Why did the AI recommend this move?" with a post-hoc analysis of real game records, and measures how far those recommendations can be trusted.

## License

Code and documentation in this repository are licensed under [0BSD](../../LICENSE), except for identified third-party components and portions carrying separate license or copyright notices, which retain their applicable terms. The author's AI models and original images `81.png` and `82.png` may also be used, modified and redistributed commercially without attribution or additional permission. Gemini-generated voice recordings have a separate permission grant limited to rights held by the author.

Other game images and recognition templates extracted from game screens are excluded from these grants. Third-party libraries retain their respective licenses and notices. See [Licensing and permissions](../../LICENSING.md) for the scope and the conditions for voices and bundled model packages.
