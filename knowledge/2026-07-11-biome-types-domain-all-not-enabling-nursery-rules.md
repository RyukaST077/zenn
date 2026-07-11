---
title: "Biome の linter.domains.types を \"all\" にしても nursery の型認識ルールが自動発火しない"
date: "2026-07-11"
cause_category: "Configuration"
tech: [node, typescript, biome]
error_type: [SilentNoOp, ConfigMisunderstanding]
library: ["@biomejs/biome"]
keywords: [biome, type-aware, types domain, domains, "all", "recommended", nursery, noFloatingPromises, noUnsafePlusOperands, useExhaustiveSwitchCases, scanner, inference engine]
status: "resolved"   # resolved | workaround | unresolved
---

# 開発ナレッジ報告書

## タイトル
Biome の linter.domains.types を "all" にしても nursery の型認識ルールが自動発火しない

## 概要
Biome 2.5.3 で型認識lint（`types` ドメイン）を試すと、`biome.json` に
`"linter": { "domains": { "types": "all" } }` を書いても、`noFloatingPromises` /
`noUnsafePlusOperands` / `useExhaustiveSwitchCases` などの型依存バグが 1 件も検出されない
（エラー0・exit 0）。これらのルールが nursery（実験）グループのため。`rules.nursery` で
各ルールを `"error"` に**明示指定**すると 3 つとも発火した。

## 背景
- プロジェクト: 024_zenn（run-practice で Biome 型認識lint を検証中）
- 技術スタック: Node.js v22.17.0, @biomejs/biome 2.5.3, macOS 26.5
- 作業内容: 型依存バグ3種（未awaitPromise / number+bigint / switch網羅漏れ）を仕込んだ
  最小TSに対し `npx @biomejs/biome lint` で検出させたかった

## 問題
- 期待した挙動: `domains.types: "all"` で nursery 含む型認識ルールが有効になり検出される
- 実際の挙動: `types: "recommended"`（stableのみ）でも `types: "all"` でも検出 0 件。
  `--verbose` では "Scanned project folder" は出る（scanner は起動している）が診断は出ない。

## 原因
今回検出したい3ルールは全て **nursery グループ**。`domains.types: "recommended"` は
stable ルールのみを対象にするため発火しない。`"all"` にしてもこの環境では nursery ルールが
自動では有効化されず、診断が出なかった（ドキュメント上は all=nursery含む、だが実挙動は
個別有効化が必要だった）。

## 解決方法 / 効いた対処
`biome.json` の `rules.nursery` で使いたい型認識ルールを個別に `"error"` 指定する。

```json
{
  "linter": {
    "enabled": true,
    "domains": { "types": "all" },
    "rules": {
      "preset": "recommended",
      "nursery": {
        "noFloatingPromises": "error",
        "noUnsafePlusOperands": "error",
        "useExhaustiveSwitchCases": "error"
      }
    }
  }
}
```

これで 3 ルールとも発火（`lint/nursery/noFloatingPromises` 他）。

補足: 型認識ルールを個別に有効化すると、ルールの有効化自体が Biome Scanner（型推論エンジン）
を起動するため、`domains.types` を `"none"` にしても検出は消えない。「型認識ON/OFFの対比」を
見たい場合は domains トグルではなく、ルール自体のON/OFF（=素の recommended との比較）で行う。

## 予防・再発防止
- 使いたい型認識ルールが nursery か stable かを先に確認する（Biome 公式 /linter/domains/）。
  nursery なら `domains` 任せにせず `rules.nursery.<rule>: "error"` で明示する。
- 検出0でも「動いていない」と即断しない。`--verbose` の "Scanned project folder" で
  scanner 起動を確認し、ルールの有効/nursery 扱いを疑う。
