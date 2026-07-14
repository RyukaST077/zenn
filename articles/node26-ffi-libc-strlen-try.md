---
title: "Node 26 の node:ffi で libc の strlen を呼んでみた"
emoji: "🔌"
type: "tech"
topics: ["nodejs", "ffi", "javascript", "libc"]
published: true
---

## はじめに

Node 26 の話題というと Temporal が既定になった件が中心で、自分もそっちを先に触っていました。ただリリースノートを眺めていたら、実験的な `node:ffi` というモジュールが増えていて、これは「JS から C の関数を直接呼べる」やつらしい、と知りました。ネイティブ関数を呼ぶには今まで C++ アドオン（node-gyp でビルドして…）が必要というイメージだったので、ビルドなしで呼べるなら面白そうだと思って手を動かしてみました。

やったことは、libc の `strlen` と `abs` を JS から呼ぶだけの最小スクリプトを書いて、成功パターンと、わざと失敗させたときの挙動を並べて観察する、というものです。結論から言うと `strlen('hello')` は無事 `5n` を返してくれたんですが、そこに至るまでにフラグ・BigInt・不正アドレスでのクラッシュと、それぞれ別の詰まり方をしました。その記録です。

:::message
筆者はネイティブ連携をちゃんとやったことがない新人寄りのエンジニアで、FFI を触るのは初めてです。実行環境は macOS 26.5（Darwin 25.5.0, arm64）/ Node v26.5.0（nvm 経由、npm 11.17.0）。`node:ffi` は experimental なので、この記事の内容も将来変わる可能性があります。
:::

## なぜ試すのか（C++アドオンとの違い）

これまで JS からネイティブ関数を叩くには C++ アドオンという一式が必要でした。`binding.gyp` を書いて、`node-gyp` でビルドして、N-API でラッパを実装して `.node` を生成する…という流れで、C/C++ のツールチェーンが前提になります。個人的にはここで腰が重くなって手を出さずにいた領域でした。

`node:ffi` はそのビルド工程が丸ごと要りません。`.mjs` を数行書いて `--experimental-ffi` を付けて実行するだけで `strlen` や `abs` が呼べました。手軽さは段違いです。

ただ、後述するように「1箇所間違えるとプロセスごと SIGSEGV で落ちる」ので、手軽さと引き換えに危うさもセットです。experimental で API も変わりうるし、Permission Model の下では明示的な許可も要ります。軽く試す・プロトタイプ用途には向いていそうですが、本番投入はまだ早いという位置づけだと感じました。

## 事前に調べたこと

ドキュメントを読む前に、まず実際に import して何が入っているか見てみました。

```bash
node --experimental-ffi -e "import('node:ffi').then(m=>console.log('ok', Object.keys(m)))"
```

出力（エクスポートされているキー一覧）:

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

ここから分かったのは、基本は `dlopen(path, definitions)` で、戻り値の `functions.<name>(...)` を呼ぶ形だということ。型は `types` 定数で指定します（`types.POINTER` / `types.UINT_64` / `types.INT_32` など）。

型指定で最初に迷ったのがここで、`types.UINT_64` のような定数で書くのか、`'u64'` のような短縮名で書くのか、という点です。試したところ **`types.*` 定数でも `'u64'` のような短縮名でも通りました**。なお `types.UINT_64` の実体は `'uint64'` という文字列定数なので、定数で書いても値の文字列そのもの（`'uint64'`）で書いても同義になります。未知の型名だけは `dlopen` の時点で `TypeError: Unsupported FFI type` になります。この二層構造（定数と短縮名がどっちも通る）はキー一覧を眺めているだけだと気づきにくいところでした。

もう一つ、フラグが2種類あるのも先に把握しておきました。

- `--experimental-ffi` … そもそも `node:ffi` を存在させるためのフラグ。無いとモジュール自体が見つからない。
- `--allow-ffi` … `--permission`（Permission Model）を有効にしたときだけ意味を持つ、「FFI を使ってよいか」の権限フラグ。

役割が別レイヤなので、場面によっては両方必要になります。これは後半の Permission Model のところで実演します。

## 環境構築（Node のバージョン確認）

まず手元のデフォルトの Node を確認したら v22 でした。

```bash
$ node -v
v22.17.0
```

この状態では `node:ffi` は存在しません。nvm で 26 を入れます。

```bash:setup.sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm install 26 && nvm use 26
node -v
```

出力:

```
v26.5.0 is already installed.
Now using node v26.5.0 (npm v11.17.0)
v26.5.0
```

ここで一度つまずきました。スクリプトの中で `nvm` を呼ぼうとすると `nvm: command not found` になります。nvm はバイナリではなくシェル関数なので、`. "$NVM_DIR/nvm.sh"` で読み込まないと使えません。あと `nvm use 26` はそのシェルセッション限りなので、別のシェルで素の `node -v` を打つとデフォルトの v22 に戻っています。当たり前かもしれませんが、最初これで「あれ、26 にしたのに」と混乱しました。

導入した Node が FFI 搭載ビルドかどうかも確認しました。配布バイナリに FFI が含まれない可能性を心配していたので。

```bash
node --experimental-ffi -e "import('node:ffi').then(m=>console.log('ok', Object.keys(m).length))"
```

これで先ほどのキー一覧が返ってきたので、少なくとも nvm 経由の v26.5.0（macOS arm64）には FFI が入っている、と確認できました。ここは環境依存だと思うので「自分の環境では入っていた」という限定つきの話です。

## 実際に試したこと（strlen / abs）

本編。まず libc の `strlen` を呼びます。

```js:step2-strlen.mjs
// libc の strlen を JS から呼ぶ（成功パス）
import { dlopen, types } from 'node:ffi';
const { STRING, POINTER, UINT_64 } = types;
// dlopen(null, ...) でメインプログラム/グローバルシンボル（libc含む）を引く
const { functions } = dlopen(null, {
  strlen: { arguments: [POINTER], return: UINT_64 },
});
const r = functions.strlen('hello');
console.log('strlen("hello") =', r, '/ typeof =', typeof r, '/ === 5n:', r === 5n);

// arguments を STRING にしても呼べる（JS文字列をNUL終端UTF-8にコピー）
const { functions: f2 } = dlopen(null, {
  strlen: { arguments: [STRING], return: UINT_64 },
});
console.log('STRING arg strlen("日本語") =', f2.strlen('日本語'), '(=UTF-8バイト数)');
```

`dlopen(null, ...)` の `null` は、特定のライブラリファイルではなくメインプログラム/グローバルシンボル（libc を含む）を引く、という意味です。実行してみます。

```bash
node --experimental-ffi step2-strlen.mjs
```

出力:

```
(node:21858) ExperimentalWarning: FFI is an experimental feature and might change at any time
strlen("hello") = 5n / typeof = bigint / === 5n: true
STRING arg strlen("日本語") = 9n (=UTF-8バイト数)
```

`5` ではなく `5n` で返ってくるのがまず新鮮でした。`typeof` は `bigint` です（理由は次の節）。

もう一つ面白かったのが `"日本語"` を渡したときで、返り値は文字数の 3 ではなく **9** でした。`arguments` を `STRING` にすると JS 文字列を NUL 終端の UTF-8 にコピーして C 側に渡すので、`strlen` はそのバイト長を数えます。日本語3文字は UTF-8 だと 9 バイトなので 9、というわけです。「文字数じゃないんだ」とここでも一瞬止まりました。

次に `abs`。

```js:step3-abs.mjs
// libc の abs を呼ぶ。32bit整数は number で返る
import { dlopen } from 'node:ffi';
const { functions } = dlopen(null, {
  abs: { arguments: ['i32'], return: 'i32' },
});
const r = functions.abs(-42);
console.log('abs(-42) =', r, '/ typeof =', typeof r, '/ === 42:', r === 42);
```

```
(node:21883) ExperimentalWarning: FFI is an experimental feature and might change at any time
abs(-42) = 42 / typeof = number / === 42: true
```

`abs` の戻り値は `42`（`number`）です。`strlen` は `5n`（`bigint`）だったのに、`abs` は普通の `number`。この違いは詰まりポイントに直結したので次の節でまとめます。

## 詰まった点と解決

### バージョンを上げたのに `No such built-in module`

一番最初にやったのが「フラグを付けずに import したらどうなるか」でした。

```js:step1-noflag.mjs
// フラグ無しで node:ffi を import するとどうなるか
import { dlopen } from 'node:ffi';
const { functions } = dlopen(null, { strlen: { arguments: ['pointer'], return: 'u64' } });
console.log(functions.strlen('hello'));
```

`--experimental-ffi` を付けずに実行:

```bash
node step1-noflag.mjs
```

:::details エラー全文
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
:::

厄介なのは、このエラー文言（`No such built-in module: node:ffi`）が「Node が古くて FFI がそもそも無い」場合とまったく同じという点でした。バージョンは 26.5.0 なのに古いときと同じことを言われるので、「あれ、26 でもまだ入ってないのか？」と一瞬バージョンを疑ってしまいます。実際は `--experimental-ffi` を付けるとモジュールが出現するだけの話でした。切り分けとしては、エラーの末尾に出ている `Node.js v26.5.0` を見てバージョンは足りていると確認し、原因はフラグだ、と気づける形です。

### 戻り値が `5` じゃなくて `5n`

`strlen` の戻りが `5n` だったのは前述のとおりで、これは 64bit 整数（`u64` / `i64`）が BigInt でやり取りされる仕様のためです。32bit（`i32` など）は `number`。だから `abs` は `42`、`strlen` は `5n` になります。

これ自体は仕様を知れば済む話なんですが、number と混ぜると即例外になります。わざと `5n + 1` をやってみました（後述の型ミス実験の一部）。`TypeError: Cannot mix BigInt and other types, use explicit conversions` が出ます。BigInt 戻り値を後続で普通の数値と足したりすると、ここで転びます。

### 型を1つ間違えるとどうなるか

FFI は unsafe と説明されているので、わざと型を間違えたら何が起きるか、安全そうな範囲でまとめて試しました。

```js:step4-wrongtype.mjs
// 型を故意に誤ったときの挙動（クラッシュしない安全な範囲）
import { dlopen } from 'node:ffi';

// (1) 戻り値を u64 ではなく i32 と誤宣言 → 小さい値なら number として返り「一見動く」
{
  const { functions } = dlopen(null, { strlen: { arguments: ['pointer'], return: 'i32' } });
  const r = functions.strlen('hello');
  console.log('[1] return を i32 に誤宣言: strlen("hello") =', r, '/ typeof =', typeof r,
              '=> 値は合うが型が number（u64 なら 5n のはず）');
}

// (2) BigInt(u64) と number を混ぜて演算 → TypeError
try {
  const { functions } = dlopen(null, { strlen: { arguments: ['pointer'], return: 'u64' } });
  const r = functions.strlen('hello'); // 5n
  console.log('[2] r + 1 を試す ...');
  console.log(r + 1);
} catch (e) {
  console.log('[2] BigInt + number:', e.constructor.name + ':', e.message);
}

// (3) pointer 引数に number を渡す → Node が引数型を検証して TypeError
try {
  const { functions } = dlopen(null, { strlen: { arguments: ['pointer'], return: 'u64' } });
  console.log('[3] strlen(12345) を試す ...');
  console.log(functions.strlen(12345));
} catch (e) {
  console.log('[3] number を pointer に:', e.constructor.name + ':', e.message);
}

// (4) 存在しない型名 → TypeError（dlopen 時点で弾かれる）
try {
  dlopen(null, { strlen: { arguments: ['pointer'], return: 'banana' } });
} catch (e) {
  console.log('[4] 未知の型名:', e.constructor.name + ':', e.message);
}
```

```
(node:21887) ExperimentalWarning: FFI is an experimental feature and might change at any time
[1] return を i32 に誤宣言: strlen("hello") = 5 / typeof = number => 値は合うが型が number（u64 なら 5n のはず）
[2] r + 1 を試す ...
[2] BigInt + number: TypeError: Cannot mix BigInt and other types, use explicit conversions
[3] strlen(12345) を試す ...
[3] number を pointer に: TypeError: Argument 0 must be a buffer, an ArrayBuffer, a string, or a bigint
[4] 未知の型名: TypeError: Unsupported FFI type: banana
```

個人的に一番怖いと思ったのが [1] です。`strlen` の戻りを `u64` ではなく `i32` と誤って宣言しても、値が小さいうちは `5`（number）で「一見ちゃんと動いている」ように見えます。BigInt にならないので、後続コードで型を BigInt 前提にしていると静かに崩れます。値が 2^31 を超えると壊れた値になり得るはずで、小さい入力で試している間は気づけない、というのが嫌なところでした。

一方 [3] は予想より安全側でした。pointer に number を渡すと、Node が引数の型を検証して `TypeError` で弾いてくれます（segfault にはならない）。渡せるのは buffer / ArrayBuffer / string / bigint のいずれか、というメッセージも出ます。[4] の未知の型名も `dlopen` の時点で弾かれるので、実行前に気づけます。

つまり「引数の JS 型はある程度チェックしてくれる」。では本当に危険なのは何かというと、型は合っているのに中身（アドレス）が不正なケースでした。

### 型が合っていてもアドレスが不正だと落ちる（SIGSEGV）

pointer には bigint を「生ポインタ値」として渡せます。型チェックは通ります。なので、適当な値を渡してみました。

```js:step4b-crash.mjs
// 【危険】不正な生アドレス(bigint)を pointer として渡すと、任意メモリを
// 参照してプロセスが SIGSEGV でクラッシュする（JS例外にはならない）。unsafe の実演。
import { dlopen } from 'node:ffi';
const { functions } = dlopen(null, { strlen: { arguments: ['pointer'], return: 'u64' } });
console.log('calling strlen(0xdeadbeefn) — junk アドレスを参照します...');
const r = functions.strlen(0xdeadbeefn); // ここで即クラッシュ
console.log('r =', r, '(ここには到達しない)');
```

```
(node:21891) ExperimentalWarning: FFI is an experimental feature and might change at any time
calling strlen(0xdeadbeefn) — junk アドレスを参照します...
```

出力はここで止まり、プロセスの終了コードは **139**（= 128 + 11 = SIGSEGV）でした。`0xdeadbeefn` は型としては受理されるものの、その先の任意メモリを `strlen` が読みに行った瞬間にセグフォルトします。JS の例外は投げられないので、`try/catch` では拾えません。プロセスごと落ちます。

これが「unsafe」の実感でした。型を正しく書いていても、値（アドレス）が不正ならこうなる。誤りを試すときは使い捨てのディレクトリで、1箇所ずつ別プロセスで、というのは守ったほうがよさそうです。

:::message alert
不正なアドレスを pointer に渡すと `try/catch` では止められず、プロセスが SIGSEGV で落ちます。実験は本番と関係ないディレクトリ・別プロセスで行うのが無難です。
:::

## Permission Model と `--allow-ffi`

事前調査で「フラグが2種類ある」と書きましたが、その意味がここで腑に落ちました。`--permission`（Permission Model）を有効にして、先ほどの `strlen` スクリプトを実行してみます。

```bash
# 拒否パターン
node --experimental-ffi --permission step2-strlen.mjs
# 許可パターン
node --experimental-ffi --permission --allow-ffi step2-strlen.mjs
```

拒否パターンの出力:

:::details ERR_ACCESS_DENIED 全文
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
:::

許可パターン（`--allow-ffi` を足す）の出力:

```
(node:22525) SecurityWarning: The flag --allow-ffi must be used with extreme caution. It could invalidate the permission model.
(node:22525) ExperimentalWarning: FFI is an experimental feature and might change at any time
strlen("hello") = 5n / typeof = bigint / === 5n: true
STRING arg strlen("日本語") = 9n (=UTF-8バイト数)
```

`--permission` を付けると FFI は既定で拒否され、`ERR_ACCESS_DENIED`（`permission: 'FFI'`）になります。`--allow-ffi` を足すと通りますが、今度は `SecurityWarning: The flag --allow-ffi must be used with extreme caution. It could invalidate the permission model.` という警告が出ます。FFI は任意メモリ・任意コードに手が届いてしまうので、許可した時点で権限モデルを実質無効化しうる、という設計意図がそのまま警告に出ている感じでした。

experimental のフラグ（機能を出すかどうか）と permission のフラグ（使ってよいかどうか）は別レイヤ、というのが実演で分かった気がします。

## 触ってみて分かったこと

もう一つ気に入ったのがリソース解放まわりです。`dlopen(...)` の戻り値は `[Symbol.dispose]` を持っているので、`using` で自動 close できます。

```js:step5-using.mjs
// using による自動 close と、明示 close() の二重呼び出しが no-op なこと
import { dlopen } from 'node:ffi';
{
  using handle = dlopen(null, { strlen: { arguments: ['pointer'], return: 'u64' } });
  console.log('using ブロック内: strlen("hi") =', handle.functions.strlen('hi'));
} // <- ここで [Symbol.dispose] が呼ばれ lib.close() される
console.log('using ブロックを抜けた（自動 dispose 済み）');

// 明示 close の二重呼び出し
const h2 = dlopen(null, {});
console.log('close #1'); h2.lib.close();
console.log('close #2（no-op のはず）'); h2.lib.close();
console.log('二重 close でも例外なし');
```

```
(node:21895) ExperimentalWarning: FFI is an experimental feature and might change at any time
using ブロック内: strlen("hi") = 2n
using ブロックを抜けた（自動 dispose 済み）
close #1
close #2（no-op のはず）
二重 close でも例外なし
```

`using` を使うとブロックを抜けたときに自動で close されるので、解放の書き忘れをしにくいです。明示的に `lib.close()` を呼んでもよく、二重に呼んでも例外にはならず no-op でした。

C++ アドオンとの比較でいうと、今回は `binding.gyp` もビルドも一切なしで、`.mjs` 数行と `--experimental-ffi` だけで libc の関数が呼べました。手軽さは本当に段違いです。ただ、ここまで見てきたとおり型を1つ誤ると SIGSEGV で落ちるし、experimental なので API も変わりうる、Permission Model 下では明示許可が要る、というトレードオフがあります。

## どんな人に向いていそうか

- ネイティブの関数を「とりあえず JS から叩いてみたい」「プロトタイプで軽く試したい」人には、ビルド不要でかなり気軽だと思いました。
- 一方で、型やアドレスを1つ間違えるとプロセスごと落ちる（`try/catch` で拾えない）ので、本番のコードにそのまま持ち込むのはまだ早い印象です。experimental が取れて API が安定してからのほうが安心して使えそうです。

## まとめ

`strlen('hello')` → `5n`、`abs(-42)` → `42` を JS から呼ぶところまでは達成できました。そこに至るまでに、フラグ忘れで `No such built-in module`（バージョン不足と同じ文言でややこしい）、64bit 整数が BigInt で返る、型を誤ると静かに number 化する / 不正アドレスで SIGSEGV になる、といった詰まり方を一通り経験できました。

まだ触れていない領域も多くて、コールバック（C から JS を呼び返す）や構造体の受け渡しあたりは今回試せていません。そのへんは experimental の API が落ち着いてきたら改めて追ってみたいです。

再現用に最短手順を残しておきます（macOS 26.5 arm64 / Node v26.5.0 で確認）。

```bash
nvm install 26 && nvm use 26          # Node 26.x を用意
node -v                                # v26.5.0 を確認
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

注意点として、配布ビルドに FFI が含まれるかは環境依存のようです（今回は nvm の v26.5.0 / arm64 で搭載を確認できました）。

## 参考リンク

今回は公式ドキュメントを読む代わりに、実際に `node:ffi` を import して API サーフェス（エクスポートされているキーや `types`）を直接確認しながら進めました。そのため正確なドキュメント URL の裏付けは取れていません。`node:ffi` は experimental で API も変わりうるので、公式の情報を当たる場合は自分が使っている Node のバージョンに対応したドキュメント（`nodejs.org/dist/latest-v26.x/docs/api/` などのバージョン別配置）を確認してください。
