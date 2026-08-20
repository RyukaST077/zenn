# 公開前レビュー: Hono 4.13 の app.query() で QUERY メソッドを試したら、詰まったのは別の場所だった / hono-query-method-curl-fetch-browser

## レビューの前提

- 対象記事: `articles/hono-query-method-curl-fetch-browser.md`（引数で明示）
- 出典ログ: `logs/run-hono-query-method-20260818-0412/execution-log.md`（引数で明示。記事冒頭の前提コメントとも一致）
- レビュー日時: 2026-08-18 04:33
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 5 件
- 根拠（判定を決めた主な指摘）:
  - warning 1: 「はじめに」の「一番自信があった」が、本文後半の「自信6割」および出典ログの記述と食い違う（記事内で自己矛盾しており、ログの裏付けも無い）
  - 公開安全（published:false / 秘密情報 / slug / 画像参照）はすべてクリア。機械チェックの `fail=0`
  - 機械チェックの `[WARN] title が長い: 105文字` は **false positive**（`wc -m` がロケール依存でバイト数を数えている。実際は 55 文字で 60 字目安内）

## 最優先で直すべき指摘（上位3件）

1. [warning] 「はじめに」L15 — 「一番自信があったのは『…Node の `fetch` からは送れないだろう』という予想でした」を、L93 の「自信6割」と整合する表現に直す。例: 「一番の見どころにするつもりだったのは」／「6割くらいの自信で立てていたのは」。
2. [suggestion] 「はじめに」L15 — 「予想を紙に書いてから始めました」の「紙に」はログに無い（実体は検証前に書いた `phase1-notes.md`）。「試す前に予想をメモに書き出してから始めました」程度に直す。
3. [suggestion] 「詰まった点」L405-418 の小文字 `query` の curl 出力 — ログ（`curl-lowercase-query.log` 全文）にある `> Accept: */*` 行が落ちている。全文引用に見えるので `> User-Agent:` の次に `> Accept: */*` を足すか、ブロック前に「抜粋」と明記する。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | はじめに L15 | 「一番自信があったのは『Node の `fetch` からは送れないだろう』」と書いているが、L93 では同じ予想を「自信6割」と書いており矛盾する。ログの予想リストで信頼度が明記されているのはこの1件のみで、しかも「自信6割。素通しされる可能性も残した」と留保付き。「一番自信があった」はログの裏付けが無い | 「一番自信があった」→「記事の柱にするつもりだった」または「6割くらいの自信で立てていた」に置換。伏線としての機能は落ちない | ログ L173（予想 #2「自信6割。素通しされる可能性も残した」）／記事 L93 との内部矛盾 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | はじめに L15 | 「予想を紙に書いて」はログに無い媒体の詳細（実体は `workspace/phase1-notes.md`）。「メモに書き出して」に | ログに無い具体を消せる。事実の粒度が本文全体と揃う |
| 2 | 詰まった点 L405-418 | 小文字 `query` の curl 出力から `> Accept: */*` 行（ログ L464）が欠落。ほか L471-481・L507-511・L519-524・L541-546 も末尾行を落として引用している | 「抜粋」と一言添える／欠落行を戻すと、読者が手元の出力と1行ずつ突き合わせられる |
| 3 | 事前に調べたこと L76 / 参考リンク L757-761 | undici issue #5454・PR #5459 を本文で何度も根拠に使っているのに、リンクが無い（参考リンクは http.dev と Hono リリースノートの2本のみ） | `https://github.com/nodejs/undici/pull/5459` 等を参考リンク節に追記すると、記事の一番の山場（なぜ通ったのか）が読者側で検証可能になる |
| 4 | 事前に調べたこと L92-98 | 7つの予想を貼っているが、答え合わせが明示されているのは #2（外れ）と、注意点メモの当たりのみ。#1・#3〜#7 の当たり外れは本文を通読すれば分かるが一覧では回収していない | 結果表の直前か「まとめ」に「予想 7 件中 6 件当たり・#2 のみ外れ」の1行を置くと、冒頭で宣言した「答え合わせ構成」が閉じる |
| 5 | 環境構築 L114 | `npm ls` 出力のパスを `/path/to/workspace` に置換している（サニタイズとして適切）。ただし他のブロックは `/.../` 表記で、記法が2種類ある | どちらかに統一すると、伏せた箇所だと読者に伝わりやすい |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false`。秘密情報・APIキー・トークンの検出なし。`/Users/...` の個人パスは全ブロックで `/.../` `/path/to/...` に置換済み（grep で 0 件）。slug `hono-query-method-curl-fetch-browser`（36字）は文字種OK・汎用語なし・`articles/` 内で重複なし |
| Front Matter | OK | title 55文字（機械チェックの「105文字」はロケール由来の false positive）／emoji 🔎／type tech／topics 5個（hono, nodejs, http, undici, cors）すべて妥当。誇大表現なし |
| 事実性（ログ照合） | 要修正 | 数値・エラー全文・コマンド・結果表はすべてログ由来で一致。創作コードなし。ログが「記事に書かない」と注記した実測所要時間（488秒）・実行者（AIエージェント）を転記していない点も適切。唯一 warning 1 の「一番自信があった」がログを超えている |
| 画像 | OK | 3枚すべて `images/hono-query-method-curl-fetch-browser/` に実在。alt テキストあり。孤立画像なし。詰まった点（CORS）にスクショが添えられている |
| Markdown構造 | OK | フェンス74行（偶数）・`:::` 6行（偶数）ともに閉じている。H1 なし、H2/H3 の階層破綻なし。リンクにプレースホルダなし。参考リンク節あり |
| 文章品質・トーン | OK | 経験談トーン。予想が外れた過程を隠さず書いている。「分からないまま残ったこと」で未検証範囲（Cache #5119 / backport / 他ブラウザ / プロキシ・HTTP/2 / Accept-Query の使い所）を5点明示。環境・バージョンも冒頭と末尾で明記 |
| 完成度 | OK | `要素材` マーカー 0 件、TODO/FIXME なし。冒頭の前提コメント（L9）は意図的な出典明示。再現手順と注意点の `:::message alert` まで揃っている |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「もう送れる。落ちるのは GET+body とクロスオリジンの CORS プリフライト」 ↔ ログ「結果サマリー: 達成／記事の主結論は『もう送れる。落ちるのは別の場所』に振る」 → **一致**
- 個別に突合して一致を確認したもの:
  - 結果表 6行×3列: ログ「最終成果の結果表」と**完全一致**
  - 小文字プローブ表 3行: ログ「追加プローブ」と一致（6.21.2=400 / 8.10.0=200 / curl=400+`Connection: close`）
  - curl 初回 QUERY 200 の全文・ヘッダ・`Date: Mon, 17 Aug 2026 19:16:34 GMT` まで一致
  - `dump()` / `[wire]` ミドルウェア / `server-min.mjs` / `shot.mjs` のコードはログ掲載の実物と一致
  - `allow: GET, HEAD` / `allow: QUERY, GET, HEAD, POST`、404→405 の前後比較が一致
  - ETag 4パターン（`e11f2813...` → `a24aa2e6...`、304、別ボディ+旧ETag=200）が一致
  - `access-control-allow-methods: GET,HEAD,PUT,POST,DELETE,PATCH,QUERY` が一致
  - EBADENGINE 警告全文（required `node: >=22.19.0` / current `v22.17.0`）が一致
  - バージョン台帳（Node 22.17.0 / undici 6.21.2 / llhttp 9.3.0 / hono 4.13.2 / Chromium 149.0.7827.55 / curl 8.7.1）が一致
  - ETag の限界（レスポンス本文ハッシュ由来であり RFC 10008 のキャッシュキーの証明ではない）を、ログの指示どおり限定して記述
- 創作の疑いがある記述: warning 1（「一番自信があった」）／suggestion 1（「紙に」）の2点のみ。他に数値・成功の断定の捏造は見つからなかった
- 残存する `要素材` マーカー: 0 件

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

### false positive の切り分け

- `[WARN] title が長い: 105文字` は **指摘としない**。script は `wc -m` で数えているが、
  このシェルのロケールでは UTF-8 として解釈されずバイト数（105）を返している。
  実測は 55 文字（`python3 -c "len(t)"`）で 60 字目安の範囲内。誇大表現も含まれない。

## 適用した修正

なし（レポートのみ・記事は未変更）。

## 次のアクション

- [ ] warning 1（「一番自信があった」→ 自信6割と整合する表現）を直す。suggestion 1〜4 もあわせて直すと完成度が上がる
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr`（Front Matter を `published: true` にして PR 作成 → main へマージで公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
