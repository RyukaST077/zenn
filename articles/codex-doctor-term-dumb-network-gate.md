---
title: "codex doctorのTERM=dumb直しではCIゲートの赤は消えない場合がある"
emoji: "🩺"
type: "tech"
topics: ["codex", "cli", "ci", "sandbox", "ai"]
published: true
---

`codex doctor` をCIのヘルスチェックゲートやエージェントハーネスの事前チェックに組み込み、ネットワーク遮断（no-egress）のコンテナ内で実行している状況を想定する。人間可読な出力には `TERM=dumb` に起因する `terminal` カテゴリの赤い警告が目立って表示されるため、「他のCLIツールでもよくある非tty出力のノイズ」と判断し、`TERM=xterm-256color` を設定すれば `codex doctor` の終了コードが0になる（ゲートが通る）と期待しがちである。この記事は、その期待が少なくとも1つのネットワーク遮断済みワークスペースでは成立しなかったという再現可能な反例を示す。

## 結論

ネットワーク遮断済みのワークスペースでは、`TERM`/`NO_COLOR` を実値に変えても直るのは見た目上の `terminal.env` チェックだけであり、`codex doctor` の `overallStatus` と終了コードは変わらなかった。別カテゴリの `network.provider_reachability` がその実行環境ではもともと `fail` のままだったため、集約結果が `fail`/終了コード`1`に固定され続けたからである。`overallStatus`/終了コードは「どれか1つ以上のカテゴリが失敗した」ことしか意味せず、`terminal` カテゴリの状態を直接表すものではない。

## 検証方法

同一の認証済みワークスペース内で `codex doctor --json` を2回連続実行し、2回目だけ `TERM`/`NO_COLOR` を明示的に上書きした。

```
codex doctor --json                                  # 1回目（環境変数はそのまま）
env TERM=xterm-256color NO_COLOR= codex doctor --json # 2回目（TERM/NO_COLORのみ変更）
```

事前登録した検証スクリプト（依存ライブラリなし）は、2回分の `--json` 出力を `status` フィールドを持つオブジェクトごとに `カテゴリ.パス -> status` へフラット化し、次の条件を機械的にチェックする。

- 2回のチェックパス集合が完全に一致すること
- `terminal` 以外の全パスのstatusが2回で完全に同一であること（単一変数統制）
- `terminal` 系のいずれか1パスは実際に変化していること（変化がなければ「判定不能」として扱う）
- 上記が満たされて初めて `overallStatus`/終了コードが連動して変化したかどうかを判定する

この設計により、「TERM以外の何かも一緒に変わってしまって結果が汚染された」可能性をコード側で排除できる。

- CLI: `codex-cli 0.147.0`（macOS aarch64、npmインストール）
- ワークスペース設定: `sandbox_workspace_write.network_access=false`（アウトバウンドネットワークなし）
- モデル/effortは指定なし（アカウントデフォルト）

## 観測結果

| 実行 | `terminal.env` | `network.provider_reachability` | `overallStatus` | 終了コード |
|---|---|---|---|---|
| 1回目（環境そのまま、`TERM=dumb`, `NO_COLOR=1`） | `fail` | `fail`（ChatGPTベースURLへの接続失敗） | `fail` | `1` |
| 2回目（`TERM=xterm-256color`, `NO_COLOR=`） | `ok` | `fail`（変化なし） | `fail`（変化なし） | `1`（変化なし） |

`terminal.env` 以外に報告された16個のチェックパス（`app_server.status`、`auth.credentials`、`config.load`、`git.environment`、`installation`、`mcp.config`、`network.env`、`network.provider_reachability`、`network.websocket_reachability`、`runtime.provenance`、`runtime.search`、`sandbox.helpers`、`state.paths`、`state.rollout_db_parity`、`system.environment`、`updates.status`）はすべて2回の実行で完全に一致しており、単一変数統制は成立していた。`network.websocket_reachability` も両回とも `warning` のまま変化なし。

検証スクリプトはこの結果を「`TERM`単独では`overallStatus`は動かない」という事前登録済みの反証側の結果として、終了コード0（＝機械判定として矛盾なく分類できた）で確定した。

## なぜ「TERMを直せば直る」と誤解しやすいのか

この記事が参照した元の調査は、通常のネットワーク到達可能なシェル（今回のようなサンドボックス外）で非公式に一度観測したケースに基づいており、そちらでは `network.provider_reachability` が両回とも `ok` で、`terminal.env` だけが失敗していたと報告されている。その条件では `TERM` を直すだけで唯一の失敗カテゴリが消え、結果として `overallStatus` も連動して変わったように見えたと考えられる。しかしその観測は生データが残っておらず、本記事の検証対象ではない。今回の実行環境（ネットワーク遮断済みワークスペース）では `network.provider_reachability` が独立して失敗し続けていたため、`terminal` を直しても集約結果に影響しなかった、というのが今回確認できた事実である。

`overallStatus` はチェックカテゴリ横断の集約値（最も悪いステータスが勝つ）に見える、という解釈はこの2つの観測と矛盾しない。変わったのはCLI内部のロジックではなく、CLIを実行した環境のネットワーク到達性である。

## 実務への影響とアクション

サンドボックス化・no-egressのDockerコンテナやエージェントハーネス内で `codex doctor` をCIゲートに使っているチームは、次を前提にすべきではない。

- `codex doctor` の終了コードが0であることは「認証・設定が健全」であることの証明にはならない（他のカテゴリが偶然すべて通っているだけかもしれない）
- 終了コードが1のとき、`terminal` のような見た目上目立つカテゴリを直せば必ず0になる、という期待

代わりに次のいずれかを行う。

1. `codex doctor --json` の出力をパースし、ゲートが本当に気にすべきカテゴリ（例: `auth.*`、`config.*`）だけを個別に抽出して判定する。`overallStatus`/終了コードそのものをゲート条件に使わない。
2. ネットワーク遮断済みの実行環境では `network.provider_reachability`/`network.websocket_reachability` が独立して `fail`/`warning` になり得ることを前提とし、そのカテゴリをゲート対象から明示的に除外する。

検証に使ったフラット化ロジックはそのまま読者側のCI runnerでも再利用できる。

```js
// status を持つ値を「category.path -> status」へ再帰的にフラット化する例
function flatten(obj, prefix, out) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      if ("status" in value) out[path] = value.status;
      flatten(value, path, out);
    }
  }
  return out;
}
```

## 検証条件と限界

- 検証日: 2026-08-28。単一サンプル・単一ホスト（`codex-cli 0.147.0`、macOS aarch64、npmインストール）。他OS・他インストール方法・`0.149.0`以降（changelog記載の追加チェックを含む）では未検証。
- この反証は「ネットワーク遮断済みワークスペース（`network_access=false`）」という条件に固有である。ネットワーク到達可能なCI runnerでは元の調査が非公式に観測した「`TERM`単独でoverallStatusが連動する」という挙動が成立する可能性があり、これは本検証では再現も反証もしていない。未検証のまま前提にしないこと。
- 検証スクリプトはstatus文字列の一致・不一致のみを機械的に比較しており、`overallStatus` がどう集約されるかというCLI内部のソースコードレベルの根拠までは確認していない。あくまで2回のペア実行間で経験的に成り立った関係である。
- `--json` 出力についての検証であり、`--summary` などの人間可読出力の挙動は対象外。
- モデル/effortはアカウントデフォルトのまま（明示指定なし）で、解決済みバックエンドの正確な特定はできていない。
