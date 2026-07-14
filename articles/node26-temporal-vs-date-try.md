---
title: "Node 26で既定になったTemporalを、Dateと同じ処理で書き比べてみた"
emoji: "🕰️"
type: "tech"
topics: ["nodejs", "javascript", "temporal", "date"]
published: true
---

<!-- 前提: 出典ログ logs/run-node26-temporal-vs-date-20260714-1517/execution-log.md -->

## はじめに

Node.js 26 で `Temporal` がフラグなしの既定で使えるようになった、という話を見かけて触ってみました。日時まわりは `Date` でだいたい済ませてきたものの、「月末に1か月足す」みたいな計算でたまに変な結果になって困ったことがあり、Temporal がそこをどう扱うのか気になっていたからです。

やったことは単純で、同じ処理を `Date` 版と `Temporal` 版で書き比べて、出力がどう違うかをひたすら並べただけです。月末の加算、タイムゾーン跨ぎの変換、日付の差分、`Date` との相互変換あたりを触りました。結論から言うと、書き比べは一通り動いて違いも見えたんですが、途中で予想と違うエラーに何度か引っかかったので、そのあたりも含めて残しておきます。

想定読者は自分と同じくらいの、`Date` は使うけど Temporal はまだ、という人です。

:::message
筆者は Temporal を触るのは初めてです。実行環境は macOS（Darwin 25.5.0）/ Node v26.5.0。手元で一通り書き比べた範囲のメモなので、断定しすぎているところがあったら差し引いて読んでください。
:::

## なぜTemporalを試すのか

きっかけは Node 26 で既定有効になったことですが、動機自体は `Date` の日時計算の落とし穴です。特に「1月31日に1か月足す」系はよくやる割に結果が直感と合わないことがあって、Temporal がそこをどう扱うのかを実際に見てみたかったのが大きいです。

Temporal 側で今回触った型とAPIは、事前に軽く洗い出しました。

- `Temporal.Now`（現在時刻）
- `PlainDate`（暦の日付）/ `PlainDateTime`（TZなしの日時）
- `ZonedDateTime`（TZ付きの日時）/ `Instant`（epoch の絶対時刻）
- `Duration`（期間）

`Date` は1つの型で全部やっていたので、TZの有無や絶対時刻かどうかで型が分かれているのは最初ちょっと戸惑いました。使ったAPIは `PlainDate.from` / `.add()` / `Instant.from` / `.toZonedDateTimeISO()` / `.since()` / `Duration.total()` / `Date.prototype.toTemporalInstant()` あたりです。

## 環境

Node 26 は nvm に入れてあったので切り替えるだけでした。

```bash
nvm use 26
node --version
```

```
Now using node v26.5.0 (npm v11.17.0)
v26.5.0
```

V8 のバージョンも一応確認しました。

```bash
node -p "process.versions.v8"
```

```
14.6.202.34-node.24
```

リリースノートなどで見かけた記載は `14.6.202.33` だったんですが、手元の 26.5.0 では末尾が `.34-node.24` でした。パッチ差だと思いますが、実機で見た値をそのまま載せておきます。

そのうえで Temporal が既定で使えるか確認しました。ここで軽く引っかかったので先に書きます。切り替え前の v22 で `typeof Temporal` を叩くと、例外ではなく `undefined` が返ってきます。

```bash
# v22.17.0
node -e "console.log(typeof Temporal)"
```

```
undefined
```

`typeof` は未定義の識別子に対しては例外を投げない、というJSの仕様どおりの挙動です。`Temporal is not defined` を見たいなら、識別子を直接参照する必要があります。

```bash
# v22.17.0
node -e "console.log(Temporal.Now.plainDateTimeISO().toString())"
```

```
[eval]:1
console.log(Temporal.Now.plainDateTimeISO().toString())
            ^
ReferenceError: Temporal is not defined
    at [eval]:1:13
    ...
Node.js v22.17.0
```

v26 に切り替えると、ちゃんとオブジェクトとして生えていました。

```bash
# v26.5.0
node -e "console.log(typeof Temporal, Temporal.Now.plainDateTimeISO().toString())"
```

```
object 2026-07-14T15:17:48.449033936
```

「既定有効＝フラグ不要」を `typeof Temporal === 'object'` で確認できたので、ここから書き比べに入りました。作業ファイルは `01`〜`06` の `.mjs` で作りましたが、Temporal はグローバルなので `import` は不要でした。

## Dateで書いた処理

まず `Date` 側です。主役は月末の加算で、1月31日に1か月足します。

```js:01-date.mjs
const d = new Date('2026-01-31T00:00:00Z');
console.log('元の日付      :', d.toISOString());

// setMonth は破壊的（元オブジェクトを書き換える）
const before = d.toISOString();
d.setMonth(d.getMonth() + 1);
console.log('setMonth 後   :', d.toISOString(), '(UTC)');
console.log('  -> 元の d が変化した?（可変性）:', before, '=>', d.toISOString());

// ローカルタイム版でも確認（環境TZ依存）
const d2 = new Date('2026-01-31T00:00:00');
d2.setMonth(d2.getMonth() + 1);
console.log('ローカル版     :', d2.toString());

// 「2月末に丸めたい」を Date でやろうとすると自前計算が要る
const d3 = new Date('2026-01-31T00:00:00Z');
const targetMonth = d3.getUTCMonth() + 1;
d3.setUTCMonth(targetMonth + 1, 0); // 翌々月の0日 = 目的月の末日
console.log('自前で月末クランプ:', d3.toISOString().slice(0, 10));
```

```
元の日付      : 2026-01-31T00:00:00.000Z
setMonth 後   : 2026-03-03T00:00:00.000Z (UTC)
  -> 元の d が変化した?（可変性）: 2026-01-31T00:00:00.000Z => 2026-03-03T00:00:00.000Z
ローカル版     : Tue Mar 03 2026 00:00:00 GMT+0900 (Japan Standard Time)
自前で月末クランプ: 2026-02-28
```

`2/31` は存在しないので、`setMonth` は溢れた分を翌月に転がして `2026-03-03` になります。しかも `setMonth` は破壊的で、元の `d` 自体が `2026-01-31` から `2026-03-03` に書き換わっていました。「2月末に丸めたい」を素直にやろうとすると、翌々月の0日を使うような自前計算が要ります。

TZ跨ぎの変換も `Date` でやってみました。

```js:03-tz.mjs
const iso = '2026-07-14T12:00:00Z'; // UTC の正午
const d = new Date(iso);
console.log('[Date] UTC        :', d.toISOString());
console.log('[Date] New York   :', d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
console.log('[Date] Tokyo      :', d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
```

```
[Date] UTC        : 2026-07-14T12:00:00.000Z
[Date] New York   : 7/14/2026, 8:00:00 AM
[Date] Tokyo      : 7/14/2026, 9:00:00 PM
```

`Date` オブジェクトは内部的には常にUTCのepochで、TZは持てません。表示を変える手段が `toLocaleString` の文字列変換しかないので、変換した結果は文字列として受け取ることになります。

差分も一応。

```js:04-diff.mjs
const a = new Date('2026-07-14T12:00:00Z');
const b = new Date('2026-01-31T00:00:00Z');
const ms = a - b; // 数値に暗黙変換される
console.log('[Date] 差(ms)     :', ms);
console.log('[Date] 差(日)     :', ms / 86400000);
console.log('[Date] 差(日,整数):', Math.floor(ms / 86400000));
```

```
[Date] 差(ms)     : 14212800000
[Date] 差(日)     : 164.5
[Date] 差(日,整数): 164
```

引き算するとミリ秒に暗黙変換されるので、`86400000` で割って日数にする、という毎度おなじみの計算になります。

## Temporalで書き直し

同じ月末加算を `PlainDate` でやります。

```js:02-temporal.mjs
const jan31 = Temporal.PlainDate.from('2026-01-31');
console.log('元の日付      :', jan31.toString());

// add は非破壊（新インスタンスを返す）
const plus1 = jan31.add({ months: 1 });
console.log('add(+1month)  :', plus1.toString(), '(既定 overflow:constrain で2月末にクランプ)');
console.log('  -> 元の jan31 は不変?:', jan31.toString());

// overflow:'reject' を付けると RangeError になるはず
try {
  const rejected = jan31.add({ months: 1 }, { overflow: 'reject' });
  console.log('overflow:reject:', rejected.toString());
} catch (e) {
  console.log('overflow:reject => 例外:', e.constructor.name + ': ' + e.message);
}

// 既定 overflow を明示（constrain）
const constrained = jan31.add({ months: 1 }, { overflow: 'constrain' });
console.log('overflow:constrain:', constrained.toString());
```

```
元の日付      : 2026-01-31
add(+1month)  : 2026-02-28 (既定 overflow:constrain で2月末にクランプ)
  -> 元の jan31 は不変?: 2026-01-31
overflow:reject => 例外: RangeError: Temporal error: not a valid ISO date.
overflow:constrain: 2026-02-28
```

`Date` が `2026-03-03` に転がったのに対して、Temporal は既定で `2026-02-28` に丸まりました。`add` は非破壊で新しいインスタンスを返すので、元の `jan31` は `2026-01-31` のまま残っています。既定の挙動は `overflow: 'constrain'` で、明示的に `overflow: 'reject'` を付けると存在しない日付として `RangeError` で弾いてくれます。`Date` の `2026-03-03` と Temporal の `2026-02-28` を並べると、差が一目で分かりました。

TZ跨ぎの変換は `ZonedDateTime` が型としてTZを持ちます。

```js:03-tz.mjs
const instant = Temporal.Instant.from('2026-07-14T12:00:00Z');
const ny = instant.toZonedDateTimeISO('America/New_York');
const tokyo = instant.toZonedDateTimeISO('Asia/Tokyo');
console.log('[Temporal] Instant:', instant.toString());
console.log('[Temporal] NewYork:', ny.toString());
console.log('[Temporal] Tokyo  :', tokyo.toString());
console.log('  -> ny.timeZoneId:', ny.timeZoneId, '/ ny.hour:', ny.hour);
```

```
[Temporal] Instant: 2026-07-14T12:00:00Z
[Temporal] NewYork: 2026-07-14T08:00:00-04:00[America/New_York]
[Temporal] Tokyo  : 2026-07-14T21:00:00+09:00[Asia/Tokyo]
  -> ny.timeZoneId: America/New_York / ny.hour: 8
```

`Date` だと文字列でしか結果を受け取れなかったところが、`.timeZoneId` や `.hour` で構造化された値として取り出せます。オフセット `-04:00` やIANA名 `[America/New_York]` が文字列表現にも入っているのが分かりやすかったです。

差分は `since` が `Duration` を返します。

```js:04-diff.mjs
const pa = Temporal.PlainDateTime.from('2026-07-14T12:00:00');
const pb = Temporal.PlainDateTime.from('2026-01-31T00:00:00');

// largestUnit 未指定だと既定は小さい単位になる
const dDefault = pa.since(pb);
console.log('[Temporal] since()（既定）   :', dDefault.toString());

// largestUnit:'day' を指定
const dDays = pa.since(pb, { largestUnit: 'day' });
console.log('[Temporal] since(largestUnit:day):', dDays.toString());
console.log('  -> days:', dDays.days, '/ hours:', dDays.hours, '/ minutes:', dDays.minutes);

// largestUnit:'month' で年月日に分解
const dMonths = pa.since(pb, { largestUnit: 'month' });
console.log('[Temporal] since(largestUnit:month):', dMonths.toString(), '=> months:', dMonths.months, 'days:', dMonths.days);

// Instant 同士の差（絶対時間）
const ia = Temporal.Instant.from('2026-07-14T12:00:00Z');
const ib = Temporal.Instant.from('2026-01-31T00:00:00Z');
const dInstant = ia.since(ib, { largestUnit: 'hour' });
console.log('[Temporal] Instant.since(hour):', dInstant.toString(), '=> total days:', dInstant.total({ unit: 'day' }));
```

```
[Temporal] since()（既定）   : P164DT12H
[Temporal] since(largestUnit:day): P164DT12H
  -> days: 164 / hours: 12 / minutes: 0
[Temporal] since(largestUnit:month): P5M14DT12H => months: 5 days: 14
[Temporal] Instant.since(hour): PT3948H => total days: 164.5
```

戻り値がISO8601形式の期間（`P164DT12H` など）で、`.days` や `.hours` で分解して取れます。`largestUnit` を `'month'` にすると同じ差分が `P5M14DT12H`（5か月14日12時間）になって、同じ差を「日」でも「か月＋日」でも表現できるのが面白かったです。

最後に `Date` との相互変換です。既存の `Date` 資産を全部捨てなくても橋渡しできるかを見たかった部分です。

```js:05-convert.mjs
const now = new Date('2026-07-14T12:34:56.789Z');
const instant = Temporal.Instant.fromEpochMilliseconds(now.getTime());
console.log('Date               :', now.toISOString());
console.log('-> Instant         :', instant.toString());
console.log('   epochMilliseconds:', instant.epochMilliseconds);

const back = new Date(instant.epochMilliseconds);
console.log('Instant -> Date     :', back.toISOString());
console.log('   往復一致?         :', now.getTime() === back.getTime());

console.log('typeof Date.prototype.toTemporalInstant:', typeof Date.prototype.toTemporalInstant);
if (typeof now.toTemporalInstant === 'function') {
  console.log('now.toTemporalInstant():', now.toTemporalInstant().toString());
}
```

```
Date               : 2026-07-14T12:34:56.789Z
-> Instant         : 2026-07-14T12:34:56.789Z
   epochMilliseconds: 1784032496789
Instant -> Date     : 2026-07-14T12:34:56.789Z
   往復一致?         : true
typeof Date.prototype.toTemporalInstant: function
now.toTemporalInstant(): 2026-07-14T12:34:56.789Z
```

`Date` ↔ `Instant` は epoch ミリ秒を経由して往復一致（`true`）しました。事前には「環境依存で無いかも」と思っていた `Date.prototype.toTemporalInstant` も、この v26.5.0 では `function` として実装済みで、呼ぶと `Instant` が返ってきました。

## 詰まった点

書き比べ自体はすんなりでしたが、予想と違うエラーにいくつか当たったので順に書きます。

ひとつめは環境のところで書いた `typeof Temporal` です。v22 で `ReferenceError` が出ると思い込んでいたら `undefined` が返ってきて、「あれ、落ちない」となりました。`typeof` は未定義識別子でも例外にならない仕様なので、`Temporal is not defined` を見せたいなら `Temporal.Now.plainDateTimeISO()` のように直接参照するのが正解でした。

ふたつめは TZ 変換で、`PlainDateTime` を引数なしで `toZonedDateTime()` に投げたときです。TZが要るはずなので落ちるだろうとは思っていたんですが、出た例外の種類が予想と違いました。

```js:03-tz.mjs
const pdt = Temporal.PlainDateTime.from('2026-07-14T12:00:00');
try {
  const zdt = pdt.toZonedDateTime(); // 引数なし
  console.log('[Temporal] PlainDateTime.toZonedDateTime():', zdt.toString());
} catch (e) {
  console.log('[Temporal] PlainDateTime.toZonedDateTime() => 例外:', e.constructor.name + ': ' + e.message);
}
// 正しくは TZ を渡す
const zdtOk = pdt.toZonedDateTime('Asia/Tokyo');
console.log('[Temporal] toZonedDateTime("Asia/Tokyo"):', zdtOk.toString());
```

```
[Temporal] PlainDateTime.toZonedDateTime() => 例外: TypeError: Temporal error: Time zone must be string or ZonedDateTime object.
[Temporal] toZonedDateTime("Asia/Tokyo"): 2026-07-14T12:00:00+09:00[Asia/Tokyo]
```

`RangeError` が来ると思っていたら `TypeError: Time zone must be string or ZonedDateTime object.` でした。`.toZonedDateTime('Asia/Tokyo')` とTZを渡せば普通に変換できます。TZが必須なのは想定どおりでしたが、例外の種類まで当てるのは難しいなと思いました。

みっつめは `since` の既定の `largestUnit` です。指定しないと単位が小さく出ると思っていたら、`PlainDateTime.since` の既定は `P164DT12H`（日＋時）で、`largestUnit: 'day'` を明示したときと同じでした。ところが `PlainDate.since` の既定は `P164D` で、型によって既定の `largestUnit` が違います。

```
[3] PlainDate.since 既定 : P164D (largestUnit未指定)
[3] PlainDate.since month: P5M14D
```

同じ `since` でも型で既定が変わるので、意図した単位があるなら `largestUnit` は明示しておいたほうが安全だと感じました。

よっつめが一番戸惑ったやつです。`06-extra.mjs` で `Duration.total({ unit: 'week' })` を呼んだら、メッセージが空っぽの `RangeError` で落ちました。

```js:06-extra.mjs
const a = Temporal.PlainDate.from('2026-07-14');
const b = Temporal.PlainDate.from('2026-01-31');
const dur = a.since(b, { largestUnit: 'day' });
console.log('[5] Duration.total(week) :', dur.total({ unit: 'week' }));
```

```
file:///.../workspace/06-extra.mjs:28
console.log('[5] Duration.total(week) :', dur.total({ unit: 'week' }));
                                              ^

RangeError: Temporal error:
    at Duration.total (<anonymous>)
    at file:///.../workspace/06-extra.mjs:28:47
    ...
Node.js v26.5.0
```

`Temporal error:` の後ろに理由が何も書かれていなくて、最初は何が悪いのか分かりませんでした。調べてみると、week / month / year のような暦単位は日数が可変なので、基準日 `relativeTo` を渡さないと `total()` できない、という話でした。day 以下の固定長の単位なら `relativeTo` は要りません。基準日を渡したら通りました。

```bash
node -e "
const a = Temporal.PlainDate.from('2026-07-14');
const b = Temporal.PlainDate.from('2026-01-31');
const dur = a.since(b, { largestUnit: 'day' });
console.log('total(day)          :', dur.total({ unit: 'day' }));
console.log('total(week,relativeTo):', dur.total({ unit: 'week', relativeTo: b }));
"
```

```
total(day)          : 164
total(week,relativeTo): 23.428571428571427
```

エラーメッセージが空になることがある、というのは知らないとハマると思ったので、これは別途 knowledge にも残しました。

## Dateと比べて分かったこと

今回触った4つの処理を並べるとこんな感じでした。

| 検証 | Date | Temporal | 感じた違い |
|---|---|---|---|
| 月末＋1か月（Jan 31） | `setMonth` → `2026-03-03`。破壊的で翌月に転がる | `PlainDate.add({months:1})` → `2026-02-28`。非破壊で既定constrainのクランプ | Dateは3月へ暴走、Temporalは2月末に丸め |
| TZ跨ぎ変換 | `toLocaleString` の文字列変換のみ、型にTZを持てない | `Instant.toZonedDateTimeISO(tz)` で型がTZ保持 | `.timeZoneId`/`.hour` で構造化して取れる |
| 差分（Duration） | `(a-b)/86400000` の数値計算 | `since` が `P164DT12H` を返し `.days`/`.hours` で分解 | largestUnitで日/か月の表現を切替できる |
| 相互変換 | `new Date(instant.epochMilliseconds)` | `Instant.fromEpochMilliseconds(date.getTime())` / `date.toTemporalInstant()` | epochミリ秒経由で往復一致、共存できる |

大きかったのは、破壊的か非破壊か、TZを型で持てるか文字列頼みか、の2点でした。特に月末クランプが既定で効くのは、`Date` で自前計算していたのが何だったのかという気持ちになりました。一方で型が用途ごとに分かれているので、`PlainDate` / `PlainDateTime` / `Instant` / `ZonedDateTime` のどれを使うかは最初に少し考える必要がありそうです。

## どんな人に向くか

日時計算で `Date` の細かい挙動に振り回された経験がある人には、触ってみる価値があると思いました。月末や差分をやることが多いなら特に恩恵が分かりやすいです。

一方で `Date` を全部捨てる話ではなくて、相互変換が epoch ミリ秒経由で往復一致したので、既存の `Date` を使うコードと共存させながら少しずつ、という入り方ができそうだと感じました。

## まとめ

書き比べは一通り動いて、`Date` と Temporal の違いは見えました。月末加算が `2026-03-03` と `2026-02-28` で分かれるところ、TZを型で持てるところが特に印象に残っています。

ただ、途中で当たったエラーは予想と外れるものが多くて、`typeof` が落ちない・TZ無しが `TypeError`・`total(week)` のメッセージが空、あたりは知らないと素直に詰まると思います。特に `Duration.total()` の `relativeTo` はまだ感覚を掴みきれていないので、次は `PlainYearMonth` や `Duration` の丸め（`round`）まわりを触ってみたいです。

## 参考リンク

https://nodejs.org/en/blog/release/v26.0.0

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal
