# 検証ログ: Node 26 の `node:ffi` で JS から libc を呼んで詰まった記録

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・出力）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-node-ffi-20260715-0405.md`
- 出典レポート: `research/search-topic-20260715-0402.md`
- 対象技術: Node.js 26.x の実験的 `node:ffi` モジュール（`--experimental-ffi` / Permission Model 時 `--allow-ffi`）
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-15 04:08 / 見積もり 約4.25h → 実測 約0.4h（AI単独） <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5（Darwin 25.5.0）/ arm64 / Node v26.5.0（npm 11.17.0）/ nvm 導入済み。検証前のデフォルトは Node v22.17.0（FFI 非搭載）
- 採用した撤退ライン: 1タスクで30分以上進まない、または人手/課金が必須と判明したら記録してスキップ or 等価手段へ。導入した Node に FFI が無ければ次候補へ切替（→ 実際は FFI 搭載を確認できたため切替不要）
- 判断方針: 引数で渡されたのは対象タスクファイルのみ。時間・スキルレベルは無指定のためデフォルト前提（半日 / Web系新人）を採用。ブラウザ表示が無いため Playwright は不使用（CLI 出力＝完了判定の証拠）

## 結果サマリー

- 完了条件の判定: **達成**（`strlen('hello')` → `5n`、`abs(-42)` → `42`、3種の詰まりログ＝フラグ忘れ／型ミス／Permission 拒否 をすべて取得）
- 作ったもの: `node:ffi` で libc の `strlen`/`abs` を呼ぶ最小スクリプト群（`step1〜step5`, `step4b-crash`）。`workspace/`（gitignore対象）＋ 実行出力を `step-logs/*.txt` に保存
- スクショ: 0 枚（ブラウザ表示なし。完了判定はすべて CLI 標準出力/終了コード）
- 詰まった点: 5 件（うち解決 5 / 未解決・撤退 0）
- knowledge 記録: なし（既知トラブルなし。新規で記録すべき環境トラブルも発生せず）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `--experimental-ffi` 付きで `strlen('hello')` が `5n`（BigInt）を返す | 達成 | `step-logs/step2.txt`：`strlen("hello") = 5n / typeof = bigint / === 5n: true` |
| 2 | `abs(-42)` が `42`（number）を返す | 達成 | `step-logs/step3.txt`：`abs(-42) = 42 / typeof = number / === 42: true` |
| 3 | ①フラグ無しのエラー全文 ②型を誤った時の挙動 ③`--permission` で `--allow-ffi` 無しだと弾かれる の3つがログに残る | 達成 | ①`step-logs/step1.txt`（`ERR_UNKNOWN_BUILTIN_MODULE`）②`step-logs/step4.txt`（型ミス4種）③`step-logs/step6-perm-denied.txt`（`ERR_ACCESS_DENIED`） |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 30分 → 実測 数分）

- [x] 公式 API 相当の情報を **実行時の API サーフェスから直接** 把握（docs を読む代わりに `node:ffi` を実際に import して構造を確認）
  - 実行したコマンド:
    ```bash
    node --experimental-ffi -e "import('node:ffi').then(m=>console.log('ok', Object.keys(m)))"
    ```
  - 出力 / エラー（全文）:
    ```
    (node:15227) ExperimentalWarning: FFI is an experimental feature and might change at any time
    ok [
      'DynamicLibrary','default','dlclose','dlopen','dlsym','exportArrayBuffer',
      'exportArrayBufferView','exportBuffer','exportString','getFloat32','getFloat64',
      'getInt16','getInt32','getInt64','getInt8','getRawPointer','getUint16','getUint32',
      'getUint64','getUint8','setFloat32','setFloat64','setInt16','setInt32','setInt64',
      'setInt8','setUint16','setUint32','setUint64','setUint8','suffix','toArrayBuffer',
      'toBuffer','toString','types'
    ]
    ```
  - 分かったこと:
    - `dlopen(path, definitions)` は `{ lib, functions, [Symbol.dispose] }` を返す。`functions.<name>(...)` で呼ぶ。
    - 型は **`types` 定数**で指定する（`types.STRING`/`types.POINTER`/`types.UINT_64`/`types.INT_32` など）。値は文字列（`"string"`/`"pointer"`/`"uint64"`/`"int32"`）。
    - **短縮エイリアス（`'u64'`/`'i32'`/`'pointer'`）も受け付ける**（実測。詰まった点#4参照）。ただし未知の型名は `dlopen` 時点で `TypeError: Unsupported FFI type` になる。
    - 64bit 整数（`u64`/`i64`）は **BigInt** でやり取り。32bit（`i32` など）は number。
    - `suffix = 'dylib'`（macOS の共有ライブラリ拡張子）。
  - 記事に書きたい気づき: 「型を文字列で書くのか定数で書くのか」で最初迷う。`types.*` 定数が正式だが短縮名も通る、という二層構造は docs だけ読むと気づきにくい。

- [x] `--experimental-ffi` と `--allow-ffi` の二重ゲートを把握
  - 記録: `--experimental-ffi` は「そもそも `node:ffi` を存在させる」ゲート（無いと `No such built-in module`）。`--allow-ffi` は Permission Model（`--permission`）を有効にした時だけ意味を持つ「FFI を使ってよいか」の権限ゲート。役割が別レイヤなので **両方必要になる場面がある**（フェーズ4で実演）。

### フェーズ2: 環境構築（見積もり 45分 → 実測 数分）

- [x] 現行バージョン確認（26 未満であること）
  - 実行したコマンド: `node -v`
  - 出力: `v22.17.0` → `node:ffi` は存在しない（出発点）
- [x] `nvm install 26 && nvm use 26`
  - 実行したコマンド:
    ```bash
    export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
    nvm ls-remote | grep v26.   # v26.0.0 〜 v26.5.0 が提供済み
    nvm install 26 && nvm use 26
    node -v
    ```
  - 出力（全文）:
    ```
    v26.5.0 is already installed.
    Now using node v26.5.0 (npm v11.17.0)
    v26.5.0
    ```
  - つまずいた理由・分かっていなかった前提: **nvm はシェル関数**なので、非対話スクリプト内では `. "$NVM_DIR/nvm.sh"` で読み込まないと `nvm: command not found` になる。素の `node -v` はデフォルト（v22.17.0）を指したままで、`nvm use 26` はそのシェルセッション限りである点に注意。
- [x] 導入した Node が FFI 搭載ビルドか確認（撤退ラインの分岐点）
  - 実行したコマンド:
    ```bash
    node --experimental-ffi -e "import('node:ffi').then(m=>console.log('ok', Object.keys(m).length))"
    ```
  - 結果: **FFI 搭載ビルドだった**（`ok 35` 相当、キー一覧はフェーズ1参照）。公式配布バイナリ（nvm 経由の v26.5.0 / macOS arm64）に FFI が含まれることを確認。→ 撤退（次候補への切替）は不要。
  - 記事に書きたい気づき: 「配布ビルドに FFI が入っていない可能性」を事前に心配していたが、少なくとも nvm の v26.5.0（macOS arm64）では入っていた。ここは環境依存なので記事では「自分の環境では入っていた」と限定して書く。

### フェーズ3: 実装・検証【本編】（見積もり 120分 → 実測 十数分）

- [x] `step1-noflag.mjs`：フラグ無しで `import 'node:ffi'`
  - 実行したコマンド: `node step1-noflag.mjs`（`--experimental-ffi` 無し）
  - 出力 / エラー（全文）:
    ```
    node:internal/modules/esm/translators:478
        throw new ERR_UNKNOWN_BUILTIN_MODULE(url);
              ^

    Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:ffi
        at ModuleLoader.builtinStrategy (node:internal/modules/esm/translators:478:11)
        at #translate (node:internal/modules/esm/loader:441:20)
        at afterLoad (node:internal/modules/esm/loader:509:29)
        at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:514:12)
        at #getOrCreateModuleJobAfterResolve (node:internal/modules/esm/loader:567:36)
        at afterResolve (node:internal/modules/esm/loader:614:52)
        at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:620:12)
        at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33)
        at ModuleJob.link (node:internal/modules/esm/module_job:389:17)
        at new ModuleJob (node:internal/modules/esm/module_job:368:26) {
      code: 'ERR_UNKNOWN_BUILTIN_MODULE'
    }

    Node.js v26.5.0
    ```
  - つまずいた理由・分かっていなかった前提: **このエラーは「Node が古くて FFI が無い」場合と全く同じ文言**（`No such built-in module: node:ffi`）。つまり Node 26 に上げても、フラグを付け忘れると「バージョンが足りないのか？」と誤診しやすい。実際は `--experimental-ffi` を付けるとモジュールが出現する。
  - 記事に書きたい気づき: 記事タイトルにできる王道の詰まり。「バージョン上げたのにまだ `No such built-in module` と言われる → 実はフラグ忘れ」の切り分けを図示する。

- [x] `step2-strlen.mjs`：`strlen('hello')` → `5n`
  - 実行したコマンド: `node --experimental-ffi step2-strlen.mjs`
  - 出力（全文）:
    ```
    (node:21858) ExperimentalWarning: FFI is an experimental feature and might change at any time
    strlen("hello") = 5n / typeof = bigint / === 5n: true
    STRING arg strlen("日本語") = 9n (=UTF-8バイト数)
    ```
  - コード要点: `dlopen(null, { strlen: { arguments: [types.POINTER], return: types.UINT_64 } })`。`dlopen(null, ...)` でメイン/グローバルシンボル（libc の `strlen`）が引ける。
  - 記事に書きたい気づき: 戻り値が `5` ではなく **`5n`（BigInt）** で返る瞬間。`arguments` を `STRING` にすると JS 文字列を NUL 終端 UTF-8 にコピーして渡すため、`"日本語"` は文字数3ではなく **UTF-8 バイト数9** が返る（`strlen` はバイト長を数える）。ここも「文字数じゃないの？」で驚けるポイント。

- [x] `step3-abs.mjs`：`abs(-42) === 42`（number）
  - 実行したコマンド: `node --experimental-ffi step3-abs.mjs`
  - 出力（全文）:
    ```
    (node:21883) ExperimentalWarning: FFI is an experimental feature and might change at any time
    abs(-42) = 42 / typeof = number / === 42: true
    ```
  - 記事に書きたい気づき: 32bit 整数（`i32`）は **number**、64bit（`u64`/`i64`）は **BigInt**。この戻り値型の使い分けが FFI を書くときの地味な落とし穴。

- [x] `step4-wrongtype.mjs`：型を故意に誤る（安全な範囲）
  - 実行したコマンド: `node --experimental-ffi step4-wrongtype.mjs`
  - 出力（全文）:
    ```
    (node:21887) ExperimentalWarning: FFI is an experimental feature and might change at any time
    [1] return を i32 に誤宣言: strlen("hello") = 5 / typeof = number => 値は合うが型が number（u64 なら 5n のはず）
    [2] r + 1 を試す ...
    [2] BigInt + number: TypeError: Cannot mix BigInt and other types, use explicit conversions
    [3] strlen(12345) を試す ...
    [3] number を pointer に: TypeError: Argument 0 must be a buffer, an ArrayBuffer, a string, or a bigint
    [4] 未知の型名: TypeError: Unsupported FFI type: banana
    ```
  - つまずいた理由・分かっていなかった前提:
    - **[1] が一番怖い**：`strlen` の戻りを `u64` ではなく `i32` と誤宣言しても、値が小さいと `5`（number）で「一見動く」。BigInt にならないので後続コードの型前提が静かに崩れる。値が 2^31 を超えると誤値/破損になり得る。
    - **[2]** は予測どおり（詰まりポイント表#3）：`5n + 1` は `Cannot mix BigInt and other types`。BigInt 戻り値を number と混ぜると即例外。
    - **[3]** 予想外に安全側：pointer に number を渡すと **Node が引数型を検証して TypeError**（segfault にはならない）。渡せるのは buffer / ArrayBuffer / string / bigint。
    - **[4]** 未知の型名は `dlopen` 時点で弾かれる（実行前に気づける）。
  - 記事に書きたい気づき: 「unsafe とはいえ、Node は引数の JS 型はある程度チェックしてくれる」。本当に危険なのは “型は合っているが中身（アドレス）が不正” なケース → step4b。

- [x] `step4b-crash.mjs`：【危険】不正な生アドレスを pointer として渡す → SIGSEGV
  - 実行したコマンド: `node --experimental-ffi step4b-crash.mjs`
  - 出力（全文）:
    ```
    (node:21891) ExperimentalWarning: FFI is an experimental feature and might change at any time
    calling strlen(0xdeadbeefn) — junk アドレスを参照します...
    ```
    終了コード: **139**（= 128 + 11 = SIGSEGV）。JS 例外は投げられず、プロセスごとクラッシュ。
  - つまずいた理由・分かっていなかった前提: `0xdeadbeefn`（bigint）は「生ポインタ値」として受理される（型チェックは通る）。その先の任意メモリを `strlen` が舐めた瞬間に SIGSEGV。**try/catch では拾えない**（プロセスが落ちる）。これが「unsafe」の実感。
  - 記事に書きたい気づき: **記事の山場**。「引数の JS 型が正しくても、値が不正なアドレスならクラッシュする」を終了コード 139 付きで見せる。検証は使い捨てディレクトリ・別プロセスで、と注意喚起。

- [x] `step5-using.mjs`：`using` 自動 close＋二重 close が no-op
  - 実行したコマンド: `node --experimental-ffi step5-using.mjs`
  - 出力（全文）:
    ```
    (node:21895) ExperimentalWarning: FFI is an experimental feature and might change at any time
    using ブロック内: strlen("hi") = 2n
    using ブロックを抜けた（自動 dispose 済み）
    close #1
    close #2（no-op のはず）
    二重 close でも例外なし
    ```
  - 記事に書きたい気づき: `dlopen(...)` の戻りは `[Symbol.dispose]` を持つので **`using` で自動 close** できる（明示 `lib.close()` も可）。`close()` の二重呼び出しは例外にならず no-op。リソース解放を書き忘れにくい設計。

### フェーズ4: 深掘り・比較（見積もり 30分 → 実測 数分）

- [x] Permission Model 有効化での比較（`--allow-ffi` 有無）
  - 実行したコマンド:
    ```bash
    # 拒否パターン
    node --experimental-ffi --permission step2-strlen.mjs
    # 許可パターン
    node --experimental-ffi --permission --allow-ffi step2-strlen.mjs
    ```
  - 拒否時の出力（全文）:
    ```
    (node:22521) ExperimentalWarning: FFI is an experimental feature and might change at any time
    node:ffi:163
      throw new ERR_ACCESS_DENIED(
            ^

    Error [ERR_ACCESS_DENIED]: Access to this API has been restricted. Use --allow-ffi to manage permissions.
        at checkFFIPermission (node:ffi:163:9)
        at dlopen (node:ffi:169:3)
        at file://.../workspace/step2-strlen.mjs:5:23
        at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
        at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
        at async node:internal/modules/esm/loader:650:26
        at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
      code: 'ERR_ACCESS_DENIED',
      permission: 'FFI',
      resource: ''
    }
    ```
  - 許可時の出力（全文）:
    ```
    (node:22525) SecurityWarning: The flag --allow-ffi must be used with extreme caution. It could invalidate the permission model.
    (node:22525) ExperimentalWarning: FFI is an experimental feature and might change at any time
    strlen("hello") = 5n / typeof = bigint / === 5n: true
    STRING arg strlen("日本語") = 9n (=UTF-8バイト数)
    ```
  - 分かったこと: `--permission` を付けると FFI は既定で拒否（`ERR_ACCESS_DENIED` / `permission: 'FFI'`）。`--allow-ffi` を足すと通るが、**`SecurityWarning: --allow-ffi must be used with extreme caution. It could invalidate the permission model.`** が出る。FFI は任意メモリ・任意コードに手が届くため、権限モデルを実質無効化しうるという設計意図がそのまま警告に表れている。
  - 記事に書きたい気づき: 「二重フラグ」の意味が実演で腑に落ちる。experimental ゲート（機能を出す）と permission ゲート（使ってよいか）は別レイヤ。

- [x] C++アドオン（node-gyp / N-API）との手間比較（メモ）
  - 記録: 従来ネイティブ関数を JS から叩くには **C++ アドオン**（`node-gyp` でビルド、`binding.gyp` 記述、N-API でラッパ実装、`.node` を生成）という一式が必要で、C/C++ ツールチェーンとビルド工程が前提だった。今回の `node:ffi` は **ビルド一切なし**で、`.mjs` 数行＋`--experimental-ffi` だけで `strlen`/`abs` を呼べた。体感の手軽さは段違い。ただしトレードオフは大きく、(1) 型・ポインタの正しさを検証しないので **1つ間違えると SIGSEGV**（step4b）、(2) experimental で API が変わりうる、(3) Permission Model 下では明示許可が要る。「軽く試す・プロトタイプ」には最適だが、**本番はまだ非推奨**という位置づけ。

### フェーズ5: 振り返り・記事化準備

- [x] `step-logs/step1〜6` を見返して詰まりを棚卸し（下表）
- [x] 「記事への写像」に記録を割り当て（後述）。素材不足の見出しは無し（全10節に一次情報を紐付け済み）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | 素の `node -v` が v22 のまま／`node:ffi` が無い | デフォルト Node が v22.17.0（FFI 未搭載） | `. "$NVM_DIR/nvm.sh"` して `nvm install 26 && nvm use 26` | 数分 | 解決 | 冒頭の出発点「自分の Node では `No such built-in module`」 |
| 2 | Node 26 でもフラグ無しだと `No such built-in module: node:ffi` | エラー文言が「バージョン不足」時と同一で誤診しやすい | 実行コマンド先頭に `--experimental-ffi` を付ける | 即 | 解決 | タイトル級の王道詰まり。フラグ無し/有りのエラー対比 |
| 3 | 戻り値が `5` でなく `5n`、number と混ぜると `Cannot mix BigInt` | 64bit 整数は BigInt で返る仕様 | BigInt 前提で扱う。number と混ぜない | 即 | 解決 | number/BigInt 境界の実演（step2/step4[2]） |
| 4 | 型を `u64`/`uint64`/`types.UINT_64` のどれで書くのか迷う | 短縮エイリアスと `types` 定数が両方通る二層構造 | どれでも可。未知名は `Unsupported FFI type` で即エラー | 数分 | 解決 | 「型指定の書き方」節。`types.*` 定数を正とし短縮も可と補足 |
| 5 | 誤ったシグネチャ／不正アドレスの扱い | FFI は unsafe。JS 引数型は検証するが値(アドレス)は検証しない | 正しいシグネチャで動かし、誤りは1箇所ずつ別プロセスで観察 | 十数分 | 解決 | 山場：型 i32 誤宣言は静かに number 化(step4[1])、不正アドレスは SIGSEGV=139(step4b) |

（予測との差分：詰まりポイント表#5「配布ビルドに FFI が無い可能性」は、nvm の v26.5.0/arm64 では **入っていた**ため発生せず。#3「number 扱いでクラッシュ」は、実際は number→pointer は TypeError で弾かれ、クラッシュするのは “型は合うが不正アドレス” の時だった、という補正が入った。）

## スクリーンショット一覧

なし（ブラウザ表示を伴わない CLI 検証のため。完了判定は各 `step-logs/*.txt` の標準出力と終了コードで実施）。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ログ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに（Temporalの陰のFFI） | 前提・動機 | Node 26 の話題は Temporal 中心だが FFI が地味に強い、の切り出し |
| 2. なぜ試すのか（C++アドオンとの違い） | フェーズ4 比較メモ | ビルド不要でネイティブ関数が叩ける魅力 vs unsafe のトレードオフ |
| 3. 事前に調べたこと（experimental/unsafe） | フェーズ1（API サーフェス確認） | 二重フラグ・型指定（`types.*`／短縮名）・BigInt 戻り・安全性 |
| 4. 環境構築（Nodeバージョン確認） | フェーズ2 / `step-logs`（v22→v26） | v22 では動かない→nvm で 26 導入。nvm はシェル関数で source 必須。FFI 搭載ビルド確認 |
| 5. 実際に試したこと（strlen/abs） | `step-logs/step2.txt`, `step3.txt` / workspace の step2/step3 | 成功コードと出力（`5n` / `42`）、UTF-8バイト長の話 |
| 6. 詰まった点（フラグ忘れ・BigInt・ポインタ/型） | `step1.txt`, `step4.txt`, `step4b.txt` ＋詰まり表 | `No such built-in module` 全文、i32 誤宣言の静かな number 化、SIGSEGV=139 |
| 7. Permission Model と `--allow-ffi` | `step6-perm-denied.txt`, `step6-perm-allowed.txt` | `ERR_ACCESS_DENIED` と `SecurityWarning` の対比 |
| 8. 触ってみて分かったこと（安全性の注意） | `step5.txt` ＋ step4b | `using` 自動 close、unsafe（不正アドレスで即クラッシュ）の扱い方 |
| 9. どんな人に向いていそうか | フェーズ5 棚卸し | ネイティブ連携を軽く試したい層／本番はまだ非推奨 |
| 10. まとめ | 結果サマリー | experimental である旨・次に試すこと（callback/構造体など未検証領域） |

## 未達・撤退した項目

なし（全フェーズ達成。撤退ラインへの到達なし）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS 26.5（Darwin 25.5.0, arm64）/ Node **v26.5.0**（nvm 経由, npm 11.17.0）。検証前デフォルトは v22.17.0
- 最短の再現手順:
  ```bash
  nvm install 26 && nvm use 26          # Node 26.x を用意（26.1+ で node:ffi 追加）
  node -v                                # v26.5.0 を確認
  # strlen 成功パス
  cat > s.mjs <<'JS'
  import { dlopen, types } from 'node:ffi';
  const { functions } = dlopen(null, { strlen: { arguments: [types.POINTER], return: types.UINT_64 } });
  console.log(functions.strlen('hello'));  // 5n
  JS
  node --experimental-ffi s.mjs          # => 5n
  # Permission Model 比較
  node --experimental-ffi --permission s.mjs             # ERR_ACCESS_DENIED
  node --experimental-ffi --permission --allow-ffi s.mjs # SecurityWarning 付きで通る
  ```
- 注意点:
  - `--experimental-ffi` を付けないと Node 26 でも `No such built-in module: node:ffi`（古い Node と同じ文言）。
  - 64bit 整数（`u64`/`i64`）は **BigInt**、32bit は number。number と BigInt を混ぜると `Cannot mix BigInt`。
  - `dlopen(null, ...)` はメイン/グローバルシンボル（libc）を引く前提。他ライブラリはパス指定（拡張子は `types`/`suffix`＝macOS で `dylib`）。
  - **unsafe**：不正アドレス（bigint）を pointer に渡すと try/catch で拾えない SIGSEGV（終了コード 139）。誤り実験は使い捨てディレクトリ・別プロセスで、1箇所ずつ。
  - 配布ビルドに FFI が含まれるかは環境依存（本検証は nvm の v26.5.0/arm64 で搭載を確認）。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] スクショは無し。代わりに `step-logs/*.txt` のログ全文とコード抜粋を本文に貼る
- [ ] 完了条件（`5n`/`42`/3種の詰まりログ）・詰まった点・C++アドオン比較を本文に落とす
