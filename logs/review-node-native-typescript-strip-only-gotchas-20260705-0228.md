# 公開前レビュー: `node app.ts` を試したら、まずバージョンで詰まった話（node-native-typescript-strip-only-gotchas）

## レビューの前提

- 対象記事: articles/node-native-typescript-strip-only-gotchas.md
- 出典ログ: logs/run-node-native-typescript-20260705-0217/execution-log.md（記事冒頭コメントの指定どおり）
- レビュー日時: 2026-07-05 02:28
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published=false / slug 妥当・重複なし / 秘密情報なし）はすべてクリア。
  - 事実整合: 記事中のコマンド・エラー全文・数値・比較表は、いずれも出典ログに一次情報として裏付けあり。ログを超えた断定・創作コード・存在しない画像参照は検出されなかった。
  - 機械チェックは fail=0 / warn=0。
  - 残る指摘はいずれも suggestion（任意改善）のみ。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] Front Matter `title`（2行目） — バッククォート `` `node app.ts` `` は Zenn のタイトルでは装飾されず文字どおり表示される。意図どおりか確認（不要なら外す）。
2. [suggestion] Front Matter `topics`（5行目） — `"tsnode"` は Zenn の一般的トピック名として弱い。`ts-node` はハイフン不可のため崩れる語であり、`"tsx"` 併記で十分。差し替え or 削除を検討。
3. [suggestion] 比較表 decorator 行（301行目） — tsx 列を「設定次第」としているが、ログでは decorator の tsx 挙動は「未計測」。「設定次第（未計測）」等と計測有無を明示するとより誠実。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | Front Matter `title`（2行目） | タイトル内のバッククォートは Zenn で装飾されず素の `` ` `` として表示される | 表示崩れの誤解を避けられる。装飾意図がなければ外すと一覧で読みやすい |
| 2 | Front Matter `topics`（5行目） | `"tsnode"` はトピックとして一般的でない（ts-node はハイフンで崩れる） | より探索されやすい/正確なトピック集合になる |
| 3 | 比較表 decorator 行（301行目） | tsx 列「設定次第」はログ上「未計測」。本文では tsx で試したと書いていないので誤りではないが計測有無が曖昧 | 「未計測」を添えると実測範囲が明確になり誠実さが増す |
| 4 | 冒頭コメント `<!-- 前提: ... -->`（9行目） | draft 由来の前提コメント。Zenn では HTML コメントとして非表示なので害はないが、公開版に残す必然性は薄い | 公開前に消すと成果物がすっきりする（残しても表示上の問題はない） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published=false / slug=41字・文字種OK・汎用でない・`articles/` 内で一意 / 秘密情報・個人パスなし（`/Users/...` は `/.../` に匿名化済み） |
| Front Matter | OK | title/emoji/type(tech)/topics(4)/published すべて揃う。title 50字。topics は suggestion のみ |
| 事実性（ログ照合） | OK | コマンド・エラー全文・数値・比較表がすべて execution-log.md に裏付け。創作・誇大なし |
| 画像 | OK | ブラウザ表示を伴わない CLI 検証タスク。`/images` 参照なしはログ（スクショ0枚）と整合 |
| Markdown構造 | OK | コードフェンス 48行（偶数・閉じ）、`:::` 2行（閉じ）、見出しは H2 のみで階層破綻なし、壊れリンクなし |
| 文章品質・トーン | OK | 経験談トーン、詰まった点を具体的に記述、環境・バージョン明記、結論と対象読者が冒頭にある |
| 完成度 | OK | 要素材/プレースホルダ残存なし。前提コメントのみ suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「確かめたかった4点はどれも実際に手元で確認できました」 ↔ ログ「完了条件の判定: 達成（4条件すべて客観ログで確認）」 → **一致**
- 主要な突合（すべて裏付けあり）:
  - バージョン境界（22.6〜22.17=要フラグ / 22.18=既定 / 24.12・25.2=stable）↔ ログ「再現性メモ」「詰まった点#1」= 一致
  - `node app.ts` の SyntaxError 全文（v22.17.0）↔ `logs/01-run-ok.txt` 引用 = 一致
  - enum / 値namespace / 型namespace / param-prop / import拡張子 / 型import / `.tsx` / decorator の各エラー全文 ↔ フェーズ3各項 = 一致（decorator の「素の SyntaxError」まで整合）
  - 型エラー: node 素通り exit=0 / `tsc --noEmit` → TS2322 exit=2 ↔ `logs/type-check.txt` = 一致
  - `npx tsc` スクワッター `tsc@2.0.4` / `This is not the tsc command...` / `-p typescript` で解決 ↔ 詰まった点#2・knowledge 記録 = 一致
  - 速度表（node 0.08/0.05/0.05→中央値0.05、tsx 1.89/0.61/0.58→中央値0.61、npx込の注記）↔ フェーズ4 = 一致
  - カバー範囲比較表（tsx は enum/値namespace/param-prop を実行= `0`/`1`/`Point {x:1,y:2}`）↔ ログ表 = 一致
- 創作の疑いがある記述: なし
- ログに無い断定・数値: なし（「◯倍速い」と断定しない等、ログの「盛らない」注意も反映されている）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/node-native-typescript-strip-only-gotchas.md (slug=node-native-typescript-strip-only-gotchas) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=41 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 50文字
[PASS] emoji あり: 🦖
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=48
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

## 適用した修正（修正適用時のみ）

なし（修正適用は指定されていないため非破壊レビュー）。

## 次のアクション

- [ ] （任意）上記 suggestion 4件を検討・反映する（公開はブロックしない）
- [ ] 直したら `/review-article` で再レビューする（任意）
- [x] 判定は「公開可」。Front Matter を `published: true` に変えて公開してよい状態
      （公開手順は `/publish-pr`。「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
