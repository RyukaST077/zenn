# 公開前レビュー: using / Symbol.dispose を try/finally と書き比べてみた (using-symbol-dispose-try-finally-compare)

## レビューの前提

- 対象記事: articles/using-symbol-dispose-try-finally-compare.md
- 出典ログ: logs/run-using-symbol-dispose-20260717-0409/execution-log.md
- レビュー日時: 2026-07-17 04:22
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（`published: false` / slug 妥当・一意 / 秘密情報なし）をすべて満たす。
  - 事実性: 記事の全出力・全コマンド・結論（4条件すべて達成）が出典ログと一致。創作なし。
  - 機械チェックの WARN 3件は目視の結果いずれも false positive または軽微（下記で重大度を suggestion に調整）。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] Front Matter `title`（2行目） — 63字と目安60字を3字超過。ブロッカーではないが、例: 「`using`/`Symbol.dispose` を try/finally と書き比べた」等に詰めると一覧で切れにくい。
2. [suggestion] Front Matter `topics`（5行目） — `typescript` を含むが本文では TS を実際には触っていない（L447「次は TypeScript のダウンコンパイル…今回はまだ触れていない」）。`v8` や `esmodules` など実際に触れた語への差し替えを検討。
3. [suggestion] 参考リンク節（L449〜） — 出典ログに記載のある nodejs.org v26 リリースノートへのリンクが本文に無い。「バージョン対応が本質」という記事の主軸を裏付けるので追加すると説得力が増す。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

（機械チェックが出した WARN 3件はすべて目視で切り分け、下記のとおり suggestion 以下へ調整した。）

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 2行目 title | 63字で目安60字を3字超過（誇大表現ではない） | Zennの一覧・OGPで末尾が切れにくくなる |
| 2 | 5行目 topics | `typescript` は本文で未実践（TS は「次にやること」） | 実際に検証した内容と topics が一致し、読者の期待とズレない |
| 3 | L449 参考リンク | nodejs.org v26 リリースノート等バージョン根拠リンクが無い | 「版差が本質」という主軸の裏付けになる |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published=false / slug 40字・文字種OK・汎用でない・ローカル重複なし / 秘密情報なし |
| Front Matter | OK | title/emoji/type/topics/published 揃う。type=tech、topics 4個。title 63字は suggestion |
| 事実性（ログ照合） | OK | 全出力・コマンド・結論がログと一致。創作・過大主張なし |
| 画像 | OK | CLI 検証記事のため画像なし（ログのスクショ0枚と整合）。[INFO] 扱いで問題なし |
| Markdown構造 | OK | コードフェンス38行（偶数）・`:::`4行（偶数）で閉じ済み。見出し階層も健全 |
| 文章品質・トーン | OK | 経験談トーン。詰まった点2件・環境/バージョン明記あり |
| 完成度 | OK | 要素材マーカー・プレースホルダ残存なし。前提コメントの消し忘れもなし |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「確かめたかった4つ…いずれも実際の出力で確認できました」(L445) ↔ ログ「完了条件の判定: **達成**（4条件すべてCLI出力で客観確認）」 → **一致**
- 出力ログの照合（記事コードブロック ↔ ログ全文）:
  - SyntaxError 全文（L64-80） ↔ ログ L58-73 → 一致（ローカルパス/ホスト名は匿名化済み。下記参照）
  - resource.mjs 出力（L121-125） ↔ ログ L103-108 → 一致
  - a-finally.mjs / a-using.mjs 出力（L161-166 / L196-201） ↔ ログ L117-120 / L128-132 → 一致
  - b-lifo.mjs 出力（L243-259） ↔ ログ L139-155 → 一致
  - c-throw.mjs 出力（L292-297） ↔ ログ L162-167 → 一致
  - d-return.mjs 出力（L331-342） ↔ ログ L174-185 → 一致
  - e-async.mjs 出力（L408-421） ↔ ログ L194-207 → 一致
  - 比較表（L432-439） ↔ ログ L213-220 → 一致（趣旨同一）
- 匿名化の確認（公開安全上むしろ望ましい対応）:
  - 記事 L65 `file:///Users/you/workspace/...` ← ログ L59 の実ユーザ名 `/Users/katayamaryuunosuke/` を `you` に置換済み。**個人パスの漏れなし**。
  - 記事 L54 `Darwin macbook.local` ← ログ L47 の実ホスト名 `katayamaryuunosukes-MacBook-Pro.local` を匿名化済み。**内部ホスト名の漏れなし**。
- 創作の疑いがある記述: なし（本文の断定はすべて出力ログに裏付けあり。感想は「〜そう」「〜と感じた」と適切にヘッジ）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/using-symbol-dispose-try-finally-compare.md (slug=using-symbol-dispose-try-finally-compare) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=40 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 63文字 (60字目安)
[PASS] emoji あり: 🧹
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=38
[PASS] ::: ブロックが閉じている: 4 行
[WARN] プレースホルダ/空リンクの疑い (example.com / 空リンク)
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 65
SUMMARY fail=0 warn=3
```

### 機械チェック WARN の目視切り分け

- **[WARN] title が長い（63字）** → **suggestion**。誇大語（完全理解/徹底解説等）は無く、内容を正確に表す説明的タイトル。3字超過のみで公開ブロックには当たらない。
- **[WARN] プレースホルダ/空リンクの疑い** → **false positive**。`example.com`・空リンク・TODO は本文に存在しない。JS のコンピューテッドメソッド構文 `[Symbol.dispose]()` の `](...)` を空リンクパターンとして誤検出したもの。
- **[WARN] 秘密情報の疑い [user-path] at line 65** → **false positive（安全）**。当該行は `file:///Users/you/workspace/024_zenn/[eval1]:1` で、実ユーザ名は `you` に匿名化済み。個人を特定するパスではない。

## 次のアクション

- [ ] 上記 suggestion（title 詰め / topics 見直し / 参考リンク追加）は任意。対応するなら `/revise-article` で。
- [ ] blocker / warning は 0 件のため、そのまま公開可能。
- [ ] Front Matter を `published: true` に変えて `git push`（本リポジトリはマージ＝公開。実運用は `/publish-pr` で PR 経由）。
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
