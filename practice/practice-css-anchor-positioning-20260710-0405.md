# 実践タスク: JSなしでツールチップ/ポップオーバーを CSS Anchor Positioning で作ってみた

## このタスクの前提

- 出典レポート: `research/search-topic-20260710-0400.md`
- 元テーマ: テーマ1「JSなしでツールチップ/ポップオーバーをCSS Anchor Positioningで作ってみた」（レポートの「最初に試すべき1本」＝推奨テーマ）
- 対象技術: CSS Anchor Positioning（`anchor-name` / `position-anchor` / `anchor()` / `position-area` / `anchor-center` / `@position-try` / `position-try-fallbacks`）
- 記事の方向性（記事タイプ）: 「試してみた」「初めて触ってみた」「詰まった点まとめ」＋ Floating UI との軽い比較
- 想定筆者 / 想定読者: Web系の新人フロントエンド / 新人〜実務2年目（Floating UI・JSでの位置計算に苦労した経験がある層）
- 検証に使える想定時間: 半日（約3〜4時間）※引数指定なし → デフォルト前提を採用
- 判断方針: 引数はレポートパスのみ指定。テーマ・時間・スキルレベルは無指定のためデフォルト前提（推奨1本 / 半日 / 新人フロント）を採用。手順・バージョンは MDN 一次情報（`Using CSS anchor positioning` / `anchor-name`、いずれも 2026-01 更新）で裏取り済み。
- 実行環境の担保: HTML/CSS の単一ファイルとローカル Playwright(Chromium) だけで完結する。ビルド・JS・課金・認証・サインアップ・デプロイは一切不要。表示確認とはみ出し検証はすべて Playwright のスクリーンショットで自動判定するため、AIエージェント単独で最後まで実行・検証できる（テーマ置き換えは不要）。

## 完成イメージ（成果物）

- 作るもの: **単一の HTML ファイル（`index.html`、CSS はインライン `<style>`）** に、CSS Anchor Positioning だけで動く UI を 3 種載せたデモページ。
  1. ボタンにひもづくツールチップ（`anchor-name` + `position-anchor` + `anchor()`）
  2. 同じツールチップを `position-area` で書き換えた版（記述量の比較用）
  3. 画面端に置いたボタン用に `@position-try` / `position-try-fallbacks` ではみ出し回避するポップオーバー
- 「できた」と言える完了条件:
  - ツールチップがアンカー要素（ボタン）に対して意図した位置（例: 直下・中央）に表示される
  - ボタンを画面端に寄せると、フォールバックで反対側/内側に回り込み、ビューポートからはみ出さない
  - `@supports (anchor-name: --x)` フォールバックを入れ、非対応環境でも崩れない
- 完了確認の方法: **Playwright(Chromium) のスクリーンショット**。各状態（通常配置 / position-area版 / 画面端フォールバック前後 / 各 anchor-side）を撮り、位置が期待どおりか画像で判定する。あわせて `page.evaluate` で `CSS.supports('anchor-name: --x')` の真偽をログに残す。
- 記事タイトル案（そのまま使える形）:
  1. 新人がCSS Anchor Positioningでツールチップを作ってみた（JS不要・詰まった点つき）
  2. Floating UIをやめてCSSだけでポップオーバーを配置してみた
  3. CSS Anchor Positioningを初めて触って詰まったところ（Baseline 2026・フォールバック編）

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**。CSS Anchor Positioning はブラウザ標準機能で、外部サービス・トークン・課金は一切使わない。
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node.js（Playwright 実行用 / LTS 系。`node -v` で確認）。ブラウザは Playwright が管理する Chromium を使う（システムの Chrome 不要）。
- [ ] インストールするもの: `npm i -D @playwright/test` と `npx playwright install chromium`（Chromium バイナリ）。HTML/CSS 自体は追加インストール不要。
- [ ] 無料枠 / コストの確認: すべて OSS・ローカル完結で **完全無料**。ネットワークは Playwright の初回ブラウザDLのみ。
- [ ] 記録用の準備（リポジトリ・スクショ・ログの置き場）: 作業ディレクトリ（例: `sandbox/anchor-positioning/`）を git 管理。スクショは `screenshots/` に連番＋状態名で保存。実行コマンド・エラー全文・所要時間を `notes.md` に追記。

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] MDN「Using CSS anchor positioning」を開き、`anchor-name` / `position-anchor` / `anchor()` / `position-area` / `anchor-center` の役割を1行ずつ書き出す（目安: 15分）
  - 記録すること: 各プロパティを自分の言葉で説明したメモ。読んで初めて知った前提（例: `anchor()` は「位置」ではなく **length（長さ）を返す**ので inset プロパティ側で使う、`margin` では効かない）。
- [ ] MDN の Browser compatibility と「Baseline 2026」表記を確認し、Chrome/Edge・Safari・Firefox の対応状況を表にする（目安: 15分）
  - 記録すること: 「Baseline 2026（newly available / 2026-01〜）」の文言と、「Some parts of this feature may have varying levels of support」という但し書き。どの機能（特に `@position-try`）が遅れているかの当たり。→ 記事の「事前に調べたこと」節の一次情報になる。

### フェーズ2: 環境構築（目安: 40分）

- [ ] 作業ディレクトリを作り `git init`、`index.html` に最小の HTML 雛形（ボタン1つ＋ツールチップ用 div 1つ）を置く（目安: 10分）
  - 記録すること: ディレクトリ構成と、最初に置いた HTML の全文。
- [ ] `npm init -y` → `npm i -D @playwright/test` → `npx playwright install chromium` を実行し、バージョンを控える（目安: 15分）
  - 記録すること: 実行コマンドと出力、Playwright / Chromium のバージョン、DL 所要時間。詰まったら **エラー全文**。
- [ ] スクショ取得スクリプト（`shot.mjs` など）を作り、`file://` で `index.html` を開いて1枚撮れることを確認する（目安: 15分）
  - 記録すること: スクリプト全文、生成された画像パス、`file://` パス指定でハマった点（相対パス・`path.resolve` など）。→ これが以降すべての完了判定基盤になる。

### フェーズ3: 実装・検証【本編】（目安: 110分）

- [ ] ツールチップを実装する: ボタンに `anchor-name: --tip-anchor`、ツールチップに `position: absolute; position-anchor: --tip-anchor;` と `top: anchor(bottom); left: anchor(left);` を設定し、ボタン直下に出す。Playwright でスクショを撮り位置を確認する（目安: 30分）
  - 記録すること: 適用した CSS 全文、スクショ、意図どおり配置されたか。`anchor()` を `margin` に書いて効かなかった等の失敗があれば全部残す。
- [ ] `anchor-side` を上下左右に切り替える（`anchor(top)` / `anchor(right)` など）4パターンを作り、各状態のスクショを撮って挙動差をメモする（目安: 20分）
  - 記録すること: 各 anchor-side のスクショと、想定と違った配置（`anchor-side` と inset プロパティの相性が悪いと **fallback 値が使われエラーにならず黙って外れる** 挙動など）。
- [ ] 同じツールチップを `position-area`（例: `position-area: bottom center;` や `bottom span-right`）で書き換え、`anchor()` 版と記述量・挙動を比較する。中央寄せに `justify-self: anchor-center;` も試す（目安: 30分）
  - 記録すること: 両実装の CSS 行数比較、`position-area` で幅が anchor 幅に揃う/max-content になる挙動、スクショ。どちらが書きやすかったかの所感。
- [ ] 画面端対応: ボタンを右端・下端に配置し、`position-try-fallbacks`（`flip-block` / `flip-inline` などのキーワード、または `@position-try` の自作フォールバック）を追加。フォールバック **適用前後** のスクショを撮り、はみ出しが消えることを確認する（目安: 30分）
  - 記録すること: フォールバック追加前（はみ出す）と後（回り込む）のスクショ2枚、使ったキーワード/自作 `@position-try` の CSS、`@position-try` が Chromium で効いたか（Baseline の但し書きとの照合）。

### フェーズ4: 深掘り・比較（目安: 30分）

- [ ] `@supports (anchor-name: --x)` でフォールバック分岐を書き、Playwright の `page.evaluate(() => CSS.supports('anchor-name: --x'))` で対応判定をログに残す。非対応時に崩れない静的配置も用意する（目安: 15分）
  - 記録すること: `@supports` ブロックの CSS、`CSS.supports` の返り値ログ、非対応フォールバック時のスクショ。
- [ ] 「これを Floating UI/Popper でやるなら何行・何依存だったか」を1段落で書き出し、CSS 版の依存ゼロと対比する（目安: 15分）
  - 記録すること: JS 実装時に必要だったもの（ライブラリ・リサイズ/スクロール監視・再計算）と、CSS 版で不要になったものの対比メモ。→ 記事の「比較」節に直結。

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] 記録テンプレを見返して詰まった点を棚卸しする（目安: 15分）
  - 記録すること: 詰まりポイント表（後述）の各行に、実際に起きたこと・効いた対処を追記。
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋める（目安: 15分）
  - 記録すること: 見出しごとに貼るスクショ・CSS・ログの割り当て。素材が足りない見出しがないか点検。

> 目安時間の合計: 約 4 時間 0 分（事前調査30 + 環境構築40 + 本編110 + 深掘り30 + 振り返り30 = 240分）。半日（約3〜4時間）の想定時間内に収まる。超過しそうなら anchor-side 4パターンを2パターンに削るか、深掘りの Floating UI 比較を省略する。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `anchor()` を書いても要素が動かない | `anchor()` は **length を返す関数**で、`top`/`left` などの inset プロパティに使う必要がある。`margin` に書いても効かない。また positioned 要素側に `position: absolute/fixed` が無いと機能しない | `position: absolute` の付け忘れを確認 → `anchor()` を inset プロパティに移す | 「新人が最初にハマる誤解」として失敗CSSと修正後を並べて見せる |
| 2 | `anchor-side` を変えても配置が変わらない/想定外の位置 | `anchor-side` の値と inset プロパティの組み合わせに相性があり、非対応だと **エラーにならず fallback 値が黙って使われる** | inset プロパティ（`top` に `anchor(bottom)` 等）の対応関係を MDN で確認し組み合わせを直す | 「エラーが出ないから気づきにくい」落とし穴として記事化 |
| 3 | 画面端で吹き出しがはみ出す / `@position-try` が効いた実感がない | フォールバックは `position-try-fallbacks` か `@position-try` の宣言が必要。Baseline 2026 でも「一部機能は対応にばらつき」とされ、フォールバック系は実装差が残りやすい | まず `position-try-fallbacks: flip-block, flip-inline;` を試し、効かなければ `@position-try` を自作。Playwright で適用前後を撮って差分確認 | フォールバック前後のスクショ2枚で「効いている証拠」を見せる記事の山場 |
| 4 | 同じ `anchor-name` を複数コンポーネントで使うと全部が最後の1つに吸着 | 同名アンカーが複数あると、positioned 要素は **ソース順で最後のアンカー**に紐づく仕様 | `anchor-scope` でサブツリーごとにスコープを切る | 「コンポーネントを繰り返すと壊れる」実務ハマりどころとして紹介 |
| 5 | Playwright スクショで `file://` パスが開けない/真っ白 | 相対パス指定や `page.goto` のパス形式ミス。読み込み完了前に撮っている | `path.resolve` で絶対 `file://` URL を作り、`waitUntil: 'load'` を指定してから撮る | 検証基盤づくりの詰まりとして環境構築節に短く記録 |
| 6 | Firefox/Safari で崩れる前提で書いてよいか迷う | MDN は Baseline 2026（newly available）だが「some parts may have varying levels of support」と明記。Playwright は Chromium で確認する方針 | `@supports` フォールバックを必ず入れ、記事では「Chromium で確認」「本番は @supports 前提」と範囲を明示 | 「新人が試した範囲」を正直に線引きする材料。断定を避ける根拠になる |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術と比べて感じた違い（Floating UI/Popper との対比）:
- スクショを撮った箇所（状態名・ファイル名）:
- 記事に書きたい気づき:

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」（1.はじめに 2.なぜCSSだけで配置したいのか 3.事前に調べたこと 4.最小サンプル 5.実際に試したこと 6.詰まった点 7.分かったこと 8.Floating UI比較 9.どんな人向きか 10.まとめ）に対応させる。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・動機（このファイル冒頭） | 新人が JS の位置計算に苦労した動機、何を試したか |
| 2. なぜCSSだけで配置したいのか | フェーズ4 の Floating UI 対比メモ | JS 実装の面倒さ（監視・再計算・依存） |
| 3. 事前に調べたこと（Baseline状況） | フェーズ1 の記録 | Baseline 2026 の但し書き・ブラウザ対応表 |
| 4. 最小サンプル | フェーズ2・フェーズ3最初のタスク | 単一HTMLの雛形と最初のツールチップCSS |
| 5. 実際に試したこと（配置バリエーション） | フェーズ3 の anchor-side / position-area タスク | anchor()版とposition-area版、各スクショ |
| 6. 詰まった点（ブラウザ差・はみ出し） | 詰まりポイント表・記録テンプレ・フェーズ3の端対応 | エラー全文とフォールバック前後スクショ |
| 7. 分かったこと | フェーズ5 の棚卸し | 使ってみた所感・記述量比較の結論 |
| 8. Floating UI比較 | フェーズ4 の対比メモ | 依存ゼロ vs ライブラリ・監視コード |
| 9. どんな人向きか | フェーズ5・フェーズ4の @supports 判定 | Chromium 前提・@supports フォールバック必須の線引き |
| 10. まとめ | フェーズ5 の棚卸し | 向いている人・次にやること |

## 経験談として書くときのコツ

- 「新人が試した範囲（Chromium で確認）」を明示し、専門家として断定しすぎない
- うまくいった点だけでなく、`anchor()` が効かなかった等の詰まりと解決過程を残す
- 実行ログ・スクリーンショット（特にフォールバック前後）・CSS 全文を貼る
- MDN / web.dev Baseline digest 2026 へのリンクを必ず入れる
- 再現性のため Playwright/Chromium のバージョンと OS を明記する

## 参考リンク

- 公式ドキュメント: MDN「Using CSS anchor positioning」 https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning/Using
- 公式ドキュメント: MDN `anchor-name` https://developer.mozilla.org/en-US/docs/Web/CSS/anchor-name （Baseline 2026 / newly available 表記を確認）
- 関連: MDN「Fallback options and conditional hiding」（`@position-try` / `position-try-fallbacks` の詳細。※本文は要確認）
- 関連: web.dev Baseline digest 2026 / css-tricks Interop 2026（レポート記載の二次情報）
- 検証基盤: Playwright 公式（`@playwright/test` / `playwright install`）

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: なし。すべてローカル・OSS。ネットワークは Playwright の Chromium 初回DLのみ。
- ライセンス / 規約: CSS は Web 標準、Playwright は Apache-2.0。制約なし。
- セキュリティ（APIキーの扱い等）: APIキー・秘密情報を一切扱わない。`file://` のローカルHTMLのみ。
- 撤退ライン（ここまで詰まったら別アプローチに切り替える）: `@position-try` / `position-try-fallbacks` が Chromium でも安定して動かない場合は、フォールバック検証を深追いせず「基本配置＋@supports フォールバック」までで成果物を確定し、フォールバックは「まだ揺れている機能」として詰まり記事に振り替える（撤退＝そのまま経験談の素材になる）。

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレを埋めながら進める
- [ ] 完了条件を満たしたら「記事への写像」に沿って本文ドラフトへ展開する（`/run-practice` → `/draft-article`）
