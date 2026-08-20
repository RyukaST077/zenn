# 公開前レビュー: pnpm 12 RC に上げて、公式が挙げた「5つの差分」を1つずつ踏んでみた / pnpm12-rc-five-diffs

## レビューの前提

- 対象記事: `articles/pnpm12-rc-five-diffs.md`（引数で明示指定）
- 出典ログ: `logs/run-pnpm12-rc-five-diffs-20260816-0411/execution-log.md`（引数で明示指定）
  - 併せて `artifacts/04-corepack-trap.log` / `results.md` / `lock-ssh-v11.yaml` / `lock-ssh-v12.yaml` /
    `lock-v11-order2.yaml` / `lock-v12-order2.yaml` / `commands.log` を一次照合に使用
- レビュー日時: 2026-08-16 04:38
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 位置づけ: **3回目のレビュー**
  - `logs/review-...-0428.md`（公開不可 / blocker 1・warning 2）
    → `logs/revise-...-0433.md` で修正 → `logs/review-...-0434.md`（公開可 / suggestion 3）
  - 記事の更新時刻は `Aug 16 04:33`、前回レビュー（04:34）以降**本文は変更されていない**。
    本レビューは前回結論の追認ではなく、照合を artifacts 側からやり直した独立チェックとして実施した。

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な確認）:
  - 公開安全: `published: false` を維持。秘密情報・個人パス・内部ホスト名の検出なし
    （`/Users/`・氏名・社内ドメイン・プライベートIP を grep して 0 件）。登場するパスは
    すべてコンテナ内の `/root/...` `/work/...` `/usr/local/bin/...` で公開して差し支えない。
  - slug `pnpm12-rc-five-diffs`（20文字）は文字種OK・汎用語でなく、`articles/` 内に重複なし
    （`pnpm11-minimum-release-age-ci-only-failure.md` とは別物）。
  - 事実性: 本文の主張・コマンド出力・数値をログおよび artifacts と突合し、
    創作・ログ超えの断定は検出されなかった（詳細は「事実整合の照合結果」）。
  - 機械チェックは `SUMMARY fail=0 warn=1`。唯一の WARN（title 91文字）は
    **バイト長を数えた false positive**（実文字数 39 字）であり指摘に採用しない。

## 最優先で直すべき指摘（上位3件）

blocker / warning は 0 件のため、以下はすべて任意（suggestion）。前回レビューの
suggestion 3 件がそのまま未適用で残っているもの。

1. [suggestion] ⑤節 L203「12 のヘルプからはこの終了コードの記載が消えていました」 —
   根拠は `pnpm peers --help`（v12）の出力なので、「`--help` の出力を見た限りでは」を添えると、
   ①③で使っている「観測できなかっただけかもしれない」という慎重なトーンと揃う。
2. [suggestion] 参考リンク L511 の `https://pnpm.io/settings` — 本文のどこからも参照されておらず浮いている。
   `globalShims` を探して見つからなかった話（L365）から参照するか、リンクを外す。
3. [suggestion] 冒頭 L9 の `<!-- 前提: 出典ログ ... -->` — パイプラインの出典追跡用として
   残す方針なら現状維持で可（Zenn 上では非表示のため公開影響なし）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | ⑤節 L203 | 「12 のヘルプからはこの終了コードの記載が消えていました」の根拠が `pnpm peers --help`（v12）の出力である旨が明示されていない | 「`--help` の出力を見た限りでは」を足すと、①③の慎重な言い回しと一貫する |
| 2 | 参考リンク L511 | `https://pnpm.io/settings` が本文のどこからも参照されていない | L365（`globalShims` を探した話）に紐づけるか外すと、リンクの意図が読者に伝わる |
| 3 | 冒頭 L9 | 前提コメント `<!-- 前提: ... -->` が残っている | 意図的に残すなら現状維持で可。消しても本文に影響なし |

（参考）今回新たに検討したが**指摘に採用しなかった**もの:

| 箇所 | 検討内容 | 不採用の理由 |
|---|---|---|
| ③節 L300 | 「ローカルの `pnpm add yarn` でも `"dependencies":{"yarn":"^1.22.22"}` が書かれるだけ」— ログ L474 ではこの実行は `--allow-build=yarn` を付けた版 | 主張の対象は「`package.json` に何が書かれるか」であり、`--allow-build` の有無で結論は変わらない。さらに L481 で `--allow-build` を付けない失敗時の挙動（12 は `package.json` を書き換えない）を別途書き分けており、記述として矛盾がない |
| L15「速度の話は測っていません」と L503「11 コールド 14.6 秒 / 12 ウォーム 4.7 秒」 | 一見矛盾 | L503 自身が「条件を揃えて測る価値はありそう」と、条件不揃いの参考値であることを明示している。ログ L182/L320 の実測とも一致 |
| L453「issue #13320 では 600 行規模の差分が報告されている」 | 記事内で未検証の二次情報 | ログ L338 に同内容が一次記録として残り、記事側も「vercel/next.js 規模の話」と伝聞であることを示している |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug 妥当・重複なし / 秘密情報・個人パスなし |
| Front Matter | OK | title・emoji 📦・type=tech・topics 5個（pnpm/nodejs/npm/monorepo/rust）・published 揃う。title 91文字 WARN はバイト長の false positive（実 39 字） |
| 事実性（ログ照合） | OK | 下記「事実整合の照合結果」参照。創作・ログ超えの断定なし |
| 画像 | OK（対象外） | 画像参照 0 件。出典ログが「スクショ 0枚（CLI検証のため宣言済み）」と明記しており、欠落ではない |
| Markdown構造 | OK | フェンス 60行（偶数）・`:::` 2行で閉じ・H1 なし・H2/H3 の階層破綻なし。リンクはすべて実URLでプレースホルダなし |
| 文章品質・トーン | OK | 「詰まった点」3件が具体的。再現性（macOS 26.5 / Docker 28.5.1 / node:24 / Node v24.18.0 / pnpm 11.22.0・12.0.0-rc.5）を冒頭と再現手順の両方に記載。結論（5点中1点のみ再現）を L17 で先出し |
| 完成度 | OK | `要素材` マーカー 0 件・プレースホルダ 0 件。前提コメント L9 のみ suggestion |

## 事実整合の照合結果（ログとの突合）

- **結論の一致**: 記事 L17 / L497「5点のうち 11→12 の差分として再現できたのは1点（⑤）だけ。
  ②④は『12 は公式どおりだが 11 でも同じ』、①③は『12 で公式どおりの挙動を確認できず』」
  ↔ ログ L26「再現 1点（⑤）／『12は公式どおりだが11でも同じ』2点（②④）／未再現 2点（①③）」
  → **一致**。判定表（記事 L146-152）もログの3値判定と一致。
- **創作の疑いがある記述**: 検出なし。今回 artifacts 側から再照合した主なもの:
  - 記事 L128-137 の corepack 出力 → `artifacts/04-corepack-trap.log` と**逐語一致**
    （`0.35.0` / `Installing pnpm@12.0.0-rc.6 in the project...` / `Downloading the pnpm 12.0.0-rc.6
    binary for linux-arm64...` / `Already up to date` / `Done in 2.5s using pnpm v12.0.0-rc.6` / `exit=0`）。
    execution-log には要約しか無い部分だが、artifacts に全文が存在する。
  - 記事 L140 「`self-update` は rc.5、`corepack` は rc.6」→ `artifacts/results.md` L54 と一致。
  - 記事 L252 の SSH 記述（`grep -c ssh` / `git@` の 0 件は3表記 fixture 側）→
    `lock-ssh-v11.yaml` / `lock-ssh-v12.yaml` とも `grep -c ssh` = **2**、
    `lock-v11.yaml` / `lock-v12.yaml` は **0**。記事の限定表現は実測と**一致**（前回 blocker の解消を再確認）。
  - 記事 L465 「12 は同じウォームストア条件でも `integrity` を書いている」→
    `lock-v12-order2.yaml`（ウォーム）の `integrity` = 13行 / `lock-v11-order2.yaml`（ウォーム）= 12行。**一致**。
  - 記事 L262-277 の sha256（`041735...` / `1aa7d0...`）→ ログ L413/415/434/436/440 と一致。
  - 記事 L503 の 14.6 秒 / 4.7 秒 → ログ L180（`real 0m14.636s`）/ L320（`Done in 4.7s`）と一致。
  - 記事 L33-54 の公式引用5点 → ログ L49-56 の引用ブロックと一致（改変なし）。
  - 記事 L182-191（`--resolution-only` の exit=2 とヘルプ grep）→ ログ L257-271 と一致。
  - 記事 L304-321（`pnpm shim --help` / `pnx --help`）→ ログ L483-496 と一致。
  - 記事 L328-360（①の全出力・`pnpm ls -g`）→ ログ L503-533 と一致。11 側の記述も
    「`$PNPM_HOME/bin` に node が現れないところまで同じ」までに限定されており、ログ L542 の範囲を超えていない。
- **残存する `要素材` マーカー**: 0 件。
- **出典ログの特定**: 済（記事 L9 の前提コメントと引数が一致）。

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

WARN の切り分け: `check-article.sh` L94 は `wc -m` で数えており、ロケール次第で
日本語がバイト数として数えられる。実際のタイトルは
`pnpm 12 RC に上げて、公式が挙げた「5つの差分」を1つずつ踏んでみた` = **39文字**（91バイト）で
60字目安の範囲内。誇大表現（完全理解/徹底解説/保存版 等）も含まないため、**指摘に採用しない**。

## 適用した修正

なし（レポートのみ・非破壊レビュー）。`published: false` は維持されている。

## 次のアクション

- [x] blocker / warning は 0 件 — 直すべき必須項目なし
- [ ] （任意）suggestion 3 件を反映するなら `/revise-article` → `/review-article` で再確認
- [ ] 判定が「公開可」のため、Front Matter を `published: true` に変えて公開してよい状態
      （このリポジトリの運用では `/publish-pr` で PR を作り、main へマージ＝公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
