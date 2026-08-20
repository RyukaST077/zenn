# 公開前レビュー: pnpm 12 RC に上げて、公式が挙げた「5つの差分」を1つずつ踏んでみた / pnpm12-rc-five-diffs

## レビューの前提

- 対象記事: `articles/pnpm12-rc-five-diffs.md`（引数で明示指定）
- 出典ログ: `logs/run-pnpm12-rc-five-diffs-20260816-0411/execution-log.md`（引数で明示指定）
  - 併せて `logs/run-pnpm12-rc-five-diffs-20260816-0411/artifacts/` の一次成果物
    （`04-corepack-trap.log` / `lock-ssh-v11.yaml` / `lock-ssh-v12.yaml` / `lock-v11-order*.yaml` /
    `lock-v12-order*.yaml`）を照合に使用
- レビュー日時: 2026-08-16 04:28
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開不可**

- blocker: 1 件 / warning: 2 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - blocker 1: ②節（L252）の「`grep -c ssh` も `grep -c git@` も lockfile 内で 0 件です」が、
    直前に貼っている `git+ssh://` fixture の lockfile については**事実と異なる**。
    一次成果物では `lock-ssh-v11.yaml` / `lock-ssh-v12.yaml` とも `grep -c ssh` = **2**、
    `grep -c git@` = **1**。0 件だったのは3表記 fixture の `lock-v11/v12.yaml` の方。
    ②の結論（SSH URL は記録されない）を支える中心の数値なので、そのままでは公開できない。

## 最優先で直すべき指摘（上位3件）

1. [blocker] ②節 L252 — 「`grep -c ssh` も `grep -c git@` も lockfile 内で 0 件です」を、
   「`version:` / `resolution:` 行には `ssh` も `git@` も現れません（`specifier:` には自分が書いた
   `git+ssh://git@github.com/...` がそのまま残ります）。3表記 fixture の lockfile では
   `grep -c ssh` / `grep -c git@` とも 0 件でした」に書き換える。
2. [warning] 「触ってみて分かったこと」L430・L459〜465 — 「ウォームストアだから `integrity` を書けない」
   という一般化が pnpm 12 の実測と矛盾する（12 はウォームストアでも `integrity` を書いている）。
   「pnpm 11.22.0 では」と主語を限定し、12 では同条件でも `integrity` が入っていた旨を1行足す。
3. [warning] 「触ってみて分かったこと」L457 — 「③で書いた `integrity` の件」の参照先が誤り。
   `integrity` の話は④および「詰まった点」で書いている。「④と『詰まった点』で触れた」に直す。

## 指摘一覧（重大度順）

### blocker

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「② Git依存の正規化は、11.22.0 の時点で既に終わっていた」L252 | `git+ssh://` fixture の出力を貼った直後に「`grep -c ssh` も `grep -c git@` も lockfile 内で 0 件です」と書いているが、その lockfile には両方とも出現する。0 件は別 fixture（3表記）の測定値であり、混線している | 「両方とも lockfile の `version:` / `resolution:` 行は HTTPS の codeload URL でした（`specifier:` には書いたとおりの `git+ssh://git@github.com/kevva/is-positive.git` が残ります）。`grep -c ssh` / `grep -c git@` が 0 件だったのは、`git+ssh://` を含まない3表記 fixture の lockfile の方です」に置換 | `artifacts/lock-ssh-v11.yaml` / `lock-ssh-v12.yaml`: `grep -c ssh`=2, `grep -c git@`=1。`artifacts/lock-v11.yaml` / `lock-v12.yaml`: 両方 0。execution-log L363-367 の 0 件は後者の測定 |

### warning

| # | 箇所 | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「詰まった点／ハッシュが違う＝早合点」L430、「触ってみて分かったこと」L459-465 | 「1回目はDLしたので integrity を書けて、2回目はストアから再利用したので書けなかった」→「真っ先に疑うべきはストアの状態」という一般化が、同記事の表と矛盾する。表の pnpm 12 行は**ウォームストアで**ハッシュ `041735...`（＝ `integrity` あり側）になっている | L430 を「pnpm 11 では、1回目は…2回目は書けなかったようです」と 11 限定にし、L465 の助言のあとに「ただし 12 は同じウォーム条件でも `integrity` を書いていて、この非決定性自体が 11 側の挙動である可能性があります」を1文追加する | `artifacts/lock-v12-order2.yaml`（ウォーム）は `integrity` 13行、`lock-v11-order2.yaml`（ウォーム）は 12行。execution-log L431-441 で 12 の2回目は `reused` 経路 |
| 2 | 「触ってみて分かったこと」L457 | 「代わりに見つかったのが、③で書いた `integrity` の件です」— ③は `pnpm add -g yarn` の節で、`integrity` の話は④と「詰まった点」にある。読者が該当箇所を探して迷子になる | 「代わりに見つかったのが、④と『詰まった点』で触れた `integrity` の件です」に修正 | 記事内の節構成（L282「③ …yarn」／L256「④ …決定性」／L419「ハッシュが違う＝非決定、と早合点した」） |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | ④節 L267「これは早合点でした（詳しくは次章）」 | 実際の解説は3つ先の「詰まった点」節にある。「次章」は誤誘導 | 「（詳しくは後述の『詰まった点』）」にすると読者が迷わない |
| 2 | ①節 L353「これは 11 でも同じで、`pnpm ls -g` にはちゃんと `node@26.7.0` が並びます」 | 直後のコードブロックは `# v12` の出力で、11 側の `pnpm ls -g` は出典ログに無い。11 で実測されているのは「`$PNPM_HOME/bin` に `node` が現れない」ことまで | 「これは 11 でも同じで、`$PNPM_HOME/bin` に `node` が現れないところまで同じでした」に寄せると、実測の範囲と記述が一致する |
| 3 | 本編の並び L154 以降 | 結果表は①〜⑤順なのに本文は⑤→②→④→③→①順。意図（再現できた順／面白い順）が書かれていない | 「以下、1つずつ。」の後に「再現できたものから順に書きます」等を足すと読者が構成を予測できる |
| 4 | 冒頭 L9 の `<!-- 前提: 出典ログ ... -->` コメント | パイプライン用の前提コメントが残っている。公開しても表示されないが、意図的に残すか判断が要る | 残す方針なら問題なし。消すなら公開前に1行削除 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false`。秘密情報の検出なし。パスは `/work` `/root` のコンテナ内パスのみで個人パスなし。slug `pnpm12-rc-five-diffs`（20字）は具体的で、`articles/` 内に重複なし（`pnpm11-minimum-release-age-ci-only-failure.md` とは別） |
| Front Matter | OK | title/emoji/type/topics/published すべて有り。type=tech、topics 5個、誇大表現なし。**スクリプトの「title が長い: 91文字」は false positive**（バイト長。実際は 39 文字） |
| 事実性（ログ照合） | 要修正 | blocker 1・warning 2。それ以外の主要な主張・出力・数値はログと artifacts で裏付けを確認（下記） |
| 画像 | OK | 画像参照 0。出典ログがスクショ 0枚（CLI検証）と宣言済みで、図はログ抜粋のコードブロックで代替されている |
| Markdown構造 | OK | フェンス 60行（偶数）、`:::` 2行で閉じている。H1 なし・`##`/`###` の階層は破綻なし。リンクは pnpm 公式 3本のみでプレースホルダなし |
| 文章品質・トーン | OK | 経験談トーン。「詰まった点」3件が具体的。環境（macOS 26.5 / Docker 28.5.1 / node:24 / Node v24.18.0 / pnpm 11.22.0 / 12.0.0-rc.5）と RC 前提が冒頭と `:::message` に明記。冒頭に結論あり |
| 完成度 | OK | `要素材` マーカー・プレースホルダの残存なし。再現手順とハマりどころ付き |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）:
  記事「5点のうち 11→12 の差分として再現できたのは1点だけ／②④は 12 は公式どおりだが 11 でも同じ／①③は確認できず」
  ↔ ログ「再現 1点（⑤）／差分として未再現 2点（②④）／未再現 2点（①③）」→ **一致**
- ログで裏付けを確認した主な記述（抜粋）:
  - ⑤ `error: unexpected argument '--resolution-only' found` / `exit=2`、11 の `--resolution-only` 成功出力、
    `pnpm peers check` が 11・12 とも `exit=0` ← execution-log フェーズ3
  - 11 ヘルプにある終了コード仕様と、12 ヘルプからの消失 ← execution-log L206-218 / L272-291
  - ② 3表記が同一 commit SHA の codeload URL に落ちる grep 出力（11/12 完全同一）← execution-log L350-361
  - ④ ハッシュ `041735...` / `1aa7d0...`、12 の3回一致、11/12 lockfile diff 0行・179行・sha256 一致 ← execution-log L327-336 / L410-441
  - ③ `+ yarn 1.22.22`（11/12とも）、`Ignored build scripts`、`pnpm shim` 不在、`pnx --help` ← execution-log L456-497
  - ① `pnpm config get globalShims` → `undefined`、`pnpm add -g node` が bin を作らない、
    `node_modules/.bin/node` が v22.11.0 ← execution-log L500-549
  - corepack が動いた件（`corepack --version` 0.35.0 / rc.6 / `Done in 2.5s` / `exit=0`）
    ← `artifacts/04-corepack-trap.log` に全文一致で存在
  - 循環依存 `[WARN]` が 12 で出ない（`grep -c cyclic` 11=各1 / 12=各0）← execution-log L340
  - `ERR_PNPM_IGNORED_BUILDS` 時に 11 は `package.json` を書き、12 は書かない ← execution-log L499
  - 14.6 秒（11 コールド）/ 4.7 秒（12 ウォーム）← execution-log L178-182 / L320-325。記事側も条件差を明記しており誇張なし
  - issue #13018 / #13320、600行差 ← execution-log L61 / L338
- 創作の疑いがある記述: なし（コードブロックはすべて出典ログまたは artifacts に対応が取れた）。
  ただし blocker 1 は「ログに存在する数値を、別の測定対象に付け替えている」誤りであり、
  創作ではないが読者には誤った実測として伝わる。
- 記事がログを超えている箇所: warning 1（`integrity` の一般化）、suggestion 2（11 の `pnpm ls -g`）。
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/pnpm12-rc-five-diffs.md (slug=pnpm12-rc-five-diffs) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=20 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 91文字 (60字目安)
[PASS] emoji あり: 📦
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=60
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

false positive の切り分け:
- `[WARN] title が長い: 91文字` → **指摘に採用しない**。日本語をバイト数で数えているためで、
  実文字数は 39 文字（`len()` で確認済み）。Zenn の 60 字目安に収まっている。

## 適用した修正

なし（レポートのみ・記事本文は変更していない）。

## 次のアクション

- [ ] blocker 1（②節 L252 の `grep -c ssh` / `git@` の 0 件記述）を直す
- [ ] warning 2 件（`integrity` の一般化を 11 限定にする／L457 の「③」参照を「④と詰まった点」に）を直す
- [ ] suggestion 4 件は任意
- [ ] 直したら `/review-article` で再レビューする（`/revise-article` を使う場合は本レポートを渡す）
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて公開
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
