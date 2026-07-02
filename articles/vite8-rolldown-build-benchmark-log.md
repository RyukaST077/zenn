---
title: "Vite 8（Rolldown）へ移行してビルド時間を測ってみた — 8倍速のはずが実際は1.9倍だった話"
emoji: "⚡"
type: "tech"
topics: ["vite", "rolldown", "react", "typescript", "frontend"]
published: true
---

<!-- 前提: 出典ログ logs/run-vite8-rolldown-20260702-2116/execution-log.md / 記事タイプ: 検証ログ・試してみた / slug: vite8-rolldown-build-benchmark-log / published: false（ドラフト） -->

## はじめに

Vite 8 が出て、内部のバンドラが Rollup ベースから **Rolldown**（Rust製）へ切り替わった、というニュースを見かけました。「ビルドが 10〜30 倍速くなる」といった景気のいい話も流れてきます。

とはいえ実際の手元のアプリでどれくらい速くなるのかは、自分で測ってみないと分かりません。そこで新人なりに、**最小の React アプリを1つ用意して、Vite 7 と Vite 8 で build/dev の時間を実測して比べてみました**。

結論を先に言うと、**バンドル処理そのものは確かに約8倍速くなった一方、`pnpm run build` 全体の体感は約1.9倍止まり**でした。理由は型チェック（`tsc`）が固定コストとして効いてくるからで、これが個人的にいちばんの学びでした。この記事はその検証ログです。

:::message
筆者は新人エンジニアで、Vite 8 / Rolldown を触るのは初めてです。実行環境: macOS 26.5 (arm64) / Apple M2 Pro 10コア / 16GB RAM / Node v22.17.0 / pnpm 10.13.1。すべてローカル完結・無料・認証不要で試せます。
:::

想定読者は、Vite を普段なんとなく使っている新人〜実務経験の浅いエンジニアです。「Vite 8 に上げると何が変わるの？」を、宣伝文句ではなく手元の数字で知りたい人向けです。

## 使ったもの・環境

計測に使ったバージョンは以下のとおりです（再現性のため明記します）。

- OS / ランタイム: macOS 26.5 (arm64) / Apple M2 Pro / 16GB / Node **v22.17.0** / pnpm **10.13.1**
- バンドラ比較: **Vite 7.3.6 ↔ Vite 8.1.3**（Vite 8 の直接依存に `rolldown ~1.1.3`、実体 1.1.4）
- 追加検証: `rolldown-vite 7.3.1`（Vite 7 上に overrides で載せる先行検証用パッケージ）
- 主要ライブラリ: @vitejs/plugin-react 5.2.0 / react 19.2.7 / react-router-dom 7.18.1 / recharts 3.9.1 / zustand 5.0.14 / lodash-es / dayjs

:::message alert
Vite 8 は **Node 20.19+ / 22.12+** が必須です。まず `node -v` で満たしているか確認してから始めると、前提エラーで詰まらずに済みます。
:::

作ったのは 3 ページ（Home / Dashboard / About）＋ zustand ストアの最小 React アプリです。あえて重めの recharts を入れて、バンドルを膨らませ（約1200モジュール・JSバンドル約590KB）、バンドラの差が数字に出やすいようにしました。

「できたと言える完了条件」はこう決めました。

1. Vite 7 で build・dev 起動が成功し、cold/warm 各3回計測できる
2. Vite 8 に移行後、同じアプリ・同じ条件で計測できる
3. 両者を1つの比較表にまとめ、差（倍率）を出せる
4. preview / dev 画面を Playwright でスクショ保存できる

結果はすべて達成しました。以下、手順を追っていきます。

## 環境構築

### 雛形を作る（対話プロンプトは出なかった）

まず `create-vite` で React + TypeScript の雛形を作ります。

```bash
pnpm create vite@latest vite-bench --template react-ts
cd vite-bench && pnpm install
pnpm ls vite   # => vite 8.1.3
```

事前には「対話プロンプトで止まるかも（`-- --template` が必要かも）」と身構えていたのですが、**`--template react-ts` を付けるだけで対話なしにスキャフォールドが完了**しました。現行の `create-vite` は引数を渡せばそのまま非対話で作ってくれるようです。

そして `create vite@latest` は当然ながら**最新の Vite 8.1.3 を入れます**。比較の起点は Vite 7 にしたいので、ここからバージョンを固定していきます。

### Vite 7 に固定したら、プラグインの peer が合わなかった（詰まり①）

比較の起点として Vite を 7 系に下げます。

```bash
pnpm add -D vite@7
# WARN  Issues with peer dependencies found
# └─┬ @vitejs/plugin-react 6.0.3
#   └── ✕ unmet peer vite@^8.0.0: found 7.3.6
```

scaffold 直後に入る `@vitejs/plugin-react` が 6.x で、これは **Vite 8 専用**でした。Vite を 7 に下げると peer が合わなくなります。対処はプラグインも Vite 7 対応版に揃えること。

```bash
npm view @vitejs/plugin-react@5 peerDependencies
# 5.2.0 => vite: ^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0
pnpm add -D @vitejs/plugin-react@5   # => 5.2.0（v7・v8 両対応）
```

`@vitejs/plugin-react@5.2.0` は Vite 7 / 8 の両方に対応しているので、**比較検証では 5.2.0 で揃えておくと、あとで Vite 8 に上げるときプラグインを触らずに済みます**（実際そうなりました）。詳しくは後述の「詰まった点」で。

### 依存追加とページ増設

バンドルを膨らませるための依存を足します。

```bash
pnpm add react-router-dom zustand dayjs recharts lodash-es
# react-router-dom 7.18.1 / zustand 5.0.14 / recharts 3.9.1 / lodash-es / dayjs
```

3 ページ＋ zustand ストアを作りました。ストアはこれだけのシンプルなカウンタです。

```ts:src/store.ts
import { create } from 'zustand'

type CounterState = {
  count: number
  inc: () => void
  dec: () => void
}

export const useCounter = create<CounterState>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
  dec: () => set((s) => ({ count: s.count - 1 })),
}))
```

ルーティングは react-router-dom で 3 ページを繋ぎます。

```tsx:src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import About from './pages/About'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  )
}
```

Dashboard は recharts で折れ線を描き、あえて重いページにしています。

```tsx:src/pages/Dashboard.tsx
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { range } from 'lodash-es'

const data = range(0, 12).map((m) => ({
  month: `${m + 1}月`,
  value: Math.round(Math.abs(Math.sin(m)) * 100),
}))

export default function Dashboard() {
  return (
    <div data-testid="dashboard">
      <h1>Dashboard</h1>
      <div style={{ width: 600, height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Link to="/">Home</Link>
    </div>
  )
}
```

### dev 起動を確認する

Vite 7 で dev を起動すると `VITE v7.3.6 ready in 167 ms`（`http://localhost:5173/`）で立ち上がりました。Playwright で開いて DOM も確認しています（`{homeVisible:true, today:"今日は 2026-07-02 です"}`）。

![Vite 7 dev の Home 画面（カウンタ・日付・ナビ）](/images/vite8-rolldown-build-benchmark-log/01-vite7-dev-home.png)
*Home。dayjs で今日の日付、zustand でカウンタ。*

![Vite 7 dev の Dashboard（recharts の折れ線）](/images/vite8-rolldown-build-benchmark-log/02-vite7-dev-dashboard.png)
*Dashboard。recharts の折れ線チャートが描画されている。*

## 実際に試したこと（計測と移行）

### 計測条件の決め方

計測は build / dev それぞれ **cold と warm を各3回**取りました。定義はこうです。

- **cold**: 各回の前に `rm -rf node_modules/.vite dist` してキャッシュを消す
- **warm**: キャッシュを保持したまま連続実行

計測はシェルスクリプトにまとめて、ラベル（`vite7` / `vite8`）を変えて回しました。

```bash:measure.sh（抜粋）
echo "### BUILD COLD x3 (rm -rf node_modules/.vite dist before each) ###"
for i in 1 2 3; do
  rm -rf node_modules/.vite dist
  /usr/bin/time -p pnpm run build 2>build_time_$i.txt | tail -6
  grep '^real' build_time_$i.txt
done
```

`pnpm run build` の中身は `tsc -b && vite build` です。**この点があとで効いてきます**（build 全体の `real` には型チェックの時間が乗る）。

### build が型エラーで落ちた（詰まり②）

Vite 7 で最初に build しようとしたら、バンドル以前に型チェックで落ちました。

```
src/pages/About.tsx(2,28): error TS7016: Could not find a declaration file for module 'lodash-es'.
  Try `npm i --save-dev @types/lodash-es` ...
src/pages/Dashboard.tsx(3,23): error TS7016: ...'lodash-es' implicitly has an 'any' type.
src/pages/Dashboard.tsx(5,32): error TS7006: Parameter 'm' implicitly has an 'any' type.
 ELIFECYCLE  Command failed with exit code 2.
```

`lodash-es` は型定義を同梱していないので、`@types/lodash-es` を入れる必要がありました。

```bash
pnpm add -D @types/lodash-es
```

これで `tsc -b && vite build` が通るようになりました。ここで「そうか、`pnpm build` は型チェック込みなんだ」と実感します。この気づきが、後半の比較の伏線になります。

### Vite 7 の計測とスクショ

Vite 7 の build は cold で `built in` 表示が **1.47 / 1.39 / 1.39 s**、`pnpm build` 全体の `real` は **3.00 / 2.59 / 2.57 s**。dev の `ready in` は **108 / 107 / 107 ms** でした。

本番ビルドを preview で開いた画面がこちらです。

![Vite 7 本番ビルドの preview 表示](/images/vite8-rolldown-build-benchmark-log/03-vite7-preview.png)
*Vite 7 の `pnpm run preview`（ポート4173）。表示は正常。*

![Vite 7 preview の Dashboard](/images/vite8-rolldown-build-benchmark-log/04-vite7-preview-dashboard.png)
*preview でも折れ線チャートは正しく描画されている。*

### Vite 8 へ移行する

いよいよ Vite 8 に上げます。プラグインを 5.2.0 に揃えてあるので、コマンド1つです。

```bash
pnpm add -D vite@8
# devDependencies:
# - vite 7.3.6
# + vite 8.1.3
# （peer 警告なし。plugin-react 5.2.0 が vite^8.0.0 も満たすため）
```

Rolldown が統合されているか確認します。

```bash
node -e "console.log(require('vite/package.json').dependencies.rolldown)"  # ~1.1.3
ls node_modules/.pnpm | grep -i rolldown  # rolldown@1.1.4, @rolldown+binding-darwin-arm64@1.1.4
```

Vite 8 の直接依存に `rolldown` が入っており、**フラグ不要でデフォルト統合**されていました。移行で壊れた箇所はなし。プラグインを 5.2.0 で揃えておいたおかげで、無修正でそのまま移行できました。

事前には「BETA 期に報告されていた警告 `validate output options ... Invalid key` が出るかも」と予測していたのですが、**素の react-ts ＋ デフォルト設定では出ませんでした**（詰まり③として後述）。代わりに、チャンクサイズ警告の文言が `build.rolldownOptions.output.codeSplitting` ＋ `rolldown.rs` へのリンクに変わっていて、Rollup → Rolldown に切り替わった証跡が確認できました。

### Vite 8 の計測とスクショ

Vite 8 の build は cold で `built in` が **185 / 173 / 167 ms**、`real` は **1.49 / 1.36 / 1.33 s**。dev の `ready in` は **100 / 106 / 102 ms**。出力は 592.47KB / 1235 modules でした。

![Vite 8 本番ビルドの preview 表示（Vite 7 と同一）](/images/vite8-rolldown-build-benchmark-log/05-vite8-preview.png)
*Vite 8（Rolldown）の preview。見た目は Vite 7 とまったく同じ。*

![Vite 8 preview の Dashboard（移行で壊れていない証跡）](/images/vite8-rolldown-build-benchmark-log/06-vite8-preview-dashboard.png)
*Dashboard も同一。移行で表示が壊れていないことを確認。*

## 詰まった点と解決（この記事の核）

今回詰まったのは3件。すべて解決しました。

### ① Vite 7 固定で plugin-react の peer が合わない

- **症状**: `pnpm add -D vite@7` で `unmet peer vite@^8.0.0: found 7.3.6`
- **原因**: scaffold 直後の `@vitejs/plugin-react` が 6.x（Vite 8 専用）だった
- **効いた対処**: `pnpm add -D @vitejs/plugin-react@5`（5.2.0 は v7/v8 両対応）
- **学び**: 新旧比較で「バージョンを固定する」ときは、**プラグインまで一緒に揃える**のが落とし穴回避のコツ。両対応版（5.2.0）で揃えておくと、後の移行でプラグインを触らずに済みます。

### ② build が `TS7016`（lodash-es の型が無い）で失敗する

- **症状**: 上に貼ったとおり `tsc -b` が exit 2 で落ちる
- **原因**: `pnpm build` は `tsc -b && vite build`。`lodash-es` は型定義を同梱しない
- **効いた対処**: `pnpm add -D @types/lodash-es`
- **学び**: **ビルドは型チェック込み**。バンドラの速さ以前に、まず `tsc` で落ちることがあります。これが後半の「バンドラを速くしてもビルド全体は宣伝ほど速くならない」話に繋がります。

### ③ 予測した警告 `Invalid key` が出なかった

- **症状（想定との相違）**: BETA 期の既知警告 `validate output options ... Invalid key` を予測していたが、**出なかった**
- **原因**: 素の react-ts ＋ デフォルト設定では、Rollup 固有オプションを使っていないため未発生
- **対処**: 追加対処は不要。代わりにチャンク警告の文言・リンク先の変化（`rollupjs.org` → `rolldown.rs`）で Rolldown 化を確認できた
- **学び**: BETA 期の既知警告が安定版では出ないこともあります。予測と実測がズレたときは、正直にそのまま書くのが検証ログの価値かなと思いました。

:::message
補足: 今回は Node 要件エラーや create-vite の対話プロンプトで詰まることは**ありませんでした**。事前に身構えていたわりに問題化しなかった、というのも1つの知見です。
:::

## 分かったこと・Vite 7 との比較

計測結果を1つの表にまとめます。vite の `built in` 表示（＝バンドル処理のみ）と、`pnpm run build` 全体の `real`（＝`tsc -b` 込み）を分けて記録しました。

| 対象 | build cold `built in`(3回) | build warm `built in`(3回) | `pnpm build` real cold(3回) | dev cold ready(3回) | dev warm ready(3回) | 出力(JS / gzip / modules) |
|---|---|---|---|---|---|---|
| Vite 7.3.6 | 1.47 / 1.39 / 1.39 s | 1.39 / 1.36 / 1.41 s | 3.00 / 2.59 / 2.57 s | 108 / 107 / 107 ms | 103 / 108 / 108 ms | 598.82 KB / 183.99 KB / 1267 |
| Vite 8.1.3 | 185 / 173 / 167 ms | 175 / 164 / 165 ms | 1.49 / 1.36 / 1.33 s | 100 / 106 / 102 ms | 95 / 95 / 94 ms | 592.47 KB / 180.11 KB / 1235 |
| 倍率(7÷8, 中央値) | **約 8.0x** | 約 8.4x | **約 1.9x** | 約 1.05x | 約 1.14x | ほぼ同等（微減） |

ここから読み取れたことです（あくまで小規模アプリでの手元計測です）。

- **バンドル処理そのもの（Rolldown vs Rollup+esbuild）は約8倍速い**。公式が言う「10〜30x」に届かないのは、今回が約1200モジュールの小規模アプリだからで説明がつきそうです。規模が大きいほど恩恵が見えるのだと思います。
- **一方 `pnpm run build` の体感（`real`）は約1.9倍止まり**。理由は `tsc -b`（型チェック）に約1.1〜1.2秒かかり、これが**両バージョン共通の固定コスト**として支配的になるためです。「バンドラを速くしてもビルド全体は宣伝ほど速くならない」——これが新人としていちばん刺さった学びでした。純粋なバンドラ速度を見たいなら vite の `built in` 表示を、体感を見たいなら `real` を見る、と使い分けが要ります。
- **dev の `ready in` はこの規模ではほぼ差が出ません**（1.05〜1.14x、どちらも100ms前後）。dev はもともと十分速く、Rolldown 化の恩恵は本番ビルドほど見えませんでした。
- **出力バンドルは Vite 8 の方がわずかに小さい**（598.82 → 592.47 KB、モジュール数 1267 → 1235）。移行しても見た目・サイズは実質同等でした。

### （おまけ）rolldown-vite も触ってみた

Vite 8 が GA になる前の先行検証用パッケージ `rolldown-vite` も、Vite 7 上に overrides で載せて試しました。

```bash
# package.json に注入
#   "pnpm": { "overrides": { "vite": "npm:rolldown-vite@latest" } }
pnpm install
# + vite <- rolldown-vite 7.3.1 deprecated   ← 現在は非推奨表示
pnpm exec vite --version   # vite/7.3.1
pnpm run build             # rolldown-vite v7.3.1 building ... built in 214ms
```

build は `built in 214ms` で、Vite 8（167〜185ms）とほぼ同等でした（中身が同じ Rolldown なので当然）。ただし `rolldown-vite 7.3.1 deprecated` と非推奨表示が出ます。Vite 8 が GA になった今、先行検証用の overrides パッケージは役目を終えたようです。**2026-07 時点では、素直に Vite 8 を使うのが正解**、という現在地の記録です。

## まとめ

- **結果**: 完了条件はすべて達成。Vite 7 / 8 の build・dev を cold/warm 各3回計測し、比較表と倍率を出し、両版の画面を Playwright でスクショ保存できました。
- **所要時間**: 見積もり約4.0h に対し、AIエージェント単独の自動実行で実測約0.5h。
- **いちばんの学び**: 「バンドラの速度」と「ビルド全体の速度」は別物。Rolldown でバンドルは約8倍速くなったが、`tsc` の固定コストで `pnpm build` 全体は約1.9倍に落ち着いた。宣伝の倍率を鵜呑みにせず、自分のアプリで `built in` と `real` を分けて測るのが大事だと感じました。
- **どんな人に向いていそうか**: 新規プロジェクトなら Vite 8 に直行して問題なさそう（`rolldown-vite` は非推奨に）。恩恵が大きいのはモジュール数の多い大規模アプリだと思うので、次は規模を上げて再計測してみたいです。

### 最短の再現手順

```bash
pnpm create vite@latest vite-bench --template react-ts
cd vite-bench && pnpm install
pnpm add -D vite@7 @vitejs/plugin-react@5      # 比較の起点（peer を揃える）
pnpm add react-router-dom zustand dayjs recharts lodash-es
pnpm add -D @types/lodash-es                    # TS7016 回避
# ここで計測（各回前に rm -rf node_modules/.vite dist）
pnpm run build       # Vite 7
pnpm add -D vite@8   # 移行
pnpm run build       # Vite 8（Rolldown）
```

> 注意: 完全無料・ローカル完結・認証不要です。build の `real` は `tsc -b` 込みなので、バンドラ純粋速度を見るなら vite の `built in` 表示を使ってください。小規模アプリでは倍率が控えめに出ます。

## 参考リンク

https://vite.dev/

https://rolldown.rs/

https://vite.dev/guide/rolldown
