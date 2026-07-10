---
title: "Playwright 1.61のパスキー検証、npm依存解決で止まった記録"
emoji: "🛑"
type: tech
topics: ["playwright", "webauthn", "npm", "testing"]
published: true
---

## 対象読者

- Playwright 1.61のパスキーAPIをローカルで試そうとしている方
- E2Eテストの実装前に、依存バージョンと停止条件をどう確認するか知りたい方
- 成功しなかった検証から、どこまでを事実として残せるか整理したい方

## 何を検証しようとしたか

Playwright 1.61で追加された`browserContext.credentials`を使い、ローカルの架空ユーザーに対するパスキー登録と、別のbrowser contextからの再ログインを試す計画でした。Playwright公式リリースノートは、このAPIが実物のセキュリティキーなしでWebAuthnに応答し、全ブラウザで利用できると説明しています。

https://playwright.dev/docs/release-notes#version-161

公式のパスキーガイドには、`credentials.get()`でcredentialを取り出し、別contextで`credentials.create()`と`install()`を使うパターンも示されています。また、保存するcredentialには秘密鍵が含まれるため、認証情報として扱う必要があります。

https://playwright.dev/docs/auth#passkeys-webauthn

今回の計画では、Chromium、Firefox、WebKitで同じspecを実行し、正常系、RP IDやoriginの不一致、challenge再利用、ChromiumのCDP方式との比較まで確認する予定でした。しかし、実際には依存関係の導入で停止条件に達しました。この記事はPlaywrightのパスキー機能の検証結果ではなく、そこへ到達できなかったセットアップ失敗の記録です。

## 検証環境

実行前に記録できた環境は次のとおりです。

| 項目 | 観測値 |
|---|---|
| OS | macOS 26.5（build 25F71） |
| Kernel | Darwin 25.5.0 arm64 |
| Node.js | v22.17.0 |
| npm | 10.9.2 |
| 指定したPlaywright | 1.61.0（未導入） |
| 指定したSimpleWebAuthn | server 13.3.1 / browser 13.3.1（未導入） |

最後の2行は`package.json`や実行結果から確認したバージョンではありません。インストールコマンドに指定した値であり、導入に失敗したため実バージョンとしては未検証です。

## 再現手順

検証用の隔離ディレクトリで`npm init`を実行した後、次のexact installを試しました。

```bash
npm init --yes
npm install --save-exact \
  playwright@1.61.0 \
  @simplewebauthn/server@13.3.1 \
  @simplewebauthn/browser@13.3.1
```

最初の実行は、既存のユーザー単位npm cacheにある一時ファイルを開けず、`EPERM`で終了しました。そこで、共有cacheの所有権変更や削除はせず、計画で許可していた1回だけの再試行としてcacheを隔離ディレクトリ内へ変更しました。

```bash
npm_config_cache="$PWD/.npm-cache" npm install --save-exact \
  playwright@1.61.0 \
  @simplewebauthn/server@13.3.1 \
  @simplewebauthn/browser@13.3.1
```

この再試行ではユーザー単位cacheのアクセス箇所を越え、npm registryのバージョン解決まで進みました。しかし、`@simplewebauthn/browser@13.3.1`に対する`ETARGET`で終了しました。

## 観測結果

時系列の結果は次のとおりです。

| 手順 | 結果 | 終了コード |
|---|---|---:|
| 環境情報の記録 | 成功 | 0 |
| `npm init --yes` | `package.json`を作成 | 0 |
| exact install | ユーザー単位cacheへのアクセスで`EPERM` | 1 |
| run-local cacheで再試行 | `@simplewebauthn/browser@13.3.1`の解決で`ETARGET` | 1 |

保持したエラーの要点は以下です。個人のパス要素とランダムな一時ファイル名は記事向けに伏せています。

```text
npm error code EPERM
npm error syscall open
npm error path /Users/<USER>/.npm/_cacache/tmp/[redacted-temporary-name]
npm error Your cache folder contains root-owned files
```

```text
npm error code ETARGET
npm error notarget No matching version found for @simplewebauthn/browser@13.3.1.
```

ここから直接言えるのは、最初のcache権限エラーだけがこの実行の最終的な阻害要因ではなかったことです。run-local cacheを使った再試行によって、次の依存バージョン解決の問題まで観測できました。

一方、次の項目は一切実行できていません。

- Playwright本体と3ブラウザの導入
- ローカルWebAuthnアプリの作成
- `browserContext.credentials`を使うspec
- Chromium、Firefox、WebKitでの登録・ログイン
- 意図した失敗ケースとCDP比較

したがって、この実行にはPlaywright 1.61のパスキーAPIが動く、または動かないと判断できる証拠はありません。

## 失敗と対処

### 1. ユーザー単位npm cacheの`EPERM`

リポジトリ内の既知事例を`EPERM`、`root-owned`、`npm cache`、`_cacache`で検索しましたが、適用できる確認済みの対処は見つかりませんでした。

そこで共有cacheを修復する代わりに、今回の隔離ディレクトリ内へcacheを向けました。この変更で最初のアクセス箇所は越えられました。ただし、これは共有cache自体を直したことを意味しません。元の`EPERM`は実行環境固有の状態として残っています。

### 2. exact versionの`ETARGET`

再試行は`@simplewebauthn/browser@13.3.1`を解決できず停止しました。計画では依存取得の再試行を1回に限定し、バージョンも固定していました。そのため、別バージョンへの置き換えや追加調査には進んでいません。

ここでバージョンを推測して変更すると、ライブラリ間の互換性やAPI前提も変わる可能性があります。今回の結果から導ける次の作業は、実際に公開されている互換バージョンを一次情報で確認し、固定バージョンとAPI前提を計画から更新して、新しい隔離ディレクトリで再実行することまでです。この記事では代替バージョンを提示しません。

## 制限事項

- npmの公開履歴や`@simplewebauthn/browser@13.3.1`の代替は調査していません。
- Playwright 1.61.0はインストールも実行もできていません。
- browser binaryのダウンロードには到達していません。
- WebAuthn ceremony、仮想認証器、物理認証器のいずれも試していません。
- 個々のコマンドの開始・終了時刻は残せず、実行全体の時刻とnpm retry logの時刻だけを記録しました。
- 結果はこのmacOS環境での1回の実行に限られます。

## まとめ

今回確認できたのは、PlaywrightのパスキーAPIではなく、その手前にある2段階のセットアップ失敗でした。最初は既存npm cacheへの`EPERM`、隔離cacheを使った1回の再試行ではexact versionに対する`ETARGET`です。

失敗時に役立ったのは、依存バージョン、再試行回数、危険な回避をしないこと、停止条件を先に固定していたことでした。これにより、共有cacheを壊さずに次の阻害要因まで切り分けつつ、未実行のPlaywright/WebAuthn機能について成功も失敗も断定せずに終えられました。

## 参考資料

- [Playwright Release notes: Version 1.61](https://playwright.dev/docs/release-notes#version-161)（2026-07-10閲覧）
- [Playwright Authentication: Passkeys (WebAuthn)](https://playwright.dev/docs/auth#passkeys-webauthn)（2026-07-10閲覧）
- [SimpleWebAuthn GitHub repository](https://github.com/MasterKale/SimpleWebAuthn)（2026-07-10閲覧）
- [SimpleWebAuthn server documentation](https://simplewebauthn.dev/docs/packages/server)（2026-07-10閲覧）
