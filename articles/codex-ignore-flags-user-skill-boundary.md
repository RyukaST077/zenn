---
title: "Codexのignore flagsだけではユーザースキルを隔離できない"
emoji: "🧱"
type: tech
topics: [codex, cli, aiagent, automation]
published: true
---

CIや評価用の`codex exec`で`--ignore-user-config --ignore-rules`を指定していると、実行時の指示は明示したプロンプトとリポジトリ内のファイルだけだと思いたくなります。しかし、開発者の`HOME`を引き継ぐself-hosted runnerや再利用コンテナでは、個人用スキルまで消えているでしょうか。

2026年8月15日、Codex CLI `0.147.0`で空の使い捨て`HOME`と、ユーザースキルを1つだけ置いた`HOME`を比較しました。両方に2つのignore flagを付けても、後者だけがスキル本文にしかない無害なマーカーを返しました。

したがって、このバージョンと明示的なスキル呼び出しの条件では、**2つのflagだけで「ユーザースキルから隔離できた」と判定してはいけません**。checked-inの指示だけを入力にしたいなら、ユーザーのスキルカタログを別に制御し、空`HOME`との対照試験で確認する必要があります。

これはCLI `0.147.0`で各条件を1回ずつ実行したcase studyです。すべてのバージョン、スキル、起動方法に一般化するものではありません。

## 2つのflagが対象にするものは別レイヤー

OpenAIのドキュメントでは、`--ignore-user-config`は`$CODEX_HOME/config.toml`を読み込まないためのflag、`--ignore-rules`はユーザーおよびプロジェクトのexecpolicy `.rules`を読み込まないためのflagと説明されています。どちらもスキル探索を無効にするflagとは説明されていません。[^non-interactive] [^developer-commands]

一方、ユーザースキルは`$HOME/.agents/skills`から探索されます。Codexはまず発見したスキルの名前・説明・パスをモデルへ渡し、選択されたときに`SKILL.md`本文を読みます。`$skill-name`による明示的な呼び出しもできます。[^build-skills]

つまり、少なくともドキュメント上は次の3つが別の入力です。

| 入力 | 今回指定した制御 |
| --- | --- |
| `$CODEX_HOME/config.toml` | `--ignore-user-config` |
| execpolicy `.rules` | `--ignore-rules` |
| `$HOME/.agents/skills`のユーザースキル | 上記2つに専用の無効化保証はない |

flag名から「ユーザー由来の入力がすべて消える」と推測せず、スキルの境界を実際の出力で検査するのが今回の狙いです。

## 空HOMEと1スキルHOMEを同じ条件で比べた

モデル自身に「スキルを読みましたか」と聞くだけでは、発見の証拠として弱すぎます。そこで、同じプロンプトとJSON Schemaを使う2つの使い捨て環境を用意しました。

- control: 空の`HOME`と空のworkspace
- treatment: `.agents/skills/ambient-probe/SKILL.md`だけを含む`HOME`と空のworkspace
- 共通prompt: `$ambient-probe`を明示的に使い、使えれば`loaded`、なければ`unavailable`を返す
- oracle: 実行ごとに生成した無害なマーカーをtreatmentの`SKILL.md`本文だけへ置く

マーカーは共通prompt、出力schema、子プロセスの引数、ファイル名、controlには含めませんでした。これにより、treatmentが正確なマーカーを返した場合、単なるprompt echoやスキル名の推測ではなく、スキル本文が消費されたと判断できます。

2つの子プロセスに共通する主要条件は次のとおりです。

| 項目 | 記録した条件 |
| --- | --- |
| 検証日 | 2026-08-15 |
| Codex CLI | `codex-cli 0.147.0` |
| model / reasoning effort | overrideなし。解決されたbackend snapshotは未記録 |
| approval | `never` |
| sandbox | `read-only` |
| session | `--ephemeral` |
| user config / rules | `--ignore-user-config --ignore-rules` |
| workspace toolのnetwork | 無効化 |
| workspace | fresh、空、非Git |
| live呼び出し | control 1回、treatment 1回、retryなし |

認証には既存の`CODEX_HOME`をそのまま使い、スキル探索用の`HOME`だけを使い捨てにしました。認証ファイルの読み取り、複製、移動は行っていません。workspace toolのnetwork無効化は、モデルプロバイダーへの通信やホストOS全体を隔離するものではありません。

子プロセスの起動形は次のとおりです。controlとtreatmentで変えるのは`<DISPOSABLE_HOME>`の中にスキルがあるかどうかだけです。

```sh
HOME=<DISPOSABLE_HOME> CODEX_HOME=<EXISTING_CODEX_HOME> \
codex -a never exec \
  --sandbox read-only \
  --ephemeral \
  --ignore-user-config \
  --ignore-rules \
  --skip-git-repo-check \
  -C <EMPTY_WORKSPACE> \
  -c sandbox_workspace_write.network_access=false \
  --json \
  --output-schema <SCHEMA_FILE> \
  -o <FINAL_OUTPUT_FILE> \
  '<COMMON_PROMPT>'
```

`<...>`は使い捨ての実パスと共通promptへ置き換えます。実際のwrapperは各子プロセスを120秒で打ち切り、marker漏えい、inventory drift、tool event、完了イベントの欠落があれば判定を中止する設計です。

## treatmentだけがスキル本文のマーカーを返した

結果はcontrolとtreatmentで明確に分かれました。

| 確認項目 | control | treatment |
| --- | --- | --- |
| `HOME`内の対象 | 空 | `.agents/skills/ambient-probe/SKILL.md`のみ |
| process | exit `0`、timeoutなし | exit `0`、timeoutなし |
| completion / failure | `1` / `0` | `1` / `0` |
| 認識されたtool event | `0` | `0` |
| workspace inventory | 空 | 空 |
| final status | `unavailable` | `loaded` |
| final value | 空文字 | スキル本文だけに置いた正確なマーカー |
| マーカー出現数 | `0` | eventとfinalの計`2` |

独立した検証器は、CLI version、promptとschemaのhash、flag、sandbox、inventory、イベント数、最終JSON、marker一致を確認し、終了コード`0`で`claim-supported`を返しました。runnerも保護対象や想定外のpath変更を検出していません。

この差から言えるのは、記録した条件では2つのignore flagがtreatmentのユーザースキルの発見と明示的な実行を抑止しなかった、ということです。両workspaceは最後まで空でtool eventも0件だったため、今回のマーカー移動をcommand、file change、MCP、Web検索に帰属させる必要もありません。

ただし、これは2つのflagの不具合を示す結果ではありません。flagはドキュメントどおり、それぞれ`config.toml`とexecpolicy rulesを対象にしています。今回確認したのは、その対象外にあるスキルカタログまでまとめて隔離する境界にはならなかったことです。

## 実運用ではスキルカタログを独立した入力として扱う

fixtureの各要素は、CIや評価環境では次のように対応します。

| fixtureの信号 | 実運用で表すもの | 判定 |
| --- | --- | --- |
| 空のcontrol `HOME` | 個人スキルを含まないclean runner | マーカーなしでfail closedする必要がある |
| 1スキルだけのtreatment `HOME` | 開発者homeや再利用runnerに入った個人workflow | control以外を同条件にして比較する |
| treatment本文だけのrandom marker | ambientな指示や出力規約 | 正確な返却は本文消費の証拠になる |
| 2つのignore flag | 個人設定とexecpolicy rulesを除くwrapper | スキル不在までは推論しない |
| tool event 0、workspace不変 | tool副作用を使わないcontext境界の検査 | prompt-contextの差として扱う |

本番runnerの採用条件は、flagの有無ではなく次のoracleにします。

```text
PROCESS_OK(case) =
  exit == 0
  AND timed_out == false
  AND completion_events == 1
  AND failure_events == 0
  AND tool_events == 0
  AND home_inventory == expected
  AND workspace_inventory == empty

NOT_REPRODUCED_AT_PINNED_BOUNDARY =
  PROCESS_OK(control)
  AND PROCESS_OK(treatment)
  AND control == {status: "unavailable", value: ""}
  AND treatment == {status: "unavailable", value: ""}
  AND hidden_marker_occurrences == 0

REJECT_FLAGS_AS_SUFFICIENT =
  PROCESS_OK(control)
  AND PROCESS_OK(treatment)
  AND control_marker_occurrences == 0
  AND treatment == {status: "loaded", value: exact_hidden_marker}

INCONCLUSIVE = 上記以外
```

今回の結果は`REJECT_FLAGS_AS_SUFFICIENT`です。`NOT_REPRODUCED_AT_PINNED_BOUNDARY`になった場合も、言えるのは固定した版と条件で再現しなかったことまでで、すべてのambient inputから隔離できた証明にはなりません。checked-inの指示だけを許可したい処理では、使い捨てまたは明示的に管理した`HOME`とスキルカタログを用意し、既存の開発者`HOME`を暗黙に継承しない設計にします。設定による別のスキルfilterは今回実行していないため、検証済みの修正としては扱いません。

## そのまま再実行できる検証レシピ

今回通過したrepository harnessは、次の1コマンドで同じcontrol/treatment検証を実行します。

```sh
node scripts/agent-practice/run-experiment.mjs \
  practice/agent/agent-practice-codex-ignore-config-user-skills-20260815-0504.json
```

別のwrapperへ移植する場合も、次の条件を削らないことが重要です。

1. CLI versionを固定し、freshな空workspaceと使い捨て`HOME`を2組作る
2. controlの`HOME`は空、treatmentには無害なinstruction-only skillを1つだけ置く
3. random markerをtreatmentの`SKILL.md`本文だけへ入れ、共通prompt、schema、引数、ファイル名には入れない
4. 両方を同じprompt、flag、sandbox、schemaで1回ずつ実行する
5. process完了、正確なinventory、tool event 0、controlのfail closedを先に確認する
6. treatmentだけが正確なmarkerを返したら2つのflagを十分な境界としては拒否する
7. marker漏えい、wrong marker、inventory drift、tool使用、version不一致、未完了は`INCONCLUSIVE`として止め、自動retryしない

CLIやrunner imageを更新した後は、以前の結果を引き継がず、このprobeを再実行します。

## この検証が保証しない範囲

今回扱ったのは、Codex CLI `0.147.0`、`$HOME/.agents/skills/ambient-probe/SKILL.md`、明示的な`$ambient-probe`呼び出し、各1回だけです。次は検証していません。

- 暗黙のdescription matchingや、多数のスキルがある場合のcatalog truncation・優先順位
- 他のCLI version、OS、model backend、client surface、skill root
- plugin、hook、MCP、memory、managed configuration、system skill、認証など、ほかのambient input
- 悪意あるスキル、sandbox escape、権限昇格、credentialやnetworkへのアクセス
- 実行を繰り返した場合の再現率

modelとreasoning effortはoverrideしていないため、CLI versionからbackend snapshotを特定することもできません。また、workspace sandboxでtask-side networkを無効にしたことは、host securityの証明ではありません。

この境界を踏まえると、実務上の判断はシンプルです。**`--ignore-user-config --ignore-rules`を使った事実ではなく、ユーザーの`HOME`とスキルカタログを別途制御し、版固定の空HOME対照試験で境界を確認する**。treatmentのマーカーが残る環境では、2つのflagを十分な境界として扱わず、本番の自動実行へ進む前にrunner側の入力を管理します。

## 参考資料

[^non-interactive]: [OpenAI Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)（2026-08-15閲覧）
[^developer-commands]: [OpenAI Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)（2026-08-15閲覧）
[^build-skills]: [OpenAI Build skills](https://learn.chatgpt.com/docs/build-skills)（2026-08-15閲覧）
