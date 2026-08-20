# 実践タスク: TypeScript 7.0 GA に上げて、typescript-eslint を生かしたまま `tsc` だけ速くする（`@typescript/typescript6` 併用構成）

## このタスクの前提

- 出典レポート: `research/search-topic-20260818-1200.md`
- 元テーマ: テーマ1（優先度「最優先」／レポートの「最初に試すべき1本」）
- 対象技術: TypeScript 7.0.2（Goネイティブ `tsc`） / `@typescript/typescript6` 6.0.2 / typescript-eslint 8.67.0
- 記事の方向性（記事タイプ）: 検証ログ / 詰まった点まとめ（過去記事 `typescript7-tsc-bin-collision-log` の続編）
- 想定筆者 / 想定読者: Web系の新人エンジニア / 新人〜実務2年目のTypeScript利用者
- 検証に使える想定時間: 1日（約7時間）※引数指定が無いためデフォルト前提を採用
- 判断方針: 引数で渡されたのは対象レポートのパスのみ。テーマ・時間・スキルレベルは未指定のため、
  レポートの「最初に試すべき1本」＋デフォルト前提（半日〜1日 → 1日配分 / 新人）を採用した。
- 実行環境の担保: 全タスクが `npm` / `package.json` 編集 / `tsc` / `eslint` / `node` の実行のみで完結する。
  課金APIキー・サインアップ・外部デプロイは一切不要。ネットワークは npm registry への読み取りのみ。
  唯一の画面確認（計測結果の比較表）は、ローカルHTMLを Playwright で開いてスクショする形に置き換え済み。
  → テーマの置き換えは不要（レポートのテーマ1をそのまま採用）。

### 事前に確認済みの一次情報（2026-08-18 に registry / 公式ブログ / GitHub で取得）

| 確認項目 | 実際の値 | 取得元 |
|---|---|---|
| `typescript` dist-tags | latest **7.0.2** / rc 7.0.1-rc / beta 6.0.0-beta / next 7.1.0-dev.20260817.1 | `npm view typescript dist-tags` |
| `@typescript/typescript6` dist-tags | latest **6.0.2** | `npm view @typescript/typescript6 dist-tags` |
| `typescript@7.0.2` の `bin` | `{ "tsc": "bin/tsc" }` のみ（`tsc6` は入らない） | `npm view typescript@7.0.2 bin` |
| `@typescript/typescript6@6.0.2` の `bin` | `{ "tsc6": "bin/tsc6" }` のみ | `npm view @typescript/typescript6@6.0.2 bin` |
| `@typescript/typescript6@6.0.2` の `dependencies` | `{ "@typescript/old": "npm:typescript@^6" }` | `npm view @typescript/typescript6@6.0.2 dependencies` |
| `typescript@7.0.2` の `exports["."]` | `./lib/version.cjs`（**Compiler API 本体は無い**）。別途 `./unstable/ast`, `./unstable/fs`, `./unstable/sync`, `./unstable/async`, `./unstable/ast/factory` 等の unstable サブパスのみ存在 | `npm view typescript@7.0.2 exports` |
| `@typescript/typescript6@6.0.2` の `main` | `./lib/typescript.js`（6.0 の API 一式） | `npm view @typescript/typescript6@6.0.2 main` |
| `typescript-eslint@8.67.0` の peer | `typescript: ">=4.8.4 <6.1.0"` ← **7.0.2 は範囲外** | `npm view typescript-eslint@8.67.0 peerDependencies` |
| `eslint` latest | 10.8.1 | `npm view eslint dist-tags` |
| `typescript@7.0.2` の `engines` | `node: ">=16.20.0"`（プラットフォーム別Goバイナリを optional deps で配布） | `npm view typescript@7.0.2 engines dependencies` |
| 公式の alias 併用構成 | `"@typescript/native": "npm:typescript@^7.0.2"` ＋ `"typescript": "npm:@typescript/typescript6@^6.0.2"` | Announcing TypeScript 7.0 |
| 7.0 に API が無い理由と復活時期 | 「7.0 は API を同梱しない。7.1 で新しい（別物の）API を出す予定」。以降3〜4か月ごとのリリース見込み | 同上 |
| 7.0 で動かないとされるツール | Vue / MDX / Astro / Svelte / Angular のテンプレート型チェック / Volar 等の埋め込み系 | 同上 |
| 併用時の CLI フラグ | `--checkers`（並列チェッカー数・既定4） / `--builders`（プロジェクト参照のビルダー数） / `--singleThreaded`（並列化を無効） | 同上 |
| 既知の詰まりポイント | typescript-go#4368（**Open**）: Yarn 4.16.0 + `nodeLinker: node-modules` で alias 構成が `ENOENT: no such file or directory, lstat '.../node_modules/typescript/lib/_tsc.js'` で失敗 | GitHub Issue #4368 |
| 前回の失敗（自分の過去記事） | `typescript@7.0.2` と `@typescript/typescript6@6.0.2` を素直に併記したら、`node_modules/.bin/tsc` が `@typescript/old`（=typescript 6.0.3）に張られ、`tsc` / `tsc6` の両方が `Version 6.0.3` を出した | `articles/typescript7-tsc-bin-collision-log.md` |

> 未確認（本文でも「要確認」と明記する）: `nx.dev` の TypeScript 7 ガイド（URL 404 で参照不可）、
> ts-jest / ts-morph の 7.0 対応状況、pnpm / yarn での alias 構成の成否（今回 npm のみ検証）。

## 完成イメージ（成果物）

- 作るもの: **型チェックに数秒かかる小さなTSプロジェクト（fixture）と、3構成の計測・破壊レポート**
  - 構成A: `typescript@6.0.x` + `typescript-eslint@8.67.0`（ベースライン）
  - 構成B: `typescript@7.0.2` に単純アップグレード（速いが lint が壊れるはず）
  - 構成C: 公式 alias 併用（`tsc` = TS7 / `tsc6` = TS6 API で lint）
- 「できた」と言える完了条件:
  1. 構成A/B/C それぞれで `tsc --noEmit` の実測秒数（3回ずつ）がログに残っている
  2. 構成B で `eslint .` が失敗した**エラー全文**が保存されている（成功してしまった場合はその事実を記録）
  3. 構成C で「`tsc` が 7.0.2 を名乗り、かつ `eslint .` が構成Aと同じ結果を返す」が**両立するか否か**の判定が出ている
  4. `ls -l node_modules/.bin/tsc*` と各バイナリの `--version` 出力が3構成ぶん残っている（前回の bin 衝突が解消したかの答え）
  5. 3構成の比較表をローカルHTMLに出力し、Playwright のスクリーンショットが `images/` に保存されている
- 完了確認の方法: CLI出力（`--version` / `time` / eslint のエラー全文）＋ Playwright スクショ1枚
- 記事タイトル案（そのまま使える形）:
  1. TypeScript 7.0 に上げたら `tsc` は速くなったが、typescript-eslint が peer で弾かれた ——公式の alias 併用構成で戻すまで
  2. 前回は `tsc` の bin 衝突で止まった。GA版 TypeScript 7.0 と `@typescript/typescript6` で再挑戦した記録
  3. `tsc` は 7.0、lint は 6.0 API のまま。TypeScript 7 の公式 side-by-side 構成を新人が実測してみた

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**。npm registry への read のみ。課金・サインアップは一切発生しない
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node.js（`typescript@7.0.2` の engines は `>=16.20.0`）、npm。
      検証機の実測値を `node -v` / `npm -v` / `sysctl -n hw.ncpu` / `uname -a` で記録しておく
      （記録済み例: Darwin 25.5.0 arm64 / Node v22.17.0 / npm 10.9.2 / Apple M2 Pro / 10 logical CPUs）
- [ ] インストールするもの: `typescript@6.0.x`, `typescript@7.0.2`, `@typescript/typescript6@6.0.2`,
      `typescript-eslint@8.67.0`, `eslint@10.8.1`, `@playwright/test@1.62.1`
- [ ] 無料枠 / コストの確認: すべて OSS・無料。ネットワーク転送のみ（TS7 はプラットフォーム別Goバイナリを落とすため
      初回 install が重め。ダウンロード量も記録対象にする）
- [ ] 記録用の準備: 作業ディレクトリ `fixtures/typescript7-alias-tsc6/`、ログ `logs/run-typescript7-alias-tsc6-<日時>/`、
      スクショ `images/typescript7-alias-tsc6/`。npm cache は作業ディレクトリ配下に隔離する
      （`npm_config_cache="$WORK_DIR/npm-cache"`。前回記事と同じ手法で再現性を上げる）

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 45分）

- [ ] 当日の dist-tags を再取得して版を固定する（目安: 10分）
  - `npm view typescript dist-tags --json`, `npm view @typescript/typescript6 dist-tags --json`,
    `npm view typescript-eslint dist-tags --json`, `npm view eslint dist-tags --json`
  - 記録すること: 実行コマンドと**出力全文**。上表の値（7.0.2 / 6.0.2 / 8.67.0 / 10.8.1）と差があれば差分を明記。
    「記事を書いた日にインストールできた版」は再現性の要なので必ず残す
- [ ] 壊れる根拠をレジストリのメタデータで先に確定させる（目安: 15分）
  - `npm view typescript@7.0.2 bin exports engines --json`
  - `npm view @typescript/typescript6@6.0.2 bin main dependencies --json`
  - `npm view typescript-eslint@8.67.0 peerDependencies --json`
  - 記録すること: 「`typescript@7.0.2` の `exports["."]` が `./lib/version.cjs` しか無い」
    「typescript-eslint の peer が `<6.1.0`」という2点を、**実行前に予測として書き留める**。
    予測 → 実測の順で書けると経験談として強い
- [ ] 公式アナウンスの該当箇所を読み、alias 構成の JSON をそのまま控える（目安: 10分）
  - https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
  - 記録すること: 引用する JSON、7.1 で API が戻る旨の記述、`--checkers` / `--builders` / `--singleThreaded` の説明
- [ ] 前回の失敗内容を読み返し、「今回どこが変わるはずか」を1段落で書く（目安: 10分）
  - `articles/typescript7-tsc-bin-collision-log.md` の「失敗の切り分け」節
  - 記録すること: 前回 `.bin/tsc` が `@typescript/old/bin/tsc`（6.0.3）に張られた事実と、
    今回 alias 構成でそれが変わると考える理由（または変わらないと考える理由）。**ここが記事の導入になる**

### フェーズ2: 環境構築 ＋ 構成A（ベースライン）（目安: 60分）

- [ ] fixture プロジェクトを作る（目安: 25分）
  - `mkdir -p fixtures/typescript7-alias-tsc6 && cd $_ && npm init -y && npm pkg set private=true`
  - `tsconfig.json` は `strict: true` / `noEmit` 前提。**型チェックに数秒かかる規模**にすること
    （ジェネリクス・条件型・大きめの union を含む `.ts` を数十本。1ファイルが軽すぎると差が出ず記事にならない）
  - 記録すること: 生成したファイル数と行数（`find src -name '*.ts' | wc -l`, `wc -l src/*.ts` の出力）、
    tsconfig の全文、「どういうコードを入れたら型チェックが重くなったか」の感触
- [ ] 構成A（TS6 + typescript-eslint）を入れて lint 設定を通す（目安: 20分）
  - `npm i -D --save-exact --ignore-scripts typescript@6.0.3 typescript-eslint@8.67.0 eslint@10.8.1`
  - `eslint.config.js` は typescript-eslint の型情報つき設定（`projectService`）にする
  - 記録すること: install の所要時間、`npm ls --depth=0` の出力、eslint 設定で詰まった箇所
- [ ] ベースラインを計測する（目安: 15分）
  - `for i in 1 2 3; do time npx tsc --noEmit; done` と `npx tsc --version`
  - `time npx eslint .`（エラー件数も記録）
  - 記録すること: 3回ぶんの `real` 秒数、初回と2回目以降の差（キャッシュ影響）、eslint の所要時間と結果。
    **CPUコア数・OS・Node版を必ずセットで残す**

### フェーズ3: 実装・検証【本編】（目安: 180分）

- [ ] 構成B: `typescript@7.0.2` に単純アップグレードして install の反応を見る（目安: 30分）
  - `npm i -D --save-exact typescript@7.0.2`（`--ignore-scripts` を付けるか外すかも記録。TS7はGoバイナリ配布のため挙動差が出うる）
  - 記録すること: **peer 依存の警告 / ERESOLVE エラーが出たら全文**。typescript-eslint の peer は `<6.1.0` なので
    ここで弾かれる可能性が高い。`--legacy-peer-deps` や `--force` を使ったなら**使った事実と理由**を書く。
    ダウンロードされたプラットフォーム別パッケージ（`@typescript/typescript-darwin-arm64` 等）と install 時間
- [ ] 構成B の型チェック速度を計測する（目安: 25分）
  - `npx tsc --version` → 7.0.2 を名乗るか確認（**ここで 6.x が出たら前回と同じ bin 衝突。その事実こそ成果**）
  - `for i in 1 2 3; do time npx tsc --noEmit; done`
  - 記録すること: `--version` の出力、3回の秒数、構成Aとの倍率。診断メッセージの文言が6と7で違うなら差分も
- [ ] 構成B で `eslint .` を実行し、壊れ方を全文で保存する（目安: 30分）★記事の山場
  - `npx eslint . 2>&1 | tee logs/.../eslint-ts7.log`
  - 記録すること: **エラー全文**（要約しない）。`typescript@7.0.2` の `exports` に Compiler API が無いため
    `ERR_PACKAGE_PATH_NOT_EXPORTED` 系や `ts.createProgram is not a function` 系が想定されるが、
    実際に何が出たかをそのまま貼る。**もし普通に通ってしまったらその事実を正直に記録する**（予測が外れたのも一次情報）
- [ ] 失敗の原因をコードで裏取りする（目安: 20分）
  - `node -e "console.log(require.resolve('typescript'))"` と
    `node -e "const ts=require('typescript'); console.log(Object.keys(ts).slice(0,20))"`
  - 記録すること: TS7 の `typescript` が何を返すか（`version` だけか）。
    「`exports` フィールドを読む」という切り分け手順そのものが新人読者に効く
- [ ] 構成C: 公式 alias 併用構成に切り替える（目安: 30分）
  - `package.json` の devDependencies を公式どおりに書き換える:
    `"@typescript/native": "npm:typescript@^7.0.2"` / `"typescript": "npm:@typescript/typescript6@^6.0.2"`
  - `rm -rf node_modules package-lock.json && npm i`
  - 記録すること: 書き換え前後の `package.json` の diff、install ログ、`npm ls --depth=0` の出力
- [ ] ★前回の宿題: bin の解決先を確定させる（目安: 30分）
  - `ls -l node_modules/.bin/tsc*`（symlink の指し先まで）
  - `./node_modules/.bin/tsc --version` / `./node_modules/.bin/tsc6 --version` / `npx tsc --version`
  - `npm ls @typescript/old` で TS6 実体がどこに入ったか確認
  - 記録すること: **前回は両方 `Version 6.0.3` だった**。今回どうなったかを同じ形式で並べる。
    もし今回も `tsc` が 6.x を指すなら、`node_modules/@typescript/native/bin/tsc --version` を直接叩いた結果と、
    回避策（`npm pkg set scripts.typecheck="@typescript/native/bin/tsc --noEmit"` 等）を記録する
- [ ] 構成C で「型チェックはTS7 / lint はTS6 API」が両立するか確かめる（目安: 15分）
  - 型チェック: 7.0.2 を名乗るバイナリで `--noEmit` を3回計測
  - lint: `npx eslint .` が構成Aと同じ結果（エラー件数一致）を返すか
  - 記録すること: 両立したか否かの判定、両立した場合の「実際に打つコマンド」、
    しなかった場合はどこで折れたか

### フェーズ4: 深掘り・比較（目安: 90分）

- [ ] `--checkers` / `--singleThreaded` を振って計測差を出す（目安: 30分）
  - 既定（`--checkers` 4）/ `--checkers 1` / `--singleThreaded` をそれぞれ3回
  - 記録すること: 各条件の秒数と、10コア機で並列度を下げるとどれだけ落ちるか。
    「8〜12倍」は大規模コードベースの話なので、**自分の小さな fixture で出た倍率をそのまま正直に書く**
- [ ] TS7 の unstable API に何があるか覗く（目安: 20分）
  - `node -e "console.log(Object.keys(require('typescript/package.json').exports))"`
  - `node -e "console.log(Object.keys(require('@typescript/native/unstable/ast')).slice(0,20))"` 等（要確認：実際に読めるか）
  - 記録すること: `./unstable/ast` `./unstable/fs` `./unstable/sync` `./unstable/async` `./unstable/proto` の存在と、
    「7.1 で正式APIが来る」という公式の記述との関係。**触れたが動かなかったものは動かなかったと書く**
- [ ] 3構成の比較表を作り、HTMLに出力して Playwright でスクショする（目安: 25分）
  - 計測値を `report.html`（表1枚）に書き出し、Playwright で `page.screenshot()` を
    `images/typescript7-alias-tsc6/benchmark.png` に保存
  - 記録すること: スクショのパス、表に入れた列（TS6 / TS7単純 / TS7+alias × tsc秒数 / eslint結果 / tsc --version）
- [ ] 別パッケージマネージャでの挙動は「未検証」として境界を明示する（目安: 15分）
  - typescript-go#4368（Yarn 4.16.0 + `nodeLinker: node-modules` で `ENOENT ... lib/_tsc.js`、Open）を読む
  - 記録すること: 今回 npm でしか試していないこと、Yarn には既知の Open issue があること。
    **時間が余ったときだけ** pnpm で同じ alias 構成を試し、結果を追記する（余らなければ「未検証」と書く）

### フェーズ5: 振り返り・記事化準備（目安: 45分）

- [ ] 記録テンプレを見返して詰まった点を棚卸しする（目安: 20分）
  - 記録すること: 見積もり時間と実測の差が大きかったタスク、予測が外れた箇所（当たった予測も）
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋める（目安: 15分）
  - 記録すること: 各見出しに貼るログ/スクショのファイルパス対応
- [ ] 「今このバージョンに上げてよい人／待つべき人」の判断軸を3行で書く（目安: 10分）
  - 記録すること: 7.1 で API が戻る見込みという公式情報を踏まえた自分の結論。断定はせず「新人が試した範囲では」と添える

> 目安時間の合計: 45 + 60 + 180 + 90 + 45 = **420分（約7時間）**。想定時間「1日」の範囲内。
> 巻きが必要なら、フェーズ4の「unstable API を覗く」と「pnpm 追試」を落として **約5時間45分** に短縮できる。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `npx tsc --version` が 7.0.2 ではなく 6.x を返す（前回の再来） | `@typescript/typescript6` は `@typescript/old`（= `npm:typescript@^6`）に依存し、その実体の `bin` も `tsc`。npm の bin リンクでどちらが `.bin/tsc` を取るかが構成に依存する | `ls -l node_modules/.bin/tsc*` で symlink の指し先を見る → `node_modules/@typescript/native/bin/tsc --version` を直接叩いて実体を切り分ける → npm scripts でフルパス指定に逃がす | 前回記事の続きとして最大の見せ場。「バージョンは合っているのに `.bin` から別実装が起動する」切り分け手順は汎用的に刺さる |
| 2 | `npm i -D typescript@7.0.2` が ERESOLVE で止まる | `typescript-eslint@8.67.0` の peer が `typescript: ">=4.8.4 <6.1.0"`。7.0.2 は範囲外 | エラー全文を保存 → `--legacy-peer-deps` で通すか、alias 構成へ進むかを選ぶ（使ったフラグは必ず記事に書く） | 「上げたら速い」より先に来る現実の壁。**peer 範囲を `npm view` で事前確認する習慣**を新人に渡せる |
| 3 | lint 実行時に `ERR_PACKAGE_PATH_NOT_EXPORTED` / `ts.createProgram is not a function` 系で落ちる | `typescript@7.0.2` の `exports["."]` は `./lib/version.cjs` のみで、Compiler API が同梱されていない（7.1で復活予定） | `node -e "console.log(require.resolve('typescript'))"` と `Object.keys(require('typescript'))` で「何が入っているか」を直接見る | 「API が無い」を概念でなく**実際の require 結果**で示せる。エラーメッセージからパッケージの `exports` を読む導線を書く |
| 4 | TS7 の install が遅い / プラットフォーム別パッケージで失敗する | 7.0 は Go 製バイナリを `@typescript/typescript-<os>-<arch>` の optional deps で配布する | `npm ls @typescript/typescript-darwin-arm64` 等で自機向けが入ったか確認。`--ignore-scripts` の有無で挙動が変わらないか両方試す | 「Go 移植」がインストール体験にどう表れるかは実測でしか書けない差別化ポイント |
| 5 | 計測値がブレて「速くなった」と言い切れない | fixture が小さい / 初回はキャッシュ無し / 並列チェッカーがコア数の影響を受ける | 必ず3回計測して初回と2回目以降を分けて記録。CPUコア数・OS・Node版を併記 | 「8〜12倍」は大規模の話。**小さい fixture では倍率が出ない**という正直な結果自体が価値になる |
| 6 | Yarn / pnpm では手順どおりに動かない | typescript-go#4368（Open）: Yarn 4.16.0 + `nodeLinker: node-modules` で `ENOENT: ... node_modules/typescript/lib/_tsc.js` | npm で完走させることを優先し、他のPMは「未検証」と明記する | 再現条件（PM と版）を明記する姿勢そのものが信頼になる。既知 issue へのリンクで読者を逃がせる |
| 7 | 構成を切り替えたのに古い `node_modules` が残って結果が汚れる | alias への書き換えは lockfile の解決結果を大きく変える | 構成を変えるたびに `rm -rf node_modules package-lock.json && npm i`。npm cache は作業ディレクトリ配下に隔離 | 「計測をやり直したら結果が変わった」系の失敗談は再現性の話として書きやすい |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術と比べて感じた違い（TS6 の tsc との体感差）:
- スクショを撮った箇所:
- 記事に書きたい気づき:

### 計測記録シート（フェーズ2〜4で埋める）

| 構成 | `tsc --version` | `tsc --noEmit` 1回目 | 2回目 | 3回目 | `eslint .` の結果 | 備考 |
|---|---|---|---|---|---|---|
| A: TS 6.0.3 |  |  |  |  |  | ベースライン |
| B: TS 7.0.2 単純アップ |  |  |  |  |  | peer / API の壊れ方 |
| C: alias 併用 |  |  |  |  |  | tsc=7 / tsc6=6 |
| C + `--checkers 1` |  |  |  |  | — |  |
| C + `--singleThreaded` |  |  |  |  | — |  |

実行環境: OS ______ / CPU ______（論理コア数 ___）/ Node ______ / npm ______ / 実行日 ______

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに（前回は bin 衝突で止まった） | フェーズ1「前回の失敗を読み返す」 | 過去記事の要約1段落と、今回の再挑戦の動機 |
| 2. なぜ TypeScript 7.0 を試すのか | フェーズ1「公式アナウンスを読む」 | GA の事実、Go移植、速度の触れ込み（自分の実測とは分けて書く） |
| 3. 事前に調べたこと（7.0にAPIが無い / 7.1で入る） | フェーズ1「レジストリのメタデータで裏取り」 | `exports` と peer 範囲を**実行前に**確認した記録。予測を先に書く |
| 4. 環境構築とベースライン計測 | フェーズ2 全タスク | fixture の中身、tsconfig、TS6 での秒数3回、実行環境スペック |
| 5. 単純に上げてみる → 速い、しかし lint が落ちる | フェーズ3 前半3タスク | install 時の警告、`tsc` の秒数比較、`eslint` のエラー全文 |
| 6. 詰まった点（エラー全文と原因） | 詰まりポイント表 #2 #3 ＋ フェーズ3「原因をコードで裏取り」 | `require('typescript')` が何を返したか、切り分けの手順 |
| 7. 公式の alias 併用構成にする | フェーズ3「構成Cに切り替え」＋「bin の解決先を確定」 | package.json の diff、`ls -l node_modules/.bin/tsc*`、前回との比較 |
| 8. 数字の比較表（TS6 / TS7 / TS7+alias） | 計測記録シート ＋ フェーズ4「HTML表をスクショ」 | 比較表と `images/typescript7-alias-tsc6/benchmark.png` |
| 9. どんな人が今上げてよさそうか（7.1待ちの判断軸） | フェーズ5「判断軸を3行で書く」＋ フェーズ4「PM差は未検証」 | 上げてよい条件・待つべき条件、検証していない範囲の明示 |
| 10. まとめ | フェーズ5「棚卸し」 | 分かったこと3点、次にやること、参考リンク |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない
- 公式の「8〜12倍」と自分の fixture の実測倍率を**混ぜない**。別の数字として並べる
- うまくいった点だけでなく、詰まった点と解決過程を書く。**予測が外れた箇所こそ書く**
- 実行ログ・スクリーンショット・コードを残して貼る。エラーは要約せず全文
- 公式ドキュメントと GitHub issue へのリンクを入れる
- 再現性（OS / CPUコア数 / Node / npm / パッケージ版 / 実行日）を冒頭に明記する
- npm でしか試していない、pnpm/yarn は未検証、という**境界を正直に書く**

## 参考リンク

- 公式ドキュメント:
  - Announcing TypeScript 7.0 — https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
  - `@typescript/typescript6`（npm） — https://www.npmjs.com/package/@typescript/typescript6 ※WebFetch は 403。ブラウザ/`npm view` で確認する
- チュートリアル / クイックスタート:
  - `npm view typescript dist-tags` / `npm view typescript@7.0.2 bin exports` （当日の版とパッケージ構造の確認）
  - nx の TypeScript 7 ガイド ※レポート記載の URL は 404（**要確認**）
- 関連記事・既知の詰まりポイント:
  - typescript-go #4368（Yarn での alias 構成失敗・Open） — https://github.com/microsoft/typescript-go/issues/4368
  - 自分の過去記事 — `articles/typescript7-tsc-bin-collision-log.md`
  - gihyo.jp「TypeScript 7.0が正式リリース」 — https://gihyo.jp/article/2026/07/typescript-7-0

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: **なし**。すべてOSS・ローカル完結。課金トリガーは存在しない
- ライセンス / 規約: TypeScript は Apache-2.0。fixture コードは自作のものだけを使う（他所のコードを丸ごと持ち込まない）
- セキュリティ（APIキーの扱い等）: APIキーを一切使わない。ログを記事に貼る前に絶対パス（ユーザー名を含む `/Users/...`）を伏せる
- 環境汚染: グローバルインストールはしない。作業は `fixtures/typescript7-alias-tsc6/` 配下に閉じ、
  npm cache も `npm_config_cache` で隔離する
- 撤退ライン:
  - フェーズ2の fixture で `tsc --noEmit` が **1秒未満**しかかからない → ファイルを増やして重くする。
    それでも差が出ないなら「差が測れなかった」を結論として記事化する（作り直しで時間を溶かさない）
  - フェーズ3で構成Cの install がどうしても通らない → 構成A/B の比較と失敗ログだけで記事を成立させる
    （前回同様「止まった記録」でも一次情報としては十分成立する）
  - フェーズ4のいずれかで詰まったら深掘りは丸ごと切る。フェーズ3までで記事の骨格は揃う

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレ・計測記録シートを埋めながら進める
- [ ] 完了条件（5項目）を満たしたら「記事への写像」に沿って本文ドラフトへ展開する
- [ ] `/run-practice` でこの実践タスクを実行 → `/draft-article` へ
