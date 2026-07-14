# 検証ログ: Node 26.5 の `--experimental-import-text` で `.txt` を import して詰まった記録

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・出力ログ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-node-text-imports-20260713-0406.md`
- 出典レポート: `research/search-topic-20260713-0400.md`
- 対象技術: Node.js v26.5.0 の text imports（import attributes `with { type: 'text' }` / `--experimental-import-text` フラグ）
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-13 04:08〜04:11 / 見積もり 約4.5h → 実測 約15分（AI単独・待ち時間ほぼなし。Node導入が12秒で済んだため大幅短縮）
- 実行環境: macOS 26.5 (arm64) / 検証前の既定 Node v22.17.0 → 検証用に v26.5.0 (npm 11.17.0) を nvm で導入
- 採用した撤退ライン: 1タスク30分で詰まったら記録してスキップ。Node 26.5 導入が45分超で解決しなければ Docker `node:26` へ切替（今回は不要だった）
- 判断方針: 引数で対象タスクファイルのみ指定。その他はデフォルト前提を採用。ブラウザ確認は完了条件に含まれないため Playwright は不使用

## 結果サマリー

- 完了条件の判定: **達成**（4条件すべてを一次ログで確認）
- 作ったもの: `node:` 標準機能だけで動く最小 ESM プロジェクト（text import / fs / JSON import の3系統＋失敗パターン4種）。`workspace/`（gitignore対象）
- スクショ: 0 枚（CLI検証のためターミナル出力が証拠。ブラウザ確認は完了条件外）
- 詰まった点: 5 件（うち解決 5 / 未解決・撤退 0）
- knowledge 記録: なし（当たったエラーはすべて本タスクの検証目的＝意図した失敗。トラブルではないため未記録）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `--experimental-import-text` **なし**で実行 → エラー全文が取れている | 達成 | commands.log「no-flag.txt」: `ERR_UNKNOWN_FILE_EXTENSION` 全文 |
| 2 | フラグ**あり**で実行 → `.txt` の中身が文字列として出力される | 達成 | commands.log「with-flag.txt」: 4行のテキストを出力、exit 0 |
| 3 | `with { type: 'text' }` 省略/誤記の失敗パターンのエラー全文が取れている | 達成 | 「no-attr.txt」「wrong-type.txt」「missing.txt」「named.txt」全文 |
| 4 | fs 版・JSON import 版とコード量・型・出力を比較した表ができている | 達成 | 「fs-version.txt」「json-version.txt」＋下記比較表 |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査

- [x] text imports の仕様4点を確認（見積もり 30分 → 実測 数分、裏取り済み一次情報を採用）
  - 確認したこと（対象タスクの裏取り済み情報と実測で整合）:
    - `--experimental-import-text` フラグが**必須**（付けないと失敗）
    - 構文 `import x from './f.txt' with { type: 'text' };`、`with { type: 'text' }` は**省略不可**
    - 公開されるのは **default export のみ**（named 不可）→ 実測で `SyntaxError` 確認
    - Stability: **1.0 - Early development**（実行時に `ExperimentalWarning` が出ることを実測）
  - 比較用: JSON imports（`with { type: 'json' }`）は安定・**フラグ不要**、値はパース済みオブジェクト → 実測で確認
  - 記事に書きたい気づき: 「JSON import はフラグ不要だったので text も同じ感覚で無フラグにすると詰まる」導線が実測で裏付けられた

### フェーズ2: 環境構築（Node 26.5）

- [x] `node -v` で既定バージョンを記録（見積もり 5分 → 実測 即時）
  - 実行したコマンド:
    ```bash
    node -v
    ```
  - 出力: `v22.17.0`
  - つまずいた理由: 既定環境が v22.17.0 で text imports 自体が存在しない。ここが出発点の詰まり

- [x] nvm で Node 26.5 系を導入し切替（見積もり 25分 → 実測 12秒）
  - 実行したコマンド:
    ```bash
    export NVM_DIR="$HOME/.nvm"
    source /opt/homebrew/opt/nvm/nvm.sh
    nvm ls-remote | grep v26   # v26.0.0 〜 v26.5.0 が候補に出る
    nvm install 26             # v26.5.0 が入る
    node -v                    # → v26.5.0
    ```
  - 出力（抜粋・全文は commands.log）:
    ```
    Downloading and installing node v26.5.0...
    Downloading https://nodejs.org/dist/v26.5.0/node-v26.5.0-darwin-arm64.tar.xz...
    Computing checksum with sha256sum
    Checksums matched!
    Now using node v26.5.0 (npm v11.17.0)
    ```
  - 効いた対処: homebrew 版 nvm を `source /opt/homebrew/opt/nvm/nvm.sh` で読み込んでから `nvm install 26`。`nvm ls-remote` に v26.5.0 が既にあった
  - つまずいた理由・分かっていなかった前提: homebrew の nvm は shell 起動ごとに `source` が要る（PATH に自動で入らない）。各コマンド実行前に毎回 source＋`nvm use 26` が必要だった
  - 既存技術と比べて感じた違い: 想定（25分）に対し実測12秒。バージョンマネージャが最新系を既にミラーしていれば導入は一瞬

- [x] 作業ディレクトリと `package.json`（`"type":"module"`）・`message.txt` を用意（見積もり 15分 → 実測 数分）
  - 構成: `workspace/` に `package.json`（`{"type":"module"}`）、`message.txt`（4行のUTF-8テキスト）、`data.json`、各 `.mjs`
  - つまずいた理由: `"type":"module"` が無いと `.mjs` 以外で ESM 構文が使えない。今回は `.mjs` 統一＋`"type":"module"` で二重に担保

### フェーズ3: 実装・検証【本編】

- [x] `main.mjs` に text import を書く（見積もり 15分 → 実測 数分）
  - 書いたコード全文:
    ```js
    import msg from './message.txt' with { type: 'text' };
    console.log('=== text import ===');
    console.log(msg);
    ```

- [x] フラグ**なし**で実行しエラー全文を保存（見積もり 20分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node main.mjs
    ```
  - 出力 / エラー（全文）:
    ```
    node:internal/modules/esm/get_format:243
      throw new ERR_UNKNOWN_FILE_EXTENSION(ext, filepath);
            ^

    TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".txt" for /Users/.../workspace/message.txt
        at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:243:9)
        at defaultGetFormat (node:internal/modules/esm/get_format:283:36)
        at defaultLoadSync (node:internal/modules/esm/load:161:16)
        at #loadAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:809:12)
        at #loadSync (node:internal/modules/esm/loader:841:53)
        at ModuleLoader.load (node:internal/modules/esm/loader:790:26)
        at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:501:31)
        at #getOrCreateModuleJobAfterResolve (node:internal/modules/esm/loader:567:36)
        at afterResolve (node:internal/modules/esm/loader:614:52)
        at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:620:12) {
      code: 'ERR_UNKNOWN_FILE_EXTENSION'
    }

    Node.js v26.5.0
    ```
  - つまずいた理由・気づき: **エラーが「フラグを付けろ」とは言わない**。`.txt` は単に「未知の拡張子」として弾かれる。フラグ未指定＝機能が存在しない扱い。新人が最初にここで「なぜ？」となる核心

- [x] フラグ**あり**で実行し成功出力を保存（見積もり 15分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node --experimental-import-text main.mjs
    ```
  - 出力（全文）:
    ```
    (node:89451) ExperimentalWarning: Text import is an experimental feature and might change at any time
    (Use `node --trace-warnings ...` to show where the warning was created)
    === text import ===
    こんにちは、text imports！
    これは複数行のテキストファイルです。
    3行目には末尾スペースがあります
    last line without trailing newline handling test
    ```
  - 気づき: `ExperimentalWarning` は**標準エラーに出るが致命ではない**。その下にちゃんとテキストが文字列で出ている。「警告＝失敗」と誤認しやすい（詰まりポイント#6の実測）

- [x] 属性省略/誤記/存在しないファイルの3失敗パターンのエラー全文を保存（見積もり 35分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node --experimental-import-text no-attr.mjs      # with{type:'text'} を省略
    node --experimental-import-text wrong-type.mjs   # .txt に type:'json' と誤記
    node --experimental-import-text missing.mjs      # 存在しない does-not-exist.txt
    ```
  - **重要な実測**: 属性省略（no-attr）と type 誤記（wrong-type）は、**フラグなしと全く同じ** `ERR_UNKNOWN_FILE_EXTENSION`（`Unknown file extension ".txt"`）になる。つまり「フラグ無し」「属性無し」「属性が json」の3ミスは**同じ見分けのつかないエラー**に集約される
  - 存在しないファイル（missing）のエラー全文:
    ```
    node:internal/modules/esm/resolve:272
        throw new ERR_MODULE_NOT_FOUND(
              ^

    Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/.../workspace/does-not-exist.txt' imported from /Users/.../workspace/missing.mjs
        at finalizeResolution (node:internal/modules/esm/resolve:272:11)
        at moduleResolve (node:internal/modules/esm/resolve:879:10)
        at defaultResolve (node:internal/modules/esm/resolve:1006:11)
        at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
        at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
        at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
        at #resolve (node:internal/modules/esm/loader:690:17)
        at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
        at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33)
        at ModuleJob.link (node:internal/modules/esm/module_job:389:17) {
      code: 'ERR_MODULE_NOT_FOUND',
      url: 'file:///Users/.../workspace/does-not-exist.txt'
    }
    ```
  - 気づき: 誤記系は拡張子エラー、パス間違いは `ERR_MODULE_NOT_FOUND` と明確に分かれる。ただし属性系ミスの区別がつかないのが実運用の罠

- [x] named export で受け取ろうとして失敗することを確認（見積もり 20分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node --experimental-import-text named.mjs   # import { foo } from './message.txt' with {type:'text'}
    ```
  - エラー全文:
    ```
    (node:90050) ExperimentalWarning: Text import is an experimental feature and might change at any time
    (Use `node --trace-warnings ...` to show where the warning was created)
    file:///Users/.../workspace/named.mjs:2
    import { foo } from './message.txt' with { type: 'text' };
             ^^^
    SyntaxError: The requested module './message.txt' does not provide an export named 'foo'
        at #asyncInstantiate (node:internal/modules/esm/module_job:463:21)
        at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
        at async ModuleJob.run (node:internal/modules/esm/module_job:561:5)
        at async node:internal/modules/esm/loader:650:26
        at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
    ```
  - 気づき: named だけは `SyntaxError`（does not provide an export named 'foo'）で、他の失敗と質が違う。「default export のみ」を身をもって確認。フラグ＋属性は正しいので `ExperimentalWarning` は出ている

- [x] `typeof` / `length` / 改行保持を確認（見積もり 15分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node --experimental-import-text inspect.mjs
    ```
  - 出力（全文）:
    ```
    (node:90060) ExperimentalWarning: Text import is an experimental feature and might change at any time
    (Use `node --trace-warnings ...` to show where the warning was created)
    typeof msg     : string
    msg.length     : 104
    lines (split n): 4
    has newline    : true
    --- JSON.stringify (改行やスペースを可視化) ---
    "こんにちは、text imports！\nこれは複数行のテキストファイルです。\n3行目には末尾スペースがあります\nlast line without trailing newline handling test"
    ```
  - 気づき: 値は素直な `string`（length 104）。改行 `\n` も末尾スペースも**そのまま保持**。加工なしのファイル内容がそのまま文字列になる

### フェーズ4: 深掘り・比較（fs / JSON import）

- [x] `fs.readFileSync` 版と比較（見積もり 25分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node fs-version.mjs   # フラグ不要
    ```
  - 出力（全文）:
    ```
    === fs.readFileSync ===
    typeof msg : string
    msg.length : 104
    こんにちは、text imports！
    これは複数行のテキストファイルです。
    3行目には末尾スペースがあります
    last line without trailing newline handling test
    ```
  - 気づき: **中身は text import と完全一致（string / length 104）**。違いは「書き味」＝ text import は静的・トップレベル・フラグ必須、fs は実行時読み込み・フラグ不要・どの Node でも動く

- [x] JSON import と比較（見積もり 20分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node json-version.mjs   # with {type:'json'}、フラグ不要
    ```
  - 出力（全文）:
    ```
    === json import ===
    typeof data : object
    data.greeting: こんにちは
    data.count   : 3
    data.tags[0] : node
    {
      greeting: 'こんにちは',
      count: 3,
      tags: [ 'node', 'esm', 'import-attributes' ]
    }
    ```
  - 気づき: JSON import は**フラグ無しで exit 0**、値は**パース済みオブジェクト**。text import はフラグ必須で値は**生文字列**。同じ import attributes 構文なのに「安定/実験」「フラグ有無」「戻り値の型」が全部違う

#### 比較表（実測）

| 観点 | text import | fs.readFileSync | JSON import |
|---|---|---|---|
| 構文 | `import x from './f.txt' with { type: 'text' }` | `readFileSync(url, 'utf8')` | `import x from './f.json' with { type: 'json' }` |
| 実行フラグ | **`--experimental-import-text` 必須** | 不要 | 不要（安定） |
| 対応バージョン | v26.5.0+（実験 / Stability 1.0） | 従来から | v23.1.0+（安定） |
| 起動時の警告 | `ExperimentalWarning` あり | なし | なし |
| 値の型 | `string`（生の文字列, length 104） | `string`（同一, length 104） | `object`（パース済み） |
| 読み込みタイミング | 静的・モジュール解決時 | 実行時（同期呼び出し） | 静的・モジュール解決時 |
| 公開 export | default のみ | 戻り値を代入 | default のみ |
| コード量 | import 1行 | import＋readFileSync呼び出し | import 1行 |

### フェーズ5: 振り返り・記事化準備

- [x] 詰まった点を4系統（バージョン/フラグ/属性/export）で棚卸し（下表）
- [x] 記事への写像を実績で埋めた（後述）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | 既定 Node v22.17.0 で機能が無い | text imports は v26.5.0 追加 | `nvm install 26` で v26.5.0 に切替 | 約12秒 | 解決 | 「まずランタイムのバージョンで詰まる」導入エピソード |
| 2 | フラグ無しで `ERR_UNKNOWN_FILE_EXTENSION` | `--experimental-import-text` 必須。JSON と違いフラグ要る | フラグ付きで再実行 | 数分 | 解決 | フラグ有無のエラー/成功を並べる。JSON感覚で無フラグにする罠 |
| 3 | 属性省略・`type:'json'` 誤記も**同じ**拡張子エラー | .txt は属性/フラグが揃わないと「未知拡張子」扱い | 正しい `with { type: 'text' }` ＋フラグ | 数分 | 解決 | 「3つの別ミスが同一エラーに集約」＝見分けにくさを表で示す |
| 4 | named import が `SyntaxError` | 公開は default のみ | `import x from ...` の default 形へ | 数分 | 解決 | 「default だけ」を実測エラーで示す |
| 5 | `ExperimentalWarning` を失敗と誤認しかける | 実験機能は警告を stderr に出す | 警告の下に成功出力があるか確認 | 数分 | 解決 | 「警告は出るが動く」で読者の不安を減らす |

> 予測（詰まりポイント表）との差分: 予測どおり5系統すべて発生。想定外だったのは **#3 で「属性省略」「型誤記」「フラグ無し」が全部同一の `ERR_UNKNOWN_FILE_EXTENSION` になる**こと（別々のメッセージを予想していた）。また Node 導入が45分想定→12秒で終わり撤退ライン（Docker切替）は不要だった。

## スクリーンショット一覧

なし（CLI 検証のためスクショは撮っていない）。完了確認の証拠はすべて `commands.log` と `workspace/logs/*.txt` のターミナル出力。ブラウザ表示は本タスクの完了条件に含まれないため Playwright は使用しなかった。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ログ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 実行の前提 | Node 26.5（2026-07-08 追加、調査5日後）の新機能を新人が試す動機 |
| 2. なぜtext importsを試すのか | フェーズ1 | 鮮度・実験段階（Stability 1.0）・JSON import は知っていたという入口 |
| 3. 事前に調べたこと | フェーズ1 | `with { type }` 構文、JSON安定・text実験の位置づけ4点 |
| 4. 環境構築（Node 26.5） | フェーズ2ログ（nvm install） | `nvm install 26`＋homebrew nvm の `source` 必要。既定v22→v26.5切替 |
| 5. 実際に試したこと | フェーズ3 with-flag / main.mjs | import 1行のコードとフラグ付き成功出力（ExperimentalWarning含む） |
| 6. 詰まった点（フラグ・属性エラー） | フェーズ3 失敗系＋「詰まった点」表 | no-flag/no-attr/wrong-type が同一エラー、missing、named の全文 |
| 7. 触ってみて分かったこと | フェーズ3 inspect.txt | default only、string、改行・末尾スペース保持、length 104 |
| 8. fs/JSON importと比べて感じたこと | フェーズ4＋比較表 | フラグ有無・型（string/object）・静的/実行時の違い |
| 9. どんな人に向いていそうか | フェーズ5棚卸し | 設定/テンプレ埋め込み用途。実験段階で本番採用は慎重に |
| 10. まとめ | 結果サマリー＋詰まった点表 | 学び（属性＋フラグ必須）・次に試す Blob textStream 等 |

## 未達・撤退した項目

なし。全フェーズ・全完了条件を達成。撤退ライン（Docker切替、テーマ#2切替）は発動せず。

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS 26.5 (arm64) / Node **v26.5.0**（npm 11.17.0）。text imports は **v26.5.0 以上必須**
- 最短の再現手順:
  ```bash
  nvm install 26                     # v26.5.0
  mkdir demo && cd demo
  echo '{"type":"module"}' > package.json
  printf 'line1\nline2\n' > message.txt
  printf "import m from './message.txt' with { type: 'text' };\nconsole.log(m);\n" > main.mjs
  node main.mjs                       # → ERR_UNKNOWN_FILE_EXTENSION（フラグ無しは失敗）
  node --experimental-import-text main.mjs   # → 中身が文字列で出る（ExperimentalWarning付き）
  ```
- 注意点:
  - `--experimental-import-text` と `with { type: 'text' }` は**両方**必要。どちらか欠けると `ERR_UNKNOWN_FILE_EXTENSION`（同一メッセージ）で見分けにくい
  - 公開は **default export のみ**（named は `SyntaxError`）
  - `ExperimentalWarning` は stderr に出るが致命ではない（Stability 1.0 の実験機能）
  - `package.json` に `"type":"module"` を入れるか `.mjs` を使う
  - 実験機能のため**将来 API が変わりうる**

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] スクショは無し。コードとエラー全文（`commands.log`）を本文に引用する
- [ ] 完了条件・詰まった点（特に #3 同一エラー）・比較表を本文に落とす
