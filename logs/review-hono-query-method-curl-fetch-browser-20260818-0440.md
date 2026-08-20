# 公開前レビュー: Hono 4.13 の app.query() で QUERY メソッドを試したら、詰まったのは別の場所だった / hono-query-method-curl-fetch-browser

## レビューの前提

- 対象記事: `articles/hono-query-method-curl-fetch-browser.md`
- 出典ログ: `logs/run-hono-query-method-20260818-0412/execution-log.md`（引数で明示。workspace 実ファイル
  `workspace/server.mjs` / `client-node.mjs` / `shot.mjs` / `page.html` / `versions.txt` も照合に使用）
- レビュー日時: 2026-08-18 04:40
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 備考: 本記事は2回目のレビュー。前回 `logs/review-hono-query-method-curl-fetch-browser-20260818-0433.md`
  （判定: 要修正 / warning 1・suggestion 5）→ `logs/revise-hono-query-method-curl-fetch-browser-20260818-0437.md`
  で修正済み。前回指摘の再発有無も確認した。

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 5 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全: `published: false`、slug 妥当（36字・具体的・ローカル重複なし）、秘密情報・個人パスの混入なし
    （個人パスはすべて `/.../` に伏せられている）。blocker なし
  - 事実性: 数値・エラー全文・実行コマンド・結果表・コードはすべて出典ログおよび workspace 実ファイルと一致。
    創作は検出されず
  - 前回 warning 1（「一番自信があった」がログの「自信6割」と矛盾）は L15「6割くらいの自信で立てていたのが」に
    修正済みで解消。suggestion 1・3・4・5 も解消、2 は部分対応（下記 suggestion 3 として残す）
  - 機械チェックの唯一の WARN（title 105文字）は**誤検知**。実文字数は 55 文字で目安 60 以内（下記参照）

## 最優先で直すべき指摘（上位3件）

blocker / warning は 0 件。以下は任意（公開を止める必要はない）。

1. [suggestion] 「3経路 × 3メソッドの結果表」L694 — 「冒頭に貼った予想」→「『事前に調べたこと』で貼った予想」。
   予想リストの実際の位置（L92-98）と参照先を一致させる。
2. [suggestion] 「環境構築」L121-130 — 「`process.versions` を丸ごと残しました」と書いた直後の JSON が
   4キー抜粋になっている。`{`の直前に「（記事には抜粋。手元には全キー残した）」の一言を足す。
3. [suggestion] 引用ブロックの「抜粋」表記を統一する。L403 だけ「（接続確立までの行は省略した抜粋）」と
   断っているが、L611-616（404 応答の `Content-Length: 13` 欠落）・L546-554・L654-670 も末尾行を
   落としている。各ブロック直前に「抜粋」と1語添えるか、欠落行を戻す。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 結果表 L694 | 「冒頭に貼った予想の答え合わせ」とあるが、予想7項目は「事前に調べたこと」L92-98 にある（冒頭＝「はじめに」ではない） | 参照先が正確になり、読者が予想リストへ戻りやすい |
| 2 | 環境構築 L121-130 | 「`process.versions` を丸ごと残しました」「丸ごと貼るのが安全」と書いた直後の JSON が node / llhttp / undici / v8 の4キー抜粋。4つの値はいずれも `workspace/versions.txt` と一致しており事実誤りではないが、直前の文と見た目が食い違う | 「（記事には抜粋）」の一言で、主張（丸ごと残す）と掲載（抜粋）の食い違いが消える |
| 3 | L546-554 / L611-616 / L654-670 | 出力ブロックの末尾行（`content-type` / `content-length` など）を落として引用しているが「抜粋」の注記が無い。L403 だけ注記がある | 表記が揃い、読者が手元の出力と1行ずつ突き合わせられる |
| 4 | L318 コードフェンス | ラベルが ```` ```javascript:page.html（script 部分） ```` で、Zenn ではファイル名として全角括弧込みで表示される | ラベルを `page.html` にして「script 部分の抜粋」を本文に出すと、ファイル名表示がきれいになる |
| 5 | （記事外）`scripts/check-article.sh` L94 | `wc -m` がロケール依存で、日本語タイトル 55 文字を 105 と数えている（バイト数）。この記事に限らず全記事で誤検知する | スクリプト冒頭で `export LC_ALL=ja_JP.UTF-8`（または `C.UTF-8`）を設定すると title 長チェックが正しく効く。記事側の修正は不要 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug 36字・具体的・重複なし / 秘密情報なし。個人パスは `/.../workspace`・`file:///.../client-node.mjs`・`/.../node_modules/undici/...` と一貫して伏字化済み（前回 suggestion 5 の記法統一も反映されている） |
| Front Matter | OK | title 55字（機械チェックの105文字は誤検知）/ emoji 🔎 / type tech / topics 5個すべて英小文字 |
| 事実性（ログ照合） | OK | 数値・エラー全文・コマンド・結果表・コードすべてログおよび workspace 実ファイル由来。創作なし。ログが「記事に書かない」と注記した実測所要時間（488秒）・実行者（AIエージェント単独）は転記されていない |
| 画像 | OK | 3枚すべて実在。`screenshots/` の原本と `cmp` でバイト一致。alt はすべて内容を説明している。孤立画像なし。詰まった点の節に 02・03 が添えられている |
| Markdown構造 | OK | フェンス74行（偶数）/ `:::` 6行（偶数）/ H1 なし・H2 H3 のみ / 参考リンク4本（http.dev・Hono リリースノート・undici issue #5454・PR #5459）。前回 suggestion 3 の undici リンク追加が反映済み |
| 文章品質・トーン | OK | 経験談トーンを維持し、予想が外れた過程・限定条件を明示。詰まった点は5件を具体的に記述。環境節に OS / ランタイム / 全ライブラリバージョンあり |
| 完成度 | OK | `要素材`・プレースホルダの残存なし。冒頭の前提コメント L9 は本パイプラインの慣例（出典ログの明示）として意図的と判断 |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「もう送れる。落ちるのは GET+body と CORS のほうだった」（L15, L606, L709）
  ↔ ログ「完了条件5件すべて達成 / 主結論は『もう送れる。落ちるのは別の場所』に振る」（ログ L28, L49, L988）
  → **一致**
- 個別に照合して一致を確認した主な一次情報:
  - curl 3本の全文・サーバー側 `bodyLen=13 / 0 / 13`（記事 L158-176, L248-252, L431-455 ↔ ログ L254-279, L342-373）
  - Node fetch の 200 / `TypeError` 全文・スタック（記事 L288-308 ↔ ログ L400-438）
  - 小文字プローブ 400 / 200・curl 小文字 400 + `Connection: close`（記事 L391-420 ↔ ログ L447-475）
  - `Allow: GET, HEAD` / `Allow: QUERY, GET, HEAD, POST` / `/nope` 404（記事 L612-636 ↔ ログ L508-544）
  - プリフライト `acrm=QUERY` → 405 / 204 と `access-control-allow-methods: GET,HEAD,PUT,POST,DELETE,PATCH,QUERY`
    （記事 L509-554 ↔ ログ L651-686）
  - ETag 4回分のステータスとハッシュ実値（記事 L654-670 ↔ ログ L788-815）
  - `EBADENGINE` 警告全文（記事 L566-576 ↔ ログ L719-729）
  - 予想7件中6件当たり・外れは #2 のみ（記事 L694 ↔ ログ L171-182）
  - `process.versions` の4値（node 22.17.0 / llhttp 9.3.0 / undici 6.21.2 / v8 12.4.254.21-node.26）
    ↔ `workspace/versions.txt` と一致
- 掲載コードの由来: `server.mjs` の `dump()`・`[wire]` ミドルウェア、`client-node.mjs`、`shot.mjs`、
  `page.html` の fetch ループはいずれも workspace 実ファイルと逐語一致（省略部分は `//` コメントで明示）。
  **創作コードなし**
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件
- 断定の抑制: 未検証範囲（Cache #5119 / 6.x・7.x backport / Chromium 以外 / プロキシ・CDN・HTTP/2 /
  `Accept-Query` の適切な付与先）はログの「未達・撤退した項目」と一対一で対応し、記事 L713-719 で明示されている

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/hono-query-method-curl-fetch-browser.md (slug=hono-query-method-curl-fetch-browser) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=36 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 105文字 (60字目安)
[PASS] emoji あり: 🔎
[PASS] topics 5個
[PASS] 画像あり: /images/hono-query-method-curl-fetch-browser/01-browser-same-origin.png
[PASS] 画像あり: /images/hono-query-method-curl-fetch-browser/02-browser-cross-origin-no-cors.png
[PASS] 画像あり: /images/hono-query-method-curl-fetch-browser/03-browser-cross-origin-with-cors.png
[PASS] コードフェンスが閉じている: フェンス行=74
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

**WARN の切り分け**: `[WARN] title が長い: 105文字` は誤検知。スクリプト L94 の `wc -m` が
ロケール未設定でバイト数を数えているため。Python の `len()` で数えた実文字数は **55 文字**で
目安 60 以内。記事側の修正は不要（スクリプト側の改善案を suggestion 5 に記載）。

## 適用した修正

なし（レポートのみ・非破壊レビュー）。

## 次のアクション

- [x] blocker / warning は 0 件。修正必須の項目はない
- [ ] （任意）suggestion 1〜4 を直すと完成度が上がる。直した場合は `/review-article` で再レビュー
- [ ] `/publish-pr` で公開する（Front Matter を `published: true` にして PR 作成 → main へマージで公開）。
      main へ直接 push はしない
- [ ] 「サイト内で既に使用されています」が出たら slug を具体化
      （`knowledge/2026-07-01-zenn-slug-already-used.md`）
