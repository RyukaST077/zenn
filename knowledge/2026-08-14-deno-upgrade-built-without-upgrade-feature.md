---
title: "deno upgrade が built without the upgrade feature で拒否される"
date: "2026-08-14"
status: "resolved"
cause_category: "Environment"
tech: [deno, homebrew, macos]
error_type: [UpgradeFeatureDisabled]
library: [deno, homebrew]
keywords: [deno upgrade, built without the upgrade feature, brew upgrade deno, Homebrew, PATH]
---

# 開発ナレッジ報告書

## タイトル

`deno upgrade` が `built without the upgrade feature` で拒否される

## 概要

Homebrewで導入したDenoはupgrade機能を無効にしてビルドされているため、`deno upgrade` を
実行できない。エラーメッセージどおり、導入元と同じHomebrewの `brew upgrade deno` で
更新する。

## 背景

Deno 2.9の `Deno.test.each()` と `t.assertSnapshot()` を試すため、Deno 2.8.3から
2.9.5へ更新しようとした。

## 問題

公式案内で一般的な `deno upgrade` を実行したが、upgrade機能がないとして終了コード1に
なった。

## 環境

- macOS 26.5（arm64）
- 更新前: Deno 2.8.3
- 更新後: Deno 2.9.5
- 実体: `/opt/homebrew/bin/deno`

## エラー

```text
$ deno upgrade
error: This deno was built without the "upgrade" feature. Please upgrade using the installation method originally used to install Deno.
exit=1
```

## 試したこと

- `deno upgrade` はバイナリにupgrade機能が含まれず失敗した。
- `which -a deno` で実体を確認し、Homebrew管理のバイナリだと特定した。

## 確認できた原因

`/opt/homebrew/bin/deno` はupgrade機能を無効にしたHomebrewビルドだった。単なる権限不足では
なく、実行中のバイナリに `deno upgrade` の機能自体が含まれていない。

## 最終的な修正

導入元と同じHomebrew経由で更新した。

```bash
brew update
brew upgrade deno
deno --version
```

## 検証

`deno --version` が次の更新後バージョンを表示することを確認した。

```text
deno 2.9.5 (stable, release, aarch64-apple-darwin)
```

更新には約4分かかり、その大半は `brew update` によるportable-rubyの再取得だった。

## 制約

この対処はHomebrew管理のDenoが対象。公式インストーラーや別のパッケージマネージャーで
導入した場合は、その導入経路に対応する更新方法を使う。

## 再発防止

- 更新前に `which -a deno` で実行中バイナリの導入経路を確認する。
- 別経路で再インストールしてPATHを二重化せず、まず既存のパッケージマネージャーで更新する。
