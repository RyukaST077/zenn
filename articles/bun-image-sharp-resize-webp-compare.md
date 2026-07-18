---
title: "Bun.Image で sharp なしに画像をリサイズ/WebP変換して、sharpと書き比べてみた"
emoji: "🖼️"
type: "tech"
topics: ["bun", "sharp", "image", "webp", "typescript"]
published: true
---

<!-- 前提: 出典ログ logs/run-bun-image-20260719-0407/execution-log.md / 記事タイプ: 書き比べ・検証ログ / slug: bun-image-sharp-resize-webp-compare / published: false -->

## はじめに

画像のリサイズやフォーマット変換をNode系のツールでやるとき、だいたい [sharp](https://sharp.pixelplumbing.com/) を入れると思います。定番で速いんですが、native 依存（libvips）を抱えていて、環境によってはインストールで手こずった記憶があって、正直あまりいい印象を持っていませんでした。

Bun 1.3 系には `Bun.Image` という画像処理APIが組み込みで入っていると知って、「これなら追加の依存なしで resize や WebP 変換ができるのでは」と気になったので、手元のMacで試してみました。ついでに同じ処理を sharp でも書いて、書き味・導入コスト・処理時間・出力サイズを比べています。

結論から言うと、WebP 変換は Bun.Image だけで問題なく動きました。ただ「AVIF は自分のチップでは失敗するはず」と身構えていた部分が拍子抜けで通ってしまったり、処理時間の計測が思ったよりブレたりと、事前の予想と実測がずれるところが何箇所かあって、そこがいちばんの学びでした。

:::message
筆者は新人寄りのエンジニアで、Bun.Image を触るのは初めてです。実行環境は macOS 26.5 / arm64（Apple M2 Pro）/ bun 1.3.14 / node v22.17.0。この記事の数値やAVIFの可否は、この環境で測った結果です。
:::

## 使ったもの・環境

- 対象技術: Bun 1.3.14 の組み込み画像処理API `Bun.Image`
- 比較対象: `sharp@0.35.3`
- ランタイム: bun 1.3.14 / node v22.17.0
- OS / チップ: macOS 26.5 / arm64 / Apple M2 Pro

やりたかったこと（＝「できた」と言える条件）は次の3つでした。

1. `Bun.Image` で「読み込み → リサイズ → WebP出力 → 保存」ができる
2. sharp でも同じ処理を書いて、両者の出力サイズ・処理時間をコンソールに出す
3. Bun.Image 版は追加の `node_modules`（native ビルド）なしで動く

## 事前に調べたこと

まず [Bun.Image のドキュメント](https://bun.sh/docs/api/image) を読んで、API の形を確認しました。

- `Bun.file("x.png").image()` から `.resize(...)` → `.webp({...})` のようにチェーンして、最後に `.write()` で保存する形。終端メソッドには `.write()` / `.bytes()` / `.buffer()` / `.metadata()` / `.toBase64()` / `.dataurl()` などがある。
- resize には `fit`（`inside` など）、`filter`（既定は `lanczos3`）、`withoutEnlargement` といったオプションがある。
- 出力フォーマットのうち `.jpeg()` / `.png()` / `.webp()` は全プラットフォームで使えるが、`.heic()` / `.avif()` は **macOS/Windows のみ**。しかもドキュメントの表には「AVIF: encode needs M3+」という注記がある。
- フォーマット非対応のときは、終端メソッドが `error.code === "ERR_IMAGE_FORMAT_UNSUPPORTED"` で reject する。

この「AVIF encode は M3+」という注記が気になりました。私の環境は M2 Pro なので、素直に読むと「AVIF は失敗するはず」です。ここは try/catch で `error.code` を拾える構えにして、実際に失敗するのか測ってみることにしました（結果は後述しますが、予想は外れます）。

もうひとつ、ドキュメントには「Don't pass user-controlled strings directly to the constructor — that's an arbitrary-file-read primitive.」というセキュリティ上の注意もありました。ユーザー入力をそのまま `Bun.file(...)` に渡すと任意ファイル読み取りになりうる、ということなので、今回は入力パスは固定値にしています。

### 公式ベンチ値（条件付きで引用）

Bun 1.3.14 のリリース情報には sharp との比較ベンチが載っていました。ただしこれは **linux/x64・50 iterations・`sharp.concurrency(1)`・sharp 0.34.5** という条件での値で、私の環境（macOS/arm64・sharp 0.35.3）とは条件が違います。あくまで引用として、自分の実測とは分けて見ることにしました。

- `metadata()`: 0.004ms vs 0.28ms = 約70×
- 1080p PNG → 400x400 → JPEG: 28.6ms vs 39.5ms = 約1.38×
- 1080p PNG → 800x600 → WebP: 82.7ms vs 110.1ms = 約1.33×
- 4K JPEG → 800x450 → JPEG: 35.8ms vs 45.5ms = 約1.27×
- 12MP → 1024x768 → WebP: 138ms vs 165ms = 約1.20×

温度感としては「metadata は桁違いに速く、実処理は 1.2〜1.4倍くらい」でした。この数字を頭に置いて、自分でも測ってみます。

## 環境構築

最小プロジェクトを作るところから。

```bash
bun init --yes
```

`.gitignore` / `index.ts` / `tsconfig.json` などが生成されて、`@types/bun@1.3.14` と `typescript@5.9.3` が入りました（5 packages、1秒くらい）。

サンプル画像は、外部からダウンロードせずに `ffmpeg`（Homebrew で入れたもの）で自前生成しました。`testsrc2` という合成パターンを使っています。

```bash
ffmpeg -y -f lavfi -i "testsrc2=size=1920x1080:rate=1" -frames:v 1 input.png
ffmpeg -y -f lavfi -i "testsrc2=size=4000x3000:rate=1" -frames:v 1 -q:v 3 big.jpg
```

これで `input.png`（215,387 bytes / 1920x1080）と `big.jpg`（591,279 bytes / 4000x3000）ができました。

:::message
`testsrc2` は高周波の合成パターンで、実写真ではありません。圧縮率の絶対値は実写と変わりうるので、そこは割り引いて見てください。
:::

まず `metadata()` で Bun.Image が本当に動くかの Hello World 確認。

```ts:metadata.ts
const meta = await Bun.file("input.png").image().metadata();
console.log("input.png metadata:", meta);

const metaBig = await Bun.file("big.jpg").image().metadata();
console.log("big.jpg metadata:", metaBig);
```

```
input.png metadata: { width: 1920, height: 1080, format: "png" }
big.jpg metadata: { width: 4000, height: 3000, format: "jpeg" }
```

寸法とフォーマットがちゃんと取れました。Bun.Image が使えることが確認できたので先に進みます。

### sharp の導入コスト

比較用に sharp を入れます。

```bash
bun add sharp
```

```
bun add v1.3.14 (0d9b296a)
Resolving dependencies
Resolved, downloaded and extracted [80]
Saved lockfile

installed sharp@0.35.3

6 packages installed [517.00ms]
```

ここは正直、身構えていたわりに拍子抜けでした。「sharp といえば native ビルドで詰まる」という先入観があったんですが、macOS/arm64 では prebuilt バイナリ（`@img/sharp-darwin-arm64`, `sharp-libvips-darwin-arm64`）で解決して、ビルドは走らず・警告もなく0.5秒くらいで終わりました。

コストとして残るのはディスクで、`node_modules` は 29M → 48M と **約19M** 増えました。うち `@img`（libvips 本体）が 17M です。

:::message
この「あっさり入った」は macOS/arm64 での話です。prebuilt が用意されていない環境ではビルドが走るので、ここは環境依存だと思っています。
:::

## 実際に試したこと（本編）

### Bun.Image で resize → WebP

まず Bun.Image 版。`Bun.file(...).image()` から一直線にチェーンできます。計測のためにウォームアップ1回＋本番5回まわして中央値を出しています。

```ts:bun-image.ts
const INPUT = "input.png";
const WARMUP = 1;
const RUNS = 5;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function webpOnce(): Promise<number> {
  const t = performance.now();
  await Bun.file(INPUT)
    .image()
    .resize(800, 800, { fit: "inside" })
    .webp({ quality: 80 })
    .write("out/bun.webp");
  return performance.now() - t;
}

for (let i = 0; i < WARMUP; i++) await webpOnce();
const webpTimes: number[] = [];
for (let i = 0; i < RUNS; i++) webpTimes.push(await webpOnce());

const webpBytes = Bun.file("out/bun.webp").size;
console.log("[Bun.Image] resize+webp times(ms):", webpTimes.map((x) => +x.toFixed(2)));
console.log("[Bun.Image] resize+webp median(ms):", +median(webpTimes).toFixed(2));
console.log("[Bun.Image] out/bun.webp bytes:", webpBytes);
```

このファイルの import は0個でした。`@types/bun` が入っているので `resize` や `webp` の補完も効きます。`fit: "inside"` は箱に収めつつアスペクト比を保つ指定で、1920x1080 が 800x450 に収まりました（既定は `"fill"` で引き伸ばしになる点に注意）。

### sharp で同じ処理

sharp 版はほぼ同じ形で書けました。違うのは生成のしかた（`sharp(path)` という関数）と、保存が `.toFile()` である点くらいです。

```ts:sharp-image.ts
import sharp from "sharp";

// median() は bun-image.ts と同じ

async function webpOnce(): Promise<number> {
  const t = performance.now();
  await sharp(INPUT)
    .resize(800, 800, { fit: "inside" })
    .webp({ quality: 80 })
    .toFile("out/sharp.webp");
  return performance.now() - t;
}
```

`resize` / `webp` のオプション名（`fit`, `quality`）はほぼ共通なので、乗り換えの負荷は小さいと感じました。terminal のメソッドが `Bun.Image` は `.write(path)`、sharp は `.toFile(path)` という違いくらいです。

実行結果（代表的な1回）はこうなりました。

```
[Bun.Image] resize+webp times(ms): [117.81, 132.3, 116.8, 87.95, 93.13]  median 116.8  bytes 12528
[sharp]     resize+webp times(ms): [79.66, 85.44, 146.03, 143.35, 133.45] median 133.45 bytes 12518
```

出力サイズは 12,528 bytes（Bun.Image）と 12,518 bytes（sharp）で、差は0.1%未満。同じ quality:80 で出力もほぼ揃っているので、条件を揃えた比較になっていると思います。出力の metadata も両方 `800x450 webp` で確認できました。

### AVIF は失敗するはず……が通った

ここが今回いちばん意外だったところです。ドキュメントの「AVIF encode は M3+」注記から、M2 Pro の自分の環境では `ERR_IMAGE_FORMAT_UNSUPPORTED` で落ちるだろうと予想して、try/catch で `error.code` を拾う書き方にしていました。

```ts:bun-image.ts
try {
  await Bun.file(INPUT)
    .image()
    .resize(800, 800, { fit: "inside" })
    .avif({ quality: 50 })
    .write("out/bun.avif");
  const avifBytes = Bun.file("out/bun.avif").size;
  console.log("[Bun.Image] AVIF OK. out/bun.avif bytes:", avifBytes);
} catch (e: any) {
  console.log("[Bun.Image] AVIF FAILED.");
  console.log("  error.code:", e?.code);
  console.log("  error.message:", e?.message);
  console.log("  error(full):", e);
}
```

ところが、例外は出ずに両方とも成功しました。

```
[Bun.Image] AVIF OK. out/bun.avif bytes: 7061
[sharp]     AVIF OK. out/sharp.avif bytes: 11052
```

metadata でも `800x450 avif` を確認できました。ドキュメントの注記を素直に読むと失敗しそうな組み合わせでも、実際に手元で測ると通る、というのはちょっと拍子抜けでした。ここは「但し書きを鵜呑みにせず、自分の環境で測ってみないと分からない」という当たり前のことを実感した部分です。

もうひとつ気づいたのが、同じ `quality: 50` を指定しても出力サイズがかなり違うこと。Bun.Image が 7,061 bytes、sharp が 11,052 bytes と、Bun.Image のほうが小さくなりました。エンコーダが違えば同じ quality 値でも意味が揃わないんだな、と。サイズだけ見て「Bun.Image のほうが優秀」とは言い切れない材料だと思います。

## 詰まった点と、予想が外れたところ

やってみて引っかかった（あるいは拍子抜けした）のは主に次の点でした。

**計測値が思ったよりブレる。** 上の生値を見ても分かるとおり、同じ run の中でも 64〜160ms くらいの幅で揺れます。1回だけ測っていたら「どっちが速い」を完全に取り違えていたはずです。JITのウォームアップやOSキャッシュ、GC、他プロセスの影響が乗るからだと思います。なのでウォームアップ1回＋5回計測で中央値を出し、さらに複数 run まわして傾向を見ました。複数 run の median を並べるとこうなります。

- Bun.Image: 113.68 / 114.37 / 116.8 / 118.44 / 124.03 ms
- sharp: 133.45 / 135.47 / 137.79 / 139.67 / 146.24 ms

こうして見ると、1080p→800px→WebP では Bun.Image が sharp の 1.1〜1.2倍くらい速い、という傾向でした。公式ベンチの 1.33× と同じ方向ではありますが、倍率は少し控えめです。

**quality を揃えても公式ベンチと数字が一致しない。** AVIF の 7KB vs 11KB のように、同じ quality でもエンコーダが違えば出力は揃いません。速度倍率も公式（1.33×）より小さめでした。これはベンチ条件（公式は linux/x64・sharp 0.34.5、こちらは macOS/arm64・sharp 0.35.3）が違うことも大きいと思います。比較するなら quality と fit は明示して条件を揃える、公式ベンチは条件込みで読む、というのを改めて意識しました。

事前に「詰まりそう」と思っていた AVIF失敗と sharp のビルド地獄は、この環境では起きませんでした。逆に、起きないこと自体が「環境依存だった」という気づきになった感じです。

## 分かったこと・比較

大きい画像でも測っておこうと思って、`big.jpg`（4000x3000）を 1920x1080 に inside でリサイズして WebP にするケースも追加しました。

```
[big/Bun.Image] times(ms): [377.22, 356.58, 418.96, 347.1, 366.8]  median 366.8  bytes 40974
[big/sharp]     times(ms): [503.21, 454.85, 452.65, 398.01, 475.88] median 454.85 bytes 41386
speedup (sharp/bun): 1.24 x
```

別の run でも speedup は 1.15〜1.29倍の範囲で、公式の 4K 帯（1.20〜1.27×）に近い値になりました。小さい画像より、大きい画像のほうが公式値に一致しやすい印象です。出力サイズは 40,974 vs 41,386 bytes とほぼ同等でした。

実測をまとめると次のとおりです。

| 観点 | Bun.Image (bun 1.3.14) | sharp 0.35.3 |
|---|---|---|
| 追加依存 | なし（組み込み）／import 0 | `bun add sharp`／`@img` native 17M（node_modules +19M） |
| 導入コスト | 0（Bun同梱） | prebuilt解決 約0.5s・無警告（当環境。native ビルドは発生せず） |
| resize+WebP 中央値 (1080p→800px, q80) | 約 114〜124ms | 約 133〜146ms |
| resize+WebP 中央値 (4K→1920px, q80) | 約 357〜373ms | 約 412〜480ms |
| WebP 出力サイズ (1080p, q80) | 12,528 bytes | 12,518 bytes（ほぼ同等） |
| AVIF (q50) 可否・サイズ | OK・7,061 bytes | OK・11,052 bytes |
| terminal メソッド | `.write(path)` | `.toFile(path)` |

sharp から乗り換えるときに感じたのは、API の形はよく似ていて負荷は小さいこと。導入は当環境では両者ともあっさりでしたが、Bun.Image は追加依存がゼロという点でやはり身軽です。速度は Bun.Image がやや速く、出力サイズはほぼ同等でした。

### どんな人に向いていそうか

すでに Bun 前提のプロジェクトで、リサイズや WebP 変換くらいの処理なら、Bun.Image だけで済ませるのは十分アリだと感じました。依存を減らせるのは単純に嬉しいです。

一方で、HEIC/AVIF は OS・チップ依存です。今回 M2 Pro では AVIF が通りましたが、ドキュメントは「AVIF encode は M3+」と注記していますし、**Linux では AVIF/HEIC 自体が非対応**です。本番が Linux なら、そこは必ず別途検証したほうがよさそうです。

## まとめ

新人が手元のMacで一通り試した範囲の結論です。

- WebP のリサイズ＋変換は Bun.Image だけで問題なく動いた。追加依存ゼロは身軽。
- 速度は Bun.Image がやや速い（1080p で約1.1〜1.2倍、4K で約1.15〜1.29倍）。出力サイズは同等。
- AVIF は「M2 Pro では失敗するはず」という予想に反して通った。OS×チップ×フォーマットの可否は、ドキュメントの但し書きだけで判断せず実測が要る。
- 計測は必ずウォームアップ＋複数回中央値で。1回計測だと2倍以上ブレる。
- 公式ベンチは条件（OS・sharpバージョン）込みで読む。同じ quality でもエンコーダが違えば出力は揃わない。

次にやってみたいのは、合成パターンではなく実写真で測ること、そして Linux 環境で AVIF/HEIC の可否と sharp の prebuild 事情を確認することです。この記事の数値はあくまで macOS 26.5 / M2 Pro での話なので、そこは断定せずに残しておきます。

### 再現手順

```bash
bun init --yes
# サンプル画像を自前生成（ffmpeg。無ければ任意のPNG/JPEGでよい）
ffmpeg -y -f lavfi -i "testsrc2=size=1920x1080:rate=1" -frames:v 1 input.png
ffmpeg -y -f lavfi -i "testsrc2=size=4000x3000:rate=1" -frames:v 1 -q:v 3 big.jpg
mkdir -p out
bun add sharp
bun run bun-image.ts     # Bun.Image: resize→webp(+avif) 計測
bun run sharp-image.ts   # sharp: 同処理
bun run big-image.ts     # 大画像/JPEG入力ケース
```

- 環境: macOS 26.5 / arm64 (Apple M2 Pro) / bun 1.3.14 / node v22.17.0 / sharp 0.35.3
- HEIC/AVIF は macOS/Windows のみ。Linux は非対応。
- Bun.Image のコンストラクタにユーザー制御の文字列を直接渡さない（任意ファイル読み取りになりうる）。入力パスは固定値に。

## 参考リンク

- Bun.Image ドキュメント: https://bun.sh/docs/api/image
- sharp ドキュメント: https://sharp.pixelplumbing.com/
