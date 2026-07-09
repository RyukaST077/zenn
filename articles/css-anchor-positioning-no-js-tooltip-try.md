---
title: "CSS Anchor Positioning でツールチップとポップオーバーをJSなしで作ってみた"
emoji: "📌"
type: "tech"
topics: ["css", "frontend", "html", "chrome"]
published: true
---

<!-- 前提: 出典ログ logs/run-css-anchor-positioning-20260710-0407/execution-log.md / 記事タイプ: 試してみた・検証ログ / slug=css-anchor-positioning-no-js-tooltip-try / published=false -->

## はじめに

ツールチップやポップオーバーの「ボタンの真下に出す」「画面端まで寄ったら反対側に回り込む」みたいな配置を、今までは JavaScript で位置を計算して実装していました。Floating UI を入れて `computePosition` を呼んで、スクロールやリサイズを監視して……という一式です。動くには動くんですが、監視を張り忘れるとスクロールでツールチップが置いていかれたりして、地味に神経を使うところでした。

CSS だけで同じことができる CSS Anchor Positioning が Chromium で使えるようになっていたので、実際に手を動かして試してみました。作ったのは次の3つです。

- `anchor()` でボタン直下に出すツールチップ
- `position-area` で「下・中央」に出すツールチップ
- 画面右端でも `position-try-fallbacks: flip-inline` で左に回り込むポップオーバー

結論から言うと、3つとも JavaScript ゼロで動きました。ただ途中で4回ほど詰まっていて、特に「フォールバックが発火しない」ところは原因が分かるまで少し時間がかかりました。そのあたりを中心に書きます。

:::message
筆者はフロントエンド実務経験の浅い新人で、CSS Anchor Positioning を触るのは初めてです。ブラウザ確認は手元の Chromium 149 のみで行っていて、Safari / Firefox は確認できていません。
:::

## 使ったもの・環境

再現できるように環境を書いておきます。

- OS: macOS（Darwin 25.5.0）
- ランタイム: Node v22.17.0
- ブラウザ確認: Playwright 1.61.1 / Chromium 149.0.7827.55

ブラウザでの見た目の確認は、Playwright で `file://` の HTML を開いてスクリーンショットを撮る方法にしました。「本当に画面からはみ出しているか」みたいな判定は目視だと怪しいので、`getBoundingClientRect()` の値もあわせてログに出しています。

「できた」と言える条件は次の3つに置きました。

1. ツールチップがボタンに対して意図した位置（直下・中央）に出る
2. ボタンを画面端に寄せると反対側に回り込み、ビューポートからはみ出さない
3. `@supports (anchor-name: --x)` のフォールバックを入れ、非対応環境でも崩れない

## 事前に調べたこと（Baseline の状況）

いきなり書き始める前に、MDN の「Using CSS anchor positioning」と「anchor-name」を読みました。読んで初めて知った前提がいくつかあります。

まず `anchor()` は「位置」ではなく **length（長さ）を返す関数**でした。MDN の表現だと "returns a length value" で、`top` / `left` / `bottom` / `right` などの inset プロパティ側で使うものです。`margin` に直接書くものではない、というのは後で詰まる原因になりました（後述）。

もうひとつ、同名の `anchor-name` が複数あると、配置される要素は "the positioned element will be associated with the _last_ anchor element in the source order"、つまりソース順で最後のアンカーに紐づく、と書いてありました。これも後で踏み抜きます。

対応状況については、`anchor-name` のページに Baseline の表記がありました。

> Baseline 2026 * Newly available

ただし但し書きも付いていて、

> Some parts of this feature may have varying levels of support.

とあります。全部が全部どのブラウザでも同じレベルで動くわけではなさそう、という温度感でした。なので今回は Chromium 149 で確認しつつ、`@supports` のフォールバックは前提として用意する方針にしました。

## 最小サンプルを作る

作業ディレクトリを作って、Playwright / Chromium のバージョンだけ確認しました（インストールは済んでいた環境です）。

```
Version 1.61.1
Chromium version: 149.0.7827.55
```

スクショを撮るスクリプトで、まず配置なしの雛形が1枚撮れることを確認します。`file://` は `path.resolve` で絶対 URL 化して、`waitUntil: 'load'` を指定しておくと真っ白にならずに撮れました。

![配置なしの最小HTML雛形（スクショ取得の動作確認）](/images/css-anchor-positioning-no-js-tooltip-try/00-skeleton.png)

このとき、各機能が使えるかも `CSS.supports` でログに出しています。Chromium 149 では全部 `true` でした。

```
CSS.supports = {"anchorName":true,"positionAnchor":true,"anchorFn":true,"positionArea":true,"positionTryFallbacks":true,"anchorScope":true}
```

最初のツールチップはこうなりました。ボタンに `anchor-name` で名前を付けて、ツールチップ側で `position-anchor` でその名前を指定し、`top` / `left` に `anchor()` を書きます。

```html:02-tooltip-ok.html
<style>
  #btn { anchor-name: --tip-anchor; }
  .tooltip {
    position: absolute;
    position-anchor: --tip-anchor;
    /* anchor() は inset プロパティ（top/left）で使う */
    top: anchor(bottom);   /* ツールチップ上端 = ボタン下端 */
    left: anchor(left);    /* ツールチップ左端 = ボタン左端 */
    margin-top: 6px;       /* 余白は普通の margin で足す */
    width: max-content;
  }
</style>
<button id="btn">ボタン</button>
<div class="tooltip">成功版ツールチップ（直下に配置）</div>
```

これでボタンの直下、左端揃えでツールチップが出ました。

![inset プロパティで直下に配置した成功版ツールチップ](/images/css-anchor-positioning-no-js-tooltip-try/02-tooltip-ok.png)

## 実際に試した配置バリエーション

### anchor-side を上下左右に振る

`anchor()` の引数（`top` / `right` / `bottom` / `left`）を変えると、ツールチップを4方向どこにでも出せます。4つのボタンを別々の `anchor-name` にして、上下左右に出す4パターンを1画面に並べてみました。

```html:03-anchor-sides.html
<style>
  /* 上に出す: ツールチップ下端 = アンカー上端 */
  .tip.top    { position-anchor: --a-top;    bottom: anchor(top);   left: anchor(left);  margin-bottom: 6px; }
  /* 右に出す: ツールチップ左端 = アンカー右端 */
  .tip.right  { position-anchor: --a-right;  left: anchor(right);   top: anchor(top);    margin-left: 6px; }
  /* 下に出す: ツールチップ上端 = アンカー下端 */
  .tip.bottom { position-anchor: --a-bottom; top: anchor(bottom);   left: anchor(left);  margin-top: 6px; }
  /* 左に出す: ツールチップ右端 = アンカー左端 */
  .tip.left   { position-anchor: --a-left;   right: anchor(left);   top: anchor(top);    margin-right: 6px; }
</style>
```

![anchor-side を上下左右に振った4パターン](/images/css-anchor-positioning-no-js-tooltip-try/03-anchor-sides.png)

なお、この時点で「アンカーは別名にしておかないと最後の1つに全部吸い付く」という仕様に気づいていたので、4つとも別名にしています（このハマりは後の「詰まった点」で書きます）。

### anchor() 版と position-area 版を比べる

同じ「ボタンの下・中央」を、書き方を変えて3つ並べてみました。

- A: `anchor()` 版（`top` / `left` を2行）
- B: `position-area: bottom center` 版（1行で下・中央）
- C: `anchor()` + `justify-self: anchor-center` 版

```html:05-position-area.html
<style>
  /* A: anchor() 版 */
  .tip.a { position-anchor: --a-anchor; top: anchor(bottom); left: anchor(left); margin-top: 6px; }
  /* B: position-area 版（これだけで下・中央寄せ） */
  .tip.b { position-anchor: --b-anchor; position-area: bottom center; margin-top: 6px; }
  /* C: anchor-center（max-content のまま中央寄せ） */
  .tip.c { position-anchor: --c-anchor; top: anchor(bottom); justify-self: anchor-center; margin-top: 6px; }
</style>
```

![anchor()版・position-area版・anchor-center版の比較](/images/css-anchor-positioning-no-js-tooltip-try/06-position-area-3ways.png)

配置に関わる宣言の数だけ見ると、`anchor()` 版が `top` / `left` / `margin` の3宣言なのに対し、`position-area` 版は `position-area` / `margin` の2宣言で済んで短いです。ただ幅の挙動が違っていて、`position-area: bottom center` は箱がアンカーのグリッド幅方向に広がる一方、`justify-self: anchor-center` は `max-content` 幅のまま中央寄せになりました。単純な中央寄せなら `anchor-center` の方が箱が素直に見えた、という印象です。

## 詰まった点

ここが今回の本題です。4か所引っかかったので順番に書きます。

### 1. anchor() を margin に書いても効かない

最初、深く考えずに `margin-top: anchor(bottom)` と書いていました。これだとツールチップがボタンにまったく揃いません。

```html:01-tooltip-fail.html
<style>
  .tooltip {
    position: absolute;
    position-anchor: --tip-anchor;
    /* anchor() は length を返す関数だが margin に書いても効かない */
    margin-top: anchor(bottom);
    margin-left: anchor(left);
    width: max-content;
  }
</style>
```

![margin に anchor() を書いた失敗版。位置が揃わない](/images/css-anchor-positioning-no-js-tooltip-try/01-tooltip-fail.png)

事前に MDN で「`anchor()` は length を返す関数で inset プロパティで使う」と読んでいたのに、いざ書くと margin に書いてしまっていました。`top` / `left` 側に移したら（前述の `02-tooltip-ok.html`）ちゃんと直下に来ました。最初にハマるとしたらここかなと思います。

### 2. anchor-side の軸がずれても、エラーが出ずに黙ってズレる

次に気になったのが「軸のミスマッチ」です。`top`（ブロック軸）に `anchor(left)`（インライン側）のような組み合わせを書いたらどうなるのか、わざと試しました。

```html:04-anchor-side-mismatch.html
<style>
  .tip {
    position: absolute;
    position-anchor: --m;
    /* top（ブロック軸）に left（インライン側）を渡す軸ミスマッチ */
    top: anchor(left);
    left: anchor(right);   /* こちらは正しい */
    width: max-content;
  }
</style>
```

これで何が起きたか、`getBoundingClientRect()` と computed 値をログに出しました。

```
button box: {"x":208,"y":208,"width":89.328125,"height":41}
tip box   : {"x":297.328125,"y":249,"width":245.46875,"height":32}
computed top: 249px
computed left: 297.328px
```

例外は一切出ませんでした。`top` は 249px（ちょうどボタンの下端あたり）に静かに解決されて、意図とは違う位置に置かれます。

![軸ミスマッチで黙ってズレる様子](/images/css-anchor-positioning-no-js-tooltip-try/04-anchor-side-mismatch.png)

エラーで気づけないので、「なんか位置がおかしいな」から自力で原因にたどり着く必要があります。`top` にはブロック軸（`top` / `bottom`）、`left` / `right` にはインライン軸、と揃えるのを意識しておくのが安全でした。

### 3. flip-inline が発火しない／そもそも「はみ出す状態」が作れない（山場）

一番時間がかかったのがこれです。「画面右端に寄せたポップオーバーが `position-try-fallbacks: flip-inline` で左に回り込む」のを確認したかったのに、なかなか再現できませんでした。

最初は、ポップオーバーを「ボタンサイズしかない小さな `position: relative` の祖先」の中に入れていました。すると `flip-inline` を付けても位置が変わらず、before / after のスクショが同じで、`getBoundingClientRect().right` も before / after とも同値（1006）のまま。回り込んでくれません。

じゃあと思って `position-area: right center` + `position: fixed` に変えたら、今度は逆で、フォールバック無しでも常にビューポート内に収まってしまい、「はみ出す before」自体が作れませんでした（before / after とも right が 800、つまりビューポート幅に張り付く）。ログにもその迷走が残っています。

```
before pop box: right edge 張り付き（viewport width=800）
after(fixed) pop box: right edge= 800 (viewport=800)
```

しばらく悩んで、原因は containing block（包含ブロック）だと分かりました。`position-try-fallbacks` のはみ出し判定も、`position-area` の自動クランプも、その要素の containing block が何かに強く依存します。

- 小さな `relative` 祖先の中に入れると、containing block がボタンサイズになり、要素はどの方向にも「はみ出し」扱いになってしまって、フォールバック判定がまともに働かない。
- `position-area` + `position: fixed` は containing block がビューポートで、その領域に収めるよう自動調整するので、そもそもはみ出さない。

なので「本当にビューポートをはみ出す状況」を作るには、positioned な祖先を作らずに（＝初期包含ブロック基準にして）、`position-area` の自動クランプを避けて明示 inset で開く、という形にしました。

```html:06-fallback-before.html（フォールバック無し・はみ出す）
<style>
  #btn { position: absolute; top: 200px; right: 24px; anchor-name: --edge; }
  .pop {
    position: absolute;          /* 近い positioned 祖先を作らない */
    position-anchor: --edge;
    left: anchor(right);         /* ボタン右に開く（明示 inset） */
    top: anchor(top);
    width: 200px;
  }
</style>
```

```html:07-fallback-after.html（flip-inline あり・回り込む）
<style>
  .pop {
    position: absolute;
    position-anchor: --edge;
    left: anchor(right);
    top: anchor(top);
    width: 200px;
    /* はみ出したら反対の左側に回り込む */
    position-try-fallbacks: flip-inline;
  }
</style>
```

これで before / after を数値で確認できました。

```
06-fallback-before.html left= 782 right= 1006 → はみ出し
07-fallback-after.html  left= 443 right= 667 → 収まる
```

before は right が 1006 でビューポート幅 800 をはみ出していて、after は `flip-inline` で左に回り込んで right 667 に収まっています。スクショでも差が出ました。

![フォールバック無し。右端でポップオーバーがはみ出す](/images/css-anchor-positioning-no-js-tooltip-try/07-fallback-before.png)

![flip-inline で左側に回り込んで収まる](/images/css-anchor-positioning-no-js-tooltip-try/08-fallback-after.png)

試す前は「Baseline のばらつきで flip がまだ効かないのかな」と疑っていたんですが、実際は機能そのものは Chromium 149 で安定して動いていて、問題は containing block の置き方でした。ここは別途 knowledge にも残しました。

### 4. 同名の anchor-name を繰り返すと、全部が最後の1つに吸着する

事前調査で読んだ「ソース順で最後のアンカーに紐づく」を、コンポーネントを繰り返す形で踏みました。共通の `relative` の中に、同じ `anchor-name: --card` のボタンとツールチップをフラットに並べると、両方のツールチップが最後のボタン（カードB）に吸い付いて、カードA のツールチップが消えます。

```html:09-anchor-scope.html
<style>
  button { anchor-name: --card; }   /* 同名で繰り返す */
  .tip { position: absolute; position-anchor: --card; top: anchor(bottom); left: anchor(left); }

  /* NG: 共通の relative にフラット配置 → 両方が最後のボタンに吸着 */
  .flat { position: relative; display: flex; gap: 260px; }

  /* OK: 各カードを自前の relative で包み containing block を分離 */
  .isolated .card { position: relative; }
</style>
```

![同名 anchor-name の NG（吸着）と OK（分離）の比較](/images/css-anchor-positioning-no-js-tooltip-try/10-anchor-scope.png)

各カードを自前の `position: relative` で包んで containing block を分けると、各ツールチップが自分のボタンにちゃんと紐づきました。MDN の「ソース順で最後」は "acceptable anchor"（その要素の containing block から見えるアンカー）の中での話で、containing block を分ければ事故らない、というのが実際に触ってみた結論です。`anchor-scope` でも切れるようですが、今回はラッパの `relative` で分ける方で解決しました。

## 分かったこと

触ってみて、注意点として残ったのは次のあたりです。

- `anchor()` は inset プロパティ限定。`margin` に書いても効かない。
- 軸のミスマッチ（`top` に `anchor(left)` 等）はエラーにならず黙ってズレるので、位置がおかしいときに気づきにくい。
- `position-try-fallbacks` と `position-area` の挙動は containing block 依存。`fixed` / `absolute` / ラッパの `relative` で結果が変わる。はみ出し検証は目視だけで判断せず、`getBoundingClientRect().right > viewportWidth` みたいに数値で担保してから見た方がよかった。
- 同名の `anchor-name` は containing block を分けないと最後のアンカーに吸着する。

最後に3つの UI を1つの HTML にまとめて、`@supports` 分岐付きで動くことを確認しました。

![3つのUIを統合したデモ](/images/css-anchor-positioning-no-js-tooltip-try/11-index-combined.png)

## Floating UI と比べてどうだったか

同じ「ボタン直下ツールチップ＋端で反転」を Floating UI（や Popper）でやる場合と比べたメモです。

JS ライブラリ版で必要だったのは、だいたいこのあたりでした。

- 依存の追加（`@floating-ui/dom` などのパッケージ、その分のバンドルサイズ）
- `computePosition(reference, floating, { middleware: [offset(), flip(), shift()] })` の呼び出し
- 位置の再計算トリガの監視。スクロール・リサイズ・`autoUpdate()`（ResizeObserver やスクロール listener）。張り忘れるとスクロールでツールチップが置いていかれる
- 初期化タイミングとクリーンアップ（listener の解除）

CSS Anchor Positioning 版だと、このうち JS 依存がまるごとゼロになり（`<style>` だけ）、スクロール／リサイズの監視も不要でした。ブラウザが再配置を面倒みてくれるので、`flip()` の middleware 相当が `position-try-fallbacks: flip-inline` の1宣言で済みます。監視コードを書かなくていいのが一番大きい差だと感じました。

一方で CSS 版で増える／残る手間もあります。Baseline 2026「newly available」に加えて一部機能はばらつきがあるので `@supports` フォールバックは前提になりますし、今回みたいに containing block 依存で詰まるポイントもあります。JS では気にしていなかった「どこが位置の基準か」を意識する必要が出てきます。

## どんな人向きか（フォールバックの線引き）

対応ブラウザを割り切れるかが分かれ目だと思います。今回は Chromium 149 で確認していますが、非対応環境向けに `@supports (anchor-name: --x)` で分岐して、対応していない場合は素直な相対配置に倒す形にしました。

```html:08-supports.html
<style>
  .wrap { position: relative; display: inline-block; }
  /* 既定（非対応環境向け）: 静的に相対配置。崩れない */
  .tooltip { position: absolute; top: 100%; left: 0; margin-top: 6px; }

  /* 対応環境向け: anchor positioning で正確に配置 */
  @supports (anchor-name: --x) {
    .tooltip { position-anchor: --tip-anchor; top: anchor(bottom); left: anchor(left); }
  }
</style>
```

![@supports 分岐つきツールチップ](/images/css-anchor-positioning-no-js-tooltip-try/09-supports.png)

`CSS.supports('anchor-name: --x')` は Chromium 149 で `true` でした。

```
CSS.supports(anchor-name: --x) = true
Chromium version: 149.0.7827.55
```

単純なツールチップやポップオーバーで、`@supports` フォールバックを用意した上で最新の Chromium 前提を許容できるプロジェクトなら、CSS 版はかなり楽だと思います。逆に幅広いブラウザで完全に同じ挙動を保証したい場面では、まだ JS ライブラリの方が安心かもしれません（このあたりは Safari / Firefox を確認できていないので断言はできません）。

## まとめ

新人の範囲で CSS Anchor Positioning を触ってみて、JavaScript ゼロで3つの UI（`anchor()` ツールチップ / `position-area` 版 / `flip-inline` の端フォールバック）が動きました。完了条件に置いた3つ（意図した位置・端で回り込む・`@supports` で崩れない）はすべて確認できました。

一番の学びは、`anchor()` の使い方そのものよりも「配置の基準になる containing block を意識する」ことでした。フォールバックが発火しないのも、同名アンカーが吸着するのも、突き詰めると containing block の話でした。

次は Safari / Firefox でどこまで同じように動くか、`@position-try` の名前付きフォールバックあたりも試してみたいです。

## 参考リンク

https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning/Using

https://developer.mozilla.org/en-US/docs/Web/CSS/anchor-name
