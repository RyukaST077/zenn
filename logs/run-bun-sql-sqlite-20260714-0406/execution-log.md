# 検証ログ: Bun 1.3 の Bun.SQL で SQLite を初めて触ってみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-bun-sql-sqlite-20260714-0404.md`
- 出典レポート: `research/search-topic-20260714-0400.md`
- 対象技術: Bun 1.3 系の内蔵DBクライアント `Bun.SQL`（SQLite アダプタ）／比較用に旧 `bun:sqlite`
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-14 04:06〜04:12 / 見積もり 約4.25h → 実測 約0.1h（AI単独・待ち時間はインストールのみ）
- 実行環境: macOS（Darwin 25.5.0, arm64 / MacBook Pro）/ Node v22.17.0 / Bun 1.3.14 / Playwright 1.61.1（chromium）
- 採用した撤退ライン: 対象タスク既定（30分以上「接続できない/版数が上がらない」で詰まったら `:memory:` 最小接続に切り戻し）。今回は発動せず。
- 判断方針: 引数は対象タスクファイルのパスのみ。時間・撤退ラインはデフォルト採用。API・注意書きは公式ドキュメント（bun.com/docs/runtime/sql, /docs/api/sqlite）で裏取り。

## 結果サマリー

- 完了条件の判定: **達成**（4条件すべてを CLI 出力で客観確認。下表参照）
- 作ったもの: Bun 単体で動く最小 SQLite CRUD スクリプト群（`workspace/src/*.ts`）＋旧 `bun:sqlite` 比較版＋HTML表出力。成果物: `logs/run-bun-sql-sqlite-20260714-0406/workspace/`
- スクショ: 1 枚（`screenshots/01-bun-sql-users-table.png`）
- 詰まった点: 実質ハマりなしで完走。ただし**予測どおりの落とし穴を意図的に踏んで再現**（adapter明示忘れ／lastInsertRowid=null）＝下の「詰まった点」表に一次ログ付きで記録
- knowledge 記録: なし（新規トラブルの発生なし。既知の落とし穴は本ログに記録）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `bun run src/crud.ts` がエラーなく終了し、INSERT した行が SELECT で取得でき stdout 表示 | 達成 | commands.log「[P3] bun run src/crud.ts」→「全処理が正常終了しました」。最終テーブルに #1〜#5 表示 |
| 2 | パラメータバインドで `${値}` が SQL に安全に渡り、期待した1件が返る | 達成 | 同ログ「SELECT WHERE id = ${id}」で1件取得。`${"1 OR 1=1"}` 試行で **0件**（全件化せず）＝プレースホルダとして安全 |
| 3 | `begin()` の複数書き込みがコミットされ、途中 throw でロールバックされる | 達成 | コミット後件数 5、throw 時「catch したエラー」出力後に件数 `5 -> 5`（増えず＝ロールバック成立） |
| 4 | 旧 `bun:sqlite` 版が同じ結果を返し、書き味の差分が埋まる | 達成 | commands.log「[P4] compare-old.ts」で同じ Alice/Bob を取得。差分は下記比較表 |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査

- [x] Bun 公式 SQL ドキュメントで SQLite の接続構文を確認（見積もり15分 → 実測 数分）
  - 確認したこと（公式より）:
    - import: `import { SQL } from "bun";`
    - 接続文字列パターン: `:memory:` / `sqlite://:memory:` / `file://:memory:`（インメモリ）、`sqlite://path.db` / `file://path.db`（ファイル）、`sqlite://data.db?mode=ro`（読み取り専用）
    - オブジェクト形: `new SQL({ adapter: "sqlite", filename: "./app.db", readonly, create, readwrite, strict, safeIntegers })`
    - **落とし穴（公式原文）**: 「Simple filenames without a protocol (like `"myapp.db"`) require explicitly specifying `{ adapter: "sqlite" }` to avoid ambiguity with PostgreSQL.」
    - クエリはタグ付きテンプレート `await sql\`SELECT * FROM users WHERE id = ${userId}\``。`${}` は自動エスケープされSQLインジェクション対策になる
    - 「SQLite executes queries synchronously under the hood but returns Promises for API consistency」＝内部同期でも**一貫してPromise**
  - 想定との差: 接続の書き方が3系統もあるのは想像以上。「ファイル名だけ渡すと Postgres と区別できずエラー」という設計は事前に読んでいないと必ず踏む。
- [x] 旧 `bun:sqlite` のAPIを確認し比較観点を決める（見積もり15分 → 実測 数分）
  - 確認したこと（公式より）: `import { Database } from "bun:sqlite"` → `new Database(":memory:")`。`.all()`（配列）/`.get()`（1件 or null）/`.run()`（`{ lastInsertRowid, changes }` を返す）。**完全同期**（await不要）。バインドは `?` 位置指定 or `$name`/`:name`/`@name` の名前付き。
  - 比較で見る項目: ①同期 vs Promise ②戻り値の形 ③パラメータバインドの書き方 ④INSERTのメタ情報（lastInsertRowid の有無）

### フェーズ2: 環境構築

- [x] Bun をインストールし `bun --version` を記録（見積もり15分 → 実測 ~17秒）
  - 実行したコマンド:
    ```bash
    npm install -g bun@1.3.14
    bun --version
    ```
  - 出力（全文）:
    ```
    added 2 packages in 17s
    /Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin/bun
    1.3.14
    ```
  - つまずいた理由: 事前に `bun` は未インストール（`bun not found`）。npm 経由で版数固定インストールしたため対話・認証は一切なし。
  - 記事に書きたい気づき: 「まず `bun --version` で 1.3.x を確認」は定番。npm でグローバル固定できるので nvm 環境でも導入が楽。

- [x] `bun init -y` で最小プロジェクト初期化（見積もり10分 → 実測 ~3秒）
  - 実行したコマンド:
    ```bash
    bun init -y
    ```
  - 出力（全文・抜粋）:
    ```
     + .gitignore
     + CLAUDE.md
     + index.ts
     + tsconfig.json (for editor autocomplete)
     + README.md
    bun install v1.3.14 (0d9b296a)
    + @types/bun@1.3.14
    + typescript@5.9.3 (v7.0.2 available)
    5 packages installed [2.67s]
    ```
  - 効いた対処: `-y` で対話プロンプトを回避（ハングせず）。生成 `package.json` は `"type": "module"`、`tsconfig.json` は strict 系ON・`types: ["bun"]`。
  - 記事に書きたい気づき: headless/AI実行では `bun init -y` 必須。生成物に `@types/bun` が入るので `SQL` 型補完が効く。

- [x] Hello World `new SQL(":memory:")` で `SELECT 1`（見積もり20分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    bun run hello.ts   # import { SQL } from "bun"; await sql`SELECT 1 as n`
    ```
  - 出力（全文）:
    ```
    typeof rows: object
    Array.isArray(rows): true
    rows: [
      {
        n: 1,
      }, count: 1, command: "SELECT", lastInsertRowid: null, affectedRows: null
    ]
    rows[0]: {
      n: 1,
    }
    ```
  - 既存技術と比べて感じた違い: 戻り値は**配列だが、配列オブジェクトに `count` / `command` / `lastInsertRowid` / `affectedRows` の付随プロパティが生えている**。`rows[0]` で行、`rows.count` でメタが取れる。素の配列だと思い込むと `count` の存在に気づかない。
  - 記事に書きたい気づき: `import { SQL } from "bun"` は追加インストール不要でそのまま通る。戻り値の“配列＋メタ”は最初に `console.log` して確認すべき。

### フェーズ3: 実装・検証【本編】

- [x] `src/crud.ts`：`new SQL("sqlite://app.db")` で接続し `users` テーブル作成（見積もり25分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    bun run src/crud.ts
    ls -la app.db
    ```
  - 出力（該当抜粋）:
    ```
    ===== CREATE TABLE =====
    users テーブルを作成しました
    ...
    -rw-r--r--@ 1 katayamaryuunosuke  staff  8192 Jul 14 04:09 app.db
    ```
  - 記事に書きたい気づき: `sqlite://app.db` 形式ならadapter明示なしで通り、`app.db` ファイルが実際に生成される（8192バイト）。

- [x] INSERT を `RETURNING *` で受け取り stdout 表示（見積もり25分 → 実測 数分）
  - 出力（該当抜粋）:
    ```
    ===== INSERT ... RETURNING * =====
    RETURNING で受け取った挿入行: {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
    }
    インサート結果配列の付随メタ: count = 1 , lastInsertRowid = null
    ```
  - 既存技術と比べて感じた違い: **SQLite でも `RETURNING *` が効き**、挿入行がそのまま取れる。ただし `Bun.SQL` の結果メタ `lastInsertRowid` は **null**（旧 `bun:sqlite` の `.run()` は `lastInsertRowid: 1` を返す＝下の比較参照）。採番IDが欲しいなら `RETURNING id` を使うのが素直。

- [x] SELECT＋パラメータバインド `WHERE id = ${id}`（見積もり25分 → 実測 数分）
  - 出力（該当抜粋）:
    ```
    ===== SELECT WHERE id = ${id} (パラメータバインド) =====
    id=1 の取得結果: [
      { id: 1, name: "Alice", email: "alice@example.com" },
      count: 1, command: "SELECT", lastInsertRowid: null, affectedRows: null
    ]
    戻り値は配列か: true 件数: 1

    ===== SQLインジェクション試行: id に "1 OR 1=1" を渡す =====
    WHERE id = ${"1 OR 1=1"} の結果件数: 0
    → 全件(3件)にならなければプレースホルダとして安全に渡っている
    ```
  - 記事に書きたい気づき: `${"1 OR 1=1"}` を入れても **0件**（全件化しない）。文字列がプレースホルダ値として渡り、SQLite が整数列 `id` と型比較して一致0件になる。「タグ付きテンプレ＝文字列連結」ではないと体感できる好例。

- [x] トランザクション `sql.begin(async tx => ...)`：コミットとロールバック（見積もり30分 → 実測 数分）
  - 出力（該当抜粋）:
    ```
    ===== トランザクション: 正常時は全件コミット =====
    コミット後の全件数: 5 (3 + 2 = 5 のはず)

    ===== トランザクション: 途中で throw → ロールバック =====
    catch したエラー: 意図的なエラーでロールバックを発生させる
    ロールバック前後の件数: 5 -> 5 (増えていなければ成功)
    ```
  - つまずいた理由・前提: コールバック内は必ず引数 `tx` を使う（`tx\`...\``）。throw すると自動ロールバックされ、`begin()` は例外を再送出するので外側で `try/catch` する。
  - 記事に書きたい気づき: 「throw したら1件も残らない」を件数で確認できた（5→5）。ロールバックを“見た”一次ログとして強い。

- [x] わざとエラー（存在しない列へ INSERT）→ エラー全文記録（見積もり15分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    bun run src/error.ts   # INSERT INTO users (name, age) ... 存在しない age 列
    ```
  - 出力（全文）:
    ```
    === エラーメッセージ (err.message) ===
    table users has no column named age

    === エラーの種類 (err.constructor.name) ===
    SQLiteError

    === err.code ===
    SQLITE_ERROR

    === err.errno ===
    1

    === Object.keys(err) ===
    [ "name", "code", "errno", "byteOffset" ]

    === String(err) 全文 ===
    SQLiteError: table users has no column named age
    ```
  - 記事に書きたい気づき: エラーは `SQLiteError` クラスで `.code = "SQLITE_ERROR"` / `.errno = 1` を持つ。メッセージが平易（`table users has no column named age`）で新人でも原因に辿り着ける。`.code` で分岐できる。

- [x] （追加検証）接続文字列の落とし穴を再現：`src/pitfall-adapter.ts`
  - 実行したコマンド:
    ```bash
    bun run src/pitfall-adapter.ts
    ```
  - 出力（全文）:
    ```
    === ケースA: new SQL('plain.db') プロトコル・adapter なし ===
    失敗: PostgresError - Connection closed

    === ケースB: new SQL('plain2.db', { adapter: 'sqlite' }) 明示 ===
    成功: { n: 1 }

    === ケースC: new SQL({ adapter: 'sqlite', filename: 'plain3.db' }) ===
    成功: { n: 1 }
    ```
  - 記事に書きたい気づき（目玉）: `new SQL("plain.db")` は **`PostgresError: Connection closed`** で落ちる（Bun が Postgres と解釈して接続しにいく）。`{ adapter: "sqlite" }` を明示すれば通る。公式の注意書きが具体的なエラーとして再現できた。

### フェーズ4: 深掘り・比較

- [x] 旧 `bun:sqlite` で同操作（`src/compare-old.ts`）（見積もり20分 → 実測 数分）
  - 出力（全文）:
    ```
    旧 bun:sqlite: テーブル作成完了（.run() は同期）
    insert.run() の戻り値(メタ): {
      changes: 1,
      lastInsertRowid: 1,
    }
    all(): [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" }
    ]
    get(1): { id: 1, name: "Alice", email: "alice@example.com" }
    旧 bun:sqlite: 全処理完了（await 一切なし）
    ```
  - 比較の要点は下記「書き味の差分表」。

- [x] （任意）SELECT結果をHTML表に出力し Playwright でスクショ（見積もり10分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    bun run src/to-html.ts                 # app.db を読んで result.html を生成
    npx playwright install chromium
    node shot.mjs <result.htmlの絶対パス> <出力png>
    ```
  - 出力（抜粋）:
    ```
    result.html を出力しました（ 5 件）
    screenshot saved: .../screenshots/01-bun-sql-users-table.png
    ```
  - スクショ: `screenshots/01-bun-sql-users-table.png`（Bun.SQL の `SELECT * FROM users` 結果5件をダークテーマの表で表示）
  - 記事に書きたい気づき: CLIだけで完結する検証も、結果をHTML表にして撮れば記事映えする画像にできる。

#### 旧 `bun:sqlite` と `Bun.SQL` の書き味 差分表

| 観点 | 旧 `bun:sqlite` | 新 `Bun.SQL` |
|---|---|---|
| import | `import { Database } from "bun:sqlite"` | `import { SQL } from "bun"` |
| 接続 | `new Database(":memory:")` / `new Database("f.db")` | `new SQL(":memory:")` / `new SQL("sqlite://f.db")`（ファイル名だけは `{adapter:"sqlite"}` 必須） |
| 実行モデル | **同期**（`await` 不要） | **Promise**（すべて `await`） |
| クエリの書き方 | `db.query("... WHERE id = ?").get(1)` | `` await sql`... WHERE id = ${1}` `` （タグ付きテンプレ） |
| バインド | `?` 位置 / `$name`・`:name`・`@name` 名前付き | `${値}` を式で埋める（自動エスケープ） |
| 取得API | `.all()`（配列）/ `.get()`（1件 or null）/ `.run()`（メタ） | すべてクエリが配列（＋`count`等のメタ付き）を返す |
| INSERTのID | `.run()` が `{ changes, lastInsertRowid }` を返す（lastInsertRowid=1） | 結果メタの `lastInsertRowid` は **null**。ID取得は `RETURNING` を使う |
| 新人所感 | 同期で直感的・少ないコードで読みやすい | タグ付きテンプレ＋`${}` が安全で、他DB(MySQL/PG)と同一APIになるのが利点。await忘れに注意 |

### フェーズ5: 振り返り・記事化準備

- [x] 詰まった点の棚卸し（下表）
- [x] 「記事への写像」を実績で埋める（後述）

## 詰まった点と解決過程（記事の核）

実行中の実際の挙動。予測（対象タスクの詰まりポイント表）と実際の差分も記載。今回は撤退ラインに達する大ハマりは無く、**予測された落とし穴を意図的に踏んで一次ログ化**した。

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `new SQL("plain.db")` が `PostgresError: Connection closed` で落ちる | プロトコル無しファイル名は Postgres と区別できず、既定でPGへ接続しにいく | `sqlite://` を付ける or `{ adapter: "sqlite" }` を明示（ケースB/Cで成功） | 数分 | 解決 | 「接続文字列3パターン」表＋実エラーで最重要の落とし穴として紹介 |
| 2 | 採番IDが取れない（`lastInsertRowid` が null） | `Bun.SQL` の結果メタは SQLite で lastInsertRowid を埋めない | `RETURNING *`（または `RETURNING id`）で挿入行から取得 | 数分 | 解決 | 旧 `bun:sqlite`（lastInsertRowid=1を返す）との対比で説明 |
| 3 | 戻り値を素の配列と思い込む | 実体は配列＋`count`/`command`/`affectedRows` 等のメタ付きオブジェクト | 最初に `console.log(rows)` で構造確認。行は `rows[0]`、件数は `rows.length`/`rows.count` | 数分 | 解決 | Hello World の出力を貼って「まず構造を見る」教訓に |
| 4 | （予測: await忘れ） | SQLite内部同期でも `Bun.SQL` は常にPromiseを返す | 全クエリに `await`。旧同期APIの癖に注意 | ― | 未発生（予防） | 「同期 vs Promise」を比較の目玉に |
| 5 | （予測: txでなく外側sqlを使う） | `begin(async tx=>...)` はコールバックの `tx` を使わないと境界に乗らない | コールバック内は `tx\`...\`` を徹底。throw時に件数で検証 | ― | 未発生（設計時に回避） | ロールバックを件数(5→5)で見た一次ログとして |

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/01-bun-sql-users-table.png | `Bun.SQL` の `SELECT * FROM users` 結果5件をHTML表で可視化 | 5. 実際に試したこと / 7. 触ってみて分かったこと |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | Bunを名前だけ知る新人が、内蔵DBクライアント Bun.SQL を SQLite で試す動機 |
| 2. なぜBun.SQLを試すのか | フェーズ1 / 出典レポート | 「1つのAPIで3つのDB」、1.3系でSQLite統合。今回はSQLiteのみ検証と明示 |
| 3. 事前に調べたこと | フェーズ1の記録（接続3パターン＋公式の注意書き原文） | 接続文字列3系統・旧APIとの違い・「ファイル名だけはadapter明示必須」 |
| 4. 環境構築 | フェーズ2ログ（npm i -g bun@1.3.14 / bun --version=1.3.14 / bun init -y / hello.ts出力） | インストール〜Hello World。戻り値が“配列＋メタ”な点 |
| 5. 実際に試したこと | フェーズ3ログ（crud.ts全出力）/ workspace/src/crud.ts / screenshots/01 | CREATE/INSERT(RETURNING)/SELECT+bind/トランザクション の実コードとstdout |
| 6. 詰まった点 | 「詰まった点」表 / pitfall-adapter.ts出力 / error.ts出力 | PostgresError再現・lastInsertRowid=null・配列メタ・await/tx予防 |
| 7. 触ってみて分かったこと | フェーズ3〜5の気づき | タグ付きテンプレ＋Promiseの書き味、RETURNINGの挙動、インジェクション0件の体感 |
| 8. 既存（bun:sqlite / Node）と比べて | フェーズ4の比較表 / compare-old.ts出力 | 同期 vs Promise、戻り値・lastInsertRowid・バインド記法の違い |
| 9. どんな人に向くか | フェーズ5棚卸し | Bun中心の新人・複数DBを同一APIで扱いたい人。今回はSQLiteのみ |
| 10. まとめ | 結果サマリー | 試した範囲(SQLite)と次(MySQL/PG・トランザクションの savepoint 等) |

## 未達・撤退した項目

- なし（全フェーズ完走。任意タスクのPlaywright化も実施）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS（Darwin 25.5.0, arm64）/ Bun 1.3.14 / Node v22.17.0（Playwright実行用）/ Playwright 1.61.1（chromium）
- 最短の再現手順:
  ```bash
  npm install -g bun@1.3.14      # or: curl -fsSL https://bun.sh/install | bash
  bun --version                  # 1.3.x を確認
  bun init -y
  # src/crud.ts に CREATE/INSERT(RETURNING)/SELECT(${bind})/sql.begin(tx=>...) を書く
  bun run src/crud.ts
  ```
- 注意点（ハマりどころ）:
  - 接続文字列は `sqlite://app.db` か `new SQL("app.db", { adapter: "sqlite" })`。**プロトコルなしのファイル名だけは Postgres と誤認され `PostgresError: Connection closed`**。
  - `Bun.SQL` は全クエリ Promise（`await` 必須）。SQLite内部同期でもAPIは非同期。
  - 挿入IDは結果メタの `lastInsertRowid` が null。`RETURNING` を使う。
  - トランザクションは `sql.begin(async tx => { await tx\`...\` })`。throw で自動ロールバック（`begin` が再throwするので外で catch）。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/<slug>.md を作成する（`/draft-article`）
- [ ] スクショを Zenn 用に `images/<slug>/` へ移して本文から参照する
- [ ] 完了条件・詰まった点（PostgresError/lastInsertRowid）・比較表を本文に落とす
