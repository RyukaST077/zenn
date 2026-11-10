---
title: "Codex CLIのconfig移行チェックリスト: untrustedは即エラー、on-failureは無音でnever化"
emoji: "🧱"
type: tech
topics: [codex, cli, aiagent, security]
published: false
---

`codex login`のサブスク認証で`workspace-write`のローカル対話利用をしていて、設定をCI無人実行や複数プロジェクト共有用の`config.toml`にまとめようとすると、次の3つに必ずぶつかります。

- 古い設定例やブログに残っている`approval_policy = "untrusted"`をそのまま使い回してよいか
- 同じく古い設定例に残る`approval_policy = "on-failure"`(ドキュメント上は「deprecated」)をどう扱うか
- betaの`default_permissions`(permission profile)を既存の`sandbox_mode`/`approval_policy`の隣に足したくなったとき、何が起きるか

公式ドキュメントは「`untrusted`はno longer supported」「`on-failure`はdeprecated」「permission profileは旧来のsandbox設定とdo not compose」と書いていますが、実際にそれぞれを動かしたときに起きるのが起動前の確定的なエラーなのか、それとも片方が無音で読み替えられる誤動作なのかまでは書かれていません。

2026年11月、codex-cli `0.164.0`でこの3条件を確認しました。うち1件(`default_permissions`をテーブルなしで追加)は決定的なharnessで実行し、独立した検証器がプログラムで判定しています。残り2件(`untrusted`/`on-failure`)は同じ調査内で手動の端末セッション1回ずつを記録したものです。この記事ではこの2つの証跡レベルを区別した上で、3条件すべてを結果として提示し、ユースケース別の`config.toml`設定例と監査チェックリストにまとめます。

4つ目の検証項目として調査時に計画していた「CLIフラグ(`--sandbox`/`--ask-for-approval`)がconfig.toml側の値より優先されること」は、どの記録にも実行済みの証跡がないため、この記事では確認せず範囲外のままにしています。

## 確認した3つの壊れ方

### 1. `approval_policy = "untrusted"` は起動前に確定的にハードエラー

証跡レベル: 手動端末セッション1回、harness未実行、retryなし(`research/agent/agent-knowhow-codex-approval-profile-decision-20261106-2007.md` §3-1)。

```
$ codex -c approval_policy=untrusted exec "echo hi"
Error: approval_policy = "untrusted" is no longer supported; remove this setting
```

公式ドキュメントの「Codex and ChatGPT Work no longer support `untrusted` as a selectable approval policy.」[^sandboxing]という記述と一致し、モデル呼び出し前にCLIが起動そのものを拒否することを確認しました。

```text
IF config.toml または -c 経由で approval_policy = "untrusted" を指定する
THEN codex exec は起動時に非ゼロ終了し、
  "is no longer supported" を含むエラーで停止する
```

### 2. `approval_policy = "on-failure"` はエラーも警告も出さず無音で`never`に読み替え

証跡レベル: 手動端末セッション1回、harness未実行、retryなし(同上 §3-2)。

```
$ codex -c approval_policy=on-failure --sandbox read-only exec "echo hi"
...
approval: never
sandbox: read-only
...
```

stdout/stderrを分離して確認しても、非推奨であることを示す警告文は一切出力されません。ドキュメントは`on-failure`を「deprecated」とだけ記載しており[^config-reference]、実際にどう壊れるかはCLIを動かすまで分かりません。しかも同じ「廃止/非推奨」カテゴリの設定なのに、`untrusted`は起動時エラー、`on-failure`は無音で最も緩い`never`への読み替えという非対称な壊れ方をする点が、設定の棚卸しをする読者が実際に踏む罠です。

```text
IF config.toml または -c 経由で approval_policy = "on-failure" を指定する
THEN codex exec はエラーも警告も出さずに起動し、
  実効の approval_policy は "never" として扱われる
```

### 3. `default_permissions` を`[permissions.<name>]`テーブルなしで追加すると起動時エラー

証跡レベル: 決定的な自動harness1ケース、独立した検証器(`verify.mjs`)による判定付き(`logs/agent/run-codex-default-permissions-table-boundary-20261107-0945-20261107-052527/execution-log.md`)。3条件のうち、唯一この自動harnessで再現されたものです。

固定した起動条件は次のとおりです。

```sh
codex exec \
  --ephemeral --ignore-user-config --ignore-rules --skip-git-repo-check \
  --json -a never --sandbox workspace-write \
  -c sandbox_workspace_write.network_access=false \
  -C <WORKSPACE> \
  '<PROMPT>'
```

この固定契約に対して、唯一の操作変数として`-c default_permissions='"read-only"'`をプロンプト直前に追加し、`[permissions.<name>]`テーブルは一切定義しませんでした。モデルのoverrideなし、sandboxは明示的に`workspace-write`(`read-only`ではない)、認証は既存の`codex login`サブスク認証のみです。

| 項目 | 記録した条件 |
| --- | --- |
| 検証日 | 2026-11-06 |
| Codex CLI | `codex-cli 0.164.0` |
| 認証 | `codex login`済みサブスク認証のみ |
| 固定approval/sandbox | `-a never --sandbox workspace-write` |
| 操作変数 | `-c default_permissions='"read-only"'`(テーブルなし) |
| session | `--ephemeral`、新規使い捨てworkspace |
| サンプル数 | 1ケース、retryなし |

wrapperはこの固定契約が実際に実行バイナリへ渡っているか自体をassertし、不一致があれば実行前にfailする設計です。実行対象は本物の認証済みCodexバイナリで、fakeのoffline CLIではありません。記録された事実は次の4点で、すべて独立した検証器がプログラムで確認しています。

| 確認項目 | 結果 |
| --- | --- |
| プロセス終了コード | `1`(非ゼロ) |
| timeout | なし |
| stderrに`default_permissions requires a`を含む | はい |
| `turn.completed`イベント数 | `0`件 |

`final_text`は`null`、イベントログ(`agent-events.jsonl`)は空で、モデルが一度も呼ばれなかったことと一致します。検証器はこの4条件すべてを満たした場合だけを事前登録した`CONFIRMED`マーカーとして判定する設計で、今回は実際にそのマーカーが記録されました。もう一方の事前登録アウトカム(設定が無言で受理される`NOT_REPRODUCED`)は発生していません。

この結果は、同じ調査内で手動実行された別の端末セッションの記録と一致します。

```
$ codex -c default_permissions='"read-only"' -c sandbox_mode='"workspace-write"' exec "echo hi"
Error: default_permissions requires a `[permissions]` table
```

ただし今回の自動実行では、生のstderr本文そのものはアーカイブされておらず、「指定の部分文字列を含むか」を示すbooleanフラグとして記録されています。正確な文言は上記の手動実行記録によって裏付けられていますが、この自動ケース自身の生ログとしては再取得できません。

```text
IF config.toml または -c 経由の呼び出しが:
  default_permissions を設定している
  AND 対応する [permissions.<name>] テーブルを定義していない
THEN codex exec は起動時に非ゼロ終了し、
  stderr に "default_permissions requires a" を含み、
  turn.completed は 0 件になる
```

## ユースケース別 `config.toml` 設定例

ここから先の3パターンは、上の3条件の実測結果と、公式ドキュメントが明記しているキーの定義[^sandboxing][^config-reference][^approvals-security]だけを組み合わせたものです。新たな実行確認はしていません。betaの`default_permissions`/`[permissions.<name>]`は旧来のsandbox設定と「do not compose」と明記されており[^permissions]、かつ本記事で実測したのは「テーブルなしで足すと起動エラーになる」という1条件だけなので、以下はいずれも旧来の`sandbox_mode`/`approval_policy`系のみで構成し、betaの`permissions`系とは混在させていません。

### パターンA: ローカル対話利用

```toml
sandbox_mode = "workspace-write"
approval_policy = "on-request"
```

ドキュメントは対話的runについて「use `on-request` for interactive runs」と明記しており[^config-reference]、`workspace-write`は「default low-friction mode for local work」とされています[^sandboxing]。

### パターンB: CI/無人実行

```toml
sandbox_mode = "workspace-write"
approval_policy = "never"

[sandbox_workspace_write]
network_access = false
```

ドキュメントは非対話runについて「use ... `never` for non-interactive runs」と明記しています[^config-reference]。`network_access`はデフォルトが明記されていないため、CIでネットワークアクセスが不要な場合は明示的に`false`を指定する運用が安全側です(本記事の`default_permissions`harnessも同じキーを`false`固定で使っています)。

### パターンC: 複数プロジェクト共有

ドキュメントは共有設定をプロジェクトごとに切り替える手段として、`$CODEX_HOME/<profile-name>.config.toml`を`--profile <profile-name>`で選択する方式を挙げています[^config-reference]。プロジェクトごとに個別の信頼レベルを維持したい場合は、`approval_policy`を明示せず、ユーザーレベル`~/.codex/config.toml`側で`[projects."/path/to/project"]`テーブルに`trust_level`を設定する経路も案内されています[^approvals-security]。

```toml
# $CODEX_HOME/ci.config.toml (--profile ci で選択)
sandbox_mode = "workspace-write"
approval_policy = "never"

# ~/.codex/config.toml (プロジェクトごとの信頼レベル)
[projects."/path/to/shared-project"]
trust_level = "untrusted"
```

プロファイルファイルのパスはドキュメントが`$CODEX_HOME/profile-name.config.toml`としてのみ明記しており[^config-reference]、`$CODEX_HOME`が`~/.codex`に解決される既定値だとはどの参照資料にも書かれていません。実際にどこに置くべきかは読者の環境の`$CODEX_HOME`の値次第であり、本記事ではこの解決先を確認していません。一方、`trust_level`の設定先として明記されているのは`~/.codex/config.toml`であり[^approvals-security]、こちらはプロファイルファイルとは別の設定ファイルです。このパターンの`[projects."...".trust_level]`はドキュメントの移行手順節からの引用であり[^approvals-security]、本記事の自動/手動検証では実行していません。

## 監査チェックリスト(廃止・非推奨・beta互換性)

既存の`config.toml`やCI用の`-c`オプション一覧を棚卸しするときは、次の順で確認してください。

| チェック項目 | 見つかったら起きること | 根拠 |
| --- | --- | --- |
| `approval_policy = "untrusted"`が残っていないか | 起動前に非ゼロ終了、`is no longer supported`を含むエラーで停止(確定的) | 本記事の結果1、手動実行1回 |
| `approval_policy = "on-failure"`が残っていないか | エラーも警告も出ず、無音で`approval: never`相当に読み替え | 本記事の結果2、手動実行1回 |
| `default_permissions`を`[permissions.<name>]`テーブルなしで足していないか | 起動前に非ゼロ終了、`default_permissions requires a`を含むエラーで停止(確定的、harness検証済み) | 本記事の結果3、自動harness |
| `--sandbox`/`--ask-for-approval`のCLIフラグとconfig.toml側の値が食い違っていないか | 本記事の範囲外、未検証 | — |

最初の3項目は上で示した実測結果にそのまま対応します。最後の項目(CLIフラグとconfig.tomlの優先順位)は、このチェックリストに載せる根拠となる実行記録がどの調査にもないため、「確認済み」としては扱わず、別途の検証が必要な項目として明記しています。

## この検証が保証しない範囲

- `codex-cli 0.164.0`以外のバージョンへの一般化はしていません。
- `default_permissions`に正しい`[permissions.<name>]`テーブルを添えた場合の挙動は未検証です。
- `--sandbox`/`--ask-for-approval`のCLIフラグがconfig.toml側の値より優先されることは、この記事のどの証跡によっても確認していません(調査時点では4件目の検証項目として計画されていましたが、実行されませんでした)。
- 結果1(`untrusted`)と結果2(`on-failure`)は、決定的なharnessではなく手動の端末セッション1回ずつの記録であり、独立した検証器やretryはありません。
- 結果3(`default_permissions`)は決定的なharnessと独立検証器で確認済みですが、自動実行自体の生のstderr/stdoutテキストはアーカイブされておらず、文言の正確さは手動実行記録に依存しています。
- 「ユースケース別config.toml設定例」と「複数プロジェクト共有」節の`trust_level`/`--profile`の記述は公式ドキュメントの引用であり、本記事のいずれの実行確認でも検証していません。
- ネットワーク無効化はCodexのworkspace sandbox内のみで有効であり、ホストOSレベルの隔離を保証するものではありません。

これらの条件を踏まえると、`config.toml`の棚卸しで上記チェックリストの最初の3項目のどれかに該当した場合は、それぞれ対応する修正(設定の削除、明示的な書き換え、`[permissions.<name>]`テーブルの追加)を行う、というのが今回の証拠が支える行動です。CLIフラグの優先順位の扱いは、この記事の範囲外として別途確認が必要です。

## 参考資料

[^sandboxing]: [Codex sandboxing](https://learn.chatgpt.com/docs/sandboxing.md)(2026-11-06閲覧)
[^config-reference]: [Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)(2026-11-06閲覧)
[^permissions]: [OpenAI Codex Permissions](https://learn.chatgpt.com/codex/permissions)(2026-11-06閲覧)
[^approvals-security]: [Codex agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)(2026-11-06閲覧)
