---
title: "codex execで境界外に書き込むには--add-dirだけでいい(--approve-for-meはエラーになる)"
emoji: "🧭"
type: tech
topics: [cli, aiagent, ai, codex]
published: true
---

`codex login`で認証済みで、対話モードの`codex exec`を何度か使い、黄色い承認プロンプトを見たことがある人が、次に一回限りのタスクを非対話で流したいとします。たとえば「生成したファイルをリポジトリの外にある共有ディレクトリへ書き込む」ようなタスクです。

OpenAIのドキュメントを読むと、`--approve-for-me`というフラグが目に入ります。説明を読む限り「承認を自動レビューに任せる」機能に見えるので、「これを付ければ、ワークスペースの外への書き込みも承認プロンプトなしで通るはずだ」と考えたくなります。

しかし、Codex CLI `0.154.0`で実際にこのフラグを試すと、他の記事や公式ドキュメントには書かれていない壁にぶつかります。この記事は、その壁の正体と、ワークスペース外への書き込みを一回限りのタスクで許可する実際に動くやり方を、実行結果つきで示します。

検証日は2026-09-17、使用したCLIは`codex-cli 0.154.0`です。

## 前提: `-C`、`--sandbox`、`--add-dir`、`--approve-for-me`

`codex exec`はプロンプトを渡すと一回だけタスクを実行して終了する、非対話のコマンドです。今回関係するフラグは次の4つです。

- `-C <dir>`: タスクの作業ルートにするディレクトリ。指定した`<dir>`が、Codexが「ここが自分のワークスペースだ」と扱う起点になります。
- `--sandbox workspace-write`: ファイルシステムへの書き込みを、原則`-C`で指定したワークスペース内に制限するサンドボックスモード。
- `--add-dir <dir>`: `-C`のワークスペースに加えて、もう1つだけ書き込みを許可するディレクトリを追加するフラグ。
- `--approve-for-me`: 人間が承認プロンプトを見て押す代わりに、自動レビューに承認を委ねるフラグ(OpenAIの`auto-review`ドキュメントによる説明)。「承認を省略する」フラグではなく、「誰が承認するか」を切り替えるフラグです。

ここまでは公式ドキュメントの説明どおりで、実際に動かして確認したものではありません。ここから先は、これらのフラグを組み合わせて実行した結果です。

## `--approve-for-me`と`--sandbox`を一緒に使うとCLIエラーになる

ワークスペース外の1ディレクトリへの書き込みを許可したいとき、ドキュメントの説明どおりに考えると次のような組み合わせを試したくなります。

```sh
codex -a never exec \
  --approve-for-me \
  --add-dir <outside-dir> \
  --sandbox workspace-write \
  -C <workspace-dir> \
  "<prompt>"
```

これは実際に実行したコマンドの、監査用の再現・記録フラグ(`--ephemeral --ignore-user-config --ignore-rules --skip-git-repo-check -c sandbox_workspace_write.network_access=false --json -o <result-file>`)を省いた核心部分です。フラグの並び順も、実際に実行した記録どおりに`--approve-for-me --add-dir <outside-dir>`を`--sandbox`より前に置いています。

これを実際に実行すると、タスクは開始すらせず、次のエラーで即座に終了しました(終了コード`2`、実行時間501ms、イベントログは0件)。

```text
error: the argument '--approve-for-me' cannot be used with '--sandbox <SANDBOX_MODE>'

Usage: codex exec [OPTIONS] [PROMPT]
       codex exec [OPTIONS] <COMMAND> [ARGS]

For more information, try '--help'.
```

これはサンドボックスや承認の中身の話ではなく、コマンドライン引数の組み合わせそのものがCLIに拒否されているという意味です。`--approve-for-me`と、明示的な`--sandbox <mode>`は、`codex-cli 0.154.0`では同時に指定できません。ドキュメントの「承認を自動レビューに委ねる」という説明だけでは、この制約には気づけません。

## 動くやり方: `--approve-for-me`を外し、`--add-dir`だけを付ける

`--approve-for-me`を使わず、`--add-dir <dir>`だけを追加すると、同じ「ワークスペース外の1ディレクトリへ書き込む」タスクが実際に成功しました。

```sh
codex -a never exec \
  --ephemeral --ignore-user-config --ignore-rules --skip-git-repo-check \
  --add-dir <outside-dir> \
  --sandbox workspace-write \
  -C <workspace-dir> \
  -c sandbox_workspace_write.network_access=false \
  --json -o <result-file> \
  "<prompt>"
```

`--ephemeral --ignore-user-config --ignore-rules --skip-git-repo-check -c sandbox_workspace_write.network_access=false --json -o <result-file>`は、この検証を自動で再現・記録するために付けていたフラグで、`--add-dir`の効果そのものとは関係ありません。対話環境で1回だけ試すだけなら、`-a never exec --sandbox workspace-write -C <workspace-dir> --add-dir <outside-dir> "<prompt>"`が核心部分です。

このコマンドで、`<workspace-dir>`の外にある`<outside-dir>`にファイルが作成され(検証スクリプトの判定で`CREATED`、終了コード`0`)、成功しました。`--approve-for-me`を付けなくても、`--add-dir`で指定したディレクトリへの書き込みは通ります。

## 4パターンをそろえて比べた結果

上の2つのケース以外に、比較のための2ケースも同じ条件で実行しました。全4ケースの結果は次のとおりです。

| ケース | 試した内容 | 結果 |
| --- | --- | --- |
| ワークスペース内・フラグなし | `-C`の中だけに書き込む、追加フラグなし | 成功(`CREATED`) |
| ワークスペース外・フラグなし | `-C`の外に書き込む、追加フラグなし | ファイルが作成された(`CREATED`) |
| ワークスペース外・`--approve-for-me --add-dir` | 上記の「動くやり方」の節で示したエラーになる組み合わせ | CLIエラーで終了(`ABSENT`) |
| ワークスペース外・`--add-dir`のみ | 上記の「動くやり方」の節のコマンド | 成功(`CREATED`) |

「ワークスペース内・フラグなし」は、`-C`の中だけに書き込む一回限りのタスクなら、追加フラグは何も要らないという基準点です。こちらは想定どおりの結果でした。

一方、「ワークスペース外・フラグなし」は想定外でした。`--add-dir`も`--approve-for-me`も付けず、`-C`の外を書き込み対象にしたタスクでも、ファイルが作成されてしまいました。

## フラグなしでも境界外に書けた件は、そのまま安全宣言に使わない

この「ワークスペース外・フラグなし」の結果は重要な注意点です。今回のテストでは、`-C`で指定したディレクトリと、書き込み先に指定した「外側」のディレクトリが、どちらもOSの一時ディレクトリ配下にありました。そのため、次のどちらが起きたのかを今回の記録だけでは区別できません。

- `--sandbox workspace-write`が、そもそも`-C`の外への書き込みを止める仕組みになっていない
- OSの一時ディレクトリ自体が、`-C`とは別に書き込み可能な領域として扱われていて、たまたま両方がその中に収まっていた

したがって、「フラグを何も付けなければ`-C`の外には書き込まれない」という前提を、この記事の結果だけを根拠に信用しないでください。一回限りのタスクを本番で使う前に、自分の`-C`と、その外にある実際のパスの組み合わせで、同じように書き込みが起きないか自分の環境で確認することを推奨します。

## この記事での判断ルール

`codex-cli 0.154.0`で、`-a never --sandbox workspace-write`の一回限りの`codex exec`タスクを組むときの判断は次のとおりです。

1. `-C`で指定したディレクトリの中だけに書き込めばよいタスクなら、追加フラグは不要です。
2. `-C`の外にある特定の1ディレクトリにも書き込ませたいタスクなら、`--add-dir <dir>`を追加します。`--approve-for-me`をこれに重ねて明示的な`--sandbox`と一緒に指定すると、CLIエラーになり実行そのものが失敗します。
3. 「フラグを何も付けていないから`-C`の外には書き込まれないはずだ」という想定は、自分の`-C`と書き込み先の組み合わせで実際に確認するまでは前提にしないでください。

## この検証の範囲

- 各ケースは1回ずつの実行で、繰り返し実行した場合の再現率は確認していません。
- 結果は`codex-cli 0.154.0`と、この検証で使った認証済みアカウントが解決したモデル/バックエンドに固有のもので、他のバージョンへの一般化はしていません。
- `--dangerously-bypass-approvals-and-sandbox`は今回実行しておらず、その挙動については何も主張しません。
- 「ワークスペース外・フラグなし」がなぜ成功したかの原因(サンドボックスの境界設計か、OS一時ディレクトリの扱いか)は、今回の記録だけでは特定できていません。

## 参考資料

- `codex exec --help`(ローカル実行、2026-09-17閲覧)
- OpenAI `auto-review`ドキュメント: `--approve-for-me`が自動レビューによる承認委譲であることの説明
