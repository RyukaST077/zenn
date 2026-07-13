---
title: "Bun 1.3 の Bun.SQL で SQLite を初めて触ってみた"
emoji: "🗃️"
type: "tech"
topics: ["bun", "sqlite", "typescript", "database"]
published: true
---

<!-- 前提: 出典ログ logs/run-bun-sql-sqlite-20260714-0406/execution-log.md / 記事タイプ: 検証ログ・試してみた / slug: bun-sql-sqlite-crud-try / published: false -->

## はじめに

Bun という名前はなんとなく知っていて、「Node より速いランタイム」くらいの認識でした。その Bun 1.3 系に `Bun.SQL` という組み込みのDBクライアントがあり、PostgreSQL・MySQL・SQLite を同じAPIで扱えると知って気になっていました。せっかくなので、いちばん手元で試しやすい SQLite で一通り CRUD を書いてみることにしました。

やったのは、Bun 単体で動く最小の SQLite CRUD スクリプトを書いて、以下を自分の目で確認するところまでです。

- `bun run` でスクリプトが最後まで通り、INSERT した行が SELECT で取れる
- タグ付きテンプレートの `${値}` が SQL に安全に渡る（インジェクションにならない）
- `sql.begin()` のトランザクションがコミット／ロールバックされる
- 旧 `bun:sqlite` で同じことを書いて書き味を比べる

結論から言うと、上の4つは全部確認できました。ただ、接続文字列の書き方でいきなり `PostgresError` を踏んだり、挿入したIDが取れずに戸惑ったりと、地味に引っかかる箇所があったので、その辺を中心に残しておきます。

:::message
筆者は実務経験の浅いエンジニアで、Bun を触るのはほぼ初めてです。今回試した範囲は SQLite のみ（PostgreSQL / MySQL は未検証）。実行環境は macOS（Darwin 25.5.0, arm64）/ Bun 1.3.14 です。
:::

## 使ったもの・環境

- OS: macOS（Darwin 25.5.0, arm64 / MacBook Pro）
- Bun: 1.3.14
- Node: v22.17.0（後半のスクショ撮影に使った Playwright 用）
- 対象: Bun 組み込みの `Bun.SQL`（SQLite アダプタ）／比較用に旧 `bun:sqlite`

「できた」と言える完了条件は、上の「はじめに」に挙げた4つを CLI 出力で確認できること、としました。

参考にしたのは Bun 公式のドキュメントです。

- https://bun.com/docs/runtime/sql
- https://bun.com/docs/api/sqlite

## 事前に調べたこと

いきなり書き始める前に、接続まわりだけ公式を読みました。`Bun.SQL` の import と接続文字列はこんな感じです。

```ts
import { SQL } from "bun";

// インメモリ
new SQL(":memory:");
new SQL("sqlite://:memory:");

// ファイル
new SQL("sqlite://app.db");

// オブジェクト形（明示的に adapter を指定）
new SQL({ adapter: "sqlite", filename: "./app.db" });
```

接続の書き方が3系統くらいあって、思ったより幅がありました。そして公式にこういう注意書きがあります。

> Simple filenames without a protocol (like `"myapp.db"`) require explicitly specifying `{ adapter: "sqlite" }` to avoid ambiguity with PostgreSQL.

要するに「プロトコルなしのファイル名だけ渡すと PostgreSQL と区別がつかないので、`{ adapter: "sqlite" }` を明示してね」ということ。これを読んでいなかったら確実に踏むやつだな、と思いました（実際あとで意図的に踏みます）。

クエリはタグ付きテンプレートで書き、`${}` は自動でエスケープされてSQLインジェクション対策になる、とのこと。

```ts
await sql`SELECT * FROM users WHERE id = ${userId}`;
```

もう一つ気になったのが、公式の「SQLite executes queries synchronously under the hood but returns Promises for API consistency」という記述。SQLite は内部的には同期実行だけど、APIの一貫性のために常に Promise を返す、と。旧 `bun:sqlite` は完全同期（`await` 不要）だったので、ここが書き味の違いになりそうです。

## 環境構築

手元に Bun が入っていなかったので、npm 経由でバージョンを固定して入れました。

```bash
npm install -g bun@1.3.14
bun --version
```

出力はこれだけ。

```
added 2 packages in 17s
/Users/<user>/.nvm/versions/node/v22.17.0/bin/bun
1.3.14
```

nvm 環境でも npm でグローバルに固定できたので、導入は楽でした。次にプロジェクトを初期化します。

```bash
bun init -y
```

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

`-y` を付けると対話プロンプトを飛ばせます。生成された `package.json` は `"type": "module"`、`tsconfig.json` は strict 系ON・`types: ["bun"]` になっていて、`@types/bun` が入るので `SQL` の型補完がそのまま効きました。

まず Hello World として `:memory:` に接続して `SELECT 1` を投げてみます。

```ts:hello.ts
import { SQL } from "bun";

const sql = new SQL(":memory:");

const rows = await sql`SELECT 1 as n`;
console.log("typeof rows:", typeof rows);
console.log("Array.isArray(rows):", Array.isArray(rows));
console.log("rows:", rows);
console.log("rows[0]:", rows[0]);

await sql.close();
```

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

ここでちょっと「ん?」となりました。戻り値は配列なんですが、その配列オブジェクトに `count` / `command` / `lastInsertRowid` / `affectedRows` という付随プロパティが生えています。行は `rows[0]`、件数などのメタは `rows.count` で取れる、という形です。素の配列だと思い込むと `count` の存在に気づかないので、最初に `console.log(rows)` して構造を見ておいてよかったです。`import { SQL } from "bun"` は追加インストールなしでそのまま通りました。

## 実際に試したこと（本編）

本編は `src/crud.ts` に、CREATE / INSERT(RETURNING) / SELECT(バインド) / トランザクションをまとめて書きました。接続はファイルDBにしています。

```ts:src/crud.ts
import { SQL } from "bun";

// sqlite:// プロトコル付きのファイル DB
const sql = new SQL("sqlite://app.db");

// --- CREATE TABLE ---
await sql`DROP TABLE IF EXISTS users`;
await sql`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT
)`;

// --- INSERT with RETURNING ---
const name = "Alice";
const email = "alice@example.com";
const inserted = await sql`
  INSERT INTO users (name, email)
  VALUES (${name}, ${email})
  RETURNING *
`;
console.log("RETURNING で受け取った挿入行:", inserted[0]);
console.log("インサート結果配列の付随メタ: count =", (inserted as any).count,
  ", lastInsertRowid =", (inserted as any).lastInsertRowid);
```

`sqlite://app.db` 形式なら adapter を明示しなくても通り、実際に `app.db` ファイルが生成されました。

```
-rw-r--r--@ 1 <user>  staff  8192 Jul 14 04:09 app.db
```

INSERT は `RETURNING *` を付けると挿入行がそのまま返ります。

```
===== INSERT ... RETURNING * =====
RETURNING で受け取った挿入行: {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
}
インサート結果配列の付随メタ: count = 1 , lastInsertRowid = null
```

SQLite でも `RETURNING *` が効くのは嬉しかったです。ただ、結果メタの `lastInsertRowid` は `null` でした。この点は後で旧APIと比べます。

次に SELECT のパラメータバインド。ついでに、`${}` にSQLっぽい文字列を突っ込んでみて挙動を見ました。

```ts:src/crud.ts
const id = 1;
const selected = await sql`SELECT * FROM users WHERE id = ${id}`;
console.log("id=1 の取得結果:", selected);

// SQLインジェクション試行
const evil = "1 OR 1=1";
const injectionAttempt = await sql`SELECT * FROM users WHERE id = ${evil}`;
console.log(`WHERE id = \${"1 OR 1=1"} の結果件数:`, injectionAttempt.length);
```

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

`"1 OR 1=1"` を渡しても結果は0件でした（末尾の「全件(3件)」はスクリプトが出す固定メッセージで、この時点でINSERT済みなのは Alice の1件だけです。トランザクションでの追加は後段）。もし `${}` が文字列連結なら `WHERE id = 1 OR 1=1` と展開されて既存の行が一致してしまうはずですが、実際は `"1 OR 1=1"` という文字列がプレースホルダの値として渡り、整数列 `id` と型比較されて一致0件になります。「タグ付きテンプレ＝ただの文字列結合」ではない、と体感できる例でした。

最後にトランザクション。`sql.begin(async tx => ...)` で、正常時のコミットと、途中で throw したときのロールバックを件数で確認します。

```ts:src/crud.ts
// 正常時は全件コミット
await sql.begin(async (tx) => {
  await tx`INSERT INTO users (name, email) VALUES (${"Dave"}, ${"dave@example.com"})`;
  await tx`INSERT INTO users (name, email) VALUES (${"Erin"}, ${"erin@example.com"})`;
});

// 途中で throw → ロールバック
try {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO users (name, email) VALUES (${"Frank"}, ${"frank@example.com"})`;
    throw new Error("意図的なエラーでロールバックを発生させる");
  });
} catch (e) {
  console.log("catch したエラー:", (e as Error).message);
}
```

```
===== トランザクション: 正常時は全件コミット =====
コミット後の全件数: 5 (3 + 2 = 5 のはず)

===== トランザクション: 途中で throw → ロールバック =====
catch したエラー: 意図的なエラーでロールバックを発生させる
ロールバック前後の件数: 5 -> 5 (増えていなければ成功)
```

コールバック内は引数の `tx` を使うのがポイントで（外側の `sql` を使うとトランザクション境界に乗らない）、throw すると自動でロールバックされます。`begin()` は例外を再送出するので、外側で `try/catch` する形です。ロールバック後も件数が 5 → 5 で増えていないので、Frank の挿入が巻き戻ったことが件数で見えました。

SELECT の結果をHTML表にして Playwright で撮ったのがこれです。5件が入っている状態です。

![Bun.SQL で SELECT * FROM users した結果5件をHTML表で表示](/images/bun-sql-sqlite-crud-try/01-bun-sql-users-table.png)

## 詰まった点と解決

### 接続文字列でいきなり PostgresError

いちばん引っかかったのがここです。事前調査で読んだ「プロトコルなしのファイル名は adapter 明示が必要」という注意書きを、実際にどうなるのか確かめたくて、わざと3パターン並べてみました。

```ts:src/pitfall-adapter.ts
import { SQL } from "bun";

// ケースA: プロトコル・adapter なし
try {
  const sql = new SQL("plain.db");
  const rows = await sql`SELECT 1 as n`;
  console.log("成功:", rows[0]);
  await sql.close();
} catch (e) {
  console.log("失敗:", (e as Error).constructor.name, "-", (e as Error).message);
}

// ケースB: adapter を明示
try {
  const sql = new SQL("plain2.db", { adapter: "sqlite" });
  const rows = await sql`SELECT 1 as n`;
  console.log("成功:", rows[0]);
  await sql.close();
} catch (e) {
  console.log("失敗:", (e as Error).constructor.name, "-", (e as Error).message);
}

// ケースC: オブジェクト形で adapter + filename
try {
  const sql = new SQL({ adapter: "sqlite", filename: "plain3.db" });
  const rows = await sql`SELECT 1 as n`;
  console.log("成功:", rows[0]);
  await sql.close();
} catch (e) {
  console.log("失敗:", (e as Error).constructor.name, "-", (e as Error).message);
}
```

結果はこうなりました。

```
=== ケースA: new SQL('plain.db') プロトコル・adapter なし ===
失敗: PostgresError - Connection closed

=== ケースB: new SQL('plain2.db', { adapter: 'sqlite' }) 明示 ===
成功: { n: 1 }

=== ケースC: new SQL({ adapter: 'sqlite', filename: 'plain3.db' }) ===
成功: { n: 1 }
```

`new SQL("plain.db")` は `PostgresError: Connection closed` で落ちます。ファイル名だけだと Bun が PostgreSQL だと解釈して接続しにいくためで、SQLite のつもりで書いていると「なんで Postgres?」と一瞬混乱します。対処は簡単で、`sqlite://` を付けるか `{ adapter: "sqlite" }` を明示すればOK（ケースB・C）。公式の注意書きが、そのまま具体的なエラーとして再現できました。本編で `sqlite://app.db` と書いていたのは、これを避けるためです。

### 挿入したIDが `lastInsertRowid` から取れない

前述のとおり、INSERT の結果メタ `lastInsertRowid` が `null` でした。採番されたIDが欲しいときにここを見ると詰まります。`Bun.SQL` では素直に `RETURNING *`（IDだけなら `RETURNING id`）を使って挿入行から取るのがよさそうです。旧 `bun:sqlite` の `.run()` は `lastInsertRowid: 1` を返してくれるので、その癖のまま来ると戸惑うポイントでした（比較は次の節）。

### わざとエラーを出して、エラーの形を見ておく

エラー時にどんなオブジェクトが飛んでくるかも見ておきました。存在しない列に INSERT します。

```ts:src/error.ts
import { SQL } from "bun";
const sql = new SQL("sqlite://app.db");

try {
  await sql`INSERT INTO users (name, age) VALUES (${"Zoe"}, ${20})`;
} catch (e) {
  const err = e as any;
  console.log(err.message);
  console.log(err.constructor.name);
  console.log(err.code);
  console.log(err.errno);
  console.log(Object.keys(err));
}
```

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

エラーは `SQLiteError` クラスで、`.code = "SQLITE_ERROR"` / `.errno = 1` を持っていました。メッセージも `table users has no column named age` と平易で、新人でも原因に辿り着けます。`.code` で分岐もできそうです。

### 踏まずに済んだところ

`await` 忘れと、トランザクションで `tx` ではなく外側の `sql` を使ってしまう、というのは事前に気をつけたので今回は起きませんでした。ただ SQLite が内部同期なだけに、旧APIの感覚のまま書くと `await` を落としそうだな、とは思いました。ここは正直「たまたま踏まなかった」だけかもしれません。

## 分かったこと・旧 bun:sqlite との比較

比較用に、旧 `bun:sqlite` で同じ「作成→INSERT→SELECT」を書きました。

```ts:src/compare-old.ts
import { Database } from "bun:sqlite";

const db = new Database(":memory:");

// CREATE（同期・.run()）
db.query(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`).run();

// INSERT（名前付きバインド $name）
const insert = db.query(`INSERT INTO users (name, email) VALUES ($name, $email)`);
const info = insert.run({ $name: "Alice", $email: "alice@example.com" });
console.log("insert.run() の戻り値(メタ):", info);

// SELECT（同期・.all() / .get()）
const all = db.query(`SELECT * FROM users`).all();
const one = db.query(`SELECT * FROM users WHERE id = ?`).get(1);

db.close();
```

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

書き味の違いを表にするとこんな感じでした。

| 観点 | 旧 `bun:sqlite` | 新 `Bun.SQL` |
|---|---|---|
| import | `import { Database } from "bun:sqlite"` | `import { SQL } from "bun"` |
| 接続 | `new Database(":memory:")` / `new Database("f.db")` | `new SQL(":memory:")` / `new SQL("sqlite://f.db")`（ファイル名だけは `{adapter:"sqlite"}` 必須） |
| 実行モデル | 同期（`await` 不要） | Promise（すべて `await`） |
| クエリの書き方 | `db.query("... WHERE id = ?").get(1)` | `` await sql`... WHERE id = ${1}` `` |
| バインド | `?` 位置 / `$name`・`:name`・`@name` 名前付き | `${値}` を式で埋める（自動エスケープ） |
| 取得API | `.all()`（配列）/ `.get()`（1件 or null）/ `.run()`（メタ） | すべてクエリが配列（＋`count` 等のメタ付き）を返す |
| INSERTのID | `.run()` が `{ changes, lastInsertRowid }`（lastInsertRowid=1） | 結果メタの `lastInsertRowid` は null。ID取得は `RETURNING` |

旧 `bun:sqlite` は同期で書けるぶんコードが短く、SQLite 単体で見ると直感的です。一方 `Bun.SQL` はタグ付きテンプレ＋`${}` で安全に書けて、しかも PostgreSQL / MySQL でも同じAPIになるのが利点だと感じました。同期の癖のまま `await` を落とさないよう注意、というのが正直な感想です。

## まとめ

やりたかった4つ（CRUD が通る／バインドが安全／トランザクションのコミット・ロールバック／旧APIとの比較）は全部確認できました。詰まったのは接続文字列の `PostgresError` と `lastInsertRowid` が null の2点で、どちらも「事前に公式を読んでおけば避けられるけど、読まずに書くと確実に踏む」タイプでした。

今回は SQLite だけを触った範囲なので、次は同じAPIで PostgreSQL / MySQL に繋いだときに本当にコードがそのまま流用できるのか、あとトランザクションの savepoint あたりも試してみたいです。

Bun 中心で開発していて、将来的に複数のDBを同じ書き方で扱いたい人には、`Bun.SQL` は覚えておく価値がありそうだな、という手応えでした。

## 参考リンク

- Bun 公式: SQL（https://bun.com/docs/runtime/sql）
- Bun 公式: SQLite（`bun:sqlite`）（https://bun.com/docs/api/sqlite）
