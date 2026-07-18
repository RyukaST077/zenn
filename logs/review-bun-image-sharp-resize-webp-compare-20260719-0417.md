# 公開前レビュー: Bun.Image で sharp なしに画像をリサイズ/WebP変換して、sharpと書き比べてみた / bun-image-sharp-resize-webp-compare

## レビューの前提

- 対象記事: articles/bun-image-sharp-resize-webp-compare.md
- 出典ログ: logs/run-bun-image-20260719-0407/execution-log.md（＋一次ログ commands.log / workspace/*.ts を併せて照合）
- レビュー日時: 2026-07-19 04:17
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug / 秘密情報）はすべてクリア。
  - 本文の数値・コマンド・コード・出力は出典ログ（execution-log.md）および一次ログ（commands.log / workspace/*.ts）と一致。創作・ログ超えの断定は検出されず。
  - 機械チェックの唯一の WARN（title 99）はバイト数計測由来で、実文字数は約51字（60字目安内）。実質 false positive のため suggestion に降格。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] Front Matter `title` — 機械チェックが「99文字」と警告するが、これはバイト計測の誤差で実文字数は約51字。修正不要。気になるなら「sharpと」の重複を削り軽く短縮してもよい（任意）。
2. [suggestion] 事実性の追跡性 — 本文の「複数 run の median」「同 run 内 64〜160ms」「speedup 1.15〜1.29倍」は execution-log には記載があるが、一次ログ commands.log には単一 run 分しか残っていない。公開可否には影響しないが、再現性を高めるなら複数 run の生ログを残すとより堅い。
3. [suggestion] コード抜粋の省略明示 — sharp 版スニペット（171行〜）は `INPUT` 宣言を省き `// median() は bun-image.ts と同じ` としている。抜粋だと読者に伝わるが、「※抜粋。全文は再現手順参照」の一言があると親切。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | Front Matter `title`（2行目） | check-article.sh が「99文字」と WARN。実体はバイト数計測の誤差で実文字数は約51字（60字目安内）。 | 修正不要。任意で軽く短縮すれば一覧での見栄えが上がる程度。 |
| 2 | 本文 233・235-236・238・254行（複数 run の median / 64〜160ms / 1.15〜1.29倍） | execution-log には裏付けがあるが commands.log（生ログ）は単一 run のみ。数値自体は出典ログ準拠で問題なし。 | 複数 run の生ログを残すと第三者の再現・追跡がさらに容易になる。 |
| 3 | sharp 版スニペット（171-184行） | `INPUT` 宣言省略・`median()` はコメント参照の抜粋形式。 | 「※抜粋」の明示で、コピペ実行を試す読者の取り違えを防げる。 |
| 4 | 前提コメント（9行目 `<!-- 前提: ... -->`） | ドラフトの内部メモ。公開時に残すか判断する。 | 意図的に残すなら可。不要なら公開前に削るとノイズが減る（消し忘れではない前提）。 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 妥当(35字, 一意, 汎用語でない) / 秘密情報・個人パス・内部ホスト名なし（本文 grep でヒットなし） |
| Front Matter | OK | title/emoji/type(tech)/topics(5・英小文字)/published 揃う。title の WARN はバイト計測誤差 |
| 事実性（ログ照合） | OK | 主要数値・コマンド・コード・出力がすべて出典ログ／一次ログと一致（下記照合結果） |
| 画像 | OK | CLI 完結タスクで画像なし（INFO）。スクショ 0 枚はログの方針どおり |
| Markdown構造 | OK | コードフェンス26行(偶数)閉じ / `:::` 6行閉じ / 見出し階層 H2-H3 で破綻なし / 空リンク・TODO なし |
| 文章品質・トーン | OK | 新人目線の経験談。詰まった点／予想が外れた点あり。環境・バージョン明記。断定を適切に回避 |
| 完成度 | OK | プレースホルダ・要素材マーカー残存なし。まとめ・再現手順・参考リンクまで完備 |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「WebP は Bun.Image だけで問題なく動いた／速度はやや速い／出力サイズ同等／AVIF は予想に反し成功」 ↔ ログ結果サマリー「完了条件3件すべて達成・AVIF は M2 Pro で成功」 → **一致**
- 数値照合（すべて一致）:
  - input.png 215,387 bytes・big.jpg 591,279 bytes、metadata 1920x1080/4000x3000 ↔ commands.log 13-24行 ✓
  - sharp 導入「6 packages [517.00ms]」「@img 17M」「node_modules +19M」 ↔ execution-log 79-93行 / commands.log 26-28行 ✓
  - Bun.Image webp `[117.81,132.3,116.8,87.95,93.13] median 116.8 bytes 12528` ↔ commands.log 32-34行 ✓
  - sharp webp `[79.66,85.44,146.03,143.35,133.45] median 133.45 bytes 12518` ↔ commands.log 39-41行 ✓
  - AVIF: Bun 7,061 / sharp 11,052 bytes ↔ commands.log 35・42行 ✓
  - big: Bun `median 366.8 bytes 40974` / sharp `median 454.85 bytes 41386` / speedup 1.24x ↔ commands.log 46-50行 ✓
  - 出力 metadata 800x450 (webp/avif) ↔ commands.log 64-84行 ✓
- コード照合: 本文 bun-image.ts / sharp-image.ts のスニペットは workspace/*.ts と一致（import 数 0 も `grep -c` で確認）。創作コードなし → **一致**
- ログを超えた断定: なし。AVIF 成功・sharp 楽々導入は「macOS 26.5 / M2 Pro」の環境限定として明記、Linux 非対応も注記済みで、ログの但し書きと整合。
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件
- 補足（追跡性のみ）: 本文の複数 run median・「64〜160ms」・「speedup 1.15〜1.29倍」は execution-log（本パイプラインの正）に記載があるが、生ログ commands.log は単一 run 分のみ。出典ログ準拠のため事実性 OK、追跡性の観点で suggestion #2 とした。

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/bun-image-sharp-resize-webp-compare.md (slug=bun-image-sharp-resize-webp-compare) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=35 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 99文字 (60字目安)
[PASS] emoji あり: 🖼️
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=26
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

補足: `[WARN] title が長い: 99文字` は計測がバイト数寄り（`wc -m` がロケール依存でバイト数を返す）で、実際の文字数は約51字。60字目安の範囲内のため重大度を suggestion に調整した。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊レビュー）。

## 次のアクション

- [ ] suggestion は任意対応（公開判定には影響しない）
- [ ] 判定は「公開可」。Front Matter を `published: true` に変えて `git push`（または `/publish-pr` で PR 作成）で公開できる状態
- [ ] 「サイト内で既に使用されています」が出たら slug を具体化（knowledge/2026-07-01-zenn-slug-already-used.md 参照。ローカル重複は現状なし）
