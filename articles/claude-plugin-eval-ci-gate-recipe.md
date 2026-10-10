---
title: "claude plugin eval でCIゲートを組む：コピペできる最小スイートと、Δを水増しする落とし穴"
emoji: "🧪"
type: "tech"
topics: ["claudecode", "aiagent", "cli", "testing"]
published: false
---

<!-- 前提: 出典ログ logs/run-claude-plugin-eval-20261003-1335/execution-log.md / slug claude-plugin-eval-ci-gate-recipe / published: false（ドラフト） -->

Claude Code のスキルを自作していると、スキルが発火するかどうかは `SKILL.md` の `description` の文面に左右されます。手で毎回試すのはつらいので、`claude plugin eval` でCIの回帰ゲートにできないか試しました。

結論から書くと、スイート自体はすんなり組めました。ただ、グレーダーの組み方を間違えると **Δ（プラグインの寄与度）が平気で水増しされる**。原因を切り分けるためにグレーダー構成を4パターン比較することになり、そこに手間を使ったので、動くスイート一式と合わせてその話を書きます。

この記事に載っているものは全部コピーして使えます。

- 最小プラグイン（`plugin.json` ＋ スキル1つ）
- evals スイート（ケース2本・無料グレーダー6ファイル）
- GitHub Actions ワークフロー全文
- Δが0・または不自然な値になったときの原因判定表（14行）

検証環境は macOS 26.5 (arm64) / Claude Code **2.1.287** / git 2.50.1 / Node v22.17.0 / jq 1.7.1 です。`claude plugin eval` は v2.1.269 で追加された比較的新しいコマンドなので、バージョンによって挙動が違う可能性があります。

あと、これは地味に大事なんですが、**評価実行はプラン使用量を実際に消費します**。無料グレーダーだけで組んでも、2ケースのスイート1回で $0.20（CLI が表示する list-price 見積り）でした。この記事を書くまでに12回スイートを回して合計 $1.30（同じく list-price 見積りの合算）。軽い気持ちで `--runs 5` とかやると普通に積み上がります。

## `claude plugin eval` が測っているもの

このコマンドは、プラグインのディレクトリを渡すと **プラグインありの実行（with）とプラグインなしの実行（without）を両方走らせて、スコアの差＝Δを出します**。公式docsでいう ablation（with-without）モードで、これが既定です。

[Plugin evals - Claude Docs](https://code.claude.com/docs/en/plugin-evals)

つまり「スキルを入れたことで何点良くなったか」が出る。単に「テストが通った」ではなく「プラグインが効いているか」を見る道具です。

最初に組んだスイート（ケース2本）を走らせたときの出力がこれです。

```
Ablation: defaulting to with-without — a plugin resolved from this path, so each case also runs a no-plugin baseline arm (2× runs) and reports Δ; graders marked with-only (including `tool_used: Skill`) become a plugin-fired indicator rather than part of the score. Pass --ablation none for the previous single-arm run and scoring.
Plugin under test: "evals-demo" version "0.1.0" at ".../evals-demo"
Ablation: 2 arms × 2 cases (4 runs)
  ignores-unrelated-request run 1/1 [with]: score 1.00  $0.04
    ✓ answers-the-question (weight 1): matched git pull
    ✓ skill-not-fired (weight 1): Skill called 0x (expected 0..0)
  ignores-unrelated-request run 1/1 [without]: score 1.00  $0.04
    ✓ answers-the-question (weight 1): matched git pull
    ✓ skill-not-fired (weight 1): Skill called 0x (expected 0..0)
✓ ignores-unrelated-request  with 1.00  without 1.00  Δ 0.00  (2 runs)  $0.09
  writes-commit-message run 1/1 [with]: score 1.00  $0.06
    ✓ file-created (weight 1): commit-msg.txt exists as expected
    ✓ message-shape (weight 1): matched ^(feat|fix|refactor|docs|test|chore|perf|build|ci)(\([a-z0-9/-]+\))?: [^\n]{1,60}\s*$
    ✓ skill-fired [with-only, not scored]: Skill called 1x (expected 1..∞)
    ✓ skill-then-write (weight 1): Skill@0 precedes Write@1
  writes-commit-message run 1/1 [without]: score 0.33  $0.05
    ✓ file-created (weight 1): commit-msg.txt exists as expected
    ✗ message-shape (weight 1): pattern not found in file commit-msg.txt
    ✗ skill-then-write (weight 1): "before" tool Skill never called
✓ writes-commit-message  with 1.00  without 0.33  Δ +0.67  (2 runs)  $0.11

CASE                       WITH  W/OUT Δ      RUNS COST    NOTES
ignores-unrelated-request  1.00  1.00  0.00   2    $0.09
writes-commit-message      1.00  0.33  +0.67  2    $0.11

2 case(s) · mean Δ +0.33 · 25s · $0.20
Report: .../evals/results/2026-10-03T04-37-19-108Z/report.html
exit=0
```

`skill-fired` の行に `[with-only, not scored]` と付いているのが見えます。これは「スキルが呼ばれたか」という検査で、プラグインなしでは絶対に通らないので採点から外されている、という意味です。公式docsの言い方だと

> A check like "the skill was invoked" can never pass without the plugin, so counting it would push the without-arm toward zero and inflate `Δ`.

この除外ルールが今回のハマりどころ全部に絡んできます。

HTMLレポートも自動で出ます。これはパターンC（グレーダー4種）のものです。

![claude plugin eval のHTMLレポート。SUITE SCORE 100%、ABLATION Δ +66.7、BASELINE SCORE 33.3% のタイルが並び、skill-fired に PLUGIN-FIRED INDICATOR バッジが付いている](/images/claude-plugin-eval-ci-gate-recipe/01-patternC-report.png)

上部の verdict が `Plugin effect: ↑ +66.7 pts vs baseline — improved 1 · flat 0 · regressed 0 of 1 case.`、タイルが SUITE SCORE 100% / ABLATION Δ +66.7 / BASELINE SCORE 33.3% / CASES 1 / PERFECT RUNS 100%。下に `GRADERS — WHAT "GOOD" MEANS FOR THIS CASE` があって、各グレーダーの型バッジと設定値が全部展開されます。外部リクエストを投げない自己完結HTMLなので、オフラインでも開けました。

## 書き始める前に調べたこと

### グレーダー6種のうち4種は無料

スイートを組む前に、どのグレーダーが課金されるかを確認しました。公式docsの原文がこれです。

> Of the six types, `regex`, `tool_used`, `tool_order`, and `file_exists` are computed from the transcript and files and cost nothing, while `llm` and `baseline` call a judge model and add to the run's cost.

| 型 | 主なオプション | 合格条件 | 課金 |
|---|---|---|---|
| `regex` | `pattern`, `flags`, `match`, `target` | JavaScript の `pattern` が target 内に見つかる。`match: not_contains` で不在、`match: "count:N"` でちょうどN個。大小無視は `flags: i`（インラインの `(?i)` は非対応） | 無料 |
| `tool_used` | `tool`, `input_match`, `min`, `max` | `tool` の呼び出し回数が `min`（既定1）〜`max`（既定無制限）の間 | 無料 |
| `tool_order` | `before`, `after` | 両方のツールが呼ばれ、`before` の最初の一致が `after` の最初の一致より前 | 無料 |
| `file_exists` | `path`, `exists` | Claude が作成したファイルが `path` グロブに一致。run 中に新規作成されたファイルのみが対象 | 無料 |
| `llm` | `criteria`, `focus` | 判定モデルが3票中2票以上 PASS | 課金 |
| `baseline` | `baseline_file`, `criteria` | 判定モデルが参照transcriptと同等以上と判定 | 課金 |

今回は無料の4種だけで組みました。

`target` / `focus` が取る値も最初に押さえておくと迷いません。`last_message`（既定）/ `trace`（1行1メッセージのJSON）/ `files`（作成されたパスの一覧。中身ではない）/ `{ source: file, path: <path> }`（ファイルの中身）/ `mock_calls`。`files` が「パスの一覧」であって中身ではない、というのは引っかかりやすいところだと思います。

### バージョン要件

`claude plugin eval` は v2.1.269 で追加。手元は 2.1.287 でした。あと公式に **git 2.31 未満だと1ケースも走らずに exit 1** という記述があります。ubuntu-latest なら気にしなくていいんですが、古い社内ランナーだとモデル呼び出しが一度も走らないまま落ちるので、見落とすと原因が分かりにくそうです。

### 雛形の既定グレーダーは課金側

これは実際に生成して気づきました。`claude plugin eval init --bare <name>` が吐く `graders/criteria.md` がこれです。

```md
---
type: llm
weight: 1
---

TODO: describe what a successful response looks like
```

`type: llm` なので課金側です。無料グレーダーだけで組むつもりなら、生成直後に必ず差し替える必要があります。

ちなみに `--bare` はモデルを一切呼ばずテンプレを書くだけなのでコスト $0。対話版の `init` はインタビューしながら実際にケースを試すのでコストが乗ります。CIスクリプトから叩くなら `--bare` 一択です。

## 最小プラグインとスイートを作る

### プラグイン本体

`plugin.json` は `name` だけが必須ですが、`--strict` を通す前提で `version` / `description` / `author` も入れました。プラグイン名は予約名を避けて `evals-demo`。

```json:evals-demo/.claude-plugin/plugin.json
{
  "name": "evals-demo",
  "version": "0.1.0",
  "description": "Minimal demo plugin: turns a described code change into a one-line Conventional Commit message.",
  "author": { "name": "evals-demo" }
}
```

スキルは「コード変更の説明を Conventional Commit 1行に変換する」だけのものにしました。

```md:evals-demo/skills/commit-msg/SKILL.md
---
name: commit-msg
description: Write a one-line Conventional Commit message for a described code change. Use when the user asks for a commit message, a commit title, or how to word a commit for changes they just made.
---

# commit-msg

Turn a description of a code change into exactly one Conventional Commit line.

## Rules

1. Output exactly **one line**. No body, no footer, no blank lines.
2. Start with a type from: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`.
3. Optionally add a scope in parentheses, then `: `, then the summary.
4. Keep the whole line at 72 characters or fewer.
5. Use the imperative mood ("rename", not "renamed" or "renames").
6. Do not end the line with a period.

Format: `<type>(<optional scope>): <summary>`

## Examples

- `refactor(api): rename getUser to fetchUser`
- `fix(auth): reject expired refresh tokens`
- `docs: add setup steps to README`

## When the user asks to save it

If the user names a file, write that single line to that file and nothing else.
```

`description` の文面がそのままΔに直結します。ここが雑だと「プラグインを入れたのに発火しない」になります。

results は実行のたびに増えるので `.gitignore` に入れておきます。この記事の検証ではスイートを回しているうちに9ディレクトリ生えました。

```:evals-demo/.gitignore
evals/results/
```

### `validate --json` の `contents: []` で止まった

スイートを書く前に `claude plugin validate ./evals-demo --strict` を通しました。

```
Validating plugin manifest: .../evals-demo/.claude-plugin/plugin.json

✔ Validation passed
exit=0
```

`--json` も付けてみたら、こう返ってきます。

```json
{
  "success": true,
  "strict": true,
  "target": ".../evals-demo/.claude-plugin/plugin.json",
  "manifest": { "file": "...", "type": "plugin", "errors": [], "warnings": [], "notes": [] },
  "contents": []
}
```

`"contents": []` を見て、スキルが認識されていないんじゃないかと疑いました。公式docsは `contents` を「per-file results, each naming its `file` and carrying `errors`, `warnings`, and `notes` arrays」としか書いていなくて、空配列が「ファイルが無い」なのか「問題が無い」なのか読み取れません。

結局、SKILL.md の frontmatter から `description` を一時的に消して再実行してみました。

```json
"contents": [
  {
    "file": ".../skills/commit-msg/SKILL.md",
    "type": "skill",
    "errors": [],
    "warnings": [
      { "path": "description",
        "message": "No description in frontmatter. A description helps users and Claude understand when to use this skill.",
        "code": null }
    ],
    "notes": []
  }
]
```

exit=1。`"type": "skill"` でちゃんと拾われていたので、`contents: []` は「スキルは読まれていて、問題が無かった」だと確定しました。2分で済んだんですが、eslint みたいに「0 problems」と言ってくれるわけではないので、認識されているか不安なときはわざと壊すのが一番速いという学びでした。

副産物として、`--strict` の効き目もここで見えました。`description` 無しは非strictなら warning（exit 0）、`--strict` なら exit 1。CIに `--strict` を入れる具体的な理由になります。

### ケース1：発火してほしい側

```md:evals-demo/evals/writes-commit-message/prompt.md
---
description: Asks for a commit message and a file, without naming the skill.
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill, Write]
---

I just renamed the function `getUser` to `fetchUser` in `src/api/user.ts`
and updated the three call sites in `src/pages/profile.ts`,
`src/pages/settings.ts` and `src/components/Avatar.ts`.
No behaviour changed.

Write the commit message for this change and save it to `commit-msg.txt`.
```

各runは空の作業ディレクトリで始まって `@path` も展開されないので、必要な情報は全部プロンプト本文に書き切る必要があります。

グレーダーは4つ。

```md:evals-demo/evals/writes-commit-message/graders/skill-fired.md
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?commit-msg"'
---
```

```md:evals-demo/evals/writes-commit-message/graders/file-created.md
---
type: file_exists
path: commit-msg.txt
---
```

```md:evals-demo/evals/writes-commit-message/graders/message-shape.md
---
type: regex
target: { source: file, path: commit-msg.txt }
pattern: '^(feat|fix|refactor|docs|test|chore|perf|build|ci)(\([a-z0-9/-]+\))?: [^\n]{1,60}\s*$'
---
```

```md:evals-demo/evals/writes-commit-message/graders/skill-then-write.md
---
type: tool_order
before: Skill
after: Write
---
```

`message-shape` で `target: files` ではなく `{ source: file, path: ... }` にしているのは、前述のとおり `files` が「作られたパスの一覧」であって中身ではないからです。コミットメッセージの形を見たいので中身を指す必要があります。

正規表現に `m` フラグを付けていないのも意図的で、`^`/`$` が文字列全体の先頭/末尾になるので「ちょうど1行」を強制できます。実際、プラグインなしの without 側はこれで落ちました。

### ケース2：発火してほしくない側

```md:evals-demo/evals/ignores-unrelated-request/prompt.md
---
description: A plain git question. The commit-msg skill must not fire.
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

In two or three sentences, what is the difference between `git fetch` and
`git pull`? I am not changing any code right now, I just want to understand
the two commands.
```

```md:evals-demo/evals/ignores-unrelated-request/graders/skill-not-fired.md
---
type: tool_used
tool: Skill
min: 0
max: 0
arm: both
---
```

```md:evals-demo/evals/ignores-unrelated-request/graders/answers-the-question.md
---
type: regex
target: last_message
pattern: 'git pull'
flags: i
---
```

`arm: both` が肝です。これを付けないと `tool_used: Skill` として除外対象に入ってしまい、「発火しないこと」の検査が両アームとも採点されません。公式docsにも

> set `arm: both` on a grader to score it in both arms regardless, which is what you want for a "must not invoke the skill" check with `min: 0` and `max: 0`.

とあります。付けた状態で実行したら両アームとも `scored: true` になっていました。なお、外した対照は今回実行していないので、「外すと除外される」のほうはdocs由来です。

## 「スキルが発火したか」だけ測るとΔが壊れる

ここが今回いちばん時間を使ったところです。

同じプロンプト・同じコマンド（`--case writes-commit-message` で1ケースに固定）で、**グレーダー構成だけ**を入れ替えて4回走らせました。

| パターン | グレーダー構成 | WITH | W/OUT | Δ | `scored` の実値 |
|---|---|---|---|---|---|
| A | `tool_used: Skill` のみ | 1.00 | 0.00 | **+1.00** | `skill-fired`: `withOnly=false` / `scored=true` |
| B | 結果側のみ（`file_exists` + `regex`） | 1.00 | 0.50 | +0.50 | 両方 `scored=true` |
| C | 4種すべて（A+B+`tool_order`） | 1.00 | 0.33 | +0.67 | `skill-fired`: `withOnly=true` / `scored=false`、他3つ `scored=true` |
| D | B + `tool_used: Skill`（`tool_order` 抜き） | 1.00 | 0.50 | +0.50 | `skill-fired`: `withOnly=true` / `scored=false`、他2つ `scored=true` |

### パターンA：グレーダーが除外対象しか無いとΔが +1.00 になる

公式docsにこういう例外があります。

> **Every grader excluded**: if every grader in a case is in the excluded set, they're scored normally instead, since there would be nothing left to score.

全部が除外対象だと採点するものが無くなってしまうので、例外的に通常採点に戻る。パターンAはまさにこれで、`tool_used: Skill` が除外されずに普通に採点されました。without 側は当然 Skill を呼べないので 0.00、結果としてΔが +1.00 に水増しされます。

出力の差も分かりやすくて、パターンAでは `[with-only, not scored]` の注記が消えています。

```
# パターンA
✓ skill-fired (weight 1): Skill called 1x (expected 1..∞)
✗ skill-fired (weight 1): Skill called 0x (expected 1..∞)

# パターンC
✓ skill-fired [with-only, not scored]: Skill called 1x (expected 1..∞)
```

レポートでも見分けられます。パターンAのレポートがこれです。

![パターンAのレポート。verdict は +100.0 pts、BASELINE SCORE 0%、skill-fired に PLUGIN-FIRED INDICATOR バッジが無い](/images/claude-plugin-eval-ci-gate-recipe/02-patternA-inflated-delta.png)

verdict が `↑ +100.0 pts`、タイルは ABLATION Δ +100.0 / BASELINE SCORE 0%。そして `skill-fired` に `PLUGIN-FIRED INDICATOR` バッジが**付いていません**。最初に貼ったパターンCのレポートではバッジが付いています。`jq` を叩かなくても、バッジの有無で `scored` が目で分かる作りになっていました。

対処としては、結果側のグレーダー（`file_exists` や `regex`）を最低1つ足すだけです。

### パターンC：`tool_order` が除外をすり抜ける

もっと厄介だったのがこっちです。

パターンC（4種全部）のΔが +0.67 なのに、結果側だけのパターンB は +0.50。`skill-fired` は `scored=false` で除外されているはずなのに、なぜ値が違うのか分からなくなりました。

公式の除外リストはこの3条件です。

> - Every `tool_used` grader whose `tool` is `Skill`
> - Every `regex` grader with `target: mock_calls` and every `llm` grader with `focus: mock_calls`, when each mocked server in the case is one your plugin declares
> - Any grader you mark `arm: with-only`

**`tool_order` が一言も書かれていません。** 実際に `aggregate-result.json` を見ると、`type: tool_order` / `before: Skill` のグレーダーは `withOnly=false` / `scored=true` で両アームとも採点されていて、without 側では `"before" tool Skill never called` で必ず落ちています。

切り分けのために、計画には無かったパターンD（`tool_order` だけ抜いた構成）を追加で走らせました。D は Δ +0.50 で、B と一致。C との差 +0.17 はまるごと `tool_order` グレーダー由来だと分離できました。

つまり、`tool_used: Skill` は除外されるのに、**同じ Skill を `tool_order` で参照すると除外されない**。除外機構が防ごうとしている水増しが、そのまま起きています。パターンCの「正直なΔ」は B/D と同じ +0.50 で、+0.67 は構成の副作用でした。

ここは切り分けておきたいんですが、「公式が `tool_order` を除外対象と書いていない」はdocsの記述、「実際に両アームで採点されてΔが +0.17 増える」は 2.1.287 での実測です。仕様としてそうなのかバグなのかは判断できていません。

いずれにせよ、Δの数字を信じる前に `scored` を全グレーダー分見るのが確実です。

```bash
jq '.cases[].arms.with[].graders[] | {name, withOnly, scored, passed}' \
  evals/results/*/aggregate-result.json
```

## `--ablation none` で絶対スコアが変わる……とは限らない

`--ablation none` を付けると without アームを走らせず、以前の単一アーム方式になります。同じスイートで両モードを比べました。

| | `--ablation with-without`（既定） | `--ablation none` |
|---|---|---|
| サマリのカラム | `CASE / WITH / W/OUT / Δ / RUNS / COST / NOTES` | `CASE / SCORE / PASS% / RUNS / COST / NOTES` |
| 実行 run 数 | 4（2アーム × 2ケース） | 2（1アーム × 2ケース） |
| COST | $0.20 | $0.10 |
| 所要 | 25s | 10s |
| `aggregates.overallScore` | 1.0 | 1.0 |
| `skill-fired` の扱い | `[with-only, not scored]` / `scored=false` | `(weight 1)` / 通常採点 |
| 冒頭の Ablation 通知 | 出る | 出ない |

![--ablation none のレポート。片アームなので baseline セクションが無い](/images/claude-plugin-eval-ci-gate-recipe/03-ablation-none.png)

事前の想定では「`none` では除外が働かないので絶対スコアが変わるはず」と思っていたんですが、**両モードとも `overallScore` 1.0 で同じでした**。理由ははっきりしていて、with 側では `skill-fired` も含め全グレーダーが合格しているので、採点対象に加わってもスコアが動かないからです。

機構そのものは観測できています（`scored` が false → true に反転して、`[with-only, not scored]` の注記が消える）。絶対スコアが変わるのは、除外対象のグレーダーが落ちているときだけ。公式の「can produce a different absolute score」は “can” であって必ずではない、という読み方になりそうです。

一方、run数とコストがちょうど半分になるのは確実な効果でした。使い分けの根拠はスコアの側ではなくコストと時間の側にあります。毎コミットは `none` で速く安く、リリース前は `with-without` でΔを見る、くらいが現実的かなと思っています。

## 終了コードとコスト上限

CIに入れるなら、どう落ちるかを把握しておく必要があります。閾値まわりを確かめるために、必ず落ちるグレーダー（`regex` / `pattern: 'ZZZ_THIS_NEVER_APPEARS_ZZZ'`）を一時的に足して score 0.80 を作りました。

```bash
# (1) 既定の threshold 1.0
claude plugin eval . --trust-plugin --runs 1 --allow-tools Write --max-cost-usd 3 \
  --no-publish --ablation none --case writes-commit-message --threshold 1.0
# → score 0.80 / exit=1

# (2) threshold 0.8
claude plugin eval . --trust-plugin --runs 1 --allow-tools Write --max-cost-usd 3 \
  --no-publish --ablation none --case writes-commit-message --threshold 0.8
# → score 0.80 / exit=0
```

(1) の出力全文です。

```
Plugin under test: "evals-demo" version "0.1.0" at ".../evals-demo"
  writes-commit-message run 1/1: score 0.80  $0.06
    ✓ file-created (weight 1): commit-msg.txt exists as expected
    ✗ impossible (weight 1): pattern not found in last_message
    ✓ message-shape (weight 1): matched ^(feat|fix|refactor|docs|test|chore|perf|build|ci)(\([a-z0-9/-]+\))?: [^\n]{1,60}\s*$
    ✓ skill-fired (weight 1): Skill called 1x (expected 1..∞)
    ✓ skill-then-write (weight 1): Skill@0 precedes Write@1
✗ writes-commit-message  score 0.80  (1 run)  $0.06

CASE                   SCORE PASS% RUNS COST    NOTES
writes-commit-message  0.80  0%    1    $0.06   impossible: pattern not found in last_message

1 case(s) · 6s · $0.06

Re-run with --keep-temp to preserve each run's sandbox (workspace + trace.jsonl) for debugging.
Report: .../evals/results/2026-10-03T04-41-11-878Z/report.html
exit=1
```

![score 0.80 で閾値割れしたレポート。impossible グレーダーの fail と失敗理由が展開されている](/images/claude-plugin-eval-ci-gate-recipe/04-threshold-fail-080.png)

同じ 0.80 なのに exit が 1 と 0 で割れます。既定の `--threshold` が 1.0、つまり1ケースでも満点未満なら落ちるからです。`PASS%` が `0%` と出るのも同じ理由（このケースは閾値未満なので「通ったrun 0%」）。

CIに入れるなら `--threshold` の明示は必須だと思います。既定のままだとグレーダーを1つ足しただけで毎回赤くなります。

### コスト上限は事前チェックなので超過する

```bash
claude plugin eval . --trust-plugin --runs 1 --allow-tools Write --no-publish \
  --max-cost-usd 0.01 --json results.json
```

```
Ablation: defaulting to with-without — ...
Wrote results.json
Report: .../evals/results/2026-10-03T04-41-40-431Z/report.html
exit=2
```

```json
{ "partial": true, "partialReason": "cost_ceiling",
  "costUsd": 0.0444614, "durationSeconds": 4 }
```

exit 2 で、`results.json` に `partial: true` と `partialReason: "cost_ceiling"` が入ります。スネークケースの機械可読な値なので、CIで分岐させるならこれを見ればよさそうです。

ただ、**上限 $0.01 を指定したのに実コストは $0.0444** でした。公式の「The ceiling is checked before each run launches, so overrun is bounded to the runs in flight」のとおり、上限は各run起動前のチェックなので必ず超過します。厳密な予算の上限値としては使えません。

### ターゲットは引数の先頭に置く

これは踏むと分かりやすいやつです。

```bash
claude plugin eval --json .
```

```
Error: --json output path must end in .json (got '.'). If that is your eval target, put it before --json.
exit=1
```

エラーメッセージが直し方まで教えてくれるので親切なんですが、CIスクリプトだとメッセージを読まずに exit 1 だけ見て混乱しそうです。最初からターゲットを先頭に書く癖をつけたほうがいい。

なお `--allow-tools` でも同じ罠を踏めるかと思って試したら、こちらは再現しませんでした。

```bash
claude plugin eval --allow-tools Write <plugindir> --trust-plugin --runs 1 --no-publish --max-cost-usd 0.5
# → 正常動作。Plugin under test: "evals-demo" ... / Δ +0.67 / Write も grant されている
```

2.1.287 では可変長の `--allow-tools` がターゲットを飲み込まずに正しく解決しました。実際に落ちたのは `--json` のときだけです。

## GitHub Actions ワークフロー

先に検証範囲をはっきりさせておくと、**これを GitHub Actions 上で実行してはいません**。push や secrets の設定といった人手の操作を避けたので、確認できたのは「ワークフローが実行するのとほぼ同じコマンド列が、ローカルのシェルで exit 0 で通る」ところまでです。YAML のCI側パース、ランナー上の挙動、`secrets.ANTHROPIC_API_KEY` の受け渡しは未検証です。

ローカルでの再現結果はこれです。

```bash
claude plugin validate . --strict
# → ✔ Validation passed / exit=0

claude plugin eval . --trust-plugin --runs 1 --allow-tools Write \
  --ablation with-without --threshold 0.8 --max-cost-usd 3 --no-publish --json results.json
# → Wrote results.json / exit=0
```

このローカル再現に `--model` / `--judge-model` は含めていません（YAML 側だけに書いてあるフラグで、実行して確かめてはいません）。

```json
{ "partial": false, "partialReason": null, "costUsd": 0.19522240000000002,
  "durationSeconds": 23, "claudeVersion": "2.1.287",
  "aggregates": { "casesTotal": 2, "casesPassed": 2, "overallScore": 1,
                  "overallPassRate": 1, "meanDelta": 0.33333333333333337 } }
```

ワークフロー全文です。

```yaml:.github/workflows/plugin-eval.yml
name: plugin-eval

# Gate plugin/skill changes on the eval suite.
# NOTE: this job makes REAL model calls on whatever credential you give it.
# Every run and every judge grader counts against your plan's usage or your API bill.

on:
  pull_request:
    paths:
      - 'skills/**'
      - '.claude-plugin/**'
      - 'evals/**'
      - '.github/workflows/plugin-eval.yml'
  workflow_dispatch:

jobs:
  eval:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      # `claude plugin eval` needs git >= 2.31 on PATH, or it stops before
      # running any case and exits 1. ubuntu-latest ships a newer git.
      - name: Show tool versions
        run: |
          git --version
          node --version

      - name: Install Claude Code
        run: npm i -g @anthropic-ai/claude-code

      - name: Show Claude Code version
        run: claude --version

      # Fails fast on manifest/skill errors before spending any model calls.
      # --strict turns warnings (e.g. a skill with no description) into exit 1.
      - name: Validate plugin
        run: claude plugin validate . --strict

      # --model / --judge-model pin the model IDs: without them a new model
      # generation moves Δ and you can't tell a regression from a model change.
      # Revisit these so you don't stay pinned to an outdated generation.
      - name: Run eval suite
        env:
          # The runner needs the same credential your normal sessions use.
          # Without --trust-plugin the run stops at the trust prompt and exits 1.
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude plugin eval . \
            --trust-plugin \
            --runs 1 \
            --allow-tools Write \
            --ablation with-without \
            --model claude-sonnet-4-5 \
            --judge-model claude-haiku-4-5 \
            --threshold 0.8 \
            --max-cost-usd 3 \
            --no-publish \
            --json results.json

      # Exit codes: 0 = every case >= --threshold. 1 = a case below threshold,
      # a case file failed to load, no cases found, or the dir isn't trusted.
      # 2 = partial run (cost ceiling hit or credential rejected); results.json
      # is still written with "partial": true and a "partialReason".
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: plugin-eval-results
          path: |
            results.json
            evals/results/**/report.html
```

`claude plugin validate . --strict` をモデル呼び出しの前に置いているのは、マニフェストやスキルの記述ミスでコストを払いたくないからです。

ひとつ注意点があって、`--json results.json` を付けると**サマリ表と per-run のグレーダー行が標準出力に出なくなります**。`Wrote results.json` と `Report:` の2行だけになる。公式docsの「To see why a case scored low, run it locally without `--json`」はこのことでした。CIで原因を追うなら artifact の `report.html` を見る設計にしておく必要があります。上の YAML で `report.html` も upload しているのはそのためです。

## Δが0・または不自然な値になったときの判定表

今回の実測とdocsを突き合わせて作った表です。各行に出典（実測／docs）を残してあります。

| 症状 | 原因 | 確認方法 | 対処 | 出典 |
|---|---|---|---|---|
| `W/OUT` カラムが出ない | ケースのプラグインが解決できていない | stderr の `ablation requested but no plugin resolved` | `prompt.md` に `plugins: ["../.."]` | docs |
| 同上 | `--ablation none` を付けている | サマリのカラムが `SCORE / PASS%` に変わる。冒頭の Ablation 通知も出なくなる | `--ablation with-without` | 実測 |
| 同上 | `context.history_file` でパス指定ターゲット（既定で片アーム） | stderr の `single-arm (no Δ)` 通知 | `--ablation with-without` | docs |
| Δが0なのに両アーム1.00 | ベースラインでも解けるタスク＝プラグインの寄与が無い | `cases[].arms.without[]` のスコア | ケースを難しくする | 実測（`ignores-unrelated-request` がこれ） |
| Δが0で `tool_used: Skill` が fail | スキルの `description` がその言い回しで発火しない | report の該当グレーダー行 | `description` を直して再実行 | docs |
| Δが +1.00 など不自然に大きい | 除外対象のグレーダーしか無い。全除外時は例外で通常採点され、without が 0 に落ちる | 出力の `[with-only, not scored]` 注記が消えている／レポートのバッジが無い | 結果側グレーダー（`file_exists` / `regex`）を最低1つ足す | 実測（パターンA: Δ +1.00、W/OUT 0.00） |
| Δが本来より少し大きい | `tool_order` で `Skill` を参照している。`tool_used: Skill` と違い除外されず、without 側で必ず落ちる | `jq '.cases[].arms.without[].graders[]'` で `"before" tool Skill never called` を探す | その `tool_order` を外すか、`Skill` を含まない順序検査に変える | 実測（C=+0.67 vs D=+0.50、差 +0.17） |
| 絶対スコアが `--ablation` の2モードで変わらない | 除外対象グレーダーが with 側で全部合格していると、採点に加えてもスコアが動かない | 両モードの `aggregates.overallScore` を比較 | 差を見たいなら除外対象が落ちるケースで比較する | 実測（両モードとも 1.0） |
| Δがマイナス | 判定モデル側の揺れ（`llm` グレーダー使用時） | report の判定票 | `--judge-model` を固定する／rubric を締める | docs（無料グレーダーのみなので未実測） |
| 突然ほぼ全ケース0 | 実行途中でプラン使用量・レート上限に到達。`partial` は立たない | `NOTES` 欄 / `cases[].arms.with[].error` | 上限解除後に `--runs 1` や `--case` で絞って再実行 | docs（今回は未発生） |
| exit 1 なのに結果は妥当に見える | `--threshold` の既定が 1.0。1ケースでも満点未満なら exit 1 | 同じスコアで `--threshold` だけ変えて exit を比較 | CI では `--threshold` を要求水準に合わせて明示 | 実測（score 0.80 で 1.0→exit 1 / 0.8→exit 0） |
| exit 2 / 結果が途中まで | `--max-cost-usd` の上限に到達 | `results.json` の `partial` / `partialReason` | 上限を上げる。上限は事前チェックなので実コストは超過する | 実測（上限 $0.01 に対し実コスト $0.0444） |
| ケースが1件も走らず exit 1 | グレーダーが0件 | stderr の `invalid case.yaml:   graders: Required` | `graders/` に最低1ファイル置く | 実測（パターン切替の作業中に偶発） |
| 1ケースも走らず exit 1 | git が 2.31 未満 | `git --version` | git を更新 | docs（本環境は 2.50.1 のため未実測） |

グレーダー0件の行は怪我の功名で埋まりました。パターンを切り替えるときのバックアップ処理が前段のコマンド中断で走っておらず、復元元が無いままグレーダーを全部消してしまって `invalid case.yaml:   graders: Required` で落ちました。4ファイル書き直す羽目になりましたが、判定表の1行が実測で埋まったのでよしとしています。

## レポートを撮るときの小ネタ

レポートHTMLを Playwright で撮ろうとして、`npx playwright install chromium` を先に打ったらブラウザが入らずインストール案内だけ出て終了しました。`playwright` パッケージ自体が未導入だったせいです。

```bash
npm i -D playwright
npx playwright install chromium
```

この順なら通ります。順序を間違えると無言で何も入らないので、ちょっと戸惑いました。

撮影スクリプトはこれだけです。レポートは外部リクエストを投げないので `file://` 直読みでオフラインでも撮れます。

```js:shot.mjs
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
```

## 最短の再現手順

```bash
# 1. プラグインを作る（plugin.json + skills/<name>/SKILL.md）
claude plugin validate . --strict          # → Validation passed / exit 0

# 2. ケースの雛形を作る（モデルを呼ばない。コスト 0）
claude plugin eval init --bare writes-commit-message
# 生成される graders/criteria.md は type: llm（課金）なので無料グレーダーに差し替える

# 3. 走らせる（ターゲットは必ず先頭）
claude plugin eval . --trust-plugin --runs 1 --allow-tools Write \
  --max-cost-usd 3 --no-publish

# 4. Δを信じる前に scored を全部見る
jq '.cases[].arms.with[].graders[] | {name, withOnly, scored, passed}' \
  evals/results/*/aggregate-result.json
```

## まだ分かっていないこと

今回の検証で触れていない範囲を書いておきます。

**`--runs 1` で回しています。** 既定は3runです。評価は単体テストと違って同じ入力で結果が揺れうるので、本来は「1回通った」ではなく「何回中何回」が意味を持つはずです。今回パターンCを3回走らせていずれも `with 1.00 / without 0.33 / Δ +0.67` で完全に一致しましたが、これは「このケースでは安定していた」までの話で、一般に1runで足りる根拠にはなりません。実運用では `--runs` を上げるぶんコストも比例して増えるので、そこは要相談だと思います。

**GitHub Actions 上では実行していません。** 前述のとおり、確認したのはローカルでのコマンド列再現までです。

**課金グレーダー（`llm` / `baseline`）は使っていません。** Δがマイナスになる現象や `--judge-model` の効き方は未実測です。判定表の該当行はdocs由来です。

**`arm: both` を外した対照も取っていません。** 付けた側で両アームとも `scored: true` になったことは実測しましたが、外すと除外されるほうはdocsの記述です。

**`tool_order` の除外漏れが仕様かバグかは分かりません。** 2.1.287 でそうなっている、というところまでです。将来のバージョンで変わる可能性があるので、Δの絶対値を運用の閾値に直接使うより、`scored` を確認する手順をセットにしておくほうが安全だと思っています。

- [Plugin evals - Claude Docs](https://code.claude.com/docs/en/plugin-evals)
- [Plugins - Claude Docs](https://code.claude.com/docs/en/plugins)
