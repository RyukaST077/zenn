# 検証ログ: Bunの組込cookie(Bun.CookieMap)で、手動Set-Cookieと書き比べてみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-bun-cookiemap-20260720-0404.md`
- 出典レポート: `research/search-topic-20260720-0401.md`
- 対象技術: Bun 1.3 系の `Bun.serve()` 組込 cookie（`request.cookies` = `Bun.CookieMap`）
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-20 04:06 / 見積もり 約4.2h → 実測 約0.1h（AI単独・非対話のため人の粒度とは異なる）
- 実行環境: macOS (Darwin 25.5.0, arm64) / Node v22.17.0 / **Bun 1.3.14 (0d9b296a)** / Playwright 1.61.1 (chromium v1228 / Chrome for Testing 149)
- 採用した撤退ライン: 1タスクで30分以上詰まったら記録してスキップ or 等価手段へ（デフォルト）。実際には撤退ゼロ
- 判断方針: 引数はタスクパスのみ。時間・スキルレベルは無指定のためデフォルト（半日 / 新人）を採用

## 結果サマリー

- 完了条件の判定: **達成**（3エンドポイントが両版で同挙動 / `Set-Cookie` 値が byte 一致 / Playwright スクショ取得）
- 作ったもの: CookieMap版 `server.ts` と手動版 `server-manual.ts`（3エンドポイント）＋検証用 `check.ts`。`workspace/` 参照
- スクショ: 2 枚（`screenshots/01-cookiemap.png`, `02-manual.png`）
- 詰まった点: 4 件（うち解決 4 / 未解決・撤退 0）
- knowledge 記録: なし（既知の詰まりポイント表の範囲内で解決。新規トラブルなし）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `/sign-in` `/whoami` `/sign-out` が両版で同じ挙動 | 達成 | `logs/cookiemap.txt` / `logs/manual.txt`（両版とも sign-in で発行→whoami で本人確認→sign-out で削除ヘッダ） |
| 2 | `curl -i` で両版の `Set-Cookie` 文字列が一致 | 達成 | UUIDをマスクして diff 一致（本文「フェーズ3」参照）。sign-in / sign-out 両方一致 |
| 3 | Playwright で cookie 状態をスクショ | 達成 | `screenshots/01-cookiemap.png` / `02-manual.png`（`context.cookies()` を表描画）+ `logs/playwright.log` |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 30分 → 実測 ~2分）

- [x] `bun --version` が 1.3 系か確認
  - 実行したコマンド:
    ```bash
    bun --version   # → 1.3.14
    node --version  # → v22.17.0
    ```
  - 結果: `1.3.14`。1.3 系のため `request.cookies` が使える前提を満たす（1.2以前ならアップグレードが必要だった）
- [x] 公式 cookie docs を読み `CookieMap` / `CookieInit` 既定値を控える
  - 出典: https://bun.com/docs/runtime/cookies
  - 記録: `set(name, value)` の既定は **`{ path: "/", sameSite: "lax" }`**。`secure`/`httpOnly`/`maxAge`/`expires`/`domain`/`partitioned` を指定可。`delete()` は「空値＋過去の expiry を付与」で削除。`Bun.serve()` では **`req.cookies` への変更が自動で Set-Cookie に反映**される。docs の例は **`routes` ハンドラのみ**（`fetch` ハンドラでの可否は明記なし → 後で実検証）
- [x] 手動版で再現すべき Set-Cookie 属性を一覧化
  - 揃える軸: `HttpOnly` / `SameSite=Strict` / `Max-Age=3600` / `Path=/`。削除は `Max-Age=0` か過去 `Expires`（どちらを Bun が吐くかは実出力で確認する）

### フェーズ2: 環境構築（見積もり 40分 → 実測 ~3分）

- [x] `bun init -y` で最小プロジェクト初期化（対話プロンプト回避）
  - 実行したコマンド:
    ```bash
    bun init -y
    ```
  - 出力（全文）:
    ```
     + .gitignore
     + CLAUDE.md
     + index.ts
     + tsconfig.json (for editor autocomplete)
     + README.md

    bun install v1.3.14 (0d9b296a)
    Resolved, downloaded and extracted [5]
    Saved lockfile
    + @types/bun@1.3.14
    + typescript@5.9.3 (v7.0.2 available)
    5 packages installed [746.00ms]
    ```
  - つまずき: なし。`-y` で対話待ちが出ず headless で完結（詰まりポイント表 #5 を回避できた）
- [x] `Bun.serve` Hello World を `curl -i` で 200 確認
  - 実行したコマンド:
    ```bash
    bun run hello.ts &   # routes: { "/": () => new Response("ok") }, port 3000
    curl -i -s localhost:3000/
    ```
  - 出力（全文）:
    ```
    HTTP/1.1 200 OK
    content-type: text/plain;charset=utf-8
    Date: Sun, 19 Jul 2026 19:07:24 GMT
    Content-Length: 2

    ok
    ```
  - ポート衝突: なし（3000 空き）
- [x] Playwright 導入
  - 実行したコマンド:
    ```bash
    bun add -d playwright                  # playwright@1.61.1, 1.90s
    bunx playwright install chromium       # chromium-1228（本環境はキャッシュ済で即完了）
    bunx playwright install --dry-run chromium  # 導入確認: Chrome for Testing 149.0.7827.55
    ```
  - 記録: 本環境は chromium が既にキャッシュ済みだったため DL は発生せず。初回環境では chromium (Chrome for Testing) のDLが走る点は再現性メモに明記

### フェーズ3: 実装・検証【本編】（見積もり 120分 → 実測 ~5分）

- [x] **CookieMap版** `server.ts`（`routes` の `/sign-in` `/whoami` `/sign-out`）
  - `request.cookies.set("sessionId", <uuid>, { httpOnly:true, sameSite:"strict", maxAge:3600, path:"/" })`、`get`、`delete` を実装。UUID は `Bun.randomUUIDv7()`
  - **要確認だった点（fetch ハンドラで cookies が使えるか）を実検証**: `/fetch-whoami` を `fetch` ハンドラに置き `typeof req.cookies` を出力
  - `curl` 出力（全文, `logs/cookiemap.txt`）:
    ```
    ===== 1) sign-in =====
    HTTP/1.1 200 OK
    Set-Cookie: sessionId=019f7bc7-3e89-7000-86c7-e22b6142e7f1; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict
    ...
    ===== 3) sign-out =====
    HTTP/1.1 200 OK
    Set-Cookie: sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax
    ...
    ===== 4) fetch ハンドラで cookies が使えるか =====
    fetch handler: typeof req.cookies=undefined, sessionId=undefined
    ```
  - **一次情報の発見**:
    1. 自動 Set-Cookie の属性順は `Path → Max-Age → HttpOnly → SameSite`
    2. `delete` は **`Max-Age=0` ではなく過去 `Expires`（`Fri, 1 Jan 1970 00:00:00 -0000`）** を吐く
    3. `delete("sessionId")` の Set-Cookie は **`SameSite=Lax`（既定へ戻る）で、`HttpOnly` も付かない**（発行時の Strict/HttpOnly は引き継がれない）
    4. **`fetch` ハンドラでは `req.cookies` が `undefined`。`request.cookies` は `routes` ハンドラ専用**（docs 通り。実地で確認）
- [x] **手動版** `server-manual.ts`（`fetch` ハンドラで手パース＋手組み）
  - `parseCookies()`: `"; "` split → 最初の `=` で分割 → `decodeURIComponent`
  - **第1版（素朴な手組み）の Set-Cookie**:
    ```
    set-cookie: sessionId=...; HttpOnly; SameSite=Strict; Max-Age=3600; Path=/   ← sign-in（属性順が逆）
    set-cookie: sessionId=; Max-Age=0; Path=/                                    ← sign-out（Max-Age=0で消そうとした / SameSite欠落）
    ```
  - **`diff`（Set-Cookie 行抽出）の結果**:
    ```
    < Set-Cookie: sessionId=<uuid>; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict   (CookieMap版)
    < Set-Cookie: sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax
    ---
    > set-cookie: sessionId=<uuid>; HttpOnly; SameSite=Strict; Max-Age=3600; Path=/   (手動版 第1版)
    > set-cookie: sessionId=; Max-Age=0; Path=/
    ```
  - ズレた箇所: (a) ヘッダ名の大小 `Set-Cookie` vs `set-cookie`、(b) sign-in の属性順、(c) sign-out の削除方式（`Max-Age=0` vs 過去 `Expires`）＋ `SameSite` 欠落
- [x] 手動版を CookieMap版に揃える（diff 一致まで）
  - 直した箇所:
    - 属性順を `Path; Max-Age; HttpOnly; SameSite` に並べ替え
    - sign-out を `sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax` に変更
    - ヘッダ名: `new Headers()` の `set("Set-Cookie", ...)` で設定（値は一致。ただし curl 上の表示大小差は HTTP 的に等価なので値で比較）
  - **最終 diff（UUIDマスク後）**:
    ```
    sessionId=<UUID>; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict
    sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax
    >>> 完全一致（Set-Cookie 値が両版で同一）
    ```

### フェーズ4: 深掘り・比較（見積もり 30分 → 実測 ~3分）

- [x] Playwright で両版を開き `context.cookies()` を取得＋スクショ（`check.ts`）
  - `context.cookies()` の中身（`logs/playwright.log`, 両版とも同一）:
    ```json
    { "name": "sessionId", "domain": "localhost", "path": "/",
      "httpOnly": true, "secure": false, "sameSite": "Strict" }
    ```
  - HttpOnly cookie は `document.cookie` では見えないが `context.cookies()` で取得できた。両版でブラウザ側の見え方（httpOnly / sameSite / path）は同一
  - スクショ: `screenshots/01-cookiemap.png`, `02-manual.png`（whoami 応答＋cookie 表）
- [x] before/after 比較表
  - 行数: `server.ts`(CookieMap版) 44行 / `server-manual.ts`(手動版) 47行 ※どちらもコメント・検証コード込み。**本質的な差は手動版が `parseCookies()` ヘルパ（約12行）を自前で持つ点**（CookieMap版は parse 不要）
  - 型: `CookieMap.get()` の戻り値は **`string | null`**（`bunx tsc` で `Type 'string | null' is not assignable to type 'number'` を確認）。手動版の `Record<string,string>` からの `cookies["sessionId"]` は `string`（キー欠落時 `undefined` を型で表現できず null チェックが甘くなりがち）
  - 削除の書き味: CookieMap版 `req.cookies.delete("sessionId")` の1行 vs 手動版は削除用 Set-Cookie 文字列（過去 Expires）を手組み

| 観点 | CookieMap版 | 手動版 |
|---|---|---|
| cookie の読み取り | `req.cookies.get()`（parse不要） | `parseCookies()` を自前実装（~12行） |
| Set-Cookie 生成 | `set()` が自動生成・自動付与 | 文字列を手組み・`Headers` に手動 set |
| 削除 | `delete("sessionId")` 1行 | 空値＋過去 `Expires` を手組み |
| `get` の型 | `string \| null`（null 強制） | `string \| undefined`（緩くなりがち） |
| 属性の付け忘れ | 既定 `path:/` `sameSite:lax` が自動 | `HttpOnly`/順序/削除方式を落としやすい |
| 使える場所 | **`routes` のみ**（`fetch` は undefined） | `fetch` でも `routes` でも（自前なので） |

### フェーズ5: 振り返り・記事化準備（見積もり 30分 → 実測 ~実行中）

- [x] 詰まった点の棚卸し（下表）
- [x] 記事への写像を実績で埋める（下記）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `fetch` ハンドラで `req.cookies` が `undefined` | `request.cookies` は `routes` ハンドラ専用（docs例も routes のみ） | cookie を使う処理は `routes` に置く。`fetch` 側では自前パースが必要 | 即 | 解決 | 「routes と fetch どちらで使えるか」を実出力(`typeof=undefined`)で示す（日本語で薄い一次情報） |
| 2 | 手動版の `Set-Cookie` が CookieMap版と一致しない | 属性順・削除方式・SameSite 欠落 | `diff` で差分特定→属性順を `Path;Max-Age;HttpOnly;SameSite` に、削除を過去Expiresに合わせる | 数分 | 解決 | before/after で「手書きは属性1つ落とすと壊れる」を diff 付きで見せる |
| 3 | cookie 削除の挙動が直感と違う | Bun の `delete` は `Max-Age=0` ではなく**過去 `Expires`**。しかも `SameSite=Strict`/`HttpOnly` を引き継がず `SameSite=Lax` で出す | CookieMap版の削除ヘッダを `curl -i` で確認し、手動版もそれに合わせる | 数分 | 解決 | 「削除は発行時と同じ Path で、Bun は過去 Expires を吐く」新人のワナとして書く |
| 4 | 手パースの取り扱い（複数cookie/エンコード） | `Cookie` ヘッダは `k1=v1; k2=v2`、値がエンコードされることがある | `"; "` split→最初の`=`で分割→`decodeURIComponent`。まず1つで動かす | 即 | 解決 | 「組込は parse 不要」という CookieMap の利点を具体で裏付ける |

> 予測（詰まりポイント表）との差分: #5「bun init の対話待ち」は `-y` で最初から回避でき、詰まらなかった。逆に**予測になかった発見**として「削除ヘッダが SameSite=Lax に戻り HttpOnly も落ちる」点が出た（#3 の深掘り）。

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/01-cookiemap.png | CookieMap版: whoami応答＋`context.cookies()`（httpOnly:true, sameSite:Strict, path:/） | 8. 書き比べて分かったこと |
| screenshots/02-manual.png | 手動版: 同上。ブラウザ側の見え方が CookieMap版と同一であることの証跡 | 8. 書き比べて分かったこと |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | cookie を手動管理してハマった経験、なぜ Bun 組込を試すか |
| 2. なぜBunのcookie APIを試すのか | フェーズ1 | Bun 1.3 の目玉・「外部ライブラリ不要」の位置づけ |
| 3. 事前に調べたこと | フェーズ1 docs調査 | `get/set/delete` と `CookieInit` 既定値（`path:/`, `sameSite:lax`）、自動 Set-Cookie |
| 4. 環境構築 | フェーズ2ログ | `bun init -y` / `Bun.serve` Hello World / Playwright 導入。`-y` で対話回避 |
| 5. CookieMapで書いてみる | `workspace/server.ts` / `logs/cookiemap.txt` | コード全文＋自動生成 Set-Cookie の実出力 |
| 6. 手動Set-Cookieで同じことを書く | `workspace/server-manual.ts` / `logs/manual.txt` | 手パース＋手組み、揃えるまでの diff |
| 7. 詰まった点（属性・削除・型） | 「詰まった点」表 / curl 全文 | fetch/routes・削除方式・属性一致（#1〜#4） |
| 8. 書き比べて分かったこと | フェーズ4比較表 / screenshots/01,02 | 行数(parse有無)・型(`string\|null`)・書き味、Playwright での見え方 |
| 9. どんな人に向いていそうか | フェーズ5棚卸し | Express/Hono で cookie 手動管理してきた人向け 等 |
| 10. まとめ | 結果サマリー | 学び・次に試したいこと・公式リンク |

## 未達・撤退した項目

- なし（全フェーズ達成、撤退ゼロ）

## 再現性メモ（記事に転記する用）

- OS / ランタイム / ライブラリ: macOS (arm64) / **Bun 1.3.14** / Playwright 1.61.1 (chromium v1228)
- 最短の再現手順:
  ```bash
  bun init -y
  # server.ts に CookieMap版 routes を書く → bun run server.ts
  curl -i -c j.txt localhost:3000/sign-in
  curl -i -b j.txt localhost:3000/whoami
  curl -i -b j.txt localhost:3000/sign-out
  # server-manual.ts に手動版を書く（port 3001）→ diff で Set-Cookie を揃える
  bun add -d playwright && bunx playwright install chromium
  bun run check.ts   # context.cookies() + スクショ
  ```
- 注意点:
  - `request.cookies` は **`Bun.serve` の `routes` ハンドラ専用**。`fetch` ハンドラでは `undefined`
  - Bun の cookie **削除は過去 `Expires`** を吐き、`SameSite=Lax` に戻る（発行時の Strict/HttpOnly は引き継がれない）
  - Bun 1.2 以前は `request.cookies` が無い（1.3 系必須）
  - ポート 3000/3001 を使用（衝突時は変更）

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/<slug>.md を作成する（run-practice → draft-article）
- [ ] スクショを Zenn 用に `images/<slug>/` へ移し本文から参照する
- [ ] 完了条件・詰まった点（特に削除挙動と routes/fetch）・比較表を本文に落とす
