# 実践タスク: Bunの組込cookie(Bun.CookieMap)で、手動Set-Cookieと書き比べてみた

## このタスクの前提

- 出典レポート: `research/search-topic-20260720-0401.md`
- 元テーマ: テーマ1 / Bunの組込cookie(Bun.CookieMap)で、手動Set-Cookieと書き比べてみた（レポートの「最初に試すべき1本」）
- 対象技術: Bun 1.3 系の `Bun.serve()` 組込 cookie（`request.cookies` = `Bun.CookieMap`）
- 記事の方向性（記事タイプ）: 書き比べ（before/after）＋詰まった点まとめ
- 想定筆者 / 想定読者: Web系の新人エンジニア / 新人〜実務2年目（cookie を手動管理した経験がある層）
- 検証に使える想定時間: 半日（約3〜4時間）※デフォルト前提を採用
- 判断方針: 引数で渡されたのは対象レポートのパスのみ。テーマ・時間・スキルレベルは無指定のため、レポートの推奨1本＋デフォルト前提（半日 / 新人）を採用した。
- 実行環境の担保: `bun` 単体（ローカルで 1.3.14 を確認済み）＋ `curl` ＋ Playwright だけで完結する。外部API・認証・課金・手動サインアップは不要。ブラウザ確認は Playwright で自動操作＋スクショするため AIエージェント単独で完結できる。テーマ置き換えは不要。

## 完成イメージ（成果物）

- 作るもの: 同じ「セッションcookie の発行 / 読み取り / 削除」を **2実装**で書いた最小の Bun HTTP サーバー
  1. **CookieMap版**: `Bun.serve({ routes })` で `request.cookies.get/set/delete` を使う（自動 Set-Cookie）
  2. **手動版**: `Cookie` ヘッダを手でパースし、`Set-Cookie` ヘッダ文字列を手で組み立てる
- 「できた」と言える完了条件:
  - `/sign-in` `/whoami` `/sign-out` の3エンドポイントが、CookieMap版・手動版の**両方**で同じ挙動（同じ `Set-Cookie` 属性・同じ cookie 削除挙動）になる
  - `curl -i` の出力で両版の `Set-Cookie` ヘッダ文字列が一致することを確認できる
  - Playwright で localhost を開き、`context.cookies()` またはブラウザに保存された cookie 状態をスクショで残せる
- 完了確認の方法: `curl -i` のレスポンスヘッダ（一次ログ）＋ Playwright のスクショ
- 記事タイトル案（そのまま使える形）:
  1. Bunの組込cookie(Bun.CookieMap)で、手動Set-Cookieと書き比べてみた
  2. cookie-parser無しでいける？ Bunの`request.cookies`を手動Set-Cookieと比べてみた
  3. Bun 1.3のCookieMapでセッションcookieを発行・削除して詰まった点

## 事前準備チェックリスト

- [ ] 認証・APIキー: 不要（cookie 機能はローカル完結。外部サービス・トークンを使わない）
- [ ] ローカル環境（言語・ランタイム・バージョン）: Bun 1.3 系（`bun --version` で確認。本環境は **1.3.14**）
- [ ] インストールするもの: Playwright（`bunx playwright install chromium`）。`curl` は macOS 標準
- [ ] 無料枠 / コストの確認: すべてローカル実行のため課金トリガー無し
- [ ] 記録用の準備: 作業ディレクトリ（例 `bun-cookie-lab/`）、`logs/` にcurl出力、`shots/` にスクショを保存する場所を用意

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] `bun --version` を実行し 1.3 系であることを確認する（目安: 5分）
  - 記録すること: 実際のバージョン文字列（例 `1.3.14`）。1.2 以前だと `request.cookies` が無いので、その場合はアップグレードコマンドと所要時間もメモ
- [ ] 公式 cookie docs（https://bun.com/docs/runtime/cookies）を読み、`CookieMap` の `get/has/set/delete` と `CookieInit`（path/sameSite/secure/httpOnly/maxAge/expires/domain）の既定値を控える（目安: 15分）
  - 記録すること: `set(name, value)` の既定が `{ path: "/", sameSite: "lax" }` である点、`secure` は HTTPS 前提である点。「事前に調べたこと」節の素材
- [ ] 「手動版で再現すべき Set-Cookie 属性」を一覧化する（httpOnly / sameSite=strict / maxAge / path）（目安: 10分）
  - 記録すること: 比較の軸として何を揃えるか。削除は `maxAge=0` / `expires` 過去日で表現する点

### フェーズ2: 環境構築（目安: 40分）

- [ ] 作業ディレクトリを作り `bun init -y` で最小プロジェクトを初期化する（目安: 10分）
  - 記録すること: 実行コマンドと生成物。`-y`（非対話）で対話プロンプトを回避できたか
- [ ] `Bun.serve({ routes: { "/": () => new Response("ok") } })` の Hello World を書き、`bun run server.ts` で起動して `curl -i localhost:3000/` が 200 を返すのを確認する（目安: 20分）
  - 記録すること: 起動コマンド、ポート、`curl -i` の初回出力。ポート衝突が起きたら使ったポートと対処
- [ ] Playwright を導入する（`bun add -d playwright` → `bunx playwright install chromium`）（目安: 10分）
  - 記録すること: インストール所要時間、chromium ダウンロードサイズ。詰まったら全文エラー

### フェーズ3: 実装・検証【本編】（目安: 120分）

- [ ] **CookieMap版** の `server.ts` を書く。`routes` に `/sign-in`（`request.cookies.set("sessionId", <値>, { httpOnly: true, sameSite: "strict", maxAge: 3600, path: "/" })`）、`/whoami`（`request.cookies.get("sessionId")` を返す）、`/sign-out`（`request.cookies.delete("sessionId")`）を実装する（目安: 40分）
  - 記録すること: 書いたコード全文。`request.cookies` を `routes` ハンドラで使えたか。**要確認**: `fetch` ハンドラ側でも `request.cookies` が使えるか（公式は `routes` 例のみ提示。実際に試して結果をログに残す）
- [ ] CookieMap版を起動し、`curl -i -c cookies.txt localhost:3000/sign-in` → `curl -i -b cookies.txt localhost:3000/whoami` → `curl -i -b cookies.txt localhost:3000/sign-out` を実行し、各 `Set-Cookie` ヘッダを `logs/cookiemap.txt` に保存する（目安: 20分）
  - 記録すること: 自動生成された `Set-Cookie` の**文字列全文**（属性の並び順・書式）。削除時のヘッダ（`Max-Age=0` か `Expires` か）を実出力で確認
- [ ] **手動版** の `server-manual.ts` を書く。`fetch` ハンドラで `req.headers.get("Cookie")` を自前パースし、`/sign-in` では `Set-Cookie` 文字列を手組み（`sessionId=...; HttpOnly; SameSite=Strict; Max-Age=3600; Path=/`）、`/sign-out` では削除用ヘッダを手組みする（目安: 40分）
  - 記録すること: 書いたコード全文。手パースで詰まった点（`; ` 区切り・`=` 分割・複数cookie・URLエンコード）。手書き Set-Cookie で最初に間違えた属性
- [ ] 手動版に同じ `curl` 3連を実行し `logs/manual.txt` に保存、`diff logs/cookiemap.txt logs/manual.txt` で `Set-Cookie` が一致するまで属性を揃える（目安: 20分）
  - 記録すること: 最初の `diff` 結果（どこがズレたか）、揃えるために直した箇所。書式の細かな差（属性名の大小・順序）

### フェーズ4: 深掘り・比較（目安: 30分）

- [ ] CookieMap版・手動版を Playwright で開き（`page.goto` → `/sign-in` を fetch → `context.cookies()` を取得）、cookie 保存状態をスクショして `shots/` に保存する（目安: 20分）
  - 記録すること: `context.cookies()` の中身（httpOnly / sameSite が意図どおり付いているか）。両版でブラウザ側の見え方が同じか。スクショのパス
- [ ] コード行数・型の付き方（`get` の戻り値 `string | null`）・削除の書き味を before/after で1表にまとめる（目安: 10分）
  - 記録すること: 行数差、型安全性の差、手動版でうっかり抜けやすい属性（HttpOnly付け忘れ等）。「書き比べて分かったこと」の素材

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] 記録テンプレを見返して詰まった点を棚卸しする（目安: 15分）
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋める（目安: 15分）

> 目安時間の合計: 約 4 時間 10 分（事前調査30 / 環境構築40 / 本編120 / 深掘り30 / 振り返り30 + バッファ）。半日の想定に概ね収まる。超過しそうなら深掘りの Playwright スクショを1版だけに絞る。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `request.cookies` が `undefined` / 使えない | Bun 1.2 以前、または `fetch` ハンドラで使おうとしている（公式例は `routes` のみ） | `bun --version` で1.3系を確認。`routes` ハンドラ内で使う。`fetch` 側での可否は実際に試して結果を残す | 「`routes` と `fetch` どちらで使えるか」を実検証した一次情報として書く（日本語で薄い） |
| 2 | 手動版の `Set-Cookie` が CookieMap版と一致しない | 属性の書式・順序・大小（`HttpOnly` / `Max-Age` / `SameSite=Strict`）や既定値（`Path=/`, `SameSite=Lax`）を揃えていない | `diff` で差分箇所を特定し、公式の既定値（`path:"/"`, `sameSite:"lax"`）に合わせる | before/after で「手書きは属性を1つ落とすと壊れる」ことを diff 付きで見せる |
| 3 | cookie 削除がブラウザに効かない | 削除は値だけ空にしても消えず、`Max-Age=0` か過去 `Expires` が必要。属性（Path/Domain）が発行時と不一致だと別cookie扱い | CookieMap版の `delete` が吐くヘッダを `curl -i` で確認し、手動版もそれに合わせる | 「削除は発行時と同じ Path で `Max-Age=0`」という新人が踏むワナとして書く |
| 4 | 手動パースが複数cookie / URLエンコードで崩れる | `Cookie` ヘッダは `k1=v1; k2=v2` 形式で、値がエンコードされる場合がある | `; ` で split → 最初の `=` で分割 → `decodeURIComponent`。まず1つだけで動かす | 「組込は parse 不要」という CookieMap の利点を具体的に裏付ける |
| 5 | `bun init` の対話プロンプトで止まる | headless 実行で対話待ちになる | `bun init -y`（非対話フラグ）を使う | 再現手順の注意書きとして明記（CI/headless での再現性） |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術と比べて感じた違い（手動 Set-Cookie / cookie-parser との差）:
- スクショを撮った箇所:
- 記事に書きたい気づき:

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・動機 | cookie を手動管理してハマった経験、なぜ Bun 組込を試すか |
| 2. なぜBunのcookie APIを試すのか | フェーズ1（事前調査） | Bun 1.3 の目玉・「外部ライブラリ不要」の位置づけ |
| 3. 事前に調べたこと（CookieMap / 自動Set-Cookie） | フェーズ1のdocs調査記録 | `get/set/delete` と `CookieInit` 既定値、自動 Set-Cookie の仕組み |
| 4. 環境構築 | フェーズ2の記録 | `bun init -y` / `Bun.serve` Hello World / Playwright 導入・詰まった点 |
| 5. CookieMapで書いてみる | フェーズ3のCookieMap版タスク | コード全文＋`curl -i` の Set-Cookie 出力 |
| 6. 手動Set-Cookieで同じことを書く | フェーズ3の手動版タスク | 手パース＋手組みコード、揃えるまでの diff |
| 7. 詰まった点（属性・削除・型） | 詰まりポイント表・記録テンプレ | エラー全文と解決過程（削除・属性一致・fetch/routes） |
| 8. 書き比べて分かったこと | フェーズ4の比較表 | 行数・型・書き味の差、Playwright での見え方 |
| 9. どんな人に向いていそうか | フェーズ5の棚卸し | Express/Hono で cookie 手動管理してきた人向け 等 |
| 10. まとめ | フェーズ5の棚卸し | 学び・次に試したいこと・公式リンク |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない
- うまくいった点だけでなく、詰まった点（特に削除・属性一致・routes/fetch）と解決過程を書く
- `curl -i` の実出力・Playwright スクショ・コードをそのまま貼る（体感でなく一次ログ）
- 公式ドキュメント（cookies docs / v1.3 blog）へのリンクを入れる
- 手順の再現性（Bun のパッチ版・OS・ポート）を明記する

## 参考リンク

- 公式ドキュメント: https://bun.com/docs/runtime/cookies （CookieMap / CookieInit / 自動Set-Cookie）
- リリース情報: https://bun.com/blog/bun-v1.3 （`request.cookies` の位置づけ・sign-in/sign-out 例・「zero overhead when unused」）
- API リファレンス: https://bun.sh/reference/bun/Cookie
- 関連記事・既知の詰まりポイント: レポート記載の Bun issues（#23615 等）は isolated install 側。cookie では削除挙動・属性一致が主な詰まりどころ

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: 無し（完全ローカル）
- ライセンス / 規約: Bun / Playwright ともに OSS。特別な制約なし
- セキュリティ（APIキーの扱い等）: 秘密情報は扱わない。`sessionId` は `randomUUIDv7()` 等のダミー値でよい。記事にはトークン実値を貼らない
- 撤退ライン: `request.cookies` が 1.3 でも使えない / 自動 Set-Cookie が出ない場合は、標準の `Bun.CookieMap` を単体（`Bun.serve` 外）で `new Bun.CookieMap()` として使い、`toSetCookieHeaders()` を手動で response に付ける形へ切り替える。それも不可なら出典レポートのテーマ2（TS 5.9 strictInference）へ切り替える

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレを埋めながら進める
- [ ] 完了条件を満たしたら「記事への写像」に沿って本文ドラフトへ展開する（run-practice → draft-article）
