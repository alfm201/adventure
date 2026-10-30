// Korean source messages map to English, Japanese and Simplified Chinese.
// Stage names use descriptive translations/transliterations, not verified regional game names.
globalThis.adventureMessages = {
  "화면 확인 중…": ["Checking screen…", "画面を確認中…", "正在确认画面…"],
  "빠름": ["Fast", "高速", "快速"],
  "탐색 강도": ["Search strength", "探索強度", "搜索强度"],
  "탐색 강도 안내": ["About search strength", "探索強度について", "搜索强度说明"],
  "VELA 탐색 강도": ["VELA search strength", "VELAの探索強度", "VELA 搜索强度"],
  "강도가 높을수록 접전에서 더 깊이 계산합니다.": ["Higher strengths search deeper when the top choices are close.", "強度が高いほど、接戦でより深く計算します。", "强度越高，局面接近时计算得越深。"],
  "즉시": ["Instant", "即時", "即时"],
  "대부분 즉시": ["Mostly instant", "ほぼ即時", "大多即时"],
  "접전 시 최대 약 1초": ["Up to about 1 s in close calls", "接戦時は最大約1秒", "局面接近时最多约 1 秒"],
  "접전 시 최대 수 초": ["Up to several seconds in close calls", "接戦時は最大数秒", "局面接近时最多数秒"],
  "CPU 전용 · 탐색 강도 선택 가능": ["CPU only · Adjustable search", "CPU専用・探索強度を選択可能", "仅限CPU · 可选择搜索强度"],
  "기존 VELA v4.2와 같은 추천입니다.": ["Uses the same recommendations as VELA v4.2.", "VELA v4.2と同じ行動をおすすめします。", "与 VELA v4.2 的推荐相同。"],
  "일부 판단이 수 초 이상 걸릴 수 있습니다. 높음 대비 점수 차이는 작습니다.": ["Some decisions may take several seconds or longer. The score gain over High is small.", "判断に数秒以上かかる場合があります。「高」とのスコア差はわずかです。", "部分决策可能需要数秒或更长时间，与高档的分数差距较小。"],
  "빠름 안내": ["About Fast", "「高速」について", "快速档说明"],
  "최고 안내": ["About Max", "「最高」について", "最高档说明"],
  "최고": ["Max", "最高", "最高"],
  "탐색 깊이": ["Search depth", "探索の深さ", "搜索深度"],
  "탐색 깊이 안내": ["About search depth", "探索の深さについて", "搜索深度说明"],
  "깊게": ["Deep", "深く", "深入"],
  "빠른 응답": ["Quick response", "素早い応答", "快速响应"],
  "더 먼 상황까지 비교": ["Compare further ahead", "先の展開まで比較", "比较更远的后续情况"],
  "사용량을 바꿔도 같은 탐색 결과를 제공합니다.": ["Changing resource usage does not change the search result.", "使用量を変えても探索結果は変わりません。", "更改资源用量不会改变搜索结果。"],
  "낮음은 처리 부하를 줄이고, 높음은 빠른 계산을 우선합니다. 사용량을 바꿔도 같은 탐색 결과를 제공합니다.": ["Low reduces processing load; High prioritizes speed. Resource usage does not change the search result.", "低は処理負荷を抑え、高は計算速度を優先します。使用量を変えても探索結果は変わりません。", "低用量减少处理负荷，高用量优先计算速度。资源用量不会改变搜索结果。"],
  "계산 시간과 메모리 사용량이 크게 늘어날 수 있습니다.": ["Calculation time and memory use may increase substantially.", "計算時間とメモリ使用量が大幅に増える場合があります。", "计算时间和内存用量可能大幅增加。"],
  "메모리 사용 주의": ["High memory use", "メモリ使用量に注意", "内存用量警告"],
  "높음과 깊은 탐색을 함께 사용하면 RAM·VRAM 사용량이 크게 늘어날 수 있습니다. 메모리가 부족하면 브라우저나 화면이 일시적으로 멈추거나 계산에 실패할 수 있습니다.": ["Combining High usage with Deep search may greatly increase RAM and VRAM use. Low memory may temporarily freeze the browser or display, or cause the calculation to fail.", "使用量「高」と深い探索を組み合わせると、RAM・VRAM使用量が大幅に増える場合があります。メモリが不足すると、ブラウザや画面の一時停止、計算の失敗が起こることがあります。", "高用量与深入搜索同时使用可能大幅增加RAM和VRAM用量。内存不足可能导致浏览器或画面暂时卡住，或计算失败。"],
  "높음과 깊은 탐색을 함께 사용하면 RAM 사용량이 크게 늘어날 수 있습니다. 메모리가 부족하면 브라우저나 화면이 일시적으로 멈추거나 계산에 실패할 수 있습니다.": ["Combining High usage with Deep search may greatly increase RAM use. Low memory may temporarily freeze the browser or display, or cause the calculation to fail.", "使用量「高」と深い探索を組み合わせると、RAM使用量が大幅に増える場合があります。メモリが不足すると、ブラウザや画面の一時停止、計算の失敗が起こることがあります。", "高用量与深入搜索同时使用可能大幅增加RAM用量。内存不足可能导致浏览器或画面暂时卡住，或计算失败。"],
  "부담을 줄이려면 사용량을 보통으로 바꿔 주세요.": ["Choose Medium usage to reduce memory demand.", "負荷を抑えるには使用量を「普通」に変更してください。", "如需降低内存需求，请将资源用量改为中等。"],
  "그래도 계속 진행하시겠습니까?": ["Do you still want to continue?", "それでも続行しますか？", "仍要继续吗？"],
  "계속 진행": ["Continue", "続行", "继续"],
  "돌아가기": ["Go back", "戻る", "返回"],
  "예상 최종 점수에는 기본 탐색용 보정 모델을 사용하며, 깊은 탐색에서의 예측 정확도는 검증되지 않았습니다.": ["Final score forecasts use the calibration model for basic search. Forecast accuracy with deep search has not been validated.", "最終スコアの予測には基本探索用の補正モデルを使います。深い探索での予測精度は未検証です。", "最终分数预测使用基本搜索的校准模型，深入搜索时的预测准确度尚未验证。"],
  "깊은 탐색에서는 더 많은 메모리가 필요할 수 있습니다.": ["Deep search may require more memory.", "深い探索では、さらに多くのメモリが必要になる場合があります。", "深入搜索可能需要更多内存。"],
  "{0} · 약 {1} 남음": ["{0} · about {1} left", "{0}・残り約{1}", "{0} · 剩余约{1}"],
  "{0}: {1}": ["{0}: {1}", "{0}：{1}", "{0}：{1}"],
  "{0} · {1} 파일": ["{0} · {1} files", "{0} · {1} ファイル", "{0} · {1} 个文件"],
  "모델 파일 읽기": ["Read model files", "モデルファイルの読み込み", "读取模型文件"],
  "모델 다운로드": ["Model download", "モデルのダウンロード", "模型下载"],
  "카드 획득": ["Cards drawn", "カード獲得", "获得卡牌"],
  "획득 불가": ["Missed draws", "獲得できず", "未能获得"],
  "실제로 손패에 들어온 카드": ["Cards actually added to your hand", "実際に手札に加わったカード", "实际加入手牌的卡牌"],
  "손패가 5장이라 받지 못한 카드": ["Cards not received because your hand already held five cards", "手札が5枚のため受け取れなかったカード", "因手牌已有5张而未能获得的卡牌"],
  "어시스트·자동 모드에서는 종료 후 <strong>이번 판 결과</strong>로 통계와 예측 추이를 확인합니다. 닫은 결과는 게임 화면의 종료 안내에서 다시 열 수 있습니다. 새 판을 시작하거나 모드를 바꾸면 기록이 초기화됩니다.": ["In Assist and Automatic modes, <strong>Run summary</strong> shows your stats and forecast history after the game ends. Reopen it from the game-over panel. Starting a new game or changing modes clears the record.", "アシスト・自動モードでは、終了後に<strong>今回の結果</strong>で統計と予測の推移を確認できます。閉じた結果はゲーム終了の案内から開き直せます。新しいプレイを始めるかモードを変えると、記録はリセットされます。", "辅助和自动模式结束后，可在<strong>本局统计</strong>中查看统计数据与预测走势。关闭后可从游戏结束提示中重新打开。开始新一局或切换模式会清空记录。"],
  "게임 종료": ["Game over", "ゲーム終了", "游戏结束"],
  "이번 판 결과": ["Run summary", "今回の結果", "本局统计"],
  "종료 시점부터 기록": ["Connected at the end", "終了時点から記録", "结束时才开始记录"],
  "주사위 {0}회부터 기록": ["Recorded from dice roll {0}", "サイコロ{0}回目から記録", "从第{0}次掷骰开始记录"],
  "처음부터 함께한 판": ["Recorded from the start", "最初から記録したプレイ", "从开局开始记录"],
  "일부 구간의 기록이 없습니다": ["Some parts were not recorded", "一部の区間は記録されていません", "部分过程未能记录"],
  "시작 이전의 기록은 없습니다": ["Earlier play is not included", "記録開始前のデータは含みません", "不包含开始记录前的数据"],
  "주사위 {0}회 사용": ["{0} dice rolls used", "サイコロを{0}回使用", "已使用{0}次骰子"],
  "확인한 행동": ["Tracked actions", "確認できた行動", "已确认行动"],
  "회": ["", "回", "次"],
  "장": ["", "枚", "张"],
  "이번 판의 진행 기록이 없습니다": ["No play history for this run", "今回のプレイ記録はありません", "没有本局的过程记录"],
  "예측 기록이 없습니다": ["No predictions recorded", "予測の記録はありません", "没有预测记录"],
  "다음 판부터 함께 기록할 수 있습니다.": ["Your next run can be recorded from the start.", "次のプレイから記録できます。", "下一局即可从开局开始记录。"],
  "행동 추천 모델을 사용한 구간의 예측이 여기에 표시됩니다.": ["Predictions appear here for periods when an action model was active.", "行動を提案するモデルを使用した区間の予測が表示されます。", "这里会显示启用行动推荐模型期间的预测。"],
  "최종 점수 예측 추이": ["Final score forecast", "最終スコア予測の推移", "最终分数预测走势"],
  "최종 점수 예측 추이. 좌우 방향키로 기록을 살펴볼 수 있습니다.": ["Final score forecast. Use the left and right arrow keys to explore.", "最終スコア予測の推移。左右の矢印キーで記録を確認できます。", "最终分数预测走势。可用左右方向键查看记录。"],
  "실제 최종 점수": ["Actual final score", "実際の最終スコア", "实际最终分数"],
  "확인한 행동 수": ["Tracked actions", "確認できた行動数", "已确认行动数"],
  "행동 수": ["Actions", "行動数", "行动数"],
  "최고·최저 기준": ["Compare within", "最高・最低の対象", "最高／最低值所属模型"],
  "최고 예측": ["Highest forecast", "最高予測", "最高预测"],
  "최저 예측": ["Lowest forecast", "最低予測", "最低预测"],
  "당시 선택한 모델을 계속 따를 때의 예상입니다. 종료 시 실제 점수는 예측 기록에서 제외했습니다.": ["Forecasts assume you keep following the model selected at the time. The actual final score is not a forecast.", "その時点で選択していたモデルに従い続けた場合の予測です。終了時の実スコアは予測に含めていません。", "预测以持续遵循当时所选模型为前提。结束时的实际分数不计入预测记录。"],
  "행동과 카드는 확인한 구간만 집계합니다. 기록 공백 전후의 선은 연결하지 않습니다.": ["Action and card counts cover tracked play only. Gaps are left unconnected.", "行動とカードは確認できた区間のみ集計します。記録が途切れた区間は線をつなぎません。", "行动与卡牌仅统计已确认的过程，记录缺失处不会连线。"],
  "최고·최저는 모델별로 확인합니다.": ["Highest and lowest forecasts are shown per model.", "最高・最低の予測はモデル別に確認できます。", "最高与最低预测按模型分别查看。"],
  "기록 시작": ["Recording started", "記録開始", "开始记录"],
  "{0}번째 행동 후": ["After action {0}", "{0}回目の行動後", "第{0}次行动后"],
  "모델 변경": ["Model changed", "モデル変更", "切换模型"],
  "{0} 카드 사용": ["Played: {0}", "「{0}」カードを使用", "使用卡牌：{0}"],
  "기록 공백 이후": ["After a recording gap", "記録再開後", "记录恢复后"],
  "기록 공백": ["Recording gap", "記録の途切れ", "记录缺失"],
  "주사위 {0}회 사용 · {1}": ["{0} dice rolls used · {1}", "サイコロ{0}回使用 · {1}", "已使用{0}次骰子 · {1}"],
  "한국어 · 여성": ["Korean · Female", "韓国語 · 女性", "韩语 · 女声"],
  "한국어 · 남성": ["Korean · Male", "韓国語 · 男性", "韩语 · 男声"],
  "영어 · 여성": ["English · Female", "英語 · 女性", "英语 · 女声"],
  "영어 · 남성": ["English · Male", "英語 · 男性", "英语 · 男声"],
  "일본어 · 여성": ["Japanese · Female", "日本語 · 女性", "日语 · 女声"],
  "일본어 · 남성": ["Japanese · Male", "日本語 · 男性", "日语 · 男声"],
  "중국어 · 여성": ["Chinese · Female", "中国語 · 女性", "中文 · 女声"],
  "중국어 · 남성": ["Chinese · Male", "中国語 · 男性", "中文 · 男声"],
  "영어": ["English", "英語", "英语"],
  "일본어": ["Japanese", "日本語", "日语"],
  "중국어": ["Chinese", "中国語", "中文"],
  "게임": ["Game", "ゲーム", "游戏"],
  "저장 공간": ["Storage", "ストレージ", "存储"],
  "정보": ["About", "情報", "关于"],
  "설정 카테고리": ["Settings categories", "設定カテゴリー", "设置类别"],
  "저장된 모델은 설정의 저장 공간에서 삭제할 수 있습니다.": ["Saved models can be deleted in Settings → Storage.", "保存したモデルは設定のストレージから削除できます。", "可在设置的存储页面删除已保存的模型。"],
  "게임 모드": ["Game mode", "ゲームモード", "游戏模式"],
  "플레이 방식에 맞는 모드를 선택하세요.": ["Choose a mode for the way you play.", "プレイ方法に合うモードを選んでください。", "请选择适合游玩方式的模式。"],
  "추천 행동과 화면 확인 안내를 음성으로 듣습니다.": ["Hear recommended actions and screen check guidance.", "おすすめの行動や画面確認の案内を音声で聞けます。", "通过语音收听推荐操作和画面确认提示。"],
  "브라우저 저장 공간": ["Browser storage", "ブラウザーのストレージ", "浏览器存储"],
  "다음 접속에도 사용할 파일이 이 브라우저에 저장됩니다.": ["Files are saved in this browser for future visits.", "次回も使うファイルをこのブラウザーに保存します。", "文件保存在此浏览器中，供下次访问使用。"],
  "새로고침": ["Refresh", "更新", "刷新"],
  "저장된 파일 용량": ["Saved file size", "保存ファイルの容量", "已保存文件大小"],
  "파일 용량 기준이며 브라우저가 자동 관리하는 임시 캐시는 포함하지 않습니다.": ["Sizes refer to saved files and exclude temporary caches managed by the browser.", "表示は保存ファイルの容量で、ブラウザーが自動管理する一時キャッシュは含みません。", "显示的是已保存文件的大小，不包括浏览器自动管理的临时缓存。"],
  "삭제해도 현재 사용 중인 모델·이미지·음성은 유지됩니다. 다음에 필요하면 다시 다운로드합니다.": ["Deleting saved files keeps the model, images and voice currently in use. Files will be downloaded again when needed.", "削除しても現在使用中のモデル・画像・音声は維持されます。次に必要なときに再ダウンロードします。", "删除后，当前使用中的模型、图像和语音仍会保留。下次需要时将重新下载。"],
  "진단 정보에도 동일한 페이지 버전이 기록됩니다.": ["The same page version is recorded in diagnostics.", "診断情報にも同じページバージョンが記録されます。", "诊断信息中也会记录相同的页面版本。"],
  "저장된 파일을 확인하고 있습니다.": ["Checking saved files.", "保存ファイルを確認しています。", "正在检查已保存的文件。"],
  "일부 저장 공간을 확인할 수 없습니다. 브라우저의 사이트 저장 설정을 확인해 주세요.": ["Some storage could not be checked. Review this site’s storage permissions in your browser.", "一部のストレージを確認できません。ブラウザーのサイト保存設定を確認してください。", "无法检查部分存储空间。请检查浏览器的网站存储设置。"],
  "저장된 파일이 없습니다.": ["No saved files.", "保存ファイルはありません。", "没有已保存的文件。"],
  "저장된 파일 없음": ["No saved files", "保存ファイルなし", "无已保存文件"],
  "이미지": ["Images", "画像", "图像"],
  "게임 이미지": ["Game images", "ゲーム画像", "游戏图像"],
  "음성 파일": ["Voice file", "音声ファイル", "语音文件"],
  "파일": ["files", "ファイル", "个文件"],
  "저장된 파일 삭제": ["Delete saved files", "保存ファイルの削除", "删除已保存的文件"],
  "선택한 저장 데이터를 삭제할까요? 다음에 필요하면 다시 다운로드합니다. 현재 사용 중인 데이터는 유지됩니다.": ["Delete the selected saved data? It will be downloaded again when needed. Data currently in use will remain available.", "選択した保存データを削除しますか？次に必要なときに再ダウンロードします。現在使用中のデータは維持されます。", "要删除所选的已保存数据吗？下次需要时将重新下载。当前使用中的数据仍会保留。"],
  "저장된 파일을 삭제했습니다.": ["Saved files deleted.", "保存ファイルを削除しました。", "已删除保存的文件。"],
  "파일을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.": ["Could not delete the files. Please try again shortly.", "ファイルを削除できませんでした。しばらくしてから再試行してください。", "无法删除文件，请稍后重试。"],
  "저장 공간을 확인하지 못했습니다. 다시 시도해 주세요.": ["Could not check storage. Please try again.", "ストレージを確認できませんでした。再試行してください。", "无法检查存储空间，请重试。"],
  "{0} 삭제": ["Delete {0}", "{0}を削除", "删除{0}"],
  "파일 캐시": ["File cache", "ファイルキャッシュ", "文件缓存"],
  "모델 저장소": ["Model storage", "モデルストレージ", "模型存储"],
  "{0} · {1}초 · 계산중": ["{0} · {1}s · calculating", "{0}・{1}秒・計算中", "{0} · {1}秒 · 计算中"],
  "모델 파일 확인 중": ["Checking model files", "モデルファイルを確認中", "正在检查模型文件"],
  "모델 파일 준비 중": ["Preparing model files", "モデルファイルを準備中", "正在准备模型文件"],
  "실행 환경 준비 중": ["Preparing the execution environment", "実行環境を準備中", "正在准备运行环境"],
  "동작 확인 중": ["Checking engine operation", "動作を確認中", "正在检查引擎运行"],
  "RAM 여유 약 {0} 이상 권장 · 기기별 차이": ["About {0} of free RAM recommended · Varies by device", "RAMの空き容量は約{0}以上を推奨 · デバイスによって異なります", "建议可用 RAM 约 {0} 以上 · 因设备而异"],
  "VRAM 여유 약 {0} 이상 권장 · 기기별 차이": ["About {0} of free VRAM recommended · Varies by device", "VRAMの空き容量は約{0}以上を推奨 · デバイスによって異なります", "建议可用 VRAM 约 {0} 以上 · 因设备而异"],
  "신경망 가치 추정으로 행동 비교": ["Compare actions using neural value estimates", "ニューラルネットワークの価値推定で行動を比較", "通过神经网络价值估计比较行动"],
  "가치 모델과 탐색으로 행동 비교": ["Compare actions using a value model and search", "価値モデルと探索で行動を比較", "通过价值模型和搜索比较行动"],
  "반복 시뮬레이션으로 행동 비교": ["Compare actions using repeated simulations", "反復シミュレーションで行動を比較", "通过重复模拟比较行动"],
  "CPU 전용 · 매우 낮은 연산 부하": ["CPU only · Very low processing load", "CPU専用 · 計算負荷は非常に低い", "仅 CPU · 计算负载极低"],
  "GPU 보통 · CPU 느림": ["GPU: moderate · CPU: slow", "GPU：普通 · CPU：遅い", "GPU：中等 · CPU：慢"],
  "GPU 빠름 · CPU 보통": ["GPU: fast · CPU: moderate", "GPU：速い · CPU：普通", "GPU：快 · CPU：中等"],
  "연구용": ["Research", "研究用", "研究用"],
  "연구용 모델입니다. 사용 중 예상하지 못한 동작이 있을 수 있습니다.": ["This is a research model. Unexpected behavior may occur during use.", "研究用モデルです。使用中に予期しない動作が発生する場合があります。", "这是研究用模型。使用过程中可能出现意外行为。"],
  "모델과 CPU/GPU 엔진을 한 번에 내려받습니다.": ["Download the model and CPU/GPU engines together.", "モデルとCPU/GPUエンジンをまとめてダウンロードします。", "一次下载模型和 CPU/GPU 引擎。"],
  "모델과 CPU/GPU 엔진을 한 번에 불러옵니다.": ["Load the model and CPU/GPU engines together.", "モデルとCPU/GPUエンジンをまとめて読み込みます。", "一并加载模型和 CPU/GPU 引擎。"],
  "저장된 모델을 다음에도 사용합니다.": ["Reuse the saved model on future visits.", "次回も保存したモデルを使用します。", "下次访问时复用已保存的模型。"],
  "사용량": ["Usage", "使用量", "使用量"],
  "LYRA 실행 장치 선택": ["LYRA compute device", "LYRA実行デバイス選択", "选择 LYRA 计算设备"],
  "낮음은 처리 부하를 줄이고, 높음은 빠른 계산을 우선합니다. 모든 설정에서 같은 모델과 정책을 사용합니다.": ["Low reduces processing load; High prioritizes speed. All settings use the same model and policy.", "低は処理負荷を抑え、高は計算速度を優先します。どの設定でも同じモデルと方策を使用します。", "低档降低处理负载，高档优先计算速度。所有设置均使用相同的模型和策略。"],
  "모델을 준비하지 못했습니다. 다시 시도해 주세요.": ["Could not prepare the model. Please try again.", "モデルを準備できませんでした。もう一度お試しください。", "模型准备失败，请重试。"],
  "GPU를 준비하지 못했습니다. 자동 또는 CPU를 선택해 주세요.": ["GPU preparation failed. Choose Auto or CPU.", "GPUを準備できませんでした。自動またはCPUを選んでください。", "GPU 准备失败。请选择自动或 CPU。"],
  "신경망으로 다음 선택 비교": ["Compare choices with a neural network", "ニューラルネットワークで次の選択を比較", "使用神经网络比较下一步选择"],
  "연구 평가": ["Research evaluation", "研究評価", "研究评估"],
  "VELA 대비 약 +1.5점": ["About +1.5 points vs VELA", "VELA比 約+1.5点", "比 VELA 约高 1.5 分"],
  "GPU 빠름 · CPU 느림": ["GPU: fast · CPU: slow", "GPU：速い · CPU：遅い", "GPU：快 · CPU：慢"],
  "테스트 모델 · V₂₀ 가치망 · π₂₀ 1-step 정책": ["Test model · V₂₀ value network · π₂₀ 1-step policy", "テストモデル · V₂₀価値ネットワーク · π₂₀ 1-step方策", "测试模型 · V₂₀ 价值网络 · π₂₀ 单步策略"],
  "실행 장치": ["Compute device", "実行デバイス", "计算设备"],
  "LYRA 실행 장치": ["LYRA compute device", "LYRA実行デバイス", "LYRA 计算设备"],
  "GPU 우선": ["GPU preferred", "GPU優先", "优先 GPU"],
  "CPU로 계산": ["Run on CPU", "CPUで計算", "使用 CPU 计算"],
  "GPU로 계산": ["Run on GPU", "GPUで計算", "使用 GPU 计算"],
  "GPU 사용 가능 여부 확인 중": ["Checking GPU availability", "GPUの利用可否を確認中", "正在检查 GPU 是否可用"],
  "GPU 사용 가능": ["GPU available", "GPUを利用できます", "GPU 可用"],
  "이 환경에서는 GPU를 사용할 수 없습니다.": ["GPU is unavailable in this environment.", "この環境ではGPUを利用できません。", "此环境无法使用 GPU。"],
  "LYRA 준비": ["Preparing LYRA", "LYRAの準備", "准备 LYRA"],
  "LYRA를 불러오는 중": ["Loading LYRA", "LYRAを読み込み中", "正在加载 LYRA"],
  "LYRA를 내려받는 중": ["Downloading LYRA", "LYRAをダウンロード中", "正在下载 LYRA"],
  "LYRA v1 준비 완료": ["LYRA v1 is ready", "LYRA v1の準備完了", "LYRA v1 已就绪"],
  "자동 · GPU 사용 중": ["Auto · Using GPU", "自動 · GPUを使用中", "自动 · 正在使用 GPU"],
  "자동 · CPU 사용 중": ["Auto · Using CPU", "自動 · CPUを使用中", "自动 · 正在使用 CPU"],
  "GPU 사용 중": ["Using GPU", "GPUを使用中", "正在使用 GPU"],
  "CPU 사용 중": ["Using CPU", "CPUを使用中", "正在使用 CPU"],
  "행동 평가와 추천을 제공합니다. 예상 최종 점수 예측은 아직 제공하지 않습니다.": ["Action values and recommendations are available. Final-score prediction is not yet available.", "行動評価と推奨を提供します。最終スコア予測はまだ利用できません。", "提供行动评估和推荐，暂不提供最终分数预测。"],
  "예상 최종 점수는 LYRA를 계속 따를 때의 예측입니다. 괄호는 직전 상태 대비 변화입니다.": ["Final-score estimate assumes continued use of LYRA. Parentheses show the change from the previous state.", "LYRAに従い続けた場合の最終スコア予測です。括弧内は直前の状態との差です。", "最终得分预测假设持续遵循 LYRA。括号内为相对上一状态的变化。"],
  "GPU 계산을 완료하지 못했습니다. 모델 선택에서 자동 또는 CPU를 선택해 주세요.": ["GPU inference failed. Choose Auto or CPU in Model selection.", "GPU計算を完了できませんでした。モデル選択で自動またはCPUを選んでください。", "GPU 计算失败。请在模型选择中选择自动或 CPU。"],
  "페이지 버전": ["Page version", "ページのバージョン", "页面版本"],
  "매우 빠름": ["Very fast", "非常に速い", "非常快"],
  "느림": ["Slow", "遅い", "较慢"],
  "이전 모델을 다시 준비하고 있습니다.": [
    "Preparing the previous model again.",
    "以前のモデルを再準備しています。",
    "正在重新准备之前的模型。"
  ],
  "GPU 계산을 중단하고 CPU로 전환했습니다.": [
    "Stopped GPU calculation and switched to CPU.",
    "GPU計算を停止し、CPUに切り替えました。",
    "已停止 GPU 计算并切换到 CPU。"
  ],
  "GPU 계산을 완료하지 못했습니다. 계산 설정에서 CPU를 선택하거나 다시 시도해 주세요.": [
    "GPU calculation failed. Select CPU in calculation settings or try again.",
    "GPU計算に失敗しました。計算設定でCPUを選択するか、再試行してください。",
    "GPU 计算失败。请在计算设置中选择 CPU 或重试。"
  ],
  "계산을 완료하지 못했습니다. 다시 계산해 주세요.": [
    "Calculation failed. Please recalculate.",
    "計算に失敗しました。再計算してください。",
    "计算失败，请重新计算。"
  ],
  "모델은 사용할 수 있지만 저장 상태를 확인하지 못했습니다.": [
    "The model is usable, but its storage status could not be checked.",
    "モデルは使用できますが、保存状態を確認できませんでした。",
    "模型可用，但无法确认保存状态。"
  ],
  "{0}~{1} 사이 정수를 입력하세요.": [
    "Enter an integer from {0} to {1}.",
    "{0}～{1}の整数を入力してください。",
    "请输入 {0} 到 {1} 之间的整数。"
  ],
  "사용할 수 없는 모드입니다.": [
    "This mode is unavailable.",
    "このモードは使用できません。",
    "此模式不可用。"
  ],
  "앞으로": [
    "Forward",
    "前へ",
    "向前"
  ],
  "뒤로": [
    "Backward",
    "後ろへ",
    "向后"
  ],
  "주사위": [
    "Dice",
    "サイコロ",
    "骰子"
  ],
  "다음 스테이지": [
    "Next stage",
    "次のステージ",
    "下一关"
  ],
  "획득 가능한 일치 카드가 없습니다.": [
    "No matching card is available to obtain.",
    "獲得可能な一致するカードがありません。",
    "没有可获取的匹配卡牌。"
  ],
  "음성은 사용할 수 있지만, 브라우저에 저장하지 못했습니다.": [
    "Voice is available, but could not be saved in this browser.",
    "音声は使用できますが、ブラウザーに保存できませんでした。",
    "语音可用，但无法保存到浏览器。"
  ],
  "음성을 재생하지 못했습니다. 음성 설정에서 미리 듣기를 눌러주세요.": [
    "Voice could not play. Try Preview in voice settings.",
    "音声を再生できませんでした。音声設定で試聴してください。",
    "无法播放语音，请在语音设置中点击试听。"
  ],
  "저장된 음성 데이터를 삭제했습니다.": [
    "Saved voice data deleted.",
    "保存済みの音声データを削除しました。",
    "已删除保存的语音数据。"
  ],
  "음성 데이터를 삭제하지 못했습니다. 브라우저의 사이트 저장소를 확인해 주세요.": [
    "Voice data could not be deleted. Check the browser's site storage.",
    "音声データを削除できませんでした。ブラウザーのサイトストレージを確認してください。",
    "无法删除语音数据，请检查浏览器的网站存储设置。"
  ],
  "화면을 준비하지 못했습니다.": [
    "Could not prepare the page.",
    "画面を準備できませんでした。",
    "无法准备页面。"
  ],
  "브라우저를 업데이트하거나 이전 버전을 이용해 주세요.": [
    "Update your browser or use the previous version.",
    "ブラウザーを更新するか、旧バージョンをご利用ください。",
    "请更新浏览器或使用旧版。"
  ],
  "파일을 저장하지 못했습니다. 브라우저의 다운로드 설정을 확인해 주세요.": [
    "Could not save the file. Check your browser's download settings.",
    "ファイルを保存できませんでした。ブラウザーのダウンロード設定を確認してください。",
    "无法保存文件，请检查浏览器的下载设置。"
  ],
  "이 브라우저에서는 이전 버전을 이용할 수 있습니다.": [
    "You can use the previous version in this browser.",
    "このブラウザーでは旧バージョンを利用できます。",
    "此浏览器可使用旧版。"
  ],
  "연결을 확인하고 다시 시도하거나 이전 버전을 이용해 주세요.": [
    "Check your connection and try again, or use the previous version.",
    "接続を確認して再試行するか、旧バージョンをご利用ください。",
    "请检查连接后重试，或使用旧版。"
  ],
  "일부 이미지를 불러오지 못했습니다.": [
    "Some images could not be loaded.",
    "一部の画像を読み込めませんでした。",
    "部分图片加载失败。"
  ],
  "이미지를 불러오는 중입니다.": [
    "Loading images.",
    "画像を読み込んでいます。",
    "正在加载图片。"
  ],
  "다시 시도": [
    "Retry",
    "再試行",
    "重试"
  ],
  "이미지 준비가 완료되었습니다.": [
    "Images are ready.",
    "画像の準備ができました。",
    "图片已就绪。"
  ],
  "준비 완료": [
    "Ready",
    "準備完了",
    "已就绪"
  ],
  "게임 화면을 준비하고 있습니다.": [
    "Preparing the game screen.",
    "ゲーム画面を準備しています。",
    "正在准备游戏画面。"
  ],
  "준비하지 못했습니다.": [
    "Preparation failed.",
    "準備に失敗しました。",
    "准备失败。"
  ],
  "연결을 확인한 뒤 다시 시도해 주세요.": [
    "Check your connection and try again.",
    "接続を確認して再試行してください。",
    "请检查连接后重试。"
  ],
  "브라우저 응답을 확인하지 못했습니다. 다시 시도해 주세요.": [
    "The browser did not respond. Please try again.",
    "ブラウザーの応答を確認できませんでした。再試行してください。",
    "浏览器未响应，请重试。"
  ],
  "이 브라우저에서는 이전 버전을 이용해 주세요.": [
    "Please use the previous version in this browser.",
    "このブラウザーでは旧バージョンをご利用ください。",
    "请在此浏览器中使用旧版。"
  ],
  "브라우저와 연결 상태를 확인한 뒤 다시 시도하거나 이전 버전을 이용해 주세요.": [
    "Check your browser and connection, then retry or use the previous version.",
    "ブラウザーと接続を確認して再試行するか、旧バージョンをご利用ください。",
    "请检查浏览器和连接后重试，或使用旧版。"
  ],
  "GPU 연결이 종료되었습니다. CPU로 전환하거나 페이지를 새로고침해 주세요. {0}": [
    "GPU connection ended. Switch to CPU or refresh the page. {0}",
    "GPU接続が終了しました。CPUに切り替えるか、ページを再読み込みしてください。{0}",
    "GPU 连接已结束。请切换到 CPU 或刷新页面。{0}"
  ],
  "이 브라우저는 WebGPU를 지원하지 않습니다. CPU를 선택해 주세요.": [
    "This browser does not support WebGPU. Please select CPU.",
    "このブラウザーはWebGPUに対応していません。CPUを選択してください。",
    "此浏览器不支持 WebGPU，请选择 CPU。"
  ],
  "GPU를 사용할 수 없습니다.": [
    "GPU is unavailable.",
    "GPUを使用できません。",
    "GPU 不可用。"
  ],
  "파일을 불러오지 못했습니다.": [
    "Could not load the file.",
    "ファイルを読み込めませんでした。",
    "无法加载文件。"
  ],
  "모델 실행 파일을 확인하지 못했습니다.": [
    "Could not verify the model runtime.",
    "モデルの実行ファイルを確認できませんでした。",
    "无法验证模型运行文件。"
  ],
  "모델 파일을 확인하지 못했습니다.": [
    "Could not verify the model file.",
    "モデルファイルを確認できませんでした。",
    "无法验证模型文件。"
  ],
  "다운로드 응답이 지연되고 있습니다.": [
    "The download response is delayed.",
    "ダウンロードの応答が遅れています。",
    "下载响应延迟。"
  ],
  "모델 다운로드가 완료되지 않았습니다.": [
    "The model download did not finish.",
    "モデルのダウンロードが完了しませんでした。",
    "模型下载未完成。"
  ],
  "저장된 모델을 읽지 못했습니다.": [
    "Could not read the saved model.",
    "保存済みのモデルを読み込めませんでした。",
    "无法读取保存的模型。"
  ],
  "모델 실행에 필요한 메모리가 부족합니다.": [
    "Not enough memory to run the model.",
    "モデル実行に必要なメモリーが不足しています。",
    "内存不足，无法运行模型。"
  ],
  "다운로드를 시작하지 못했습니다.": [
    "Could not start the download.",
    "ダウンロードを開始できませんでした。",
    "无法开始下载。"
  ],
  "현재 버전의 모델이 필요합니다.": [
    "The current model version is required.",
    "現行バージョンのモデルが必要です。",
    "需要当前版本的模型。"
  ],
  "벨로스": [
    "Belos",
    "ベロス",
    "贝罗斯"
  ],
  "산림지대": [
    "Forest Area",
    "森林地帯",
    "森林地带"
  ],
  "고목나무 숲": [
    "Ancient Tree Forest",
    "枯れ木の森",
    "古木森林"
  ],
  "플루톤 신전": [
    "Pluton Temple",
    "プルトン神殿",
    "普鲁顿神殿"
  ],
  "엘리아스": [
    "Elias",
    "エリアス",
    "艾莉亚斯"
  ],
  "들판지대": [
    "Field Area",
    "野原地帯",
    "原野地带"
  ],
  "지하동굴": [
    "Underground Cave",
    "地下洞窟",
    "地下洞穴"
  ],
  "산악지대": [
    "Mountain Area",
    "山岳地帯",
    "山岳地带"
  ],
  "용경": [
    "Yong Gyoung",
    "龍京",
    "龙京"
  ],
  "붉은수수밭": [
    "Red Sorghum Field",
    "赤いコウリャン畑",
    "红高粱地"
  ],
  "아르카디아": [
    "Arcadia",
    "アルカディア",
    "阿卡迪亚"
  ],
  "벚나무 호숫가": [
    "Cherry Lake",
    "桜並木の湖畔",
    "樱花湖畔"
  ],
  "아오이치": [
    "Aoich",
    "アオイチ",
    "奥伊齐"
  ],
  "흑월성": [
    "Dark Moon Castle",
    "黒月城",
    "黑月城"
  ],
  "사막지대": [
    "Desert Area",
    "砂漠地帯",
    "沙漠地带"
  ],
  "피라미드": [
    "Pyramid",
    "ピラミッド",
    "金字塔"
  ],
  "엘파": [
    "Elfa",
    "エルパ",
    "艾尔法"
  ],
  "어둠의 숲": [
    "Dark Forest",
    "闇の森",
    "黑暗森林"
  ],
  "포우 저택": [
    "Poe Mansion",
    "ポウ邸宅",
    "波乌宅邸"
  ],
  "오르카 해변": [
    "Orca Beach",
    "オルカ海辺",
    "奥尔卡海岸"
  ],
  "정글지대": [
    "Jungle Area",
    "ジャングル地帯",
    "丛林地带"
  ],
  "크투가 유적": [
    "Ktuka Ruins",
    "クトガ遺跡",
    "克图卡遗迹"
  ],
  "베히모스의 뱃속": [
    "Inside Behemoth",
    "ベヒーモスの腹の中",
    "贝希摩斯体内"
  ],
  "위로위로 나무": [
    "Upward Tree",
    "上へ上への木",
    "向上之树"
  ],
  "크투가 유적 지하": [
    "Ktuka Underground Ruins",
    "クトガ遺跡地下",
    "克图卡地下遗迹"
  ],
  "심연의 유적": [
    "Abyss Ruins",
    "深淵の遺跡",
    "深渊遗迹"
  ],
  "아쿠아리움": [
    "Aquarium",
    "アクアリウム",
    "水族馆"
  ],
  "지하수로": [
    "Underground Waterway",
    "地下水路",
    "地下水道"
  ],
  "비프로스트": [
    "Bifrost",
    "ビフレスト",
    "彩虹桥"
  ],
  "행거": [
    "Hangar",
    "格納庫",
    "机库"
  ],
  "수경농장": [
    "Hydroponic Farm",
    "水耕農場",
    "水耕农场"
  ],
  "디-라보": [
    "D-Lab",
    "D研究所",
    "D 实验室"
  ],
  "길드연합": [
    "Guild Union",
    "ギルド連合",
    "公会联盟"
  ],
  "엘 아노르 평원(남부)": [
    "El Anor Plains (South)",
    "エルアノール平原（南部）",
    "艾尔阿诺平原（南部）"
  ],
  "엘 아노르 평원(서부)": [
    "El Anor Plains (West)",
    "エルアノール平原（西部）",
    "艾尔阿诺平原（西部）"
  ],
  "엘 아노르 평원(동부)": [
    "El Anor Plains (East)",
    "エルアノール平原（東部）",
    "艾尔阿诺平原（东部）"
  ],
  "엘 아노르 산악지대": [
    "El Anor Mountains",
    "エルアノール山岳地帯",
    "艾尔阿诺山地"
  ],
  "별가루 평원": [
    "Stardust Plains",
    "星くずの平原",
    "星尘平原"
  ],
  "통곡의 해안": [
    "Wailing Coast",
    "慟哭の海岸",
    "恸哭海岸"
  ],
  "붕괴의 탑": [
    "Collapsing Tower",
    "崩壊の塔",
    "崩坏之塔"
  ],
  "바나헤임": [
    "Vanaheim",
    "ヴァナヘイム",
    "瓦纳海姆"
  ],
  "세계수의 환영 입구": [
    "World Tree Mirage Entrance",
    "世界樹の幻影入口",
    "世界树幻影入口"
  ],
  "벨파 도서관": [
    "Belpa Library",
    "ベルパ図書館",
    "贝尔帕图书馆"
  ],
  "잊혀진 평원": [
    "Forgotten Plains",
    "忘れられた平原",
    "遗忘平原"
  ],
  "석양의 평원": [
    "Sunset Plains",
    "夕陽の平原",
    "夕阳平原"
  ],
  "무한회랑": [
    "Infinite Corridor",
    "無限回廊",
    "无限回廊"
  ],
  "산호의 숲": [
    "Coral Forest",
    "珊瑚の森",
    "珊瑚森林"
  ],
  "오로라의 숲": [
    "Aurora Forest",
    "オーロラの森",
    "极光森林"
  ],
  "천공성": [
    "Sky Castle",
    "天空城",
    "天空城"
  ],
  "비취수림": [
    "Jade Forest",
    "翡翠の森",
    "翡翠森林"
  ],
  "폭풍의 감시자 폐허": [
    "Storm Watcher Ruins",
    "嵐の監視者の廃墟",
    "风暴监视者废墟"
  ],
  "석영동굴": [
    "Quartz Cave",
    "石英洞窟",
    "石英洞穴"
  ],
  "버섯의 숲": [
    "Mushroom Forest",
    "キノコの森",
    "蘑菇森林"
  ],
  "메린 섬": [
    "Merin Island",
    "メリン島",
    "梅林岛"
  ],
  "트레져 비치": [
    "Treasure Beach",
    "トレジャービーチ",
    "宝藏海滩"
  ],
  "아키시티": [
    "Aki City",
    "アキシティ",
    "阿基城"
  ],
  "세레스의 신전": [
    "Ceres Temple",
    "セレスの神殿",
    "瑟蕾斯神殿"
  ],
  "쥬드 왕국 수도": [
    "Jude Capital",
    "ジュード王国首都",
    "朱德王国首都"
  ],
  "화이트 콜 협곡": [
    "White Coal Canyon",
    "ホワイトコール峡谷",
    "白煤峡谷"
  ],
  "루맨": [
    "Lumen",
    "ルーメン",
    "卢门"
  ],
  "수련의 숲": [
    "Training Forest",
    "修練の森",
    "修炼森林"
  ],
  "불타는 도시": [
    "Burning City",
    "燃える都市",
    "燃烧的城市"
  ],
  "아말룬 사막": [
    "Amalun Desert",
    "アマルーン砂漠",
    "阿玛伦沙漠"
  ],
  "타르타로스": [
    "Tartarus",
    "タルタロス",
    "塔尔塔罗斯"
  ],
  "지하도시 공사장": [
    "Underground Construction Site",
    "地下都市工事現場",
    "地下城市工地"
  ],
  "아드리카": [
    "Adrica",
    "アドリカ",
    "阿德里卡"
  ],
  "포보스": [
    "Phobos",
    "フォボス",
    "福波斯"
  ],
  "데보라 설원": [
    "Debora Snowfield",
    "デボラ雪原",
    "德博拉雪原"
  ],
  "아발론": [
    "Avalon",
    "アヴァロン",
    "阿瓦隆"
  ],
  "수정달 숲": [
    "Crystal Moon Forest",
    "水晶月の森",
    "水晶月森林"
  ],
  "라란가도": [
    "Raranga Road",
    "ララン街道",
    "拉兰街道"
  ],
  "우주여행": [
    "Space Travel",
    "宇宙旅行",
    "宇宙旅行"
  ],
  "앞으로 1칸 이동": [
    "Move forward 1 tile",
    "前に1マス移動",
    "前进1格"
  ],
  "앞으로 2칸 이동": [
    "Move forward 2 tiles",
    "前に2マス移動",
    "前进2格"
  ],
  "앞으로 3칸 이동": [
    "Move forward 3 tiles",
    "前に3マス移動",
    "前进3格"
  ],
  "앞으로 4칸 이동": [
    "Move forward 4 tiles",
    "前に4マス移動",
    "前进4格"
  ],
  "앞으로 5칸 이동": [
    "Move forward 5 tiles",
    "前に5マス移動",
    "前进5格"
  ],
  "앞으로 6칸 이동": [
    "Move forward 6 tiles",
    "前に6マス移動",
    "前进6格"
  ],
  "앞으로 7칸 이동": [
    "Move forward 7 tiles",
    "前に7マス移動",
    "前进7格"
  ],
  "앞으로 8칸 이동": [
    "Move forward 8 tiles",
    "前に8マス移動",
    "前进8格"
  ],
  "앞으로 9칸 이동": [
    "Move forward 9 tiles",
    "前に9マス移動",
    "前进9格"
  ],
  "앞으로 10칸 이동": [
    "Move forward 10 tiles",
    "前に10マス移動",
    "前进10格"
  ],
  "앞으로 11칸 이동": [
    "Move forward 11 tiles",
    "前に11マス移動",
    "前进11格"
  ],
  "앞으로 12칸 이동": [
    "Move forward 12 tiles",
    "前に12マス移動",
    "前进12格"
  ],
  "뒤로 1칸 이동": [
    "Move back 1 tile",
    "後ろに1マス移動",
    "后退1格"
  ],
  "뒤로 2칸 이동": [
    "Move back 2 tiles",
    "後ろに2マス移動",
    "后退2格"
  ],
  "뒤로 3칸 이동": [
    "Move back 3 tiles",
    "後ろに3マス移動",
    "后退3格"
  ],
  "주사위 2배!": [
    "Dice ×2!",
    "サイコロ2倍！",
    "骰子2倍！"
  ],
  "주사위 3배!!": [
    "Dice ×3!",
    "サイコロ3倍！",
    "骰子3倍！"
  ],
  "주사위 5배!!!": [
    "Dice ×5!",
    "サイコロ5倍！",
    "骰子5倍！"
  ],
  "주사위 7배!!!!": [
    "Dice ×7!",
    "サイコロ7倍！",
    "骰子7倍！"
  ],
  "주사위 8배!!!!!": [
    "Dice ×8!",
    "サイコロ8倍！",
    "骰子8倍！"
  ],
  "주사위 10배!!!!!!": [
    "Dice ×10!",
    "サイコロ10倍！",
    "骰子10倍！"
  ],
  "다음 스테이지 첫번째 칸으로 이동!": [
    "Go to the first tile of the next stage!",
    "次のステージの最初のマスに移動！",
    "移动到下一关的第一格！"
  ],
  "모델 파일 없음": [
    "Model file missing",
    "モデルファイルなし",
    "缺少模型文件"
  ],
  "사용할 버전의 model.bin.gz를 압축을 풀지 않고 public/models/{0}/ 폴더에 넣어 주세요.": [
    "Place this version's model.bin.gz in public/models/{0}/ without extracting it.",
    "このバージョンのmodel.bin.gzを解凍せずpublic/models/{0}/に配置してください。",
    "请将此版本的 model.bin.gz 放入 public/models/{0}/，不要解压。"
  ],
  "모델 실행 기능 미지원": [
    "Model runtime unsupported",
    "モデル実行に非対応",
    "不支持模型运行"
  ],
  "이 브라우저에서는 모델 실행 기능을 사용할 수 없습니다. 브라우저를 업데이트하거나 X36을 선택해 주세요.": [
    "This browser cannot run the model. Update it or select X36.",
    "このブラウザーではモデルを実行できません。更新するか、X36を選択してください。",
    "此浏览器无法运行模型，请更新或选择 X36。"
  ],
  "계산 기능 사용 불가": [
    "Calculation unavailable",
    "計算機能を使用できません",
    "计算功能不可用"
  ],
  "별도 계산 기능을 시작하지 못했습니다. 브라우저를 업데이트하거나 확장 프로그램과 사이트 제한 설정을 확인해 주세요. 이전 버전도 이용할 수 있습니다.": [
    "Could not start the calculation worker. Update your browser or check extensions and site restrictions. The previous version is also available.",
    "計算ワーカーを起動できませんでした。ブラウザーの更新、拡張機能やサイトの制限を確認してください。旧バージョンも利用できます。",
    "无法启动计算线程。请更新浏览器或检查扩展和网站限制，也可使用旧版。"
  ],
  "파일 처리 기능 미지원": [
    "File processing unsupported",
    "ファイル処理に非対応",
    "不支持文件处理"
  ],
  "대용량 모델 파일을 처리하는 기능이 없습니다. 브라우저를 업데이트하거나 X36을 선택해 주세요.": [
    "Large model files cannot be processed. Update your browser or select X36.",
    "大容量モデルファイルを処理できません。ブラウザーを更新するか、X36を選択してください。",
    "无法处理大型模型文件，请更新浏览器或选择 X36。"
  ],
  "파일 확인 기능 사용 불가": [
    "File verification unavailable",
    "ファイル検証を使用できません",
    "文件验证不可用"
  ],
  "모델 파일을 확인하는 기능을 사용할 수 없습니다. 안전한 연결에서 최신 브라우저로 다시 접속하거나 X36을 선택해 주세요.": [
    "Model verification is unavailable. Reopen using a secure connection and an updated browser, or select X36.",
    "モデルを検証できません。安全な接続と最新のブラウザーで開くか、X36を選択してください。",
    "无法验证模型，请通过安全连接使用新版浏览器重新打开，或选择 X36。"
  ],
  "연결 확인 필요": [
    "Check connection",
    "接続を確認",
    "请检查连接"
  ],
  "파일을 불러오지 못했습니다. 파일 위치와 연결 상태를 확인한 뒤 다시 시도해 주세요.": [
    "Could not load the file. Check its location and your connection, then retry.",
    "ファイルを読み込めませんでした。場所と接続を確認して再試行してください。",
    "无法加载文件，请检查文件位置和网络连接后重试。"
  ],
  "응답 확인 필요": [
    "Check response",
    "応答を確認",
    "请检查响应"
  ],
  "브라우저 응답이 늦어지고 있습니다. 다른 작업을 줄인 뒤 다시 확인해 주세요.": [
    "The browser is responding slowly. Reduce other work and check again.",
    "ブラウザーの応答が遅れています。他の作業を減らして再確認してください。",
    "浏览器响应缓慢，请减少其他任务后重新检查。"
  ],
  "메모리 부족": [
    "Not enough memory",
    "メモリー不足",
    "内存不足"
  ],
  "다른 앱이나 탭을 닫고 다시 시도하거나 X36을 선택해 주세요.": [
    "Close other apps or tabs and retry, or select X36.",
    "他のアプリやタブを閉じて再試行するか、X36を選択してください。",
    "请关闭其他应用或标签页后重试，或选择 X36。"
  ],
  "파일 확인 실패": [
    "Verification failed",
    "ファイル検証失敗",
    "验证失败"
  ],
  "모델 파일이 완전하지 않거나 필요한 버전과 다릅니다. 올바른 파일을 준비한 뒤 다시 시도해 주세요.": [
    "The model file is incomplete or has the wrong version. Prepare the correct file and retry.",
    "モデルファイルが不完全か、必要なバージョンと異なります。正しいファイルで再試行してください。",
    "模型文件不完整或版本不符，请准备正确文件后重试。"
  ],
  "모델 실행 실패": [
    "Model failed to run",
    "モデル実行失敗",
    "模型运行失败"
  ],
  "모델을 준비하지 못했습니다. 다시 시도하거나 X36을 선택해 주세요.": [
    "Could not prepare the model. Retry or select X36.",
    "モデルを準備できませんでした。再試行するか、X36を選択してください。",
    "无法准备模型，请重试或选择 X36。"
  ],
  "저장된 모델 읽기 실패": [
    "Saved model read failed",
    "保存モデルの読み込み失敗",
    "保存的模型读取失败"
  ],
  "브라우저에서 저장된 모델을 읽지 못했습니다. 모델을 다시 불러오거나 다른 모델을 선택해 주세요.": [
    "Could not read the saved model. Reload it or select another model.",
    "保存モデルを読み込めませんでした。再読み込みするか、別のモデルを選択してください。",
    "无法读取保存的模型，请重新加载或选择其他模型。"
  ],
  "모델 저장 미지원": [
    "Model storage unsupported",
    "モデル保存に非対応",
    "不支持模型保存"
  ],
  "이 브라우저는 필요한 저장 기능을 지원하지 않습니다. 브라우저를 업데이트하거나 이번 접속 동안만 모델을 사용할 수 있습니다.": [
    "This browser lacks the required storage features. Update it or use the model for this visit only.",
    "必要な保存機能がありません。ブラウザーを更新するか、今回の接続中のみ使用してください。",
    "浏览器不支持所需存储功能，请更新或仅在本次访问中使用。"
  ],
  "저장 공간 부족": [
    "Not enough storage",
    "保存容量不足",
    "存储空间不足"
  ],
  "새 모델을 저장할 공간이 부족합니다. 기기의 저장 공간을 확보하거나 이번에만 사용을 선택해 주세요. 업데이트 중에는 기존 파일도 함께 보관합니다.": [
    "Not enough room to save a new model. Free some storage or use it once. Updates also retain the existing file temporarily.",
    "新しいモデルを保存する空き容量が不足しています。空きを増やすか、今回のみ使用してください。更新中は既存のファイルも保持します。",
    "没有足够空间保存新模型，请释放空间或仅使用一次。更新期间还会保留原文件。"
  ],
  "저장 접근 제한": [
    "Storage access restricted",
    "保存へのアクセス制限",
    "存储访问受限"
  ],
  "브라우저의 사이트 데이터 설정에서 저장을 허용해 주세요. 비공개 창 또는 사이트 제한 설정에 따라 저장이 제한될 수 있습니다.": [
    "Allow storage in the browser's site data settings. Private browsing or site restrictions may limit storage.",
    "ブラウザーのサイトデータ設定で保存を許可してください。プライベートモードやサイトの制限で保存できない場合があります。",
    "请在浏览器的网站数据设置中允许存储。隐私模式或网站限制可能影响存储。"
  ],
  "저장 파일 사용 중": [
    "Stored file in use",
    "保存ファイル使用中",
    "保存文件正在使用"
  ],
  "다른 탭에서 모델 파일을 사용 중일 수 있습니다. 다른 Adventure 탭을 닫고 다시 시도해 주세요.": [
    "Another tab may be using the model. Close other Adventure tabs and retry.",
    "別のタブでモデルを使用中かもしれません。他のAdventureタブを閉じて再試行してください。",
    "其他标签页可能正在使用模型，请关闭其他 Adventure 标签页后重试。"
  ],
  "모델 저장 실패": [
    "Model save failed",
    "モデル保存失敗",
    "模型保存失败"
  ],
  "모델을 보관하지 못했습니다. 이번에는 사용할 수 있지만 다음 접속 때 모델 파일을 다시 불러와야 할 수 있습니다.": [
    "Could not store the model. It works now, but may need to be loaded again next visit.",
    "モデルを保存できませんでした。今回は使用できますが、次回は再読み込みが必要な場合があります。",
    "无法保存模型。本次仍可使用，但下次可能需要重新加载。"
  ],
  "GPU 계산 미지원": [
    "GPU calculation unsupported",
    "GPU計算に非対応",
    "不支持 GPU 计算"
  ],
  "이 브라우저에서는 GPU 계산을 지원하지 않습니다. CPU를 선택하거나 브라우저를 업데이트해 주세요.": [
    "This browser does not support GPU calculation. Select CPU or update the browser.",
    "GPU計算に対応していません。CPUを選択するか、ブラウザーを更新してください。",
    "浏览器不支持 GPU 计算，请选择 CPU 或更新浏览器。"
  ],
  "GPU 사용 불가": [
    "GPU unavailable",
    "GPU使用不可",
    "GPU 不可用"
  ],
  "브라우저에서 사용 가능한 GPU를 제공하지 않았습니다. 그래픽 가속 설정과 드라이버를 확인하거나 CPU를 선택해 주세요.": [
    "The browser did not provide a GPU. Check graphics acceleration and drivers, or select CPU.",
    "利用可能なGPUが提供されませんでした。グラフィックアクセラレーションとドライバーを確認するか、CPUを選択してください。",
    "浏览器未提供可用 GPU，请检查图形加速和驱动，或选择 CPU。"
  ],
  "GPU 계산 검사 실패": [
    "GPU calculation check failed",
    "GPU計算検査失敗",
    "GPU 计算检查失败"
  ],
  "이 기기에서 GPU 계산 결과를 확인하지 못했습니다. 브라우저와 그래픽 드라이버를 업데이트하거나 CPU를 선택해 주세요.": [
    "Could not verify GPU results on this device. Update your browser and graphics driver, or select CPU.",
    "この端末のGPU計算結果を確認できませんでした。ブラウザーとドライバーを更新するか、CPUを選択してください。",
    "无法验证此设备的 GPU 结果，请更新浏览器和显卡驱动，或选择 CPU。"
  ],
  "GPU 연결 종료": [
    "GPU connection ended",
    "GPU接続終了",
    "GPU 连接已结束"
  ],
  "GPU 연결이 종료되어 CPU로 계산합니다. 다른 작업을 줄이거나 계산 설정에서 GPU를 다시 확인해 주세요.": [
    "GPU connection ended; using CPU. Reduce other work or check GPU again in calculation settings.",
    "GPU接続が終了したためCPUで計算します。他の作業を減らすか、計算設定でGPUを再確認してください。",
    "GPU 连接已结束，改用 CPU。请减少其他任务或在计算设置中重新检查 GPU。"
  ],
  "기기별 차이": [
    "Varies by device",
    "端末による差",
    "因设备而异"
  ],
  "GPU rollout {0}개가 종료 한도에 도달했습니다. 결과를 추천에 사용하지 않습니다.": [
    "{0} GPU rollouts reached the termination limit. These results will not be used for recommendations.",
    "{0}件のGPUシミュレーションが終了上限に達しました。結果は推薦に使用しません。",
    "{0} 次 GPU 模拟达到终止上限。这些结果不会用于推荐。"
  ],
  "카드": [
    "Card",
    "カード",
    "卡牌"
  ],
  "멈춤": [
    "Stop",
    "停止",
    "停止"
  ],
  "현재": [
    "Here",
    "現在",
    "当前"
  ],
  "확정": [
    "Certain",
    "確定",
    "必定"
  ],
  "사용 가능 여부": [
    "Availability",
    "利用可否",
    "可用性"
  ],
  "다시 확인": [
    "Check again",
    "再確認",
    "重新检查"
  ],
  "{0}: {1}. 원인과 해결 방법": [
    "{0}: {1}. Causes and solutions",
    "{0}：{1}。原因と解決方法",
    "{0}：{1}。原因与解决方法"
  ],
  "{0}번카드": [
    "Card {0}",
    "カード{0}",
    "卡牌{0}"
  ],
  "{0}칸 직접 이동": [
    "Move {0} tiles directly",
    "{0}マス直接移動",
    "直接移动{0}格"
  ],
  "자동": [
    "Automatic",
    "自動",
    "自动"
  ],
  "수동": [
    "Manual",
    "手動",
    "手动"
  ],
  "어시스트": [
    "Assist",
    "アシスト",
    "辅助"
  ],
  "모델 선택": [
    "Select model",
    "モデル選択",
    "选择模型"
  ],
  "행동별 평가 비교": [
    "Compare action values",
    "行動評価の比較",
    "行动评估比较"
  ],
  "예상 점수 전체 비교": [
    "Compare estimated scores",
    "予想スコアの比較",
    "预测分数比较"
  ],
  "행동별 평가": [
    "Action values",
    "行動評価",
    "行动评估"
  ],
  "추천": [
    "Recommended",
    "おすすめ",
    "推荐"
  ],
  ": 평가가 가장 높은 선택. 값이 클수록 유리하며, 최종 점수 예측은 아닙니다.": [
    ": highest action value. Higher is better; this is not a final-score estimate.",
    "：評価が最も高い行動。高いほど有利ですが、最終スコア予測ではありません。",
    "：评估值最高的行动。数值越高越有利，并非最终得分预测。"
  ],
  ": 현재 평균이 가장 높은 선택 ·": [
    ": highest current mean ·",
    "：現在の平均が最も高い選択・",
    "：当前平均值最高的选择 ·"
  ],
  "근접": [
    "Near tie",
    "僅差",
    "相近"
  ],
  ": 차이가 작아 우열이 애매한 선택 ·": [
    ": difference too small to distinguish clearly ·",
    "：差が小さく優劣が不明確な選択・",
    "：差距较小、难分优劣的选择 ·"
  ],
  "후보": [
    "Candidate",
    "候補",
    "候选"
  ],
  ": 아직 제외되지 않은 선택": [
    ": not yet excluded",
    "：まだ除外されていない選択",
    "：尚未排除的选择"
  ],
  "최종 점수": [
    "Final score",
    "最終スコア",
    "最终得分"
  ],
  "예상 최종 점수": [
    "Expected final score",
    "予想最終スコア",
    "预计最终得分"
  ],
  "점": [
    " pts",
    "点",
    "分"
  ],
  "계산 중…": [
    "Calculating…",
    "計算中…",
    "计算中…"
  ],
  "직전 확정 상태의 예상 점수입니다.": [
    "Expected score for the last confirmed state.",
    "直前の確定状態の予想スコアです。",
    "上一已确认状态的预计得分。"
  ],
  "예상 최종 점수는 VELA를 계속 따를 때의 예측입니다. 괄호는 직전 상태 대비 변화입니다.": [
    "Final-score estimate assumes continued use of VELA. Parentheses show the change from the previous state.",
    "VELAに従い続けた場合の最終スコア予測です。括弧内は直前の状態との差です。",
    "最终得分预测假设持续遵循 VELA。括号内为相对上一状态的变化。"
  ],
  "예상 최종 점수는 G3-R100K를 계속 따를 때의 예측입니다. 괄호는 직전 상태 대비 변화입니다.": [
    "Final-score estimate assumes continued use of G3-R100K. Parentheses show the change from the previous state.",
    "G3-R100Kに従い続けた場合の最終スコア予測です。括弧内は直前の状態との差です。",
    "最终得分预测假设持续遵循 G3-R100K。括号内为相对上一状态的变化。"
  ],
  "칸": [
    " tiles",
    "マス",
    "格"
  ],
  "{0}, 현재 {1}칸, 스테이지 {2}번째 칸, 주사위 {3}회 사용. {4} 모드.": [
    "{0}, tile {1}, stage tile {2}, {3} dice used. {4} mode.",
    "{0}、現在{1}マス、ステージ内{2}マス目、サイコロ{3}回使用。{4}モード。",
    "{0}，当前第{1}格，关卡内第{2}格，已用骰子{3}次。{4}模式。"
  ],
  "주사위 굴리기": [
    "Roll dice",
    "サイコロを振る",
    "掷骰子"
  ],
  "더블 여부 변경 ({0})": [
    "Toggle doubles ({0})",
    "ゾロ目の切り替え（{0}）",
    "切换同点状态（{0}）"
  ],
  "더블": [
    "Doubles",
    "ゾロ目",
    "同点"
  ],
  "일반": [
    "Normal",
    "通常",
    "普通"
  ],
  "모드변경 (현재 {0})": [
    "Settings (current mode: {0})",
    "設定（現在のモード：{0}）",
    "设置（当前模式：{0}）"
  ],
  "{0}번 카드: {1}": [
    "Card {0}: {1}",
    "カード{0}：{1}",
    "卡牌{0}：{1}"
  ],
  "{0}번 빈 카드 슬롯: 카드 획득": [
    "Empty slot {0}: obtain a card",
    "空きスロット{0}：カード獲得",
    "空卡槽{0}：获取卡牌"
  ],
  "칸 이동": [
    " tiles",
    "マス移動",
    "格移动"
  ],
  "다음 스테이지 첫번째 칸으로 이동": [
    "Go to the first tile of the next stage",
    "次のステージの最初のマスに移動",
    "移动到下一关的第一格"
  ],
  "제외": [
    "Excluded",
    "除外",
    "已排除"
  ],
  "계산중": [
    "Calculating",
    "計算中",
    "计算中"
  ],
  "종료": [
    "Finished",
    "終了",
    "结束"
  ],
  "비교": [
    "Compare",
    "比較",
    "比较"
  ],
  "0.000점": [
    "0.000 pts",
    "0.000点",
    "0.000分"
  ],
  "오류": [
    "Error",
    "エラー",
    "错误"
  ],
  "계산중...": [
    "Calculating...",
    "計算中...",
    "计算中..."
  ],
  "직전 확정 상태의 평가값입니다.": [
    "Action value for the last confirmed state.",
    "直前の確定状態の評価値です。",
    "上一已确认状态的评估值。"
  ],
  "다시 계산": [
    "Recalculate",
    "再計算",
    "重新计算"
  ],
  "비어 있음": [
    "Empty",
    "空き",
    "空"
  ],
  "이전 값": [
    "Previous value",
    "直前の値",
    "上一数值"
  ],
  "{0}번 카드{1}": [
    "Card {0}{1}",
    "カード{0}{1}",
    "卡牌{0}{1}"
  ],
  "행동": [
    "Action",
    "行動",
    "行动"
  ],
  "평가값": [
    "Value",
    "評価値",
    "评估值"
  ],
  "중앙값": [
    "Median",
    "中央値",
    "中位数"
  ],
  "평균": [
    "Mean",
    "平均",
    "平均值"
  ],
  "범위": [
    "Range",
    "範囲",
    "范围"
  ],
  "샘플": [
    "Samples",
    "サンプル",
    "样本"
  ],
  "추천차": [
    "Gap",
    "推薦との差",
    "推荐差值"
  ],
  "상태": [
    "Status",
    "状態",
    "状态"
  ],
  "{0} · {1}초": [
    "{0} · {1}s",
    "{0}・{1}秒",
    "{0} · {1}秒"
  ],
  "{0} · G3 · {1}초 · 실제 {2}회{3}": [
    "{0} · G3 · {1}s · {2} actual runs{3}",
    "{0}・G3・{1}秒・実際{2}回{3}",
    "{0} · G3 · {1}秒 · 实际{2}次{3}"
  ],
  "· 계산중": [
    "· calculating",
    "・計算中",
    "· 计算中"
  ],
  "카드 검색": [
    "Find a card",
    "カード検索",
    "搜索卡牌"
  ],
  "이름 또는 효과": [
    "Name or effect",
    "名前または効果",
    "名称或效果"
  ],
  "+숫자 · -숫자 · *배수 · >": [
    "+number · -number · *multiplier · >",
    "+数字・-数字・*倍率・>",
    "+数字 · -数字 · *倍率 · >"
  ],
  "카드 이름이나 효과 입력": [
    "Enter a card name or effect",
    "カード名または効果を入力",
    "输入卡牌名称或效果"
  ],
  "현재 칸 변경": [
    "Edit current tile",
    "現在のマスを変更",
    "修改当前格数"
  ],
  "주사위 사용 횟수 변경": [
    "Edit dice used",
    "サイコロ使用回数を変更",
    "修改骰子使用次数"
  ],
  "이동할 칸": [
    "Destination tile",
    "移動先のマス",
    "目标格数"
  ],
  "사용한 주사위": [
    "Dice used",
    "使用したサイコロ",
    "已用骰子"
  ],
  "재시작": [
    "Restart",
    "再スタート",
    "重新开始"
  ],
  "현재 게임을 초기화할까요?": [
    "Reset the current game?",
    "現在のゲームをリセットしますか？",
    "要重置当前游戏吗？"
  ],
  "웹 화면이 아닌 공유 중인 실제 게임 화면의 물음표(?)를 눌러주세요.": [
    "Click the question mark (?) in the shared actual game window.",
    "共有中の実際のゲーム画面にある「?」を押してください。",
    "请点击正在共享的实际游戏画面中的问号（?）。"
  ],
  "카드 동작을 선택하세요.": [
    "Choose a card action.",
    "カードの操作を選んでください。",
    "请选择卡牌操作。"
  ],
  "도착 예측": [
    "Arrival preview",
    "到着予測",
    "落点预测"
  ],
  "버리기": [
    "Discard",
    "捨てる",
    "丢弃"
  ],
  "닫기": [
    "Close",
    "閉じる",
    "关闭"
  ],
  "현재 칸": [
    "Current tile",
    "現在のマス",
    "当前格数"
  ],
  "주사위 사용 횟수": [
    "Dice used",
    "サイコロ使用回数",
    "骰子使用次数"
  ],
  "보유 카드": [
    "Hand",
    "手札",
    "手牌"
  ],
  "주사위 버튼": [
    "Dice button",
    "サイコロボタン",
    "骰子按钮"
  ],
  "화면 연결이 끊겼습니다": [
    "Screen disconnected",
    "画面の接続が切れました",
    "画面已断开"
  ],
  "다시 연결하면 현재 상태부터 확인합니다.": [
    "Reconnect to check the current state.",
    "再接続すると現在の状態から確認します。",
    "重新连接后将确认当前状态。"
  ],
  "게임 화면이 멈춰 있습니다": [
    "Game screen is frozen",
    "ゲーム画面が停止しています",
    "游戏画面已停止"
  ],
  "공유 중인 창을 다시 표시해 주세요.": [
    "Show the shared window again.",
    "共有中のウィンドウを再表示してください。",
    "请重新显示正在共享的窗口。"
  ],
  "플레이를 이어가세요": [
    "Continue playing",
    "プレイを続けてください",
    "请继续游戏"
  ],
  "카드 이력을 확인했습니다. 이력 창을 닫아도 됩니다.": [
    "Card history checked. You may close it.",
    "カード履歴を確認しました。閉じても構いません。",
    "卡牌记录已确认，可以关闭记录窗口。"
  ],
  "화면의 변화를 읽어 상태와 추천에 반영합니다.": [
    "Screen changes update the state and recommendations.",
    "画面の変化を状態と推薦に反映します。",
    "将读取画面变化并更新状态和推荐。"
  ],
  "화면 인식을 시작하지 못했습니다": [
    "Could not start screen recognition",
    "画面認識を開始できませんでした",
    "无法启动画面识别"
  ],
  "연결 관리에서 화면을 다시 연결해 주세요.": [
    "Reconnect the screen through connection settings.",
    "接続管理から画面を再接続してください。",
    "请在连接管理中重新连接画面。"
  ],
  "게임 창 전체를 보여주세요": [
    "Show the entire game window",
    "ゲーム画面全体を表示してください",
    "请显示完整游戏窗口"
  ],
  "현재 칸과 화면 아래의 주사위 사용 횟수·카드가 보여야 합니다.": [
    "The current tile, dice count and cards at the bottom must be visible.",
    "現在のマスと画面下のサイコロ使用回数・カードが見える必要があります。",
    "需要显示当前格数以及画面底部的骰子次数和手牌。"
  ],
  "게임 창을 조금 더 크게 보여주세요": [
    "Make the game window a little larger",
    "ゲーム画面を少し大きくしてください",
    "请稍微放大游戏窗口"
  ],
  "작은 글자를 읽기 어렵습니다. 게임 창을 원래 크기로 표시해 주세요.": [
    "Small text is hard to read. Show the game window at its original size.",
    "小さな文字を読み取りにくい状態です。ゲームを元のサイズで表示してください。",
    "文字过小难以识别，请以原始大小显示游戏窗口。"
  ],
  "게임 화면을 확인하고 있습니다": [
    "Checking the game screen",
    "ゲーム画面を確認しています",
    "正在确认游戏画面"
  ],
  "팝업이 열려 있다면 닫은 뒤 계속해 주세요.": [
    "If a popup is open, close it to continue.",
    "ポップアップが開いている場合は閉じて続けてください。",
    "如有弹窗，请关闭后继续。"
  ],
  "동작이 끝나면 자동으로 이어집니다.": [
    "Continues automatically when the action ends.",
    "動作が終わると自動的に再開します。",
    "动作结束后将自动继续。"
  ],
  "카드 획득 이력을 다시 열어주세요": [
    "Reopen card acquisition history",
    "カード獲得履歴を開き直してください",
    "请重新打开卡牌获取记录"
  ],
  "카드 획득 이력을 열어주세요": [
    "Open card acquisition history",
    "カード獲得履歴を開いてください",
    "请打开卡牌获取记录"
  ],
  "놓친 변화가 있어 남은 카드를 다시 확인하겠습니다.": [
    "Some changes were missed. Checking the remaining cards again.",
    "見逃した変化があるため、残りのカードを再確認します。",
    "有变化未被捕获，将重新确认剩余卡牌。"
  ],
  "실제 게임의 ? 버튼을 누른 뒤 목록을 천천히 스크롤해 주세요.": [
    "Click ? in the actual game and scroll the list slowly.",
    "実際のゲームの「?」を押し、一覧をゆっくりスクロールしてください。",
    "请点击实际游戏中的 ? 按钮并缓慢滚动列表。"
  ],
  "카드 이력을 {0}로 스크롤해 주세요": [
    "Scroll card history {0}",
    "カード履歴を{0}にスクロールしてください",
    "请向{0}滚动卡牌记录"
  ],
  "위": [
    "up",
    "上",
    "上"
  ],
  "아래": [
    "down",
    "下",
    "下"
  ],
  "일부 카드가 아직 보이지 않습니다. 스크롤 후 잠시 멈춰 주세요.": [
    "Some cards are not visible yet. Pause briefly after scrolling.",
    "まだ見えていないカードがあります。スクロール後に少し止めてください。",
    "部分卡牌尚未显示，请滚动后稍作停留。"
  ],
  "카드 이력을 천천히 스크롤해 주세요": [
    "Scroll card history slowly",
    "カード履歴をゆっくりスクロールしてください",
    "请缓慢滚动卡牌记录"
  ],
  "목록의 위치를 확인하고 있습니다. 조금 움직인 뒤 잠시 멈춰 주세요.": [
    "Checking the list position. Move it slightly, then pause.",
    "一覧の位置を確認しています。少し動かした後、止めてください。",
    "正在确认列表位置，请稍微滚动后停留。"
  ],
  "카드 이력을 조금 위아래로 움직여 주세요": [
    "Move card history slightly up and down",
    "カード履歴を少し上下に動かしてください",
    "请稍微上下滚动卡牌记录"
  ],
  "아직 읽지 못한 항목이 있습니다. 체크 표시가 보이면 잠시 멈춰 주세요.": [
    "Some entries are unread. Pause when check marks are visible.",
    "未読の項目があります。チェックマークが見えたら少し止めてください。",
    "还有未识别的项目，看到勾选标记时请稍作停留。"
  ],
  "스크롤을 잠시 멈춰 주세요": [
    "Pause scrolling briefly",
    "スクロールを少し止めてください",
    "请暂停滚动片刻"
  ],
  "현재 보이는 카드 이력을 확인하고 있습니다.": [
    "Checking the visible card history.",
    "表示中のカード履歴を確認しています。",
    "正在确认当前显示的卡牌记录。"
  ],
  "{0} 확인이 필요합니다": [
    "Please check {0}",
    "{0}の確認が必要です",
    "请确认{0}"
  ],
  "가리는 창이나 커서를 옮겨주세요. 계속 어려우면 직접 입력할 수 있습니다.": [
    "Move any covering window or cursor. You can enter values manually if needed.",
    "重なっているウィンドウやカーソルを動かしてください。必要なら直接入力できます。",
    "请移开遮挡窗口或鼠标，仍有困难时可手动输入。"
  ],
  "화면을 확인하고 있습니다": [
    "Checking the screen",
    "画面を確認しています",
    "正在确认画面"
  ],
  "행동이 끝나면 상태와 추천이 갱신됩니다.": [
    "State and recommendations update after the action ends.",
    "行動が終わると状態と推薦を更新します。",
    "行动结束后将更新状态和推荐。"
  ],
  "실제 게임에 보이는 값으로 맞춰주세요.": [
    "Match the values shown in the actual game.",
    "実際のゲームに表示された値に合わせてください。",
    "请填写实际游戏中显示的数值。"
  ],
  "더블 상태": [
    "Doubles active",
    "ゾロ目状態",
    "同点状态"
  ],
  "주사위 버튼이 파란색": [
    "Dice button is blue",
    "サイコロボタンが青色",
    "骰子按钮为蓝色"
  ],
  "왼쪽부터 순서대로": [
    "In order from the left",
    "左から順番に",
    "从左到右依次选择"
  ],
  "적용": [
    "Apply",
    "適用",
    "应用"
  ],
  "취소": [
    "Cancel",
    "キャンセル",
    "取消"
  ],
  "{0}번": [
    "Slot {0}",
    "{0}番",
    "第{0}张"
  ],
  "없음": [
    "None",
    "なし",
    "无"
  ],
  "읽은 값 수정": [
    "Correct recognized values",
    "読み取り値の修正",
    "修正识别数值"
  ],
  "보유 카드는 빈칸 없이 왼쪽부터 선택해 주세요.": [
    "Select cards from left to right without empty slots.",
    "手札は空きを挟まず左から選択してください。",
    "请从左到右选择手牌，中间不要留空。"
  ],
  "현재 게임 화면을 다시 보여준 뒤 적용해 주세요.": [
    "Show the current game screen again, then apply.",
    "現在のゲーム画面を再表示してから適用してください。",
    "请重新显示当前游戏画面后再应用。"
  ],
  "입력 중 화면이 바뀌었습니다. 닫은 뒤 최신 값으로 다시 확인해 주세요.": [
    "The screen changed while editing. Close and check the latest values.",
    "入力中に画面が変わりました。閉じて最新の値を再確認してください。",
    "输入期间画面已变化，请关闭后重新确认最新数值。"
  ],
  "입력한 값으로 상태를 확인합니다.": [
    "Checking the state using your entries.",
    "入力した値で状態を確認します。",
    "将根据输入值确认状态。"
  ],
  "공유 화면 미리보기": [
    "Shared screen preview",
    "共有画面プレビュー",
    "共享画面预览"
  ],
  "미리보기 접기": [
    "Collapse preview",
    "プレビューを折りたたむ",
    "收起预览"
  ],
  "미리보기 숨기기": [
    "Hide preview",
    "プレビューを隠す",
    "隐藏预览"
  ],
  "공유 화면": [
    "Shared screen",
    "共有画面",
    "共享画面"
  ],
  "미리보기를 표시할 수 없습니다": [
    "Preview unavailable",
    "プレビューを表示できません",
    "无法显示预览"
  ],
  "공유 화면 미리보기 열기": [
    "Open shared screen preview",
    "共有画面プレビューを開く",
    "打开共享画面预览"
  ],
  "공유 화면 미리보기 숨기기": [
    "Hide shared screen preview",
    "共有画面プレビューを隠す",
    "隐藏共享画面预览"
  ],
  "미리보기 펼치기": [
    "Expand preview",
    "プレビューを展開",
    "展开预览"
  ],
  "어시스트 상태와 안내": [
    "Assist status and guidance",
    "アシストの状態と案内",
    "辅助状态与提示"
  ],
  "확인한 카드 이력": [
    "Checked card history",
    "確認済みカード履歴",
    "已确认的卡牌记录"
  ],
  "음성 안내 설정": [
    "Voice guidance settings",
    "音声案内設定",
    "语音提示设置"
  ],
  "직접 입력": [
    "Enter manually",
    "直接入力",
    "手动输入"
  ],
  "화면": [
    "Screen",
    "画面",
    "画面"
  ],
  "음성": [
    "Voice",
    "音声",
    "语音"
  ],
  "연결 관리": [
    "Connection settings",
    "接続管理",
    "连接管理"
  ],
  "음성 확인": [
    "Check audio",
    "音声確認",
    "检查语音"
  ],
  "음성 켜짐": [
    "Voice on",
    "音声オン",
    "语音已开启"
  ],
  "음성 설정에서 재생을 확인해 주세요": [
    "Check playback in voice settings",
    "音声設定で再生を確認してください",
    "请在语音设置中检查播放"
  ],
  "음성 안내 설정 · 켜짐": [
    "Voice settings · on",
    "音声設定・オン",
    "语音设置 · 已开启"
  ],
  "공유 중 · 연동됨": [
    "Sharing · synced",
    "共有中・同期済み",
    "共享中 · 已同步"
  ],
  "공유 중 · 확인 중": [
    "Sharing · checking",
    "共有中・確認中",
    "共享中 · 确认中"
  ],
  "공유 중지": [
    "Sharing stopped",
    "共有停止",
    "共享已停止"
  ],
  "{0} / 30 확인": [
    "{0} / 30 checked",
    "{0} / 30 確認済み",
    "已确认 {0} / 30"
  ],
  "값 수정": [
    "Edit values",
    "値を修正",
    "修改数值"
  ],
  "문제 확인에 필요한 게임·브라우저 정보를 저장합니다. 문의할 때 파일을 첨부해 주세요.": [
    "Save game and browser information for troubleshooting. Attach the file when contacting support.",
    "問題確認用のゲーム・ブラウザー情報を保存します。お問い合わせ時に添付してください。",
    "保存排查问题所需的游戏和浏览器信息，请在联系时附上文件。"
  ],
  "자동으로 전송되지 않습니다.": [
    "Nothing is sent automatically.",
    "自動送信はされません。",
    "不会自动发送。"
  ],
  "파일 저장": [
    "Save file",
    "ファイル保存",
    "保存文件"
  ],
  "진단 정보": [
    "Diagnostics",
    "診断情報",
    "诊断信息"
  ],
  "문제가 반복되면 진단 정보를 함께 전달해 주세요.": [
    "If the problem persists, include diagnostics when contacting support.",
    "問題が続く場合は診断情報もお送りください。",
    "如问题持续，请同时提供诊断信息。"
  ],
  "값": [
    "Value",
    "値",
    "数值"
  ],
  "{0}–{1} 사이의 숫자": [
    "A number from {0} to {1}",
    "{0}～{1}の数値",
    "{0} 到 {1} 之间的数值"
  ],
  "확인": [
    "OK",
    "確認",
    "确定"
  ],
  "{0}초": [
    "{0}s",
    "{0}秒",
    "{0}秒"
  ],
  "{0}분 {1}초": [
    "{0}m {1}s",
    "{0}分{1}秒",
    "{0}分{1}秒"
  ],
  "{0}시간 {1}분": [
    "{0}h {1}m",
    "{0}時間{1}分",
    "{0}小时{1}分"
  ],
  "다운로드 완료": [
    "Download complete",
    "ダウンロード完了",
    "下载完成"
  ],
  "응답 대기 중": [
    "Waiting for response",
    "応答待ち",
    "等待响应"
  ],
  "속도 확인 중": [
    "Checking speed",
    "速度確認中",
    "正在检查速度"
  ],
  "· 약 {0} 남음": [
    "· about {0} left",
    "・残り約{0}",
    "· 剩余约{0}"
  ],
  "진단 정보 다운로드를 요청했습니다.": [
    "Diagnostics download requested.",
    "診断情報のダウンロードを要求しました。",
    "已请求下载诊断信息。"
  ],
  "문의·제보 접수 폼을 새 탭으로 열까요?": [
    "Open the contact and report form in a new tab?",
    "お問い合わせ・報告フォームを新しいタブで開きますか？",
    "要在新标签页中打开咨询与反馈表单吗？"
  ],
  "저장된 진단 정보 파일은 접수 폼에 직접 첨부해 주세요.": [
    "Attach the saved diagnostics file to the form yourself.",
    "保存した診断ファイルはフォームにご自身で添付してください。",
    "请自行将保存的诊断文件附加到表单。"
  ],
  "접수 폼 열기": [
    "Open form",
    "フォームを開く",
    "打开表单"
  ],
  "나중에": [
    "Later",
    "後で",
    "稍后"
  ],
  "문의·제보": [
    "Contact / report",
    "お問い合わせ・報告",
    "咨询与反馈"
  ],
  "플레이 모드": [
    "Play mode",
    "プレイモード",
    "游玩模式"
  ],
  "는 연결한 게임 화면에서 위치·주사위·카드를 읽어 추천에 반영합니다. 실제 게임은 직접 조작하세요.": [
    " reads position, dice and cards from your shared game screen for recommendations. Control the actual game yourself.",
    "は共有ゲーム画面から位置・サイコロ・カードを読み取り、推薦に反映します。実際のゲームはご自身で操作してください。",
    "会读取共享游戏画面的格数、骰子和手牌并用于推荐。请自行操作实际游戏。"
  ],
  "은 실제 게임의 위치·주사위·카드를 직접 입력하는 모드입니다.": [
    " lets you enter the actual game's position, dice and cards yourself.",
    "では実際のゲームの位置・サイコロ・カードを直接入力します。",
    "模式需要手动输入实际游戏的格数、骰子和手牌。"
  ],
  "은 실제 게임 규칙으로 직접 플레이합니다. 실제 게임을 대신 조작하지 않습니다.": [
    " lets you play here using the actual game rules. It does not control the actual game.",
    "では実際のルールでこのページ上で遊びます。実際のゲームを代わりに操作しません。",
    "模式可按实际规则在此游玩，不会代为操作实际游戏。"
  ],
  "중간부터 연결하면 실제 게임의": [
    "When connecting mid-game, open the game's ",
    "途中から接続する場合、実際のゲームの",
    "中途连接时，请打开实际游戏中的"
  ],
  "카드 획득 이력": [
    "card acquisition history",
    "カード獲得履歴",
    "卡牌获取记录"
  ],
  "읽기 어려운 값은": [
    "For values that are hard to read, use ",
    "読み取りにくい値は",
    "难以识别的数值可通过"
  ],
  "상단 안내의 직접 입력": [
    "manual entry in the top guidance bar",
    "上部の案内の直接入力",
    "顶部提示栏的手动输入"
  ],
  "으로 보완할 수 있습니다. 확인 중에는 추천을 잠시 멈춥니다.": [
    ". Recommendations pause while values are being checked.",
    "で補えます。確認中は推薦を一時停止します。",
    "补充，确认期间会暂停推荐。"
  ],
  "추천 모델을 선택한 뒤 상단": [
    "After choosing a model, enable guidance through the top ",
    "モデル選択後、上部の",
    "选择推荐模型后，可通过顶部的"
  ],
  "에서 음성 안내를 켤 수 있습니다. 한국어·영어·일본어·중국어와 여성·남성 목소리 중에서 골라 사용할 수 있습니다. 음성을 받기 전에 용량을 확인할 수 있고, 브라우저 저장과 삭제도 가능합니다.": [
    " menu. Choose Korean, English, Japanese or Chinese and a female or male voice. Check the size before downloading; browser storage and deletion are also available.",
    "から音声案内を有効にできます。韓国語・英語・日本語・中国語、女性・男性の声を選べます。ダウンロード前に容量を確認でき、保存と削除も可能です。",
    "菜单开启语音。支持韩语、英语、日语、中文以及女声和男声。下载前可查看大小，也可保存到浏览器或删除。"
  ],
  "모드변경": [
    "Settings → Change mode",
    "設定 → モード変更",
    "设置 → 切换模式"
  ],
  "으로 전환해도 마지막으로 확인한 상태는 유지됩니다. 어시스트의 화면 연결을 끝내려면 연결을 해제하거나 다른 모드로 전환하세요.": [
    " preserves the last confirmed state. To stop sharing in Assist mode, disconnect or switch to another mode.",
    "で切り替えても最後の確定状態を維持します。画面共有を終了するには、接続を解除するか別のモードに切り替えてください。",
    "切换后会保留最近确认的状态。要结束辅助画面共享，请断开连接或切换到其他模式。"
  ],
  "위치와 스테이지 이동": [
    "Position and stage movement",
    "位置とステージ移動",
    "位置与关卡移动"
  ],
  "칸 번호": [
    "tile number",
    "マス番号",
    "格数"
  ],
  "를 누르면 위치를 입력할 수 있습니다. 수동 모드 단축키는": [
    " to edit your position. Manual-mode shortcut: ",
    "を押すと位置を入力できます。手動モードのショートカットは",
    "可输入位置。手动模式快捷键为"
  ],
  "입니다.": [
    ".",
    "です。",
    "。"
  ],
  "수동 모드에서는": [
    "In Manual mode, ",
    "手動モードでは",
    "在手动模式中，"
  ],
  "캐릭터를 끌어": [
    "drag the character",
    "キャラクターをドラッグして",
    "拖动角色"
  ],
  "위치를 바꿀 수 있습니다.": [
    " to change position. ",
    "位置を変更できます。",
    "可改变位置。"
  ],
  "스테이지 화살표": [
    "Stage arrows",
    "ステージ矢印",
    "关卡箭头"
  ],
  "{0}는 수동·자동 모드에서 위치를 바꿉니다.": [
    "{0} change your position in Manual and Automatic modes.",
    "{0}で手動・自動モードの位置を変更します。",
    "{0}可在手动和自动模式中改变位置。"
  ],
  "·방향키 ←/→": [
    " / arrow keys ←/→",
    "・方向キー←/→",
    " / 方向键 ←/→"
  ],
  "주사위와 더블": [
    "Dice and doubles",
    "サイコロとゾロ目",
    "骰子与同点"
  ],
  "에서는 주사위 버튼으로 더블 여부를 바꾸고,": [
    ": toggle doubles with the dice button, and use ",
    "ではサイコロボタンでゾロ目を切り替え、",
    "模式中，用骰子按钮切换同点状态，并用"
  ],
  "로 나온 눈의 합을 입력합니다.": [
    " to enter the dice sum.",
    "で出目の合計を入力します。",
    "输入骰子点数之和。"
  ],
  "에서는 주사위 버튼으로 두 개를 굴립니다. 더블이면 다음 주사위는 횟수를 소모하지 않습니다.": [
    ": the dice button rolls two dice. Doubles grant the next roll without using a paid roll.",
    "ではボタンで2個のサイコロを振ります。ゾロ目の場合、次のサイコロは回数を消費しません。",
    "模式中，骰子按钮会掷两枚骰子。同点时，下次掷骰不消耗次数。"
  ],
  "를 눌러 수정할 수 있습니다. 수동 모드 단축키는": [
    " can be clicked to edit it. Manual-mode shortcut: ",
    "を押すと修正できます。手動モードのショートカットは",
    "可点击修改。手动模式快捷键为"
  ],
  "행동별 평가와 추천": [
    "Action values and recommendations",
    "行動評価と推薦",
    "行动评估与推荐"
  ],
  "평가값이 높을수록 유리한 선택": [
    "Higher values indicate better choices",
    "評価が高いほど有利な選択",
    "评估值越高，选择越有利"
  ],
  "입니다. 추천은 가장 높은 값을 가진 선택이며 최종 점수 예측은 아닙니다.": [
    ". The highest value is recommended; these are not final-score estimates.",
    "です。最高評価の行動を推薦します。最終スコア予測ではありません。",
    "。推荐评估值最高的选择，并非最终得分预测。"
  ],
  "목록에 마우스를 올리면 행동별 값을 비교합니다. 클릭 또는": [
    "Hover over the list to compare values. Recalculate by clicking or pressing ",
    "一覧にカーソルを合わせると比較できます。クリックまたは",
    "悬停列表可比较数值，点击或按"
  ],
  "로 다시 계산합니다.": [
    " to recalculate.",
    "で再計算します。",
    "可重新计算。"
  ],
  "작은 화면에서는": [
    "On small screens, press ",
    "小さな画面では",
    "在小屏幕上，请点击"
  ],
  "버튼을 누르세요. 터치에서는 목록을 길게 눌러도 열립니다.": [
    ". On touchscreens, you can also hold the list to open it.",
    "ボタンを押してください。タッチでは一覧の長押しでも開けます。",
    "按钮。触屏也可长按列表打开。"
  ],
  "을 누르면 모델을 바꿀 수 있습니다.": [
    " lets you change the model.",
    "を押すとモデルを変更できます。",
    "可切换模型。"
  ],
  "행동별 점수와 추천": [
    "Action scores and recommendations",
    "行動スコアと推薦",
    "行动分数与推荐"
  ],
  "각 선택 이후를 시뮬레이션한": [
    "Each choice shows the simulated ",
    "各行動後をシミュレーションした",
    "每个选择显示模拟后的"
  ],
  "최종 점수의 평균": [
    "mean final score",
    "最終スコアの平均",
    "最终得分平均值"
  ],
  "입니다. ‘추천’은 평균이 가장 높은 선택, ‘근접’은 추천과 차이가 뚜렷하지 않은 선택입니다.": [
    ". Recommended has the highest mean; Close has no clear difference from it.",
    "です。「おすすめ」は平均最大、「近接」はおすすめとの差が明確でない選択です。",
    "。“推荐”为平均值最高的选择，“接近”表示与推荐的差距不明显。"
  ],
  "행동별 점수는 선택을 비교하는 값으로, G3 추천을 매번 다시 계산하며 따를 때의 예상 최종 점수와는 다릅니다.": [
    "Action scores compare individual choices. They differ from the expected final score when recalculating and following G3 at every step.",
    "行動スコアは選択を比較する値です。毎回G3を再計算して従った場合の予想最終スコアとは異なります。",
    "行动分数用于比较选择，与每步重新计算并遵循 G3 时的预计最终得分不同。"
  ],
  "점수 목록에 마우스를 올리면 전체 비교 표가 열립니다. 목록을 누르거나": [
    "Hover over the score list for a full comparison. Click the list or press ",
    "スコア一覧にカーソルを合わせると比較表が開きます。一覧のクリックまたは",
    "悬停分数列表可打开完整比较表。点击列表或按"
  ],
  "을 누르면 모델·계산 방식을 바꿀 수 있습니다.": [
    " lets you change the model and calculation method.",
    "を押すとモデルと計算方法を変更できます。",
    "可切换模型和计算方式。"
  ],
  "통계 읽는 법": [
    "Reading the statistics",
    "統計の読み方",
    "统计说明"
  ],
  "표본 수": [
    "Sample count",
    "標本数",
    "样本数"
  ],
  "해당 선택을 시뮬레이션한 횟수": [
    "Number of simulations for this choice",
    "その選択をシミュレーションした回数",
    "该选择的模拟次数"
  ],
  "평균 / 중앙값": [
    "Mean / median",
    "平均 / 中央値",
    "平均值 / 中位数"
  ],
  "평균은 모든 결과의 평균, 중앙값은 결과를 정렬했을 때 가운데 값입니다. 비교 표의 대표값은 GPU 평균·CPU 중앙값이며 추천은 둘 다 평균 기준입니다.": [
    "Mean averages all results; median is the middle sorted result. The table displays GPU means and CPU medians, but both recommend by mean.",
    "平均は全結果の平均、中央値は並べた結果の中央です。表はGPU平均・CPU中央値を表示しますが、推薦は両方とも平均基準です。",
    "平均值是全部结果的平均，中位数是排序后的中间值。表中 GPU 显示平均值、CPU 显示中位数，但两者均按平均值推荐。"
  ],
  "시뮬레이션에서 나온 최저~최고 점수": [
    "Lowest to highest simulated score",
    "シミュレーションの最低～最高スコア",
    "模拟中的最低至最高分数"
  ],
  "95% 신뢰구간": [
    "95% confidence interval",
    "95%信頼区間",
    "95% 置信区间"
  ],
  "평균 추정의 불확실성을 나타냅니다. 한 판의 점수가 이 안에 나온다는 뜻은 아닙니다.": [
    "Uncertainty in the estimated mean, not an interval containing an individual game's score.",
    "平均推定の不確実性です。1回のゲームのスコアがこの範囲に入るという意味ではありません。",
    "表示平均值估计的不确定性，并不代表单局得分会落入此区间。"
  ],
  "현재 상태에서": [
    "From the current state, ",
    "現在の状態から",
    "从当前状态开始，"
  ],
  "{0} 추천을 계속 따를 때": [
    "following {0} recommendations continuously",
    "{0}の推薦に従い続けた場合",
    "持续遵循{0}的推荐"
  ],
  "의 최종 점수 예측입니다. 실제 결과를 보장하지 않으며 행동별 평가와 별도로 계산합니다.": [
    " gives this final-score estimate. It is not guaranteed and is calculated separately from action values.",
    "の最終スコア予測です。実際の結果を保証せず、行動評価とは別に計算します。",
    "时的最终得分预测。此值不保证实际结果，与行动评估独立计算。"
  ],
  "괄호는 직전 상태 대비 변화입니다. 위치·카드 등을 직접 수정해도 변하므로 한 번의 행동 효과만 뜻하지는 않습니다.": [
    "Parentheses show change from the previous state. Manual edits also change it, so it does not represent only the effect of one action.",
    "括弧内は直前との差です。位置やカードの直接修正でも変わるため、1行動だけの効果ではありません。",
    "括号内为相对上一状态的变化。手动修改位置或卡牌也会改变它，因此不只代表一次行动的效果。"
  ],
  "게임이 끝나면 실제 최종 점수를 표시합니다. 예측할 수 없으면": [
    "At game end, the actual score is shown. Unavailable estimates display ",
    "終了時は実際の最終スコアを表示します。予測できない場合は",
    "游戏结束时显示实际最终得分，无法预测时显示"
  ],
  "로 표시합니다.": [
    ".",
    "と表示します。",
    "。"
  ],
  "카드 사용과 추가": [
    "Using and adding cards",
    "カードの使用と追加",
    "使用与添加卡牌"
  ],
  "카드를 누르면 사용": [
    "Click a card to use it",
    "カードを押すと使用",
    "点击卡牌即可使用"
  ],
  "합니다.": [
    ".",
    "します。",
    "。"
  ],
  "로 해당 슬롯을 선택할 수도 있습니다.": [
    " also selects the matching slot.",
    "でも該当スロットを選べます。",
    "也可选择对应卡槽。"
  ],
  "우클릭하면 이동 없이 바로 버립니다.": [
    "Right-click to discard without moving.",
    "右クリックで移動せずに捨てます。",
    "右键点击可丢弃卡牌而不移动。"
  ],
  "터치에서는 길게 누른 뒤 ‘버리기’를 선택하세요.": [
    "On touchscreens, hold the card and choose Discard.",
    "タッチでは長押しして「捨てる」を選んでください。",
    "触屏请长按后选择“丢弃”。"
  ],
  "수동 모드에서": [
    "In Manual mode, ",
    "手動モードでは",
    "在手动模式中，"
  ],
  "배수 카드는 실제 주사위 눈의 합(2~12)": [
    "multiplier cards require the actual dice sum (2–12)",
    "倍率カードは実際の出目の合計（2～12）",
    "倍率卡需要实际骰子点数之和（2–12）"
  ],
  "을 선택해 사용합니다. 숫자 버튼을 누르거나 입력 후": [
    ". Select a number button, or enter a number and press ",
    "を選択して使用します。数字ボタンを押すか、入力後に",
    "。点击数字按钮，或输入后按"
  ],
  "로 적용하며,": [
    " to apply; press ",
    "で適用し、",
    "应用，按"
  ],
  "또는 취소로 돌아갑니다.": [
    " or Cancel to go back.",
    "またはキャンセルで戻ります。",
    "或“取消”返回。"
  ],
  "빈 슬롯": [
    "an empty slot",
    "空きスロット",
    "空卡槽"
  ],
  "이나": [
    " or ",
    "または",
    "或"
  ],
  "로 카드를 검색해 추가합니다. 자동 모드에서는 카드 획득 칸에서 뽑습니다.": [
    " lets you find and add a card. Automatic mode draws cards on card tiles.",
    "でカードを検索・追加できます。自動モードではカードマスで引きます。",
    "可搜索并添加卡牌。自动模式在卡牌格抽取。"
  ],
  "카드 검색 예시": [
    "Card search examples",
    "カード検索の例",
    "卡牌搜索示例"
  ],
  "이름 일부": [
    "Part of a name",
    "名前の一部",
    "部分名称"
  ],
  "카드 이름에 포함된 글자로 검색": [
    "Search text contained in the card name",
    "カード名に含まれる文字で検索",
    "按卡牌名称包含的文字搜索"
  ],
  "+10 또는 10": [
    "+10 or 10",
    "+10 または 10",
    "+10 或 10"
  ],
  "앞으로 10칸": [
    "Forward 10 tiles",
    "前に10マス",
    "前进10格"
  ],
  "뒤로 5칸": [
    "Back 5 tiles",
    "後ろに5マス",
    "后退5格"
  ],
  "주사위 2배": [
    "Dice ×2",
    "サイコロ2倍",
    "骰子2倍"
  ],
  "도착 미리보기": [
    "Arrival preview",
    "到着プレビュー",
    "落点预览"
  ],
  "보드에는": [
    "The board shows ",
    "ボードには",
    "棋盘上显示"
  ],
  "도착 위치별 확률": [
    "arrival probabilities by tile",
    "到着位置ごとの確率",
    "各落点的概率"
  ],
  "이 표시됩니다. 여러 주사위 결과가 같은 위치에 도착하면 확률을 합칩니다.": [
    ". Dice outcomes landing on the same tile have their probabilities combined.",
    "を表示します。複数の出目が同じ場所に着く場合、確率を合算します。",
    "。多个骰子结果到达同一位置时，概率会合并。"
  ],
  "주사위나 카드에 마우스를 올리면 카드칸·점프칸·멈춤칸 확률을 볼 수 있습니다. 현재 스테이지의 도착 위치는 보드 위에 표시됩니다.": [
    "Hover over dice or cards for card, jump and stop tile probabilities. Destinations in the current stage appear on the board.",
    "サイコロやカードにカーソルを合わせるとカード・ジャンプ・停止マスの確率を表示します。現在のステージの到着位置はボード上に表示します。",
    "悬停骰子或卡牌可查看卡牌格、跳跃格和停止格的概率，当前关卡落点会显示在棋盘上。"
  ],
  "터치에서는 주사위를 길게 누르거나, 카드를 길게 누른 뒤": [
    "On touchscreens, hold the dice button, or hold a card and choose ",
    "タッチではサイコロを長押しするか、カードを長押しして",
    "触屏请长按骰子，或长按卡牌后选择"
  ],
  "을 선택하세요.": [
    ".",
    "を選んでください。",
    "。"
  ],
  "전체 카드와 획득 표시": [
    "All cards and obtained marks",
    "全カードと獲得表示",
    "全部卡牌与获取标记"
  ],
  "버튼으로 전체 카드 목록을 열고 닫습니다.": [
    " opens and closes the full card list.",
    "ボタンで全カード一覧を開閉します。",
    "按钮可打开或关闭全部卡牌列表。"
  ],
  "수동 모드에서는 목록의 카드를 눌러 획득 표시를 바꾸고, 우클릭하거나 길게 누르면 손패에 추가할 수 있습니다.": [
    "In Manual mode, click a listed card to toggle its obtained mark. Right-click or hold it to add it to your hand.",
    "手動モードではカードを押して獲得表示を変更できます。右クリックや長押しで手札に追加できます。",
    "手动模式中点击列表卡牌可切换获取标记，右键或长按可加入手牌。"
  ],
  "획득 표시만 바꿔도 손패는 바뀌지 않습니다. 손패에 추가하면 획득 표시도 함께 바뀝니다. 자동 모드에서는 획득 표시 해제만 가능합니다.": [
    "Changing only the obtained mark does not change your hand. Adding a card to your hand also marks it obtained. Automatic mode only allows unmarking.",
    "獲得表示だけの変更では手札は変わりません。手札に追加すると獲得表示も変わります。自動モードでは表示解除のみ可能です。",
    "仅修改获取标记不会改变手牌，加入手牌时会同步标记。自动模式仅允许取消标记。"
  ],
  "다시 시작": [
    "Restarting",
    "再スタート",
    "重新开始"
  ],
  "을 누르고 확인하면 위치·주사위·카드가 초기화됩니다. 이 페이지를 열어 둔 동안의 최고 기록은 유지됩니다.": [
    " and confirm to reset position, dice and cards. Your best record for this page visit is kept.",
    "を押して確認すると位置・サイコロ・カードを初期化します。このページを開いている間の最高記録は維持します。",
    "并确认后会重置位置、骰子和手牌，但保留本次页面访问中的最高记录。"
  ],
  "조작이 헷갈리면": [
    "For a reminder of the controls, open ",
    "操作に迷ったら",
    "不清楚操作时可打开"
  ],
  "도움말": [
    "Help",
    "ヘルプ",
    "帮助"
  ],
  "에서 다시 확인하세요.": [
    " again.",
    "で再確認してください。",
    "重新查看。"
  ],
  "이전 안내": [
    "Previous tip",
    "前の案内",
    "上一条提示"
  ],
  "자세히": [
    "Details",
    "詳細",
    "详情"
  ],
  "건너뛰기": [
    "Skip",
    "スキップ",
    "跳过"
  ],
  "이전": [
    "Back",
    "戻る",
    "上一步"
  ],
  "다음": [
    "Next",
    "次へ",
    "下一步"
  ],
  "문제가 있나요?": [
    "Having trouble?",
    "お困りですか？",
    "遇到问题？"
  ],
  "진단 정보 저장": [
    "Save diagnostics",
    "診断情報を保存",
    "保存诊断信息"
  ],
  "Adventure 사용 안내": [
    "Adventure guide",
    "Adventure利用ガイド",
    "Adventure 使用指南"
  ],
  "완료": [
    "Done",
    "完了",
    "完成"
  ],
  "도움말 종료": [
    "Close help",
    "ヘルプ終了",
    "关闭帮助"
  ],
  "도움말을 종료할까요? 도움말 버튼으로 언제든 다시 열 수 있습니다.": [
    "Close help? You can reopen it anytime using the Help button.",
    "ヘルプを終了しますか？ヘルプボタンでいつでも再表示できます。",
    "要关闭帮助吗？可随时通过帮助按钮重新打开。"
  ],
  "설명 접기": [
    "Collapse details",
    "説明を閉じる",
    "收起说明"
  ],
  "파일 읽기": [
    "Read file",
    "ファイル読み込み",
    "读取文件"
  ],
  "다운로드": [
    "Download",
    "ダウンロード",
    "下载"
  ],
  "메모리 여유 약 {0} 이상 권장 · 기기별 차이": [
    "About {0} free memory recommended · varies by device",
    "空きメモリー約{0}以上推奨・端末により異なります",
    "建议可用内存约 {0} 以上 · 因设备而异"
  ],
  "메모리 사용량은 기기와 게임 상태에 따라 달라집니다.": [
    "Memory usage varies by device and game state.",
    "メモリー使用量は端末とゲーム状態によって異なります。",
    "内存使用量因设备和游戏状态而异。"
  ],
  "평균 기록": [
    "Mean score",
    "平均記録",
    "平均记录"
  ],
  "약 {0}점": [
    "About {0} pts",
    "約{0}点",
    "约{0}分"
  ],
  "추론 시간": [
    "Inference time",
    "推論時間",
    "推理耗时"
  ],
  "사용 가능 여부 확인 중": [
    "Checking availability",
    "利用可否を確認中",
    "正在检查可用性"
  ],
  "VELA 사용 가능 여부": [
    "VELA availability",
    "VELA利用可否",
    "VELA 可用性"
  ],
  "이유·해결 방법": [
    "Reasons and solutions",
    "原因・解決方法",
    "原因与解决方法"
  ],
  "이 PC의 모델 불러오기 · 약 68 MB": [
    "Load this PC's model · about 68 MB",
    "このPCのモデルを読み込み・約68 MB",
    "加载此电脑的模型 · 约 68 MB"
  ],
  "첫 사용 시 모델 전체 다운로드 · 약 68 MB": [
    "Download the full model on first use · about 68 MB",
    "初回はモデル全体をダウンロード・約68 MB",
    "首次使用下载完整模型 · 约 68 MB"
  ],
  "추천 없이 시작할까요?": [
    "Start without recommendations?",
    "推薦なしで開始しますか？",
    "不使用推荐开始？"
  ],
  "행동 추천 없이 게임을 이용합니다. 나중에 ‘모델 선택’에서 추천을 켤 수 있습니다.": [
    "Play without action recommendations. Enable them later through Select model.",
    "行動推薦なしで利用します。後から「モデル選択」で有効にできます。",
    "在没有行动推荐的情况下使用，之后可通过“选择模型”开启。"
  ],
  "추천 없이 시작": [
    "Start without recommendations",
    "推薦なしで開始",
    "不使用推荐开始"
  ],
  "모델": [
    "Model",
    "モデル",
    "模型"
  ],
  "기존 화면으로 이동": [
    "Open previous version",
    "旧画面へ移動",
    "打开旧版"
  ],
  "게임의 다음 선택을 도와줄 모델을 고르세요.": [
    "Choose a model to help with your next move.",
    "次の行動を支援するモデルを選んでください。",
    "请选择帮助决定下一步行动的模型。"
  ],
  "CPU로 바로 판단": [
    "Immediate CPU decisions",
    "CPUで即座に判断",
    "CPU 即时判断"
  ],
  "시뮬레이션으로 선택 비교": [
    "Compare choices by simulation",
    "シミュレーションで選択を比較",
    "通过模拟比较选择"
  ],
  "GPU 또는 CPU · 사용량 선택 가능": [
    "GPU or CPU · adjustable usage",
    "GPUまたはCPU・使用量を選択可能",
    "GPU 或 CPU · 可调整用量"
  ],
  "참고값 · 모델별 평가 표본이 다름 · 기기·상태별 차이": [
    "Reference values · different evaluation samples · varies by device and state",
    "参考値・モデルごとに評価標本が異なる・端末と状態により変動",
    "参考值 · 各模型评估样本不同 · 因设备和状态而异"
  ],
  "기존 화면": [
    "Previous version",
    "旧画面",
    "旧版"
  ],
  "이전에 저장한 모델이 있습니다.": [
    "A previously saved model is available.",
    "以前保存したモデルがあります。",
    "有之前保存的模型。"
  ],
  "이 브라우저에 모델 저장을 허용했습니다.": [
    "Model storage is allowed in this browser.",
    "このブラウザーでモデル保存を許可しました。",
    "已允许在此浏览器保存模型。"
  ],
  "저장된 모델 삭제": [
    "Delete saved model",
    "保存モデルを削除",
    "删除保存的模型"
  ],
  "저장 해제·삭제": [
    "Disable storage / delete",
    "保存解除・削除",
    "停止保存并删除"
  ],
  "저장된 모델을 삭제했습니다.": [
    "Saved model deleted.",
    "保存モデルを削除しました。",
    "已删除保存的模型。"
  ],
  "다시 삭제": [
    "Retry deletion",
    "削除を再試行",
    "重新删除"
  ],
  "모델 파일을 삭제하지 못했습니다. 다른 Adventure 탭을 닫고 다시 시도해 주세요.": [
    "Could not delete the model file. Close other Adventure tabs and retry.",
    "モデルを削除できませんでした。他のAdventureタブを閉じて再試行してください。",
    "无法删除模型文件，请关闭其他 Adventure 标签页后重试。"
  ],
  "VELA 준비": [
    "Prepare VELA",
    "VELAの準備",
    "准备 VELA"
  ],
  "사용할 모델을 확인하고 있습니다.": [
    "Checking the model to use.",
    "使用するモデルを確認しています。",
    "正在确认要使用的模型。"
  ],
  "이 PC의 모델 파일을 불러옵니다.": [
    "Loading the model file from this PC.",
    "このPCのモデルを読み込みます。",
    "将读取此电脑的模型文件。"
  ],
  "모델 파일": [
    "Model file",
    "モデルファイル",
    "模型文件"
  ],
  "모델 불러오기": [
    "Load model",
    "モデル読み込み",
    "加载模型"
  ],
  "모델 저장 동의": [
    "Model storage consent",
    "モデル保存への同意",
    "模型保存许可"
  ],
  "이 브라우저에 저장": [
    "Save in this browser",
    "このブラウザーに保存",
    "保存到此浏览器"
  ],
  "저장 공간과 사용 가능 여부를 확인합니다.": [
    "Checking storage and availability.",
    "保存容量と利用可否を確認します。",
    "正在检查存储空间和可用性。"
  ],
  "이번에만 사용": [
    "Use once",
    "今回のみ使用",
    "仅本次使用"
  ],
  "모델은 준비되어 있습니다. 다음 접속을 위한 저장 여부를 선택하세요.": [
    "The model is ready. Choose whether to save it for next time.",
    "モデルは準備済みです。次回用に保存するか選んでください。",
    "模型已就绪，请选择是否保存供下次使用。"
  ],
  "이 PC의 모델 파일을 불러와 준비합니다.": [
    "Loading and preparing this PC's model file.",
    "このPCのモデルを読み込んで準備します。",
    "读取此电脑的模型文件并准备。"
  ],
  "전체 모델을 한 번 내려받아 준비합니다.": [
    "Downloading the full model once to prepare it.",
    "モデル全体を一度ダウンロードして準備します。",
    "下载一次完整模型以准备使用。"
  ],
  "저장 시 파일을 다시 읽습니다": [
    "Saving requires reading the file again",
    "保存時にファイルを再読み込み",
    "保存时需重新读取文件"
  ],
  "저장 시 다시 다운로드": [
    "Saving requires another download",
    "保存時に再ダウンロード",
    "保存时需重新下载"
  ],
  "모델을 브라우저에도 저장할까요?": [
    "Also save the model in this browser?",
    "モデルをブラウザーにも保存しますか？",
    "也将模型保存到浏览器吗？"
  ],
  "다음에도 다운로드 없이 사용할까요?": [
    "Use it next time without downloading again?",
    "次回もダウンロードせずに使いますか？",
    "下次无需下载直接使用？"
  ],
  "다음 접속 때 이 PC의 파일을 다시 읽습니다.": [
    "The file on this PC will be read again next visit.",
    "次回はこのPCのファイルを再読み込みします。",
    "下次访问时将重新读取此电脑的文件。"
  ],
  "다음 접속 때 다시 다운로드합니다.": [
    "It will be downloaded again next visit.",
    "次回は再ダウンロードします。",
    "下次访问时将重新下载。"
  ],
  "브라우저 저장 공간을 별도로 사용합니다.": [
    "Uses additional browser storage.",
    "ブラウザーの保存容量を別途使用します。",
    "会另外占用浏览器存储空间。"
  ],
  "브라우저 데이터 정리나 저장 공간 부족 시 다시 다운로드할 수 있습니다.": [
    "Clearing browser data or low storage may require a new download.",
    "データ削除や空き容量不足の場合、再ダウンロードが必要になることがあります。",
    "清理浏览器数据或存储空间不足时可能需要重新下载。"
  ],
  "모델 저장": [
    "Save model",
    "モデルを保存",
    "保存模型"
  ],
  "설정 변경": [
    "Change settings",
    "設定変更",
    "修改设置"
  ],
  "저장 확인 중": [
    "Checking storage",
    "保存確認中",
    "正在检查存储"
  ],
  "모델 {1}": [
    "Model {1}",
    "モデル{1}",
    "模型{1}"
  ],
  "모델 준비": [
    "Prepare model",
    "モデル準備",
    "准备模型"
  ],
  "준비하고 있습니다.": [
    "Preparing.",
    "準備しています。",
    "正在准备。"
  ],
  "잠시만 기다려 주세요.": [
    "Please wait a moment.",
    "しばらくお待ちください。",
    "请稍候。"
  ],
  "준비 중": [
    "Preparing",
    "準備中",
    "准备中"
  ],
  "대기 중": [
    "Waiting",
    "待機中",
    "等待中"
  ],
  "모델을 메모리에 준비하는 중": [
    "Preparing the model in memory",
    "モデルをメモリーに準備中",
    "正在将模型载入内存"
  ],
  "VELA를 불러오는 중": [
    "Loading VELA",
    "VELAを読み込み中",
    "正在加载 VELA"
  ],
  "VELA를 내려받는 중": [
    "Downloading VELA",
    "VELAをダウンロード中",
    "正在下载 VELA"
  ],
  "모델 파일을 다시 읽는 중": [
    "Rereading the model file",
    "モデルファイルを再読み込み中",
    "正在重新读取模型文件"
  ],
  "모델을 다시 내려받는 중": [
    "Redownloading the model",
    "モデルを再ダウンロード中",
    "正在重新下载模型"
  ],
  "VELA를 준비하는 중": [
    "Preparing VELA",
    "VELAを準備中",
    "正在准备 VELA"
  ],
  "브라우저 저장본 대신 이 PC의 모델 파일을 읽습니다.": [
    "Reading this PC's model file instead of the browser copy.",
    "ブラウザーの保存本ではなく、このPCのモデルを読み込みます。",
    "将读取此电脑的模型文件，而非浏览器保存的副本。"
  ],
  "저장된 파일을 확인하지 못해 새로 받습니다.": [
    "Could not verify the saved file; downloading again.",
    "保存ファイルを確認できないため、再取得します。",
    "无法验证保存文件，将重新下载。"
  ],
  "준비가 끝나면 바로 사용할 수 있습니다.": [
    "Ready to use as soon as preparation finishes.",
    "準備完了後すぐに使用できます。",
    "准备完成后即可使用。"
  ],
  "저장된 파일": [
    "Saved file",
    "保存ファイル",
    "保存的文件"
  ],
  "저장된 모델 읽기": [
    "Read saved model",
    "保存モデルを読み込み",
    "读取保存的模型"
  ],
  "모델 {0}": [
    "Model {0}",
    "モデル{0}",
    "模型{0}"
  ],
  "{0} 준비 완료": [
    "{0} ready",
    "{0}準備完了",
    "{0}已就绪"
  ],
  "이제 다음 선택을 비교할 수 있습니다.": [
    "You can now compare your next choices.",
    "次の選択を比較できます。",
    "现在可以比较下一步选择。"
  ],
  "이 브라우저에 저장된 모델을 다음에도 사용합니다.": [
    "The model saved in this browser will be used next time.",
    "次回もブラウザーに保存したモデルを使用します。",
    "下次会使用保存在此浏览器中的模型。"
  ],
  "이번 접속 동안 모델을 사용할 수 있습니다.": [
    "The model is available for this visit.",
    "今回の接続中はモデルを使用できます。",
    "本次访问可使用模型。"
  ],
  "모델을 저장하지 못했습니다. {0}": [
    "Could not save the model. {0}",
    "モデルを保存できませんでした。{0}",
    "无法保存模型。{0}"
  ],
  "다음 접속 때 다시 다운로드할 수 있습니다.": [
    "You may need to download it again next visit.",
    "次回、再ダウンロードが必要になる場合があります。",
    "下次访问可能需要重新下载。"
  ],
  "시작": [
    "Start",
    "開始",
    "开始"
  ],
  "모델을 저장하지 못했습니다. 이번에는 사용할 수 있습니다.": [
    "Could not save the model. It is available for this visit.",
    "モデルを保存できませんでした。今回は使用できます。",
    "无法保存模型，本次仍可使用。"
  ],
  "X36 준비": [
    "Prepare X36",
    "X36の準備",
    "准备 X36"
  ],
  "계산 엔진을 준비하고 있습니다.": [
    "Preparing the calculation engine.",
    "計算エンジンを準備しています。",
    "正在准备计算引擎。"
  ],
  "모델을 준비하지 못했습니다": [
    "Could not prepare the model",
    "モデルを準備できませんでした",
    "无法准备模型"
  ],
  "다시 시도하거나 다른 모델을 선택할 수 있습니다.": [
    "Try again or select another model.",
    "再試行するか、別のモデルを選択してください。",
    "请重试或选择其他模型。"
  ],
  "화면을 연결해 주세요": [
    "Connect a screen",
    "画面を接続してください",
    "请连接画面"
  ],
  "화면 선택 중": [
    "Choosing a screen",
    "画面選択中",
    "正在选择画面"
  ],
  "화면 연결됨": [
    "Screen connected",
    "画面接続済み",
    "画面已连接"
  ],
  "화면 일시 중지": [
    "Screen paused",
    "画面一時停止",
    "画面已暂停"
  ],
  "연결 끊김": [
    "Disconnected",
    "切断",
    "已断开"
  ],
  "화면 공유는 HTTPS 주소나 로컬 서버에서 사용할 수 있습니다.": [
    "Screen sharing requires HTTPS or a local server.",
    "画面共有はHTTPSまたはローカルサーバーで利用できます。",
    "屏幕共享需要 HTTPS 或本地服务器。"
  ],
  "이 브라우저에서는 화면 공유를 사용할 수 없습니다. PC의 화면 공유 지원 브라우저에서 열어 주세요.": [
    "Screen sharing is unavailable in this browser. Use a supported desktop browser.",
    "このブラウザーでは画面共有を利用できません。対応するPCブラウザーで開いてください。",
    "此浏览器不支持屏幕共享，请使用支持共享的电脑浏览器。"
  ],
  "화면을 연결하지 않았습니다. 다시 선택하거나 브라우저의 공유 권한을 확인해 주세요.": [
    "No screen connected. Select again or check browser sharing permissions.",
    "画面を接続していません。再選択するか、共有権限を確認してください。",
    "未连接画面，请重新选择或检查浏览器共享权限。"
  ],
  "공유할 화면이 없습니다. 게임 창을 연 뒤 다시 연결해 주세요.": [
    "No screen to share. Open the game window and reconnect.",
    "共有する画面がありません。ゲームを開いて再接続してください。",
    "没有可共享的画面，请打开游戏窗口后重新连接。"
  ],
  "화면을 가져오지 못했습니다. 게임 창과 브라우저의 화면 공유 권한을 확인해 주세요.": [
    "Could not capture the screen. Check the game window and browser sharing permissions.",
    "画面を取得できませんでした。ゲームウィンドウと共有権限を確認してください。",
    "无法获取画面，请检查游戏窗口及浏览器共享权限。"
  ],
  "이 브라우저에서는 화면 인식을 사용할 수 없습니다. 최신 PC 브라우저에서 열어 주세요.": [
    "Screen recognition is unavailable in this browser. Use an updated desktop browser.",
    "このブラウザーでは画面認識を利用できません。最新のPCブラウザーで開いてください。",
    "此浏览器不支持画面识别，请使用新版电脑浏览器。"
  ],
  "미리보기를 재생하지 못했습니다. 화면을 다시 연결해 주세요.": [
    "Could not play the preview. Reconnect the screen.",
    "プレビューを再生できませんでした。画面を再接続してください。",
    "无法播放预览，请重新连接画面。"
  ],
  "모드 선택": [
    "Select mode",
    "モード選択",
    "选择模式"
  ],
  "{0} 모드로 전환했습니다.": [
    "Switched to {0} mode.",
    "{0}モードに切り替えました。",
    "已切换到{0}模式。"
  ],
  "어떤 방식으로 플레이할까요?": [
    "How would you like to play?",
    "どのモードでプレイしますか？",
    "想以哪种方式游玩？"
  ],
  "모드를 바꿔도 현재 위치·주사위·카드는 유지됩니다.": [
    "Changing mode preserves your position, dice and cards.",
    "モードを変えても位置・サイコロ・カードは維持します。",
    "切换模式会保留位置、骰子和手牌。"
  ],
  "게임 화면을 읽어 상태와 추천을 자동 반영": [
    "Read the game screen to update state and recommendations",
    "ゲーム画面から状態と推薦を自動更新",
    "读取游戏画面并自动更新状态和推荐"
  ],
  "실제 게임은 직접 조작합니다.": [
    "You control the actual game yourself.",
    "実際のゲームはご自身で操作します。",
    "实际游戏由您自行操作。"
  ],
  "실제 게임의 결과를 직접 입력": [
    "Enter results from the actual game manually",
    "実際のゲーム結果を直接入力",
    "手动输入实际游戏结果"
  ],
  "실제 게임 규칙으로 직접 플레이": [
    "Play here using the actual game rules",
    "実際のルールでこのページ上でプレイ",
    "按实际游戏规则在此游玩"
  ],
  "실제 게임을 대신 조작하지 않습니다.": [
    "Does not control the actual game.",
    "実際のゲームを代わりに操作しません。",
    "不会代为操作实际游戏。"
  ],
  "사용 중": [
    "In use",
    "使用中",
    "使用中"
  ],
  "공유 중인 게임 화면": [
    "Shared game screen",
    "共有中のゲーム画面",
    "正在共享的游戏画面"
  ],
  "‹ 모드 선택": [
    "‹ Select mode",
    "‹ モード選択",
    "‹ 选择模式"
  ],
  "화면 미리보기": [
    "Screen preview",
    "画面プレビュー",
    "画面预览"
  ],
  "게임 창 하나를 선택해 주세요.": [
    "Select one game window.",
    "ゲームウィンドウを1つ選んでください。",
    "请选择一个游戏窗口。"
  ],
  "화면이 일시 중지되었습니다.": [
    "Screen is paused.",
    "画面が一時停止しています。",
    "画面已暂停。"
  ],
  "점수·주사위·손패를 읽어 추천에 반영합니다. 확인이 필요하면 화면 위쪽에서 알려드립니다.": [
    "Reads score, dice and hand for recommendations. Any checks needed appear at the top.",
    "スコア・サイコロ・手札を推薦に反映します。確認が必要な場合は上部に表示します。",
    "读取分数、骰子和手牌用于推荐，需要确认时会在顶部提示。"
  ],
  "화면 연결 안내": [
    "Screen connection guide",
    "画面接続ガイド",
    "画面连接指南"
  ],
  "게임 창 선택": [
    "Select game window",
    "ゲームウィンドウ選択",
    "选择游戏窗口"
  ],
  "‘화면 연결’을 누르고 게임이 열린 창이나 탭을 선택하세요. 게임 창을 원래 크기로 표시하고 최소화하지 마세요. 소리는 공유하지 않습니다.": [
    "Press Connect screen and choose the game's window or tab. Keep the game at original size and do not minimize it. Audio is not shared.",
    "「画面接続」でゲームのウィンドウかタブを選びます。元のサイズで表示し、最小化しないでください。音声は共有しません。",
    "点击“连接画面”并选择游戏窗口或标签页。请保持原始大小，不要最小化游戏窗口。不会共享声音。"
  ],
  "화면 확인": [
    "Check screen",
    "画面確認",
    "确认画面"
  ],
  "현재 칸·주사위 사용 횟수·보유 카드가 가려지지 않게 해 주세요. 중간부터 시작하면 실제 게임의 카드 획득 이력을 열고 위부터 아래까지 천천히 스크롤하세요.": [
    "Keep the current tile, dice count and cards visible. When joining mid-game, open card history in the game and scroll slowly from top to bottom.",
    "現在のマス・サイコロ回数・手札を隠さないでください。途中参加ではゲームのカード履歴を開き、上から下へゆっくりスクロールしてください。",
    "请勿遮挡当前格数、骰子次数和手牌。中途开始时请打开实际游戏的卡牌记录，从上到下缓慢滚动。"
  ],
  "작은 미리보기는 끌어서 옮기거나 접을 수 있습니다. 이 창을 닫아도 공유는 유지됩니다. ‘연결 해제’나 다른 모드로 전환하면 공유가 끝나며, 기존 게임 상태는 유지됩니다.": [
    "Drag or collapse the small preview. Closing this dialog keeps sharing active. Disconnecting or switching modes stops sharing while preserving the game state.",
    "小さなプレビューは移動・折りたたみができます。このウィンドウを閉じても共有は続きます。切断やモード変更で共有が終了し、ゲーム状態は維持します。",
    "可拖动或收起小预览。关闭此窗口仍会继续共享，断开连接或切换模式会停止共享并保留游戏状态。"
  ],
  "선택한 화면은 이 브라우저에서만 확인하며, 녹화·전송하지 않습니다.": [
    "The selected screen is processed only in this browser; it is not recorded or transmitted.",
    "選択した画面はこのブラウザー内でのみ処理し、録画・送信しません。",
    "所选画面仅在此浏览器内处理，不会录制或传输。"
  ],
  "화면 연결": [
    "Connect screen",
    "画面接続",
    "连接画面"
  ],
  "덱 다시 확인": [
    "Recheck deck",
    "デッキ再確認",
    "重新确认牌库"
  ],
  "연결 해제": [
    "Disconnect",
    "接続解除",
    "断开连接"
  ],
  "수동 모드로": [
    "Use Manual mode",
    "手動モードへ",
    "转到手动模式"
  ],
  "화면 공유 미지원": [
    "Screen sharing unsupported",
    "画面共有に非対応",
    "不支持屏幕共享"
  ],
  "화면 선택 중…": [
    "Choosing screen…",
    "画面選択中…",
    "正在选择画面…"
  ],
  "화면 바꾸기": [
    "Change screen",
    "画面変更",
    "更换画面"
  ],
  "다시 연결": [
    "Reconnect",
    "再接続",
    "重新连接"
  ],
  "공유할 화면을 선택해 주세요": [
    "Select a screen to share",
    "共有する画面を選んでください",
    "请选择要共享的画面"
  ],
  "화면 공유를 사용할 수 없습니다": [
    "Screen sharing unavailable",
    "画面共有を利用できません",
    "屏幕共享不可用"
  ],
  "함께 볼 화면을 연결하세요": [
    "Connect the screen to view together",
    "共有する画面を接続してください",
    "请连接要查看的画面"
  ],
  "주사위 눈의 합": [
    "Dice sum",
    "サイコロの合計",
    "骰子点数之和"
  ],
  "나온 눈의 합": [
    "Rolled sum",
    "出目の合計",
    "掷出的点数之和"
  ],
  "Enter 적용": [
    "Enter to apply",
    "Enterで適用",
    "Enter 应用"
  ],
  "{0} × {1} = {2}칸": [
    "{0} × {1} = {2} tiles",
    "{0} × {1} = {2}マス",
    "{0} × {1} = {2}格"
  ],
  "눈의 합을 선택하세요.": [
    "Choose the dice sum.",
    "出目の合計を選んでください。",
    "请选择骰子点数之和。"
  ],
  "2~12 사이의 합을 입력하세요.": [
    "Enter a sum from 2 to 12.",
    "2～12の合計を入力してください。",
    "请输入 2 到 12 之间的点数之和。"
  ],
  "주사위 {0}배": [
    "Dice ×{0}",
    "サイコロ{0}倍",
    "骰子{0}倍"
  ],
  "v2 업데이트 안내": [
    "v2 update",
    "v2アップデート",
    "v2 更新说明"
  ],
  "버전 {0}": [
    "Version {0}",
    "バージョン{0}",
    "版本{0}"
  ],
  "어시스트 모드 (BETA)": [
    "Assist mode (BETA)",
    "アシストモード（BETA）",
    "辅助模式（BETA）"
  ],
  "화면 공유를 통해 실제 인게임 화면(보유 카드, 캐릭터 위치, 진행도)을 실시간으로 자동 인식하고, 최적의 카드 사용 및 주사위 행동을 추천합니다.": [
    "Screen sharing recognizes your hand, position and progress in real time, and recommends card use and dice actions.",
    "画面共有で手札・位置・進行状況をリアルタイム認識し、カード使用やサイコロ行動を推薦します。",
    "通过屏幕共享实时识别手牌、角色位置及进度，并推荐卡牌和骰子行动。"
  ],
  "Gemini AI 실시간 음성 가이드": [
    "Gemini AI voice guidance",
    "Gemini AI音声ガイド",
    "Gemini AI 语音引导"
  ],
  "추천 행동, 카드 사용 및 주사위 굴리기를 4개 국어(한국어, 영어, 일본어, 중국어) 남/여성 AI 보이스로 생생하게 안내합니다. 상단": [
    "AI voices guide recommended actions in Korean, English, Japanese and Chinese, with female and male options. Use the top ",
    "韓国語・英語・日本語・中国語の女性・男性AI音声で推薦行動を案内します。上部の",
    "支持韩语、英语、日语、中文的男女 AI 语音，提示推荐行动、卡牌使用和掷骰。可在顶部"
  ],
  "[음성]": [
    "[Voice]",
    "［音声］",
    "[语音]"
  ],
  "메뉴에서 보이스 및 볼륨을 설정할 수 있습니다.": [
    " menu to choose a voice and volume.",
    "メニューから声と音量を設定できます。",
    "菜单中设置声音和音量。"
  ],
  "자유로운 모드 전환 & 도움말": [
    "Flexible modes and help",
    "モード切り替えとヘルプ",
    "自由切换模式与帮助"
  ],
  "하단": [
    "Use the bottom ",
    "下部の",
    "通过底部的"
  ],
  "[모드변경]": [
    "[Settings → Change mode]",
    "［設定 → モード変更］",
    "[设置 → 切换模式]"
  ],
  "버튼을 통해": [
    " button to switch between ",
    "ボタンから",
    "按钮，可在"
  ],
  "수동 / 자동 / 어시스트": [
    "Manual / Automatic / Assist",
    "手動 / 自動 / アシスト",
    "手动 / 自动 / 辅助"
  ],
  "모드를 언제든 손쉽게 전환할 수 있습니다. 좌상단 확성기 아이콘을 누르면 언제든지 이 공지를 다시 볼 수 있습니다.": [
    " anytime. Reopen this notice using the speaker icon at the top left.",
    "をいつでも切り替えられます。左上の拡声器アイコンでこのお知らせを再表示できます。",
    "模式间随时切换。点击左上角扩音器图标可再次查看此公告。"
  ],
  "다시 보지 않기": [
    "Don't show again",
    "次回から表示しない",
    "不再显示"
  ],
  "새로운 기능 안내": [
    "New features",
    "新機能のお知らせ",
    "新功能介绍"
  ],
  "알림 닫기": [
    "Dismiss notification",
    "通知を閉じる",
    "关闭通知"
  ],
  "카드칸": [
    "Card tile",
    "カードマス",
    "卡牌格"
  ],
  "점프칸": [
    "Jump tile",
    "ジャンプマス",
    "跳跃格"
  ],
  "멈춤칸": [
    "Stop tile",
    "停止マス",
    "停止格"
  ],
  "낮음": [
    "Low",
    "低",
    "低"
  ],
  "다른 작업 우선": [
    "Prioritize other tasks",
    "他の作業優先",
    "优先其他任务"
  ],
  "보통": [
    "Medium",
    "中",
    "中"
  ],
  "균형": [
    "Balanced",
    "バランス",
    "均衡"
  ],
  "높음": [
    "High",
    "高",
    "高"
  ],
  "빠른 계산 우선": [
    "Prioritize fast calculation",
    "計算速度優先",
    "优先快速计算"
  ],
  "기본": [
    "Default",
    "標準",
    "默认"
  ],
  "계산 엔진": [
    "Calculation engine",
    "計算エンジン",
    "计算引擎"
  ],
  "계산 방식과 기기 사용량을 고르세요.": [
    "Choose the calculation method and device usage.",
    "計算方法と端末使用量を選んでください。",
    "请选择计算方式和设备用量。"
  ],
  "GPU 사용량": [
    "GPU usage",
    "GPU使用量",
    "GPU 用量"
  ],
  "CPU 사용량": [
    "CPU usage",
    "CPU使用量",
    "CPU 用量"
  ],
  "G3 · 더 많은 표본": [
    "G3 · more samples",
    "G3・標本数が多い",
    "G3 · 更多样本"
  ],
  "G3 · 적은 연산량": [
    "G3 · less computation",
    "G3・計算量が少ない",
    "G3 · 更少计算量"
  ],
  "{0}개 동시 계산": [
    "{0} parallel workers",
    "{0}並列計算",
    "{0}个并行计算"
  ],
  "GPU 사용 가능 여부": [
    "GPU availability",
    "GPU利用可否",
    "GPU 可用性"
  ],
  "GPU 사용 불가 · 도움말": [
    "GPU unavailable · help",
    "GPU使用不可・ヘルプ",
    "GPU 不可用 · 帮助"
  ],
  "X36 엔진 선택": [
    "Select X36 engine",
    "X36エンジン選択",
    "选择 X36 引擎"
  ],
  "이 안내 음성은 Google Gemini 3.8 Flash TTS (gemini-3.8-flash-tts) 모델을 사용하여 미리 생성된 AI 음성입니다.": [
    "This AI voice was generated in advance using Google Gemini 3.8 Flash TTS (gemini-3.8-flash-tts).",
    "このAI音声はGoogle Gemini 3.8 Flash TTS（gemini-3.8-flash-tts）で事前生成しました。",
    "此 AI 语音由 Google Gemini 3.8 Flash TTS（gemini-3.8-flash-tts）预先生成。"
  ],
  "문장 단위 고품질 음성 합성 및 자연스러운 호흡을 위한 무음 최적화 처리가 적용되었습니다.": [
    "Uses sentence-level speech synthesis and silence optimization for natural pacing.",
    "文単位の音声合成と、自然な間合いのための無音最適化を適用しています。",
    "采用句子级语音合成，并优化静音以实现自然停顿。"
  ],
  "음성 정보": [
    "About the voice",
    "音声について",
    "语音信息"
  ],
  "안내 언어": [
    "Guidance language",
    "案内言語",
    "提示语言"
  ],
  "음성 목소리": [
    "Voice selection",
    "音声の種類",
    "语音声音"
  ],
  "볼륨": [
    "Volume",
    "音量",
    "音量"
  ],
  "음성 다운로드 진행률": [
    "Voice download progress",
    "音声ダウンロード進捗",
    "语音下载进度"
  ],
  "화면 확인 요청과 추천 행동을 음성으로 안내합니다.": [
    "Hear screen-check requests and recommended actions.",
    "画面確認の依頼と推薦行動を音声で案内します。",
    "通过语音提示画面确认请求和推荐行动。"
  ],
  "행동을 추천할 모델을 먼저 선택해 주세요.": [
    "Select an action recommendation model first.",
    "先に推薦モデルを選んでください。",
    "请先选择行动推荐模型。"
  ],
  "언어": [
    "Language",
    "言語",
    "语言"
  ],
  "목소리": [
    "Voice",
    "声",
    "声音"
  ],
  "안내 항목 선택 (고급)": [
    "Guidance options (advanced)",
    "案内項目（詳細）",
    "提示项目（高级）"
  ],
  "음성 데이터": [
    "Voice data",
    "音声データ",
    "语音数据"
  ],
  "음성 목록을 확인하고 있습니다.": [
    "Checking available voices.",
    "音声一覧を確認しています。",
    "正在检查语音列表。"
  ],
  "다음에도 저장된 음성을 사용합니다.": [
    "Use the saved voice next time too.",
    "次回も保存した音声を使用します。",
    "下次也使用保存的语音。"
  ],
  "저장 삭제": [
    "Delete saved data",
    "保存を削除",
    "删除保存数据"
  ],
  "Gemini 3.8 Flash TTS로 미리 생성한 AI 음성입니다.": [
    "AI voice generated in advance with Gemini 3.8 Flash TTS.",
    "Gemini 3.8 Flash TTSで事前生成したAI音声です。",
    "由 Gemini 3.8 Flash TTS 预先生成的 AI 语音。"
  ],
  "다운로드하고 켜기": [
    "Download and enable",
    "取得してオン",
    "下载并开启"
  ],
  "미리 듣기": [
    "Preview",
    "試聴",
    "试听"
  ],
  "음성 끄기": [
    "Turn voice off",
    "音声をオフ",
    "关闭语音"
  ],
  "여성": [
    "Female",
    "女性",
    "女声"
  ],
  "남성": [
    "Male",
    "男性",
    "男声"
  ],
  "재생 확인": [
    "Check playback",
    "再生確認",
    "检查播放"
  ],
  "켜짐": [
    "On",
    "オン",
    "已开启"
  ],
  "꺼짐": [
    "Off",
    "オフ",
    "已关闭"
  ],
  "사용 중인 음성": [
    "Current voice",
    "使用中の音声",
    "正在使用的语音"
  ],
  "저장된 음성": [
    "Saved voice",
    "保存済み音声",
    "已保存的语音"
  ],
  "다운로드할 음성": [
    "Voice to download",
    "取得する音声",
    "要下载的语音"
  ],
  "선택한 음성이 아직 준비되지 않았습니다.": [
    "The selected voice is not ready yet.",
    "選んだ音声はまだ準備されていません。",
    "所选语音尚未就绪。"
  ],
  "선택한 음성을 바로 사용할 수 있습니다.": [
    "The selected voice is ready to use.",
    "選んだ音声はすぐに使用できます。",
    "所选语音可立即使用。"
  ],
  "선택한 음성을 받습니다.": [
    "Downloads the selected voice.",
    "選んだ音声を取得します。",
    "将下载所选语音。"
  ],
  "저장 공간이 부족합니다. 저장하지 않고 사용할 수 있습니다.": [
    "Not enough storage. You can use it without saving.",
    "空き容量が不足しています。保存せずに使用できます。",
    "存储空间不足，可不保存直接使用。"
  ],
  "이 브라우저에서는 저장할 수 없습니다. 이번 접속에서만 사용할 수 있습니다.": [
    "This browser cannot save it. Available for this visit only.",
    "このブラウザーでは保存できません。今回のみ使用できます。",
    "此浏览器无法保存，仅限本次访问使用。"
  ],
  "브라우저에 총": [
    "Total stored in browser: ",
    "ブラウザーに合計",
    "浏览器共保存"
  ],
  "저장됨": [
    " stored",
    "保存済み",
    "已保存"
  ],
  "삭제 중…": [
    "Deleting…",
    "削除中…",
    "正在删除…"
  ],
  "음성을 확인하고 있습니다": [
    "Verifying voice",
    "音声を確認しています",
    "正在验证语音"
  ],
  "음성을 불러오고 있습니다": [
    "Loading voice",
    "音声を読み込んでいます",
    "正在加载语音"
  ],
  "준비 중…": [
    "Preparing…",
    "準備中…",
    "准备中…"
  ],
  "음성 적용": [
    "Apply voice",
    "音声を適用",
    "应用语音"
  ],
  "음성 켜기": [
    "Turn voice on",
    "音声をオン",
    "开启语音"
  ],
  "다운로드하고 적용": [
    "Download and apply",
    "取得して適用",
    "下载并应用"
  ],
  "재생 중지": [
    "Stop playback",
    "再生停止",
    "停止播放"
  ],
  "저장된 음성 삭제": [
    "Delete saved voice",
    "保存音声を削除",
    "删除保存的语音"
  ],
  "다음 접속에서는 필요한 음성을 다시 받습니다. 지금 사용 중인 음성은 계속 들을 수 있습니다.": [
    "Needed voices will be downloaded again next visit. The voice in use can keep playing now.",
    "次回は必要な音声を再取得します。今使用中の音声は引き続き再生できます。",
    "下次访问需要重新下载语音，当前使用的语音仍可继续播放。"
  ],
  "삭제": [
    "Delete",
    "削除",
    "删除"
  ],
  "음성 안내": [
    "Voice guidance",
    "音声案内",
    "语音提示"
  ],
  "음성 설정에서 미리 듣기를 눌러주세요.": [
    "Press Preview in voice settings.",
    "音声設定で試聴を押してください。",
    "请在语音设置中点击试听。"
  ],
  "음성을 재생하지 못했습니다. 음성 설정에서 다시 확인해 주세요.": [
    "Could not play audio. Check again in voice settings.",
    "音声を再生できませんでした。音声設定で再確認してください。",
    "无法播放语音，请在语音设置中重新检查。"
  ],
  "브라우저가 음성을 일시 중지했습니다. 미리 듣기를 눌러주세요.": [
    "The browser paused audio. Press Preview.",
    "ブラウザーが音声を一時停止しました。試聴を押してください。",
    "浏览器已暂停语音，请点击试听。"
  ],
  "추천 행동": [
    "Recommended actions",
    "推薦行動",
    "推荐行动"
  ],
  "주사위 굴리기와 카드 사용": [
    "Dice rolls and card use",
    "サイコロとカード使用",
    "掷骰与使用卡牌"
  ],
  "추천 계산 중": [
    "Calculating recommendation",
    "推薦計算中",
    "推荐计算中"
  ],
  "계산을 기다리는 동안 안내": [
    "Guidance while waiting for calculation",
    "計算待ち中の案内",
    "等待计算期间的提示"
  ],
  "게임 창 확인": [
    "Check game window",
    "ゲームウィンドウ確認",
    "确认游戏窗口"
  ],
  "게임 창 전체를 표시하도록 요청": [
    "Request the entire game window",
    "ゲーム全体の表示を依頼",
    "请求显示完整游戏窗口"
  ],
  "화면 확대": [
    "Enlarge screen",
    "画面拡大",
    "放大画面"
  ],
  "글자를 읽기 어려울 때 확대 요청": [
    "Request enlargement when text is hard to read",
    "文字が読みにくい場合の拡大依頼",
    "文字难以识别时请求放大"
  ],
  "팝업 닫기": [
    "Close popups",
    "ポップアップを閉じる",
    "关闭弹窗"
  ],
  "게임 화면을 가리는 팝업 안내": [
    "Guidance for popups covering the game",
    "ゲームを隠すポップアップの案内",
    "遮挡游戏画面的弹窗提示"
  ],
  "인식값 확인": [
    "Check recognized values",
    "認識値の確認",
    "确认识别值"
  ],
  "점수·주사위·보유 카드 확인 요청": [
    "Request score, dice and hand checks",
    "スコア・サイコロ・手札の確認依頼",
    "请求确认分数、骰子与手牌"
  ],
  "공유 중인 창을 다시 표시하도록 요청": [
    "Request the shared window be shown again",
    "共有ウィンドウの再表示依頼",
    "请求重新显示共享窗口"
  ],
  "카드 이력 열기": [
    "Open card history",
    "カード履歴を開く",
    "打开卡牌记录"
  ],
  "실제 게임에서 이력 창을 열도록 요청": [
    "Request card history in the actual game",
    "実際のゲームで履歴を開くよう依頼",
    "请求在实际游戏中打开记录"
  ],
  "카드 이력 스크롤": [
    "Scroll card history",
    "カード履歴スクロール",
    "滚动卡牌记录"
  ],
  "스크롤 방향과 잠시 멈출 시점 안내": [
    "Scroll direction and when to pause",
    "スクロール方向と停止時機の案内",
    "提示滚动方向与暂停时机"
  ],
  "카드 이력 확인 완료": [
    "Card history check complete",
    "カード履歴確認完了",
    "卡牌记录确认完成"
  ],
  "이력 확인이 끝났을 때 안내": [
    "Guidance when the history check finishes",
    "履歴確認終了時の案内",
    "记录确认结束时提示"
  ],
  "화면 공유 종료": [
    "Screen sharing ended",
    "画面共有終了",
    "屏幕共享结束"
  ],
  "공유가 끊겼을 때 안내": [
    "Guidance when sharing disconnects",
    "共有切断時の案内",
    "共享断开时提示"
  ],
  "화면 인식 오류": [
    "Screen recognition error",
    "画面認識エラー",
    "画面识别错误"
  ],
  "화면을 다시 연결하도록 요청": [
    "Request screen reconnection",
    "画面の再接続依頼",
    "请求重新连接画面"
  ],
  "한국어": [
    "한국어",
    "한국어",
    "한국어"
  ],
  "음성 목록을 불러오지 못했습니다. 잠시 후 다시 열어주세요.": [
    "Could not load the voice list. Reopen it in a moment.",
    "音声一覧を読み込めませんでした。しばらくして開き直してください。",
    "无法加载语音列表，请稍后重新打开。"
  ],
  "음성 목록을 확인하지 못했습니다.": [
    "Could not verify the voice list.",
    "音声一覧を確認できませんでした。",
    "无法验证语音列表。"
  ],
  "저장된 음성을 사용할 수 없습니다. 다운로드 용량을 확인한 뒤 다시 받아주세요.": [
    "The saved voice is unavailable. Check download size and download again.",
    "保存音声を使用できません。容量を確認して再取得してください。",
    "保存的语音不可用，请确认下载大小后重新下载。"
  ],
  "음성 파일 형식이 올바르지 않습니다.": [
    "Invalid voice file format.",
    "音声ファイルの形式が不正です。",
    "语音文件格式无效。"
  ],
  "음성 파일의 버전이 올바르지 않습니다.": [
    "Invalid voice file version.",
    "音声ファイルのバージョンが不正です。",
    "语音文件版本无效。"
  ],
  "일부 안내 음성이 없습니다.": [
    "Some guidance audio is missing.",
    "一部の案内音声がありません。",
    "缺少部分提示语音。"
  ],
  "안내 음성을 확인하지 못했습니다.": [
    "Could not verify guidance audio.",
    "案内音声を確認できませんでした。",
    "无法验证提示语音。"
  ],
  "음성 파일의 크기가 올바르지 않습니다.": [
    "Invalid voice file size.",
    "音声ファイルのサイズが不正です。",
    "语音文件大小无效。"
  ],
  "안내 음성을 찾지 못했습니다.": [
    "Guidance audio not found.",
    "案内音声が見つかりません。",
    "未找到提示语音。"
  ],
  "음성 파일을 받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.": [
    "Could not download the voice file. Check your connection and retry.",
    "音声ファイルを取得できませんでした。接続を確認して再試行してください。",
    "无法下载语音文件，请检查连接后重试。"
  ],
  "음성 파일을 끝까지 받지 못했습니다.": [
    "The voice file download was incomplete.",
    "音声ファイルの取得が完了しませんでした。",
    "语音文件下载不完整。"
  ],
  "음성 파일을 확인하지 못했습니다. 다시 받아주세요.": [
    "Could not verify the voice file. Download it again.",
    "音声ファイルを確認できませんでした。再取得してください。",
    "无法验证语音文件，请重新下载。"
  ],
  "음성 다운로드가 지연되고 있습니다. 연결을 확인한 뒤 다시 시도해 주세요.": [
    "Voice download is delayed. Check your connection and retry.",
    "音声の取得が遅れています。接続を確認して再試行してください。",
    "语音下载延迟，请检查连接后重试。"
  ],
  "게임 상태와 주사위": [
    "Game state and dice",
    "ゲーム状態とサイコロ",
    "游戏状态与骰子"
  ],
  "공지사항": [
    "Notices",
    "お知らせ",
    "公告"
  ],
  "문의·제보 (새 탭)": [
    "Contact / report (new tab)",
    "お問い合わせ・報告（新しいタブ）",
    "咨询与反馈（新标签页）"
  ],
  "캐릭터": [
    "Character",
    "キャラクター",
    "角色"
  ],
  "행동 전체 비교": [
    "Compare all actions",
    "全行動の比較",
    "比较全部行动"
  ],
  "예상 점수 목록": [
    "Estimated score list",
    "予想スコア一覧",
    "预计分数列表"
  ],
  "더블 여부 변경": [
    "Toggle doubles",
    "ゾロ目を切り替え",
    "切换同点状态"
  ],
  "보드": [
    "Board",
    "ボード",
    "棋盘"
  ],
  "캐릭터 위치 편집": [
    "Edit character position",
    "キャラクター位置を編集",
    "编辑角色位置"
  ],
  "게임 도구": [
    "Game tools",
    "ゲームツール",
    "游戏工具"
  ],
  "행운 카드": [
    "Lucky cards",
    "幸運カード",
    "幸运卡牌"
  ],
  "카드 정보": [
    "Card information",
    "カード情報",
    "卡牌信息"
  ],
  "이전 스테이지": [
    "Previous stage",
    "前のステージ",
    "上一关"
  ],
  "카드 획득 정보": [
    "Card acquisition information",
    "カード獲得情報",
    "卡牌获取信息"
  ],
  "게임 준비": [
    "Game preparation",
    "ゲーム準備",
    "游戏准备"
  ],
  "현재 오류와 브라우저 정보를 파일로 저장합니다. 자동 전송되지 않습니다.": [
    "Save current errors and browser information to a file. Nothing is sent automatically.",
    "現在のエラーとブラウザー情報を保存します。自動送信はされません。",
    "将当前错误及浏览器信息保存到文件，不会自动发送。"
  ],
  "알림": [
    "Notifications",
    "通知",
    "通知"
  ],
  "주사위 이동": [
    "Dice movement",
    "サイコロ移動",
    "骰子移动"
  ],
  "최고 기록:": [
    "Best: ",
    "最高記録：",
    "最高记录："
  ],
  "1 칸": [
    "1 tile",
    "1マス",
    "1格"
  ],
  "6개 case": [
    "6 cases",
    "6ケース",
    "6种选择"
  ],
  "모험을 준비하고 있어요": [
    "Preparing your adventure",
    "冒険を準備しています",
    "正在准备冒险"
  ],
  "잠시 후 게임이 시작됩니다.": [
    "The game will start shortly.",
    "まもなくゲームが始まります。",
    "游戏即将开始。"
  ],
  "화면 준비 중": [
    "Preparing screen",
    "画面準備中",
    "正在准备画面"
  ],
  "설정": [
    "Settings",
    "設定",
    "设置"
  ],
  "모드 변경": [
    "Change mode",
    "モード変更",
    "切换模式"
  ],
  "페이지 언어": [
    "Page language",
    "ページ言語",
    "页面语言"
  ],
  "음성 설정": [
    "Voice settings",
    "音声設定",
    "语音设置"
  ],
  "게임 상태와 화면 연결은 그대로 유지됩니다.": [
    "Your game state and screen connection are preserved.",
    "ゲーム状態と画面接続は維持されます。",
    "游戏状态和画面连接会保持不变。"
  ],
  "음성 언어는 음성 설정에서 별도로 선택합니다.": [
    "Choose the voice language separately in voice settings.",
    "音声言語は音声設定で別に選べます。",
    "语音语言可在语音设置中单独选择。"
  ],
  "현재 모드: {0}": [
    "Current mode: {0}",
    "現在のモード：{0}",
    "当前模式：{0}"
  ],
  "설정 (현재 {0})": [
    "Settings (current mode: {0})",
    "設定（現在のモード：{0}）",
    "设置（当前模式：{0}）"
  ],
  "설정 → 모드 변경": [
    "Settings → Change mode",
    "設定 → モード変更",
    "设置 → 切换模式"
  ],
  "[설정 → 모드 변경]": [
    "[Settings → Change mode]",
    "［設定 → モード変更］",
    "[设置 → 切换模式]"
  ],
  "모험가": [
    "Adventurer",
    "冒険者",
    "冒险者"
  ],
  "{0}번카드: {1}": [
    "Card {0}: {1}",
    "カード{0}：{1}",
    "卡牌{0}：{1}"
  ],
  "{0}점": [
    "{0} pts",
    "{0}点",
    "{0}分"
  ],
  "{0} 칸": [
    "{0} tiles",
    "{0}マス",
    "{0}格"
  ],
  "{0}칸": [
    "{0} tiles",
    "{0}マス",
    "{0}格"
  ],
  "{0} 모드": [
    "{0} mode",
    "{0}モード",
    "{0}模式"
  ],
  "브라우저에 총 {0} 저장됨": [
    "Total stored in browser: {0}",
    "ブラウザーに合計{0}保存済み",
    "浏览器共保存{0}"
  ],
  "현재 <strong>칸 번호</strong>를 누르면 위치를 입력할 수 있습니다. 수동 모드 단축키는 <kbd>{0}</kbd>입니다.": [
    "Click the current <strong>tile number</strong> to enter a position. In Manual mode, the shortcut is <kbd>{0}</kbd>.",
    "現在の<strong>マス番号</strong>を押すと位置を入力できます。手動モードのショートカットは<kbd>{0}</kbd>です。",
    "点击当前<strong>格数</strong>可输入位置。手动模式快捷键为<kbd>{0}</kbd>。"
  ],
  "<strong>어시스트</strong>는 연결한 게임 화면에서 위치·주사위·카드를 읽어 추천에 반영합니다. 실제 게임은 직접 조작하세요.": [
    "<strong>Assist</strong> reads your position, dice and cards from the shared game screen to provide recommendations. You control the actual game yourself.",
    "<strong>アシスト</strong>は共有ゲーム画面から位置・サイコロ・カードを読み取り、行動を提案します。実際のゲームはご自身で操作してください。",
    "<strong>辅助模式</strong>会读取共享游戏画面中的位置、骰子和手牌并提供推荐。实际游戏仍需自行操作。"
  ],
  "<strong>수동</strong>은 실제 게임의 위치·주사위·카드를 직접 입력하는 모드입니다.": [
    "In <strong>Manual mode</strong>, you enter the actual game's position, dice and cards yourself.",
    "<strong>手動モード</strong>では、実際のゲームの位置・サイコロ・カードを自分で入力します。",
    "在<strong>手动模式</strong>中，需要自行输入实际游戏的位置、骰子和手牌。"
  ],
  "<strong>자동</strong>은 실제 게임 규칙으로 직접 플레이합니다. 실제 게임을 대신 조작하지 않습니다.": [
    "In <strong>Automatic mode</strong>, you play on this page using the actual game rules. This mode does not control the actual game for you.",
    "<strong>自動モード</strong>では、実際のゲームルールでこのページ上をプレイします。実際のゲームを代わりに操作する機能ではありません。",
    "在<strong>自动模式</strong>中，可以按实际游戏规则在此页面游玩。此模式不会代为操作实际游戏。"
  ],
  "중간부터 연결하면 실제 게임의 <strong>카드 획득 이력</strong>을 열고 위부터 아래까지 천천히 스크롤하세요. 새 게임은 바로 시작하며, 놓친 변화로 덱 상태가 불명확할 때 다시 확인을 요청합니다.": [
    "If you connect mid-game, open <strong>card acquisition history</strong> in the actual game and scroll slowly from top to bottom. A new game can start immediately. If the deck state is unclear after missed changes, you will be asked to check it again.",
    "途中から接続する場合は、実際のゲームで<strong>カード獲得履歴</strong>を開き、上から下へゆっくりスクロールしてください。新規ゲームはすぐに開始できます。見逃した変化によってデッキが不明になった場合は、再確認をお願いします。",
    "中途连接时，请在实际游戏中打开<strong>卡牌获取记录</strong>，从上到下缓慢滚动。新游戏可直接开始。如果遗漏的变化导致牌库状态不明确，会请求重新确认。"
  ],
  "읽기 어려운 값은 <strong>상단 안내의 직접 입력</strong>으로 보완할 수 있습니다. 확인 중에는 추천을 잠시 멈춥니다.": [
    "If a value is difficult to read, use <strong>manual entry in the guidance bar</strong> at the top. Recommendations pause while the values are being checked.",
    "読み取りにくい値は、<strong>上部の案内バーから直接入力</strong>して補えます。確認中は行動の提案を一時停止します。",
    "难以识别的数值可通过<strong>顶部提示栏中的手动输入</strong>补充。确认期间会暂停推荐。"
  ],
  "추천 모델을 선택한 뒤 상단 <strong>음성</strong>에서 음성 안내를 켤 수 있습니다. 한국어·영어·일본어·중국어와 여성·남성 목소리 중에서 골라 사용할 수 있습니다. 음성을 받기 전에 용량을 확인할 수 있고, 브라우저 저장과 삭제도 가능합니다.": [
    "After choosing a model, open <strong>Voice</strong> at the top to enable spoken guidance. Choose a female or male voice in Korean, English, Japanese or Chinese. You can check the download size beforehand, save the voice in your browser, or delete saved voices.",
    "モデルを選択したら、上部の<strong>音声</strong>から音声案内を有効にできます。韓国語・英語・日本語・中国語の女性または男性の声を選べます。取得前に容量を確認でき、ブラウザーへの保存と削除も可能です。",
    "选择模型后，可通过顶部的<strong>语音</strong>开启语音提示。支持韩语、英语、日语、中文的女声和男声。下载前可查看大小，也可在浏览器中保存或删除语音。"
  ],
  "<strong>설정 → 모드 변경</strong>으로 전환해도 마지막으로 확인한 상태는 유지됩니다. 어시스트의 화면 연결을 끝내려면 연결을 해제하거나 다른 모드로 전환하세요.": [
    "Use <strong>Settings → Change mode</strong> to switch modes while keeping the last confirmed state. To end screen sharing in Assist mode, disconnect the screen or switch to another mode.",
    "<strong>設定 → モード変更</strong>で切り替えても、最後に確認した状態は維持されます。アシストの画面共有を終了するには、接続を解除するか別のモードに切り替えてください。",
    "通过<strong>设置 → 切换模式</strong>切换后，会保留最近确认的状态。要结束辅助模式的画面共享，请断开连接或切换到其他模式。"
  ],
  "수동 모드에서는 <strong>캐릭터를 끌어</strong> 위치를 바꿀 수 있습니다. <strong>스테이지 화살표</strong>{0}는 수동·자동 모드에서 위치를 바꿉니다.": [
    "In Manual mode, <strong>drag the character</strong> to change position. The <strong>stage arrows</strong>{0} change your position in Manual and Automatic modes.",
    "手動モードでは<strong>キャラクターをドラッグ</strong>して位置を変更できます。<strong>ステージ矢印</strong>{0}は手動・自動モードでの位置変更に使えます。",
    "在手动模式中，可<strong>拖动角色</strong>改变位置。<strong>关卡箭头</strong>{0}可在手动和自动模式中改变位置。"
  ],
  "<strong>수동</strong>에서는 주사위 버튼으로 더블 여부를 바꾸고, <strong>+2~+12</strong>로 나온 눈의 합을 입력합니다.": [
    "In <strong>Manual mode</strong>, click the dice button to toggle doubles. Use <strong>+2–+12</strong> to enter the sum of the dice you rolled.",
    "<strong>手動モード</strong>では、サイコロボタンでゾロ目の有無を切り替えます。<strong>+2～+12</strong>で実際に出た目の合計を入力してください。",
    "在<strong>手动模式</strong>中，用骰子按钮切换同点状态，并通过<strong>+2～+12</strong>输入实际掷出的点数之和。"
  ],
  "<strong>자동</strong>에서는 주사위 버튼으로 두 개를 굴립니다. 더블이면 다음 주사위는 횟수를 소모하지 않습니다.": [
    "In <strong>Automatic mode</strong>, the dice button rolls two dice. If both show the same number, the next roll does not use up a roll from the counter.",
    "<strong>自動モード</strong>では、ボタンで2個のサイコロを振ります。ゾロ目が出ると、次のサイコロは使用回数を消費しません。",
    "在<strong>自动模式</strong>中，骰子按钮会掷两枚骰子。如果两枚点数相同，下次掷骰不消耗使用次数。"
  ],
  "<strong>주사위 사용 횟수</strong>를 눌러 수정할 수 있습니다. 수동 모드 단축키는 <kbd>{0}</kbd>입니다.": [
    "Click <strong>Dice used</strong> to edit the count. In Manual mode, the shortcut is <kbd>{0}</kbd>.",
    "<strong>サイコロ使用回数</strong>を押すと回数を修正できます。手動モードのショートカットは<kbd>{0}</kbd>です。",
    "点击<strong>骰子使用次数</strong>可修改次数。手动模式快捷键为<kbd>{0}</kbd>。"
  ],
  "<strong>평가값이 높을수록 유리한 선택</strong>입니다. 추천은 가장 높은 값을 가진 선택이며 최종 점수 예측은 아닙니다.": [
    "<strong>A higher action value indicates a better choice.</strong> The choice with the highest value is recommended. These values are not final-score estimates.",
    "<strong>評価値が高いほど有利な選択</strong>です。最も高い値の行動を提案します。評価値は最終スコアの予測ではありません。",
    "<strong>评估值越高，选择越有利。</strong>推荐评估值最高的选择，这些数值并非最终得分预测。"
  ],
  "목록에 마우스를 올리면 행동별 값을 비교합니다. 클릭 또는 <kbd>Ctrl+R</kbd>로 다시 계산합니다.": [
    "Hover over the list to compare action values. Click the list or press <kbd>Ctrl+R</kbd> to recalculate.",
    "一覧にカーソルを合わせると行動ごとの評価を比較できます。一覧をクリックするか、<kbd>Ctrl+R</kbd>で再計算します。",
    "将鼠标悬停在列表上可比较行动评估值。点击列表或按<kbd>Ctrl+R</kbd>重新计算。"
  ],
  "작은 화면에서는 <strong>비교</strong> 버튼을 누르세요. 터치에서는 목록을 길게 눌러도 열립니다.": [
    "On small screens, press <strong>Compare</strong>. On touchscreens, you can also press and hold the list.",
    "小さな画面では<strong>比較</strong>を押してください。タッチ操作では一覧の長押しでも開けます。",
    "在小屏幕上，请点击<strong>比较</strong>。触屏也可长按列表打开。"
  ],
  "<strong>모델 선택</strong>을 누르면 모델을 바꿀 수 있습니다.": [
    "Click <strong>Select model</strong> to change the model.",
    "<strong>モデル選択</strong>を押すとモデルを変更できます。",
    "点击<strong>选择模型</strong>可切换模型。"
  ],
  "각 선택 이후를 시뮬레이션한 <strong>최종 점수의 평균</strong>입니다. ‘추천’은 평균이 가장 높은 선택, ‘근접’은 추천과 차이가 뚜렷하지 않은 선택입니다.": [
    "Each action shows the <strong>mean final score</strong> of simulations starting with that choice. “Recommended” has the highest mean. “Near tie” means its difference from the recommended choice is not clear.",
    "各行動を選んだ後のシミュレーションによる<strong>最終スコアの平均</strong>です。「おすすめ」は平均が最も高い選択、「僅差」はおすすめとの差が明確でない選択です。",
    "各行动显示从该选择开始模拟得到的<strong>最终得分平均值</strong>。“推荐”表示平均值最高的选择，“相近”表示与推荐选择的差距不明显。"
  ],
  "점수 목록에 마우스를 올리면 전체 비교 표가 열립니다. 목록을 누르거나 <kbd>Ctrl+R</kbd>로 다시 계산합니다.": [
    "Hover over the score list to open the full comparison table. Click the list or press <kbd>Ctrl+R</kbd> to recalculate.",
    "スコア一覧にカーソルを合わせると比較表が開きます。一覧をクリックするか、<kbd>Ctrl+R</kbd>で再計算します。",
    "将鼠标悬停在分数列表上可打开完整比较表。点击列表或按<kbd>Ctrl+R</kbd>重新计算。"
  ],
  "<strong>모델 선택</strong>을 누르면 모델·계산 방식을 바꿀 수 있습니다.": [
    "Click <strong>Select model</strong> to change the model or calculation method.",
    "<strong>モデル選択</strong>からモデルと計算方法を変更できます。",
    "点击<strong>选择模型</strong>可修改模型与计算方式。"
  ],
  "현재 상태에서 <strong>{0} 추천을 계속 따를 때</strong>의 최종 점수 예측입니다. 실제 결과를 보장하지 않으며 행동별 평가와 별도로 계산합니다.": [
    "This is the estimated final score if you <strong>keep following {0} recommendations</strong> from the current state. It does not guarantee the actual result and is calculated separately from action values.",
    "現在の状態から<strong>{0}の提案に従い続けた場合</strong>の最終スコア予測です。実際の結果を保証するものではなく、行動評価とは別に計算します。",
    "这是从当前状态开始<strong>持续遵循{0}推荐</strong>时的最终得分预测。此值不保证实际结果，与行动评估独立计算。"
  ],
  "게임이 끝나면 실제 최종 점수를 표시합니다. 예측할 수 없으면 <strong>—</strong>로 표시합니다.": [
    "When the game ends, the actual final score is shown. If no estimate is available, <strong>—</strong> is displayed.",
    "ゲーム終了時は実際の最終スコアを表示します。予測できない場合は<strong>—</strong>と表示します。",
    "游戏结束时显示实际最终得分，无法预测时显示<strong>—</strong>。"
  ],
  "<strong>카드를 누르면 사용</strong>합니다. <kbd>Ctrl+1~5</kbd>로 해당 슬롯을 선택할 수도 있습니다.": [
    "<strong>Click a card to use it.</strong> You can also select its slot with <kbd>Ctrl+1–5</kbd>.",
    "<strong>カードを押すと使用</strong>します。<kbd>Ctrl+1～5</kbd>でも該当スロットを選択できます。",
    "<strong>点击卡牌即可使用。</strong>也可通过<kbd>Ctrl+1～5</kbd>选择对应卡槽。"
  ],
  "<strong>우클릭하면 이동 없이 바로 버립니다.</strong> 터치에서는 길게 누른 뒤 ‘버리기’를 선택하세요.": [
    "<strong>Right-click to discard a card without moving.</strong> On touchscreens, press and hold it, then choose Discard.",
    "<strong>右クリックすると、移動せずにカードを捨てます。</strong>タッチ操作では長押しして「捨てる」を選んでください。",
    "<strong>右键点击可丢弃卡牌而不移动。</strong>触屏请长按后选择“丢弃”。"
  ],
  "수동 모드에서 <strong>배수 카드는 실제 주사위 눈의 합(2~12)</strong>을 선택해 사용합니다. 숫자 버튼을 누르거나 입력 후 <kbd>Enter</kbd>로 적용하며, <kbd>Esc</kbd> 또는 취소로 돌아갑니다.": [
    "In Manual mode, use a multiplier card by selecting the <strong>actual dice sum (2–12)</strong>. Click a number button, or type the sum and press <kbd>Enter</kbd>. Press <kbd>Esc</kbd> or Cancel to go back.",
    "手動モードで倍率カードを使うときは、<strong>実際の出目の合計（2～12）</strong>を選びます。数字ボタンを押すか、入力後に<kbd>Enter</kbd>で適用します。<kbd>Esc</kbd>またはキャンセルで戻れます。",
    "在手动模式中，使用倍率卡时需选择<strong>实际骰子点数之和（2～12）</strong>。可点击数字按钮，或输入后按<kbd>Enter</kbd>应用。按<kbd>Esc</kbd>或“取消”返回。"
  ],
  "수동 모드에서 <strong>빈 슬롯</strong>이나 <kbd>{0}</kbd>로 카드를 검색해 추가합니다. 자동 모드에서는 카드 획득 칸에서 뽑습니다.": [
    "In Manual mode, click an <strong>empty slot</strong> or press <kbd>{0}</kbd> to find and add a card. Automatic mode draws cards when you land on a card tile.",
    "手動モードでは<strong>空きスロット</strong>または<kbd>{0}</kbd>でカードを検索して追加できます。自動モードではカードマスに到着するとカードを引きます。",
    "在手动模式中，点击<strong>空卡槽</strong>或按<kbd>{0}</kbd>可搜索并添加卡牌。自动模式会在到达卡牌格时抽牌。"
  ],
  "보드에는 <strong>도착 위치별 확률</strong>이 표시됩니다. 여러 주사위 결과가 같은 위치에 도착하면 확률을 합칩니다.": [
    "The board shows the <strong>probability of landing on each tile</strong>. If several dice outcomes lead to the same tile, their probabilities are added together.",
    "ボードには<strong>各マスに到着する確率</strong>を表示します。複数の出目が同じマスに到着する場合、その確率を合算します。",
    "棋盘显示<strong>到达各格的概率</strong>。多个骰子结果到达同一格时，会合并其概率。"
  ],
  "터치에서는 주사위를 길게 누르거나, 카드를 길게 누른 뒤 <strong>도착 예측</strong>을 선택하세요.": [
    "On touchscreens, press and hold the dice button. For a card, press and hold it and choose <strong>Arrival preview</strong>.",
    "タッチ操作ではサイコロを長押ししてください。カードの場合は長押し後に<strong>到着予測</strong>を選びます。",
    "触屏请长按骰子按钮。查看卡牌时，长按卡牌后选择<strong>落点预测</strong>。"
  ],
  "<strong>?</strong> 버튼으로 전체 카드 목록을 열고 닫습니다.": [
    "Press <strong>?</strong> to open or close the full card list.",
    "<strong>?</strong>ボタンで全カード一覧を開閉します。",
    "点击<strong>?</strong>按钮可打开或关闭全部卡牌列表。"
  ],
  "<strong>재시작</strong>을 누르고 확인하면 위치·주사위·카드가 초기화됩니다. 이 페이지를 열어 둔 동안의 최고 기록은 유지됩니다.": [
    "Press <strong>Restart</strong> and confirm to reset your position, dice and cards. Your best record is kept while this page remains open.",
    "<strong>再スタート</strong>を押して確認すると、位置・サイコロ・カードが初期化されます。このページを開いている間の最高記録は維持されます。",
    "点击<strong>重新开始</strong>并确认后，会重置位置、骰子和手牌。页面保持打开期间的最高记录会保留。"
  ],
  "조작이 헷갈리면 <strong>도움말</strong>에서 다시 확인하세요.": [
    "If you need a reminder of the controls, open <strong>Help</strong> again.",
    "操作を確認したい場合は、<strong>ヘルプ</strong>をもう一度開いてください。",
    "如需再次查看操作说明，请打开<strong>帮助</strong>。"
  ],
  "화면에 표시할 언어를 선택하세요.": [
    "Choose the language used on this page.",
    "ページの表示言語を選んでください。",
    "选择页面显示语言。"
  ],
  "브라우저 저장이 제한되어 이번 접속에만 적용됩니다.": [
    "Browser storage is unavailable. This choice applies only to this visit.",
    "ブラウザーに保存できないため、今回の利用中のみ適用されます。",
    "浏览器无法保存此设置，仅在本次访问期间生效。"
  ],
  "선택한 언어는 이 브라우저에 저장되어 다음 접속에도 유지됩니다.": [
    "Your language choice is saved in this browser for your next visit.",
    "選んだ言語はこのブラウザーに保存され、次回も引き継がれます。",
    "所选语言将保存在此浏览器中，下次访问时继续使用。"
  ],
  "안내 언어·목소리·볼륨": [
    "Language, voice and volume",
    "案内の言語・声・音量",
    "提示语言、声音和音量"
  ],
  "페이지 언어를 바꿔도 게임 상태와 화면 연결은 유지됩니다.": [
    "Changing the page language keeps your game state and screen connection.",
    "表示言語を変えても、ゲームの状態と画面の接続は維持されます。",
    "切换页面语言不会改变游戏状态或断开画面连接。"
  ]
};
