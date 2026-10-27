# 彩虹岛「彩虹大冒险」助手 | AI 骰子与卡牌策略推荐

[한국어](../../README.md) · [English](README.en.md) · [日本語](README.ja.md) · **简体中文** · [繁體中文](README.zh-TW.md)

这是一款为《彩虹岛》的「彩虹大冒险」玩法提供骰子和卡牌行动建议的网页应用。支持三种模式：**辅助**模式读取你共享的游戏画面，**手动**模式由你填写游戏状态，**自动**模式在应用内模拟你选择的掷骰子或用牌操作。实际游戏仍需由你亲自操作。

辅助模式提供韩语、英语、日语和中文的**语音提示**，可选择女声或男声。下载前可以查看语音包的大小，也可以将其保存在浏览器中或删除已保存的语音包。提示音频均使用 Gemini 3.8 Flash TTS 提前合成。

## 选择模型

| 模型 | 评估方式 | 平均得分 |
| --- | --- | ---: |
| **LYRA · v2（研究版）** | 在 CPU 或 GPU 上结合神经网络与单步搜索评估行动 | 研究评测中约 1,880 分 |
| **VELA · v4.2** | 在 CPU 上推演后续局面，评估行动 | 约 1,877 分 |
| **X36 · G3** | 在 CPU 或 GPU 上反复模拟，比较不同选择 | 约 1,860 分 |

以上平均得分来自不同评测，仅供参考。计算耗时取决于设备性能和当前游戏局面。

默认选择 VELA。LYRA 为研究版模型，运行设备可设为自动、CPU 或 GPU。选择自动时，会优先使用可用的 GPU；若初始化或推理失败，则切换到 CPU。

首次使用时，VELA 需要加载约 **68 MB** 的模型包，LYRA 约为 **68 MB**。访问在线网站时，如果同意将模型保存在浏览器中，下次访问即可复用。VELA 确认最新模型信息后会清理不兼容的旧模型；LYRA 则在验证并保存新模型包后清理旧包。在本机运行时，直接使用项目中的模型文件，不会再向浏览器存储一份副本。LYRA 在 CPU 与 GPU 之间切换时使用同一个模型包。

各行动的评估值用于比较不同选择的优劣。预计最终得分表示持续按照所选模型的建议行动时，可能获得的最终分数。VELA v4.2 和 LYRA v2 分别使用针对各自策略训练的专用得分预测器。游戏结束后，显示的是实际得分。也可以取消模型选择，在不显示行动建议的情况下使用应用。

## 在本机运行

安装 **Node.js 22 或更高版本**后，无需另行安装依赖包或构建项目即可运行。

1. 下载并解压项目。
2. 从下方的 **GitHub Releases** 下载所需模型，**不要解压模型文件**，直接放到对应路径。如果只使用 X36 · G3，可以跳过此步骤。
   - **[VELA v4.2](https://github.com/alfm201/adventure/releases/tag/vela-v4.2)：** `model.bin.gz` → `public/models/vela-v4.2/model.bin.gz`
   - **[LYRA v2](https://github.com/alfm201/adventure/releases/tag/lyra-v2)：** `lyra-v2.bin.gz` → `public/models/lyra-v2/lyra-v2.bin.gz`
3. 在项目文件夹中打开终端，运行以下命令：

   ```sh
   node scripts/serve.mjs
   ```

4. 在浏览器中打开 **[http://127.0.0.1:4173/](http://127.0.0.1:4173/)**。也可以通过 `PORT` 环境变量指定其他端口。

也可以使用 `npm start` 启动。使用期间请保持终端开启，退出时按 `Ctrl+C`。不支持双击 `index.html`、通过 `file://` 直接打开的方式。

## 模型下载与使用

本项目自有的 VELA、LYRA 模型可自由用于其他服务。模型包中第三方组件的使用与再分发条件，请参阅[许可证与使用许可说明](../../LICENSING.md)（英语）。

模型文件仍会通过 [GitHub Releases](https://github.com/alfm201/adventure/releases) 提供。如需从 Cloudflare 下载，请向 `https://adventure.alfm201.workers.dev` 的以下路径发送 `GET` 请求。

| 模型 | Cloudflare 下载路径 |
| --- | --- |
| VELA v4.2 | [/models/vela-v4.2/model.bin.gz](https://adventure.alfm201.workers.dev/models/vela-v4.2/model.bin.gz) |
| LYRA v2 | [/models/lyra-v2/lyra-v2.bin.gz](https://adventure.alfm201.workers.dev/models/lyra-v2/lyra-v2.bin.gz) |

LYRA 模型包内的 `LICENSES.txt` 包含第三方运行时的许可证声明。再分发模型包时，请保留此文件。

如果单个服务每天产生数千次或更多模型下载请求，希望您能自行托管模型文件并向用户提供下载，感谢理解与支持。

## 使用帮助

浏览器会自动缓存页面图片。如果仅更新了页面代码，已有图片会继续复用；图片发生变化时，只会重新下载有变化的文件。清除网站数据后，需要重新下载图片。如果要修改图片，可参阅[图片缓存说明](../../src/content/IMAGE_CACHE.md)（韩语），了解如何生成和校验哈希列表。

操作方法和快捷键可以在应用的**帮助**中查看。遇到问题时，请点击帮助页面底部的**保存诊断信息 → 保存文件**，将保存的文件和问题发生时的情况一并提供。诊断文件不会自动发送。

## 模型研究与构建

[研究概览](../../research/README.md)（英语）介绍 X36 → VELA → LYRA 的演进、主要转折与评测结果。[环境与计算量](../../research/topics/environment.md)（韩语）说明有限资源 MDP 的数学模型、状态空间、搜索分支数及 Oracle 实验。

模型生成、训练与转换流程请从[复现指南](../../research/reproduction/README.md)（英语）开始。LYRA v2 的 M₄₀ 训练代码，以及转换为浏览器用 FP32 模型的代码和说明，见[复现指南的 LYRA v2 一节](../../research/reproduction/README.md#lyra-v2--m₄₀-neural-value-model)。应用采用 M₄₀ 和单步 expectimax 策略。

VELA v4.2 的 FULL100 生成、Hinge 训练代码及最终结果摘要，见[复现指南的 VELA v4.2 一节](../../research/reproduction/README.md#vela-v42--compact100-hinge)；WASM 构建方法见[构建指南](../../src/policies/vela/native/README.md)。运行应用不需要 FULL100 原始表。各模型的详细指南与 WASM 构建指南均为韩语。

## 许可证

本仓库的代码和文档采用 [0BSD](../../LICENSE) 许可证。已明确列出的第三方组件，以及附有其他许可证或版权声明的部分，仍遵循各自的条款。作者的 AI 模型和原创图片 `81.png`、`82.png` 也允许商业使用、修改和再分发，无需署名或另行取得许可。对于 Gemini 合成的语音，作者仅在其拥有的权利范围内另行授予使用许可。

其他游戏图片和从游戏画面中提取的识别模板不在上述授权范围内。再分发外部库时，须保留相应的许可证和声明。具体授权范围，以及语音和模型包的相关条件，请参阅[许可证与使用许可说明](../../LICENSING.md)（英语）。
