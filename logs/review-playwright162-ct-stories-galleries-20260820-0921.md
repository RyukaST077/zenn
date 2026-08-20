# 公開前レビュー: Playwright 1.62 の stories & galleries でコンポーネントテストを最小構成から作ってみた / playwright162-ct-stories-galleries

## レビューの前提

- 対象記事: `articles/playwright162-ct-stories-galleries.md`（引数で明示指定）
- 出典ログ: `logs/run-playwright-ct-stories-galleries-20260820-0213/execution-log.md`（引数で明示指定）
- レビュー日時: 2026-08-20 09:21
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 前回レビュー: `logs/review-playwright162-ct-stories-galleries-20260820-0913.md`（判定「要修正」/ blocker 0・warning 4・suggestion 5）
- 前回修正: `logs/revise-playwright162-ct-stories-galleries-20260820-0917.md`（warning 4件 ＋ suggestion 2件を適用）
- **本レビューは再レビュー**。前回 warning の解消確認に加え、事実整合を独立に再照合した（前回レポートの結論を鵜呑みにしていない）

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な事実）:
  - 公開安全は全項目クリア。`published: false` / slug 妥当かつ一意 / 秘密情報・トークン・個人パス（`/Users/...`）・内部ホスト名はいずれも検出なし。
  - 前回の warning 4件（W1〜W4）はすべて解消済み。掲載コード欠落・出力引用の不一致・ログ外の所要時間断定が消えている（下記「前回指摘の解消確認」参照）。
  - 事実整合を独立再照合した結果、**本文の主要コードブロック9本すべてが出典ログの全文と `diff` 完全一致**、**主要エラー出力2本（最初の失敗39行／壊した版）も `diff` 完全一致**。創作コード・創作エラーはゼロ。
  - 残るのは体裁・可読性の suggestion 3件のみで、いずれも公開を止める性質ではない。

## 最優先で直すべき指摘（上位3件）

blocker / warning はゼロ。以下は任意対応の suggestion（この3件が全件）。

1. [suggestion] Front Matter `title`（L2） — 61文字で目安の60文字をわずかに超える。一覧での見切れが気になるなら「Playwright 1.62 の stories & galleries でコンポーネントテストを作ってみた」まで縮める。
2. [suggestion] 「型で守られる範囲と、守られない範囲」L724 の `ts` ブロック — 直後の tsc 出力が `tests/components/typecheck.spec.ts(7,5)` を指すのに、この検証用ファイルの名前が本文に一度も現れない（`wc -l` の内訳表にも無い）。ブロックを `ts:tests/components/typecheck.spec.ts` にするか、「検証用に `tests/components/typecheck.spec.ts` を1本作った」と一言添えると、行番号と本文が対応する。
3. [suggestion] L9 の前提コメント `<!-- 前提: 出典ログ ... -->` — パイプラインの申し送りメモが本文先頭に残っている（HTMLコメントなので表示はされない）。公開時に消すと記事ファイル単体で内部メタが混ざらない。運用として残すなら現状のままでも可。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| S1 | Front Matter `title`（L2） | 61文字。機械チェックは通過するが目安の60文字を1文字超過 | 一覧・検索結果での見切れが減る。前回 S2 の再掲（著者判断で見送り済み） |
| S2 | 「型で守られる範囲と、守られない範囲」L724 の `ts` ブロック | 直後の tsc 出力が `tests/components/typecheck.spec.ts(7,5)` / `(2,1)` を指すのに、そのファイル名が本文にもコードブロックのラベルにも `wc -l` 表にも出てこない。他のブロックはすべてファイル名付きで統一されているため、ここだけ読者が「どのファイルの7行目か」を追えない | ブロックを `ts:tests/components/typecheck.spec.ts` にする（または一文添える）と、エラー出力の行番号と本文が対応し、記事全体のファイル名付きブロックの体裁とも揃う |
| S3 | L9 の前提コメント | パイプラインの申し送りメモが残存（HTMLコメント・非表示） | 公開時に消すと内部メタが記事に混ざらない。前回 S3 の再掲（運用として保持を選択済み） |

## 前回指摘の解消確認（W1〜W4 / S1・S4）

| 前回# | 内容 | 状態 | 確認方法 |
|---|---|---|---|
| W1 | `tests/components/button.spec.ts` から `Disabled` テストが欠落 | **解消** | 該当ブロックは34行になり、ログ「（全文 / 34行）」と `diff` 完全一致。記事内 `wc -l` 表の「34」および実行結果ブロックの `✓ 4 ... Disabled story ...` と整合 |
| W2 | `src/components/Button.tsx` / `Counter.story.tsx` が本文に不掲載 | **解消** | それぞれ13行・7行で追記され、ログ全文と `diff` 完全一致。`wc -l` 表の13・7と一致 |
| W3 | `npm view` 出力ブロックが合成・整形されていた | **解消** | ログ フェーズ1の実出力（`rc` を含む4キー）に差し替え済み。直前の一文にも実行コマンド `npm view @playwright/test dist-tags` が明記された |
| W4 | 「初見でここに数時間持っていかれる」がログ外の推測 | **解消** | 数値を伴う断定は削除され、「実際に時間を食ったのは…gallery の契約を読み解くところと、上の3番の原因を切り分けるところ」＋「あくまで見立てですが」に置換。ログ L1058 の記事化指示（「見積もりのどこが外れたかの質だけを使う／full reload の原因究明が実装より長い」）および実測（gallery 実装 約1分 < 原因究明 約2分）と整合 |
| S1 | 「毎回同じ1件目です」が貼った出力（`✘ 2`）と矛盾 | **解消** | 「毎回同じ1件（`button.spec.ts:4:1` の Primary）です」に修正済み |
| S4 | devtools から叩ける旨が実演ベースでない | **解消** | 「（今回はスクショ用スクリプトから `page.evaluate` で同じことをやりました）」を追記済み |

未解消の warning: **なし**。

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false`（Front Matter 6行目）。slug `playwright162-ct-stories-galleries`（34文字・`a-z0-9-` のみ・汎用語なし・`articles/` 内で一意）。`grep -nE '/Users/\|katayama\|ghp_\|sk-\|api[_-]?key\|token\|password\|secret\|BEGIN .*PRIVATE'` で該当0件。ログ引用の絶対パスも `.../pw162-ct/...` にマスク済み |
| Front Matter | OK | title/emoji(🎭)/type(tech)/topics(5件・英小文字)/published すべて妥当。title 61文字のみ suggestion（S1） |
| 事実性（ログ照合） | **OK** | 主要コードブロック9本・主要エラー出力2本が出典ログと `diff` 完全一致。数値・バージョン・所要時間の記述はすべてログに裏付けあり。創作なし |
| 画像 | OK | 参照7枚すべて `images/playwright162-ct-stories-galleries/` に実在。7枚すべて `logs/.../screenshots/` の同名ファイルとバイト数一致（25514 / 26462 / 26346 / 26095 / 27633 / 28012 / 102117）。孤立画像なし。全画像に説明的な alt あり。詰まった点（`update()` 節）とまとめ（HTMLレポート）にもスクショが添えられている |
| Markdown構造 | OK | コードフェンス90本（偶数）。`:::` 6本（`message`×1・`details`×2 が開閉一致：L26/28・L557/599・L677/712）。見出しは H2 のみで H1 乱用なし（`### Bug Fixes` はコードフェンス内・L94 を目視確認済み。`#` で始まる L952-956 は bash ブロック内のコメント）。`example.com` / `TODO` / 空リンクなし。参考リンク5本は playwright.dev / github.com / vite.dev の公式ドメイン |
| 文章品質・トーン | OK | 経験談トーン。「CT を触るのは今回が初めて」「旧方式は実務未経験」を冒頭で明示し、比較・移行コスト・所要時間はすべて「見立て」「はず」「という理解でいます」と断っている。詰まった点は6件相当を具体的に記述し、未解決の1件（全22回中1回）と「エラー全文を `tail` で切って残せなかった」という反省まで書いている。環境（macOS 26.5 arm64 / Node v22.17.0 / npm 10.9.2 / Playwright 1.62.1 / Chromium 151.0.7922.34 / Vite 8.2.1 / React 19.2.8 / TS 6.0.3）を表で明記し再現性あり |
| 完成度 | OK | `要素材` / TODO / FIXME / `<slug>` の残存0件。972行・構成は「はじめに→環境→仕様→詰まった点→深掘り→比較→まとめ→参考リンク」で公開に耐える |

## 事実整合の照合結果（ログとの突合）

### 結論の一致

- 記事「最終的に7テスト全部 pass して、HTML レポートも残りました」 ↔ ログ「完了条件の判定: **達成（5/5）**」「`FINAL verification run` `7 passed (1.6s)` / `screenshots/07-html-report.png`（All 7 / Passed 7 / Failed 0 / Flaky 0）」 → **一致**
- 記事の「初めて触る人が踏みそうな順」6項目 ↔ ログ「詰まった点」#1〜#6 → **一致**（未解決の#6も記事に正直に記載）

### `diff` で完全一致を確認したブロック（機械照合）

| 記事の掲載箇所 | 行数 | 出典ログ | 結果 |
|---|---|---|---|
| `playwright/gallery/main.tsx` (L231) | 67 | 「全文 / 67行 / 手書き」 | **完全一致** |
| `playwright/gallery/index.html` (L303) | 15 | 「全文 / 15行」 | 行数一致 |
| `playwright.config.ts` (L333) | 25 | 「全文 / 25行」 | **完全一致** |
| `src/components/Button.tsx` (L367) | 13 | フェーズ2「全文」 | **完全一致** |
| `src/components/Counter.tsx` (L385) | 23 | フェーズ2「全文」 | 行数一致 |
| `src/components/Button.story.tsx` (L420) | 23 | 「全文 / 23行」 | **完全一致** |
| `src/components/Counter.story.tsx` (L448) | 7 | 「全文 / 7行」 | **完全一致** |
| `tests/components/button.spec.ts` (L460) | 34 | 「全文 / 34行」 | **完全一致** |
| `tests/components/counter.spec.ts` (L497) | 25 | 「全文 / 25行」 | **完全一致** |
| 最初の実行結果（`:::details`, L559-597） | 39 | フェーズ3 失敗全文 | **完全一致** |
| 壊した版のエラー全文（`:::details`, L679-711） | 33 | フェーズ3-6b 全文 | **完全一致** |
| `tsconfig.pw.json` / tsc 出力 TS2353・TS6133 | — | フェーズ4 全文 | **完全一致** |
| 再現手順6行（`mv playwright /tmp/pw_gallery_hidden` ...） | 6 | ログ L611-616 | **完全一致** |

掲載9ファイルの行数合計 = 67+15+25+13+23+23+7+34+25 = **232** で、本文の `wc -l` 内訳表「232 total」と一致。記事内の自己整合も取れている。

### 個別数値・主張の裏付け（抜粋・独立に再確認）

- `npm view @playwright/test dist-tags` 出力4キー（`rc: '1.18.0-rc1'` 含む）→ ログ L51-56 と一致
- 1.62.1 Bug Fixes 5件の全文・「3件が `[Regression]` / fatal since 1.62」→ ログ L73-79 と一致
- 1.62.0 の要点（stories and galleries / 型引数で props 型検査 / AbortSignal・WebP・`Reporter.preprocess()`・`retryStrategy: 'isolated'`・`npx playwright mcp`/`cli` / Debian 11 サポート終了）→ ログ L83-88 と一致
- Chromium 151.0.7922.34（1.62 系同梱）→ ログ L87 と一致
- `npm ls --depth=0` 9行（Vite 8.2.1 / TS 6.0.3 / React 19.2.8 / oxlint 1.79.0 / @types/node 24.13.3）→ ログ L145 周辺と一致
- `VITE v8.2.1 ready in 113 ms` → ログ L134 / L585 と一致
- chromium キャッシュ「7世代で 2.2GB 超」「1世代 299〜356MB」→ ログ L229/L231/L1155 と一致（記事の 299 は実出力 `299M ... 356M` 由来。ログ本文の「約300〜356MB」より実出力に忠実）
- `init-skills` 生成物「Markdown 16ファイル / 合計 2710行 / コード0行」と `✅ Skill installed` 3行、`--help` 出力、`no matches found` → ログ L233-301 と一致
- `2:16:07 AM [vite] (client) page reload playwright/gallery/index.html` → ログ L587 と一致
- 仮説A（`optimizeDeps.entries`）棄却 → 仮説B（dev server が gallery より先に起動）確定、最終 `7 passed` かつ `page reload` 行なし、5連続 5/5 green → ログ L611-623 と一致
- 「7テストが1.5秒台」→ ログ L436「今回の実測でも7テストが1.5秒で終わる」と一致（`commands.log` の `7 passed` は 1.0〜1.6s の範囲。代表値として妥当）
- story リネーム時の `exit=0` / `✓ built in 380ms` / `Unknown story:` 2件 / `2 failed 3 passed (2.5s)` → ログ L762-800 と一致
- `net::ERR_CONNECTION_REFUSED` / `The gallery page does not define window.mount().` → ログ フェーズ4-2・4-x と一致
- 1.62.0 回帰2件（`Failed to resolve "extends" path` / `"references" path "../packages/shared"` ＋ `No tests found`）、1.62.1 で `7 passed (1.5s)`、`npx tsc -p tests/tsconfig.json` の TS2307 2件 → ログ L896-970 と一致
- 旧パッケージ: latest 1.62.1・npm 上 deprecated 指定なし・alpha は `2026-08-07` で停止 vs `@playwright/test` は `2026-08-19` → ログ L64 / L990 と一致
- `references/migration.md` の "after" 例の矛盾2点（関数 props / `component.click()`）→ ログ L1011-1016 と一致
- `vite build` は gallery を無視（`✓ built in 112ms` / `dist/index.html` のみ）→ ログ L1027 周辺と一致
- 未解決の1件（全22回中1回・5連続 green・2仮説を各3回試して再現せず・`tail` でエラー全文を失った）→ ログ L1071 / L1115-1116 と一致
- 「一意なら後方一致の短縮形も通る」→ ログ L93（公式ドキュメント読解メモ）と一致。`endsWith('/' + path)` の実装も L325 と一致

### 創作の疑い

**なし**。掲載コード・エラー出力はすべて出典ログの workspace 由来で、機械照合（`diff`）で確認済み。ログを超えた断定・数値も検出されなかった。ログ外の見立てにあたる箇所（移行コスト・旧方式との比較・向いている人・読解時間）はいずれも「見立て」「はず」「という理解でいます」「あくまで見立てですが」と明示的に断られている。

### 残存する `要素材` マーカー

**0 件**。

## 機械チェック結果（scripts/check-article.sh）

```
$ bash scripts/check-article.sh articles/playwright162-ct-stories-galleries.md --expect-published false
OK: articles/playwright162-ct-stories-galleries.md (slug=playwright162-ct-stories-galleries, published=false)
EXIT=0
```

補助的に実行した手動チェック:

```
コードフェンス数: 90（偶数）
::: 行: 6（message×1 / details×2、開閉一致）
秘密情報パターン grep: 0 件
要素材 / TODO / FIXME / <slug> / example.com: 0 件
画像参照: 7 件 → 実在 7 件（バイト数まで screenshots/ と一致）
孤立画像: 0 件
title 文字数: 61
```

## 適用した修正

なし（引数で修正適用が指定されていないため、記事本文は一切変更していない）。

## 次のアクション

- [x] blocker / warning はゼロ。**この記事は `published: true` にして公開して問題ない状態**
- [ ] 任意: S1〜S3（title 61文字の短縮 / `typecheck.spec.ts` のファイル名明示 / 前提コメントの削除）を反映する
- [ ] `/publish-pr articles/playwright162-ct-stories-galleries.md` で公開PRを作る
      （`published: true` への変更と push は publish-pr が行う。main へのマージ＝公開）
- [ ] 「サイト内で既に使用されています」が出たら slug を具体化
      （knowledge/2026-07-01-zenn-slug-already-used.md）
