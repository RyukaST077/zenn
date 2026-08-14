---
title: "Deno.test.each() で TestContext を受け取ると TS2339 になる（引数の順序）"
date: "2026-08-14"
status: "resolved"
cause_category: "API"
tech: [deno, typescript, test]
error_type: [TS2339, ArgumentOrderMismatch]
library: [deno-test, assertSnapshot]
keywords: [deno, Deno.test.each, TestContext, assertSnapshot, TS2339, 引数順]
---

# 開発ナレッジ報告書

## タイトル

`Deno.test.each()` で `TestContext` を受け取ると TS2339 になる（引数の順序）

## 概要

`Deno.test.each()` のコールバックではケースの値が先、`TestContext` が最後に渡される。通常の
`Deno.test("name", (t) => ...)` と同じ感覚で `t` を第1引数へ置くと、ケース値と
`TestContext` の型が入れ替わり、`TS2339` が2か所に出る。ケース引数を先、`t` を後ろへ
並べることで解決する。

## 背景

- 作業内容: Deno 2.9の `Deno.test.each()` と `t.assertSnapshot()` を使ったパラメータ化テスト
- 技術スタック: Deno 2.9.5 / TypeScript 6.0.3

## 問題

通常の `Deno.test()` と同様に `TestContext` を先頭へ置いたところ、ケースのプロパティと
`assertSnapshot` の両方で型エラーになった。

```ts
Deno.test.each([
  { title: "Hello" },
])("renderHeader $title", async (t, { title }) => {
  await t.assertSnapshot(renderHeader({ title }));
});
```

## 環境

- macOS 26.5（arm64）
- Deno 2.9.5
- TypeScript 6.0.3

## エラー

```text
TS2339 [ERROR]: Property 'title' does not exist on type 'TestContext'.
])("renderHeader $title", async (t, { title }) => {
                                      ~~~~~
TS2339 [ERROR]: Property 'assertSnapshot' does not exist on type '{ readonly title: "Hello"; } | { readonly title: "こんにちは"; }'.
  await t.assertSnapshot(renderHeader({ title }));
          ~~~~~~~~~~~~~~
Found 2 errors.

error: Type checking failed.
```

## 試したこと

- `Deno.test()` と同じ `(t, caseValue)` の順序で記述したが、上記2件の型エラーになった。
- `--no-check` は型検査を飛ばすだけで引数の実体を直さないため、解決策として採用しなかった。

## 確認できた原因

`Deno.test.each()` はケースの値を先に展開し、`TestContext` を最後の引数として渡す。
エラーに現れた型も、`t` と考えていた第1引数がケース値、分割代入した第2引数が
`TestContext` と解釈されていることを示していた。

## 最終的な修正

ケース引数を先、`t` を最後へ置く。

```ts
Deno.test.each([
  { title: "Hello" },
])("renderHeader $title", async ({ title }, t) => {
  await t.assertSnapshot(renderHeader({ title }));
});
```

配列ケースでも、展開された位置引数の後ろへ `t` を置く（例: `(a, b, t) => ...`）。

## 検証

修正後はケース値が `{ title }`、末尾引数が `TestContext` として型付けされ、元の2件の
`TS2339` を解消できた。

## 制約

この記録は Deno 2.9.5 のAPIと型定義に基づく。将来のDenoでシグネチャが変わる場合は、
そのバージョンの `Deno.test.each()` の型定義を再確認する。

## 再発防止

- `Deno.test.each()` の型エラーがケース値と `TestContext` の双方に出たら、引数順を確認する。
- 型検査を無効化せず、コールバックのシグネチャを型定義に合わせる。
