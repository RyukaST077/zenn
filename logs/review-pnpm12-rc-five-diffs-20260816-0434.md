# 公開前レビュー: pnpm 12 RC に上げて、公式が挙げた「5つの差分」を1つずつ踏んでみた / pnpm12-rc-five-diffs

## レビューの前提

- 対象記事: `articles/pnpm12-rc-five-diffs.md`（引数で明示指定）
- 出典ログ: `logs/run-pnpm12-rc-five-diffs-20260816-0411/execution-log.md`（引数で明示指定）
  - 併せて `commands.log` と `artifacts/lock-ssh-v11.yaml` / `lock-ssh-v12.yaml` / `lock-v11.yaml` / `lock-v12.yaml` を照合に使用
- レビュー日時: 2026-08-16 04:34
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 前回レビュー: `logs/review-pnpm12-rc-five-diffs-20260816-0428.md`（判定: 公開不可 / blocker 1・warning 2）
  → `logs/revise-pnpm12-rc-five-diffs-20260816-0433.md` で修正済み。本レビューは**再レビュー**

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な確認）:
  - 前回 blocker（②節の `grep -c ssh` / `grep -c git@` が 0 件という記述）は解消を実測で確認した。
    現在の L252 は「`grep -c ssh` / `grep -c git@` が 0 件だったのは、`git+ssh://` を含まない3表記
    fixture の lockfile の方です」と限定されており、`artifacts/lock-ssh-v11.yaml` / `lock-ssh-v12.yaml`
    が `specifier: git+ssh://git@github.com/...` を保持し `resolution:` は codeload HTTPS である事実、
    および `lock-v11.yaml` / `lock-v12.yaml` の `grep -c ssh` = 0 という事実の両方と一致する
  - 前回 warning 2 件（`integrity` の一般化 / 参照先誤り）も解消を確認
  - 機械チェックは `SUMMARY fail=0 warn=1`。唯一の WARN（title 91文字）は**バイト長を数えた false positive**
    （実文字数 39 字）であり指摘に採用しない
  - 本文の主張・数値・コマンド出力を出典ログと突合し、新規の創作・ログ超えの断定は検出されなかった

## 最優先で直すべき指摘（上位3件）

blocker / warning は 0 件のため、以下はすべて任意（suggestion）。

1. [suggestion] ⑤節 L203「12 のヘルプからはこの終了コードの記載が消えていました」 — 根拠は
   `pnpm peers --help`（v12）の出力なので、「`--help` の出力を見た限りでは」と観測範囲を添えると
   ①③の判定で使っている慎重な言い回しと揃う。
2. [suggestion] 参考リンク L511 の `https://pnpm.io/settings` — 出典ログにも本文にも参照がなく浮いている。
   `globalShims` を探した話（L365）から参照するか、リンクを外す。
3. [suggestion] 冒頭 L9 の `<!-- 前提: 出典ログ ... -->` コメント — 残す方針なら現状で問題なし。
   Zenn 上では非表示なので公開影響もない（前回レビューでも同判断）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | ⑤節 L203 | 「12 のヘルプからはこの終了コードの記載が消えていました」の根拠が `pnpm peers --help`（v12）の出力である旨が明示されていない | 「`--help` の出力を見た限りでは」を足すと、①③で使っている「観測できなかっただけかもしれない」という慎重なトーンと一貫する |
| 2 | 参考リンク L511 | `https://pnpm.io/settings` が本文のどこからも参照されていない | `globalShims` を探して見つからなかった話（L365）に紐づけるか外すと、リンクの意図が読者に伝わる |
| 3 | 冒頭 L9 | 前提コメント `<!-- 前提: ... -->` が残っている | パイプラインの出典追跡用として意図的に残すなら現状維持で可。消す場合も本文に影響なし |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` 維持。秘密情報の検出なし。個人パス（`/Users/...`）・社内ホスト名なし（本文のパスは `/root/...` `/work/...` のコンテナ内パスのみ）。slug `pnpm12-rc-five-diffs`（20字）は文字種OK・汎用語でなく、`articles/` 内に重複なし |
| Front Matter | OK | title/emoji/type/topics/published すべて揃う。type=tech、topics 5個（pnpm, nodejs, npm, monorepo, rust）すべて英小文字。title 39字・誇大表現なし |
| 事実性（ログ照合） | OK | 下記「事実整合の照合結果」参照。創作の検出なし |
| 画像 | OK（対象外） | `/images` 参照 0・孤立画像なし。出典ログが「スクショ 0枚（CLI検証のためブラウザ表示を伴わない）」と宣言しており、スクショ欠如は未完成のサインではない |
| Markdown構造 | OK | コードフェンス 60行（偶数・閉じている）、`:::` 2行（閉じている）。H1 なし・`##`→`###` の階層破綻なし。リンクは pnpm 公式3本のみでプレースホルダ・空リンクなし |
| 文章品質・トーン | OK | 「詰まった点」節に3件（self-update の PATH / `$PNPM_HOME/bin` / ハッシュ差の早合点）。再現性（macOS 26.5 / Docker 28.5.1 / node:24 / Node v24.18.0 / pnpm 11.22.0・12.0.0-rc.5）を冒頭と「再現手順」の両方に明記。冒頭 L17 で結論（5点中1点のみ再現）を先出し。RC であることを `:::message` で注記 |
| 完成度 | OK | `要素材` マーカー 0・プレースホルダ 0。前提コメントのみ意図的に残存（suggestion 3） |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）:
  記事 L17「5点のうち 11→12 の差分として再現できたのは1点だけ／『12は公式どおりだが11でも同じ』2点／
  『12で公式どおりの挙動を確認できなかった』2点」
  ↔ ログ L26「**再現 1点（⑤）／「12は公式どおりだが11でも同じ」2点（②④）／未再現 2点（①③）**」
  → **一致**。判定表（記事 L146-153）の3値の割り当ても①未再現・②差分として未再現・③未再現・④差分として未再現・⑤再現でログと一致
- 主要な出力ブロックの突合（すべてログ／`commands.log` に原文あり）:

| 記事の箇所 | 内容 | 出典 |
|---|---|---|
| L71-76 | コンテナのバージョン群（v24.18.0 / 11.16.0 / git 2.39.5 / uname） | execution-log L88-93 |
| L116-121 | `npm i -g pnpm@11` → 11.22.0 / `which pnpm` | execution-log L133-146 |
| L129-137 | corepack 0.35.0 / `corepack use pnpm@next-12` → rc.6 / `Done in 2.5s` | `commands.log` L412-421（**全文一致**） |
| L161-174 | 11 の `--resolution-only` 成功・`peers check`・`--help \| grep` | execution-log L192-205 |
| L179-191 | 12 の `error: unexpected argument '--resolution-only' found` / `exit=2` / `--help` の 102行目 | execution-log L257-271 |
| L198-201 | 11 の `peers check` ヘルプ（非ゼロ終了の記載） | execution-log L211-213 |
| L210-220 | 3表記の lockfile grep（同一 commit SHA の codeload URL） | execution-log L350-360 |
| L234-249 | `git+ssh://` 追試（鍵なしで 11/12 とも成功、lock は HTTPS） | execution-log L373-394 ＋ `artifacts/lock-ssh-v11.yaml` / `lock-ssh-v12.yaml` |
| L261-264 / L272-277 | 11 の 2ハッシュ（`041735...` / `1aa7d0...`）と 12 の3回とも `041735...` | execution-log L412-415 / L433-440 |
| L285-297 | `pnpm add -g yarn` の 11/12 出力（両方 1.22.22、12 は `Ignored build scripts`） | execution-log L458-472 |
| L305-311 / L317-320 | `pnpm shim --help` の `Command "shim" not found` / `pnx --help` | execution-log L483-496 |
| L328-350 / L356-360 | ①の4ブロックと `pnpm ls -g` | execution-log L503-533 |
| L374-386 / L393-399 | `self-update` 後にバージョンが上がらない件と `~/.local/share/pnpm/bin` の ls | execution-log L225-249 |
| L411-414 | `The configured global bin directory ... is not in PATH` | execution-log L450-453 |
| L424-427 / L433-436 | `integrity:` 1行だけの diff とウォーム再測定 | execution-log L417-428 |
| L444-450 | 179行 / `041735...` / `diff \| wc -l` = 0 | execution-log L327-335 |
| L476 | `[WARN] There are cyclic workspace dependencies:` と 12 では出ない（`grep -c cyclic`） | execution-log L159 / L340 |
| L481 | `ERR_PNPM_IGNORED_BUILDS` 時の `package.json` の扱いが 11/12 で違う | execution-log L499 |
| L503 | 「11 のコールドストアで 14.6 秒、12 のウォームストアで 4.7 秒」 | execution-log L178-182（`real 0m14.636s`）/ L320（`Done in 4.7s`、`reused 2` のウォーム）。**ストアの状態を明記したうえで比較しており、L15 の「速度は測っていない」とも矛盾しない** |
| L453 | issue #13320 の約600行差 | execution-log L338（下調べ由来の伝聞として記事側も「報告されている」と書いており断定していない） |
| L515-534 | 再現手順とハマりどころ5点 | execution-log L629-647（**ほぼ逐語**） |

- 創作の疑いがある記述: **なし**。数値（179行 / sha256 3種 / 14.6s / 4.7s / 2.5s / 362ms / 788ms / 222ms /
  311ms / 690ms / exit code 2）はすべてログに実測値として存在する
- ログを超えた断定の有無: **なし**。①は「切り分けられていない」、②④は「11.22.0 との比較である」、
  ③は「rc.5 では」と、いずれも観測範囲を限定して書かれている。まとめ L499-501 も
  「公式が間違っている」ではなく「比較対象の取り方の問題」というログ L558 の自己判断と一致
- 前回 blocker の解消確認（再実測）:
  - `artifacts/lock-ssh-v11.yaml` L12 / `lock-ssh-v12.yaml` L12 = `specifier: git+ssh://git@github.com/kevva/is-positive.git`（`ssh` / `git@` は残る）
  - 同 L18 `resolution:` = `tarball: https://codeload.github.com/...`（両版とも HTTPS）
  - `lock-v11.yaml` / `lock-v12.yaml` の `grep -c ssh` = 0 / 0
  → 記事 L252 の現在の記述と**完全に整合**
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

### false positive の切り分け

- `[WARN] title が長い: 91文字` … スクリプトは `wc -m` で数えているが、当環境のロケールでは
  マルチバイト文字がバイト単位で数えられている。実際の文字数は
  `pnpm 12 RC に上げて、公式が挙げた「5つの差分」を1つずつ踏んでみた` = **39 文字**（91 は UTF-8 バイト数）。
  60字目安を下回るため**指摘に採用しない**（前回レビュー・修正レポートでも同じ切り分け）。

## 適用した修正

なし（レポートのみ・記事本文は一切変更していない。`published: false` のまま）。

## 次のアクション

- [x] blocker / warning は 0 件（前回の blocker 1・warning 2 はすべて解消済み）
- [ ] suggestion 3件は任意。直す場合は `/revise-article` を通し、直さない場合はそのまま公開可
- [ ] `/publish-pr` で公開準備する（Front Matter を `published: true` に変え、feature ブランチで PR 作成 →
      main へマージで Zenn 公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
