# 検証ログ: Bun.Imageでsharpなしに画像リサイズ/変換して書き比べてみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・出力ログ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-bun-image-20260719-0405.md`
- 出典レポート: `research/search-topic-20260719-0402.md`
- 対象技術: Bun 1.3.14 の組み込み画像処理API `Bun.Image`（比較対象 `sharp@0.35.3`）
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-19 04:07〜04:12 / 見積もり 約4.25h → 実測 約6分（AI単独・逐次実行。記事にはそのまま書かない） <!-- draft-article が人の粒度に直す or 省く -->
- 実行環境: macOS 26.5 / arm64 / **Apple M2 Pro** / bun 1.3.14 / node v22.17.0
- 採用した撤退ライン: 対象タスク準拠。「AVIF が通らなければ WebP のみで比較を成立させ、AVIF は OS/チップ依存で不可の記録として残す」「sharp が native ビルドで詰まれば node 実行に切替、それも不可なら導入で詰まったこと自体を成果にする」／一般則として1タスク30分超で撤退
- 判断方針: 引数は対象タスクファイルのみ指定。時間・撤退ラインは対象タスクのデフォルトを採用。ブラウザ表示を伴わないためPlaywrightは不使用（完了判定はCLI出力で実施）
- サンプル画像の作り方: 外部DL・認証を避けるため、ローカルの `ffmpeg`（homebrew）で `testsrc2` パターンを生成（`input.png` 1920x1080 / `big.jpg` 4000x3000）。DL素材サイトは使わない

## 結果サマリー

- 完了条件の判定: **達成**（3条件すべて客観確認。根拠は下表）
- 作ったもの: Bun.Image と sharp で同処理（読込→resize→WebP/AVIF→保存）を実装した比較スクリプト一式＋計測。`logs/run-bun-image-20260719-0407/workspace/`
- スクショ: 0 枚（CLI完結タスクのためコンソール出力ログ `commands.log` で代替）
- 詰まった点: 3 件（うち解決 3 / 未解決・撤退 0）※事前に「目玉」とされたAVIF失敗は**起きなかった**（M2 Proで成功）＝予測と実際の差分そのものが記事素材
- knowledge 記録: なし（新規トラブルなし。既知の落とし穴は回避できた）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `bun run bun-image.ts` で Bun.Image のリサイズ＋WebP出力が生成される | 達成 | commands.log「本編: bun-image.ts」→ `out/bun.webp bytes: 12528`／metadata で `800x450 webp` を確認 |
| 2 | `bun run sharp-image.ts` で sharp の同処理出力が生成され、両者の出力サイズ・処理時間がコンソールに出る | 達成 | commands.log「本編: sharp-image.ts」→ 5回の生値・median・`out/sharp.webp bytes: 12518` |
| 3 | Bun.Image 版は追加 `node_modules`（native ビルド）なしで動く | 達成 | `bun-image.ts` の import 数=0（`grep -c "^import"`）。sharp 版は `import sharp` が必須で `@img`(17M) を伴う |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査

- [x] Bun.Image 公式ドキュメントで API 形・対応フォーマット・エラーコードを確認
  - 記録:
    - チェーンAPI: `Bun.file("x.png").image().resize(800,800,{fit:"inside"}).webp({quality:80}).write("out.webp")`。terminal は `.write()` / `.bytes()` / `.buffer()` / `.metadata()` / `.toBase64()` / `.dataurl()` など。
    - resize オプション: `fit`（`inside` 等）、`filter`（既定 `lanczos3`）、`withoutEnlargement`。
    - 出力: `.jpeg()/.png()/.webp()` は全プラットフォーム、`.heic()/.avif()` は **macOS/Windows のみ**。ドキュメント表に **「AVIF: encode needs M3+」** の注記あり。
    - エラーコード: フォーマット非対応時は terminal が `error.code === "ERR_IMAGE_FORMAT_UNSUPPORTED"` で reject。
    - セキュリティ警告（原文）:「Don't pass user-controlled strings directly to the constructor — that's an arbitrary-file-read primitive.」→ 入力パスは固定値にする。
- [x] Bun v1.3.14 リリースブログの公式ベンチ値を控える（**自分の実測と区別して引用**）
  - 記録（条件: linux/x64, 50 iterations, `sharp.concurrency(1)`, 対 **sharp 0.34.5**）:
    - `metadata()` 0.004ms vs 0.28ms = **70×**
    - 1080p PNG→400x400→JPEG 28.6ms vs 39.5ms = **1.38×**
    - 1080p PNG→800x600→WebP 82.7ms vs 110.1ms = **1.33×**
    - 4K JPEG→800x450→JPEG 35.8ms vs 45.5ms = **1.27×** ／ 4K→1920x1080→JPEG 57.2 vs 69.9 = **1.22×** ／ 12MP→1024x768→WebP 138 vs 165 = **1.20×**
    - 温度感:「metadata は突出、実処理は 1.2〜1.4倍」。※自分の環境は macOS/arm64・sharp 0.35.3 なので条件が違う点に注意。
- [x] 実行環境を記録（HEIC/AVIF はOS依存のためOS明記）
  - macOS 26.5 / arm64 / Apple M2 Pro / bun 1.3.14 / node v22.17.0。**チップは M2 Pro**（ドキュメントの「AVIF encode は M3+」に該当しない世代）。
  - 既存技術との違い: 事前調査の時点では「AVIFは自分の環境で失敗するはず」と予測 → 実測で覆る（後述）。

### フェーズ2: 環境構築

- [x] `bun init --yes` で最小プロジェクト初期化
  - 実行コマンド:
    ```bash
    bun init --yes
    ```
  - 出力（抜粋）: `.gitignore / CLAUDE.md / index.ts / tsconfig.json / README.md` を生成、`@types/bun@1.3.14` と `typescript@5.9.3` を install（5 packages, ~1s）。`type: "module"` の package.json。
- [x] サンプル画像を用意（外部DL不要にする）
  - 実行コマンド:
    ```bash
    ffmpeg -y -f lavfi -i "testsrc2=size=1920x1080:rate=1" -frames:v 1 input.png
    ffmpeg -y -f lavfi -i "testsrc2=size=4000x3000:rate=1" -frames:v 1 -q:v 3 big.jpg
    ```
  - 記録: `input.png` = 215,387 bytes (1920x1080) / `big.jpg` = 591,279 bytes (4000x3000)。testsrc2 は高周波の合成パターン。**実写真ではない**ため、圧縮率の絶対値は実写と異なる可能性ありと明記。
- [x] `metadata()` で Hello World 確認
  - 実行コマンド: `bun run metadata.ts`
  - 出力（全文）:
    ```
    input.png metadata: { width: 1920, height: 1080, format: "png" }
    big.jpg metadata: { width: 4000, height: 3000, format: "jpeg" }
    ```
  - ここで動いた＝Bun.Image が使える確証。
- [x] `bun add sharp` の導入コストを記録
  - 実行コマンド: `bun add sharp`
  - 出力（全文）:
    ```
    bun add v1.3.14 (0d9b296a)
    Resolving dependencies
    Resolved, downloaded and extracted [80]
    Saved lockfile

    installed sharp@0.35.3

    6 packages installed [517.00ms]
    ```
  - 記録: **native ビルドは走らなかった**。prebuilt バイナリ（`node_modules/@img/sharp-darwin-arm64`, `sharp-libvips-darwin-arm64`）で解決。`node_modules` は 29M → 48M（**+19M**）。うち `@img` が **17M**（libvips 本体が 17M）。所要 約0.5秒。
  - **予測と実際の差分**: 事前想定は「sharp の native ビルド地獄」。実際は macOS/arm64 では prebuild が当たり無警告・一瞬で完了。=「ビルド地獄」は環境依存で、当環境では起きなかったことを正直に記録。

### フェーズ3: 実装・検証【本編】

- [x] `bun-image.ts` 実装（resize inside → webp q80 → write）
  - コード: `workspace/bun-image.ts`（50行、うち import 0）。核は
    ```ts
    await Bun.file("input.png").image()
      .resize(800, 800, { fit: "inside" })
      .webp({ quality: 80 })
      .write("out/bun.webp");
    ```
  - 書き味: `Bun.file(...).image()` から一直線のチェーン。`@types/bun` で resize/webp の補完が効く。`fit:"inside"` は箱に収めてアスペクト比維持（既定は `"fill"` で引き伸ばし）。1920x1080 → 800x450 に収まった。
- [x] `sharp-image.ts` 実装（同条件）
  - コード: `workspace/sharp-image.ts`（47行、`import sharp from "sharp"` が必須）。核は
    ```ts
    await sharp("input.png")
      .resize(800, 800, { fit: "inside" })
      .webp({ quality: 80 })
      .toFile("out/sharp.webp");
    ```
  - API差: 生成が `sharp(path)` 関数 vs `Bun.file(path).image()`。terminal が **`.toFile()` vs `.write()`**。resize/webp のオプション名（`fit`, `quality`）はほぼ同じ＝乗り換え負荷は小さい。
- [x] `performance.now()` でウォームアップ1回＋5回計測して中央値・出力バイトを出力
  - 出力（代表run・全文は commands.log）:
    ```
    [Bun.Image] resize+webp times(ms): [117.81, 132.3, 116.8, 87.95, 93.13]  median 116.8  bytes 12528
    [sharp]     resize+webp times(ms): [79.66, 85.44, 146.03, 143.35, 133.45] median 133.45 bytes 12518
    ```
  - 複数run の median 傾向（生値は下の「詰まった点」表 #2 参照）:
    - Bun.Image: 113.68 / 114.37 / 116.8 / 118.44 / 124.03 ms
    - sharp:     133.45 / 135.47 / 137.79 / 139.67 / 146.24 ms
  - → 1080p PNG→800px→WebP は **Bun.Image が sharp の約1.1〜1.2倍速**（同一run内は 64〜160ms と大きく揺れる）。公式の 1.33× と同方向だが倍率は小さめ。出力サイズはほぼ同じ（12528 vs 12518 bytes、差<0.1%）＝条件を揃えた比較になっている。
- [x] AVIF 変換を try/catch で試行（`error.code` 捕捉）
  - 出力（全文）:
    ```
    [Bun.Image] AVIF OK. out/bun.avif bytes: 7061
    [sharp]     AVIF OK. out/sharp.avif bytes: 11052
    ```
  - **結果: 両方とも成功**。metadata で `800x450 avif` を確認。事前に「M2 Pro は AVIF encode 非対応（M3+）で失敗するはず」と予測していたが、**当環境（macOS 26.5 / M2 Pro）では Bun.Image・sharp とも AVIF エンコードが通った**。`ERR_IMAGE_FORMAT_UNSUPPORTED` は再現せず。
  - 注目: 同 quality:50 でも **Bun.Image 7,061 bytes vs sharp 11,052 bytes** とエンコーダ差で出力サイズが大きく違う（Bun.Image の方が小さい）。quality の意味が実装間で一致しない好例＝サイズだけで優劣を断じない材料。

### フェーズ4: 深掘り・比較

- [x] 比較表にまとめる（下記「比較表」）
- [x] 大画像/JPEG入力ケースを追加（`big.jpg` 4000x3000 → 1920x1080 inside → WebP）
  - 出力（全文・代表run、複数run は commands.log）:
    ```
    [big/Bun.Image] times(ms): [377.22, 356.58, 418.96, 347.1, 366.8]  median 366.8  bytes 40974
    [big/sharp]     times(ms): [503.21, 454.85, 452.65, 398.01, 475.88] median 454.85 bytes 41386
    speedup (sharp/bun): 1.24 x
    ```
  - 別run: Bun.Image 357.9 / 373.18 ms、sharp 412.39 / 480.19 ms（speedup 1.15〜1.29x）。
  - → 大画像（4K JPEG入力）では **約1.15〜1.29倍**で、公式の 4K 帯（1.20〜1.27×）に**近い**。小さい画像より公式値に一致する傾向。出力サイズはほぼ同等（40,974 vs 41,386 bytes）。

#### 比較表（実測）

| 観点 | Bun.Image (bun 1.3.14) | sharp 0.35.3 |
|---|---|---|
| 追加依存 | **なし（組み込み）**／import 0 | `bun add sharp`／`@img` native **17M**（node_modules +19M） |
| 導入コスト | 0（Bun同梱） | prebuilt解決 約0.5s・無警告（当環境。native ビルドは発生せず） |
| resize+WebP 中央値 (1080p→800px, q80) | 約 **114〜124ms** | 約 **133〜146ms** |
| resize+WebP 中央値 (4K→1920px, q80) | 約 **357〜373ms** | 約 **412〜480ms** |
| WebP 出力サイズ (1080p, q80) | 12,528 bytes | 12,518 bytes（ほぼ同等） |
| AVIF (q50) 可否・サイズ | OK・**7,061 bytes** | OK・11,052 bytes |
| 実装行数（計測込みスクリプト） | 50 行 | 47 行（+ `import sharp`） |
| terminal メソッド | `.write(path)` | `.toFile(path)` |

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | 事前想定「AVIFはM2 Proで失敗する」が外れた（=良い意味で詰まらなかった） | ドキュメントの「AVIF encode は M3+」注記から失敗を予測。実際は macOS 26.5/M2 Pro で Bun.Image・sharp とも成功 | try/catch で `error.code` を捕捉する構えで実行 → 例外は出ず両者成功。metadata で avif 出力を検証 | 数分 | 解決（予測と実際が乖離） | 「ドキュメントの但し書き（M3+）を鵜呑みにせず自分の環境で測る」体験。OS×チップ×フォーマットの可否は実測が要る、という新人目線の学び |
| 2 | 処理時間が測るたびに大きくブレる | JITウォームアップ・OSキャッシュ・GC・並行負荷。1回計測では実態を反映しない | ウォームアップ1回＋5回計測で中央値。同run内でも 64〜160ms 幅。複数run の median で傾向を確認（Bun 113〜124 / sharp 133〜146ms） | 実装に内包 | 解決 | 「公式の1.3倍を鵜呑みにせず自分で測ると揺れる」体験そのもの。中央値と生値を併記する作法 |
| 3 | quality:80/50 を揃えても出力サイズや速度倍率が公式と一致しない | 実装間でエンコーダ既定や内部処理が異なる（AVIF q50 は 7,061 vs 11,052 bytes と差大）。ベンチ条件も OS/sharp版が公式(linux/0.34.5)と違う | 両者とも quality/fit を明示して条件を揃える。公式値は条件（linux x64・sharp 0.34.5）を明記して**引用として区別**、実測を主に置く | 実装に内包 | 解決 | 「比較は条件を揃えないと意味がない」「公式ベンチは条件込みで読む」検証の作法 |

> 事前の「詰まりポイント表」との差分: #1(AVIF失敗) と #3(sharpのbun add失敗) は**当環境では発生せず**。#2(計測ブレ) と #5(quality条件) は予測どおり発生。#4(ユーザー入力をコンストラクタに渡す危険)は入力パスを固定値にして回避（未発生）。

## スクリーンショット一覧

CLI完結タスクのため画像スクショは取得していない。一次証跡は下記テキストログ。

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| commands.log | 全コマンドの入出力（環境・metadata・sharp導入・両ベンチ・大画像・出力検証） | 環境構築 / 実際に試したこと / 詰まった点 / 比較 |
| workspace/out/*.webp, *.avif | 実際に生成された出力ファイル（metadata で妥当性確認済み） | 実際に試したこと / 比較 |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ログ | 書くこと（メモ） |
|---|---|---|
| はじめに | 前提・動機 | sharp のビルドで困った経験と、依存ゼロの Bun.Image を試す動機（当環境ではビルド地獄は再現しなかった点も正直に） |
| なぜBun.Imageを試すのか | フェーズ1 記録 | sharp の native 依存（@img 17M）と Bun.Image の「組み込み・import 0」 |
| 事前に調べたこと | フェーズ1 記録（API表・公式ベンチ・M3+注記・セキュリティ警告） | 対応フォーマット表・公式ベンチ値（linux/0.34.5 条件付きで**引用**、自分の実測と区別） |
| 環境構築 | フェーズ2 ログ / commands.log | `bun init`、ffmpegでの画像自前生成、`bun add sharp`（prebuilt解決0.5s・+19M・@img 17M） |
| 実際に試したこと | フェーズ3 コード（workspace/bun-image.ts, sharp-image.ts）と計測方法 | 両実装コード・チェーンの書き味・`.write()` vs `.toFile()`・ウォームアップ1+5回中央値 |
| 詰まった点 | 「詰まった点」表 / フェーズ3 AVIF記録 | 予測(AVIF失敗/ビルド地獄)が外れた話・計測のばらつき・quality条件の非対称（AVIF 7KB vs 11KB） |
| 触ってみて分かったこと / 比較 | フェーズ4 比較表・大画像ログ | 依存差・出力サイズ・処理時間（1080p 約1.1〜1.2x / 4K 約1.15〜1.29x）・行数の表と考察 |
| sharpと比べて感じたこと | フェーズ3〜4 記録 | API差は小さい・導入は当環境では両者楽・速度は Bun.Image がやや速い・出力サイズは同等 |
| どんな人に向いていそうか | フェーズ5 棚卸し | Bun前提のプロジェクト／依存を減らしたい場合。ただし HEIC/AVIF は OS・チップ依存なので Linux 本番は要検証 |
| まとめ | 結果サマリー | 新人が試した範囲の結論（WebPは楽勝・AVIFは環境依存・公式ベンチは条件込みで読む）・次にやること（実写真/Linuxで再検証） |

## 未達・撤退した項目

- なし（全フェーズ実行・完了条件3件すべて達成）。
- ただし**環境限定の但し書き**: AVIF成功・sharp楽々導入は「macOS 26.5 / M2 Pro」での結果。Linux や別チップでは公式注記どおり AVIF不可・sharp prebuild差が出る可能性があり、記事では環境を明記して断定を避ける。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS 26.5 / arm64 (Apple M2 Pro) / bun 1.3.14 / node v22.17.0 / sharp 0.35.3
- 最短の再現手順:
  ```bash
  bun init --yes
  # サンプル画像を自前生成（ffmpeg。無ければ任意のPNG/JPEGでよい）
  ffmpeg -y -f lavfi -i "testsrc2=size=1920x1080:rate=1" -frames:v 1 input.png
  ffmpeg -y -f lavfi -i "testsrc2=size=4000x3000:rate=1" -frames:v 1 -q:v 3 big.jpg
  mkdir -p out
  bun add sharp
  bun run bun-image.ts     # Bun.Image: resize→webp(+avif) 計測
  bun run sharp-image.ts   # sharp: 同処理
  bun run big-image.ts     # 大画像/JPEG入力ケース
  ```
- 注意点:
  - HEIC/AVIF は macOS/Windows のみ（docs は「AVIF encode は M3+」と注記だが、当環境の M2 Pro では成功した＝実測要）。**Linux は AVIF/HEIC 非対応**。
  - 計測は必ずウォームアップ＋複数回中央値で。1回計測は 2倍以上ブレる。
  - quality を明示し fit を揃えないと不公平比較になる。エンコーダ差で同 quality でも出力サイズは一致しない。
  - Bun.Image コンストラクタに**ユーザー制御文字列を直接渡さない**（任意ファイル読み取り）。入力パスは固定値。
  - testsrc2 は合成パターン。実写真では圧縮率・速度の絶対値が変わりうる。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] 記事タイプ: 書き比べ / 検証ログ（「試してみた」寄り）。タイトル案は practice ファイル参照
- [ ] 完了条件・詰まった点（予測と実際の乖離）・比較表を本文に落とす。公式ベンチは条件込みで引用し実測を主にする
