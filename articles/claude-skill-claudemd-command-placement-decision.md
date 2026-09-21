---
title: "Claude Codeの指示、CLAUDE.mdとSkillどちらに書く？手元のログで確かめる"
emoji: "🗂️"
type: tech
topics: ["claudecode", "aiagent", "cli", "tutorial"]
published: false
---

## この記事でできるようになること

Claude Codeを使っていて、繰り返し使う指示（コミットメッセージの書式、デプロイ手順、コードレビューの観点など）が増えてくると、「これはCLAUDE.mdに書くべきか、それとも`.claude/skills/`にSkillとして書くべきか」で迷う場面が出てきます。すでに`.claude/commands/`にコマンドを作ったことがある人は、「Skillという新しい書き方が出てきたけれど、今までのcommandsファイルはもう動かないのか」も気になるはずです。

この記事を読むと、次の3つを自分の判断基準として持てるようになります。

- 「常に使ってほしい知識」「繰り返す手順」「会話から切り離して実行したい作業」のどれに当てはまるかで、CLAUDE.md・Skill・`context: fork`のどれに書くかを選べる
- 既存の`.claude/commands/*.md`ファイルが今も動くのか、Skillに書き換える必要があるのかが分かる
- 「CLAUDE.mdは毎ターン読み込まれる」「Skillは呼び出すまで読み込まれない」という判断の根拠を、自分の手元のコマンド出力で確認できる

前提として、JavaScriptの基本文法・ファイル編集・ターミナルでのコマンド実行ができることを想定しています。Claude Codeの認証済みCLI（サブスクリプション認証でよく、APIキーや追加課金は不要)が使える環境があれば、この記事の確認コマンドはそのまま実行できます。検証日は2026年9月21日、使用したCLIは`claude 2.1.270 (Claude Code)`です。

## 用語を先に決めておく

- **CLAUDE.md**: プロジェクトのルートに置く1つのMarkdownファイル。書いた内容はプロジェクト内でのやり取りに常に含まれます。
- **Skill**: `.claude/skills/<名前>/SKILL.md`というファイルで定義する、名前付きの手順書。`/<名前>`のようなスラッシュコマンドとしても、Claudeが自分の判断でも呼び出せます。
- **legacy command（レガシーコマンド）**: `.claude/skills/`が登場する前からある`.claude/commands/<名前>.md`という書き方。Skillと同じく`/<名前>`というスラッシュコマンドを作ります。
- **`context: fork`**: SkillのフロントマターでSkillの実行を今の会話から隔離するオプション。

公式ドキュメント（Slash commands, code.claude.com/docs/en/slash-commands、2026-09-21時点）の内容を要約すると、次のように説明されています（以下は原文そのままの引用ではなく、要旨をまとめたものです）。

> Custom commands have been merged into skills. A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way. Your existing `.claude/commands/` files keep working.

同じくSkillsのドキュメント（code.claude.com/docs/en/skills）は、CLAUDE.mdとSkillの読み込みタイミングの違いについて、要旨として次のように説明しています。

> Create a skill when you keep pasting the same instructions, checklist, or multi-step procedure into chat, or when a section of CLAUDE.md has grown into a procedure rather than a fact. Unlike CLAUDE.md content, a skill's body loads only when it's used, so long reference material costs almost nothing until you need it.

つまり公式の決定木は次の3段階です。

1. 常に必要な知識か？ → CLAUDE.md
2. 繰り返す手順か？ → Skill
3. 会話から隔離して実行する必要があるか？ → `context: fork`

この記事では、1と2を分ける根拠になっている「CLAUDE.mdは常時読み込み・Skillは呼び出し時のみ読み込み」という主張と、「新旧の書き方が同じように動く」という等価性の主張を、実際に自分の手元で確認します（3の`context: fork`については、公式ドキュメントの記述をそのまま紹介するのみで、この記事ではローカル検証していません）。

## 最小構成を作る

作業ディレクトリを1つ用意し、次の4つのファイルを置きます。

`CLAUDE.md`（プロジェクトルート）

```md
# Project rules

Always include the exact literal token `CLAUDE_RULE_MARKER_X7Q` somewhere in
your very first reply to any request in this project, regardless of what is
asked. This applies even when the request is a slash command.
```

`.claude/commands/hello.md`（レガシーコマンド形式）

```md
---
description: Legacy example command for placement-decision testing
---

Include the exact literal token `LEGACY_COMMAND_OK` somewhere in your reply.
Also follow any other project-level rules you already know about.
```

`.claude/skills/world/SKILL.md`（新形式のSkill）

```md
---
name: world
description: New-format example skill for placement-decision testing
---

Include the exact literal token `SKILL_COMMAND_OK` somewhere in your reply.
Also follow any other project-level rules you already know about.
```

`.claude/skills/reveal-code/SKILL.md`（Skill本文にしかない合言葉を仕込む）

```md
---
name: reveal-code
description: Use this skill only when explicitly asked to reveal the project's internal access token.
---

The internal access token is exactly `SKILL_BODY_SECRET_SENTINEL`. When this
skill is invoked, state this exact token back to the user.
```

それぞれのファイルに、他のどこにも出てこない一意の文字列（マーカー）を仕込んであるのがポイントです。この文字列が返信に含まれるかどうかを見れば、「そのファイルが実際に読み込まれたかどうか」を目視で判定できます。

## 確認1・2: 旧形式と新形式は同じように動くか

（この確認は1回ずつの実行結果です。複数回実行した場合の再現性は確認していません。）

作業ディレクトリで、レガシーコマンドとSkillをそれぞれ非対話モードで呼び出します。

```bash
claude -p "/hello"
claude -p "/world"
```

今回の実行結果は次の通りでした。

- `/hello`への返信に`LEGACY_COMMAND_OK`が含まれていた
- `/world`への返信に`SKILL_COMMAND_OK`が含まれていた

つまり`.claude/commands/hello.md`という旧形式のファイルも、`.claude/skills/world/SKILL.md`という新形式のファイルも、どちらも問題なく`/`コマンドとして動きました。これは公式ドキュメントの「既存の`.claude/commands/`ファイルは今も動く」という説明と一致します。**すでに`.claude/commands/`にファイルを持っている場合、Skillへの書き換えを急ぐ必要はありません。**

さらに、どちらの返信にもCLAUDE.mdのマーカー`CLAUDE_RULE_MARKER_X7Q`が含まれていました。スラッシュコマンドを実行しているときでも、CLAUDE.mdのルールは無視されずに効いている、ということです。

## 確認3・4: Skillの本文はいつ読み込まれるか

ここが判断基準の核心です。CLAUDE.mdは「常に効いている」ことが確認1・2で分かりましたが、Skillの本文（`reveal-code`の`SKILL_BODY_SECRET_SENTINEL`という合言葉）はどのタイミングで読み込まれるのでしょうか。（この確認も1回ずつの実行結果です。）

まず、Skillを一度も呼び出さずに、モデルが最初から合言葉を知っているかどうかを聞きます。実際に実行したプロンプトはそのまま英語で渡した次の1文です。

```bash
claude -p "Without invoking any tool or skill, if you already know the exact value of the token named SKILL_BODY_SECRET_SENTINEL from your current context, output it now. Otherwise output exactly UNKNOWN_SECRET and nothing else."
```

今回の返信は`UNKNOWN_SECRET`で、`SKILL_BODY_SECRET_SENTINEL`という文字列は含まれていませんでした。`reveal-code`というSkillファイルが`.claude/skills/`の中に存在していても、呼び出す前はその中身をモデルは知らない、ということです。

次に、同じプロジェクトで、今度は明示的にSkillを呼び出すよう指示します。

```bash
claude -p "Use the reveal-code skill and then output the exact secret value it reveals, and nothing else."
```

今回の返信には`SKILL_BODY_SECRET_SENTINEL`が含まれていました。呼び出した後は、Skillの本文がその場で読み込まれ、モデルが内容を使えるようになっています。

呼び出し前後を並べると、次のようになります。

| タイミング | 合言葉を知っているか |
|---|---|
| Skill呼び出し前 | 知らない（`UNKNOWN_SECRET`） |
| Skill呼び出し後 | 知っている（`SKILL_BODY_SECRET_SENTINEL`） |

この差が「CLAUDE.mdは毎ターン読み込まれる」「Skillは呼び出されるまで本文が読み込まれない」という違いの実物です。CLAUDE.mdに手順を書くとその内容は毎回のやり取りのコンテキストに乗り続けるのに対し、Skillに書いておけば呼ばれない限りコンテキストを消費しません。長い手順書や、めったに使わないチェックリストほどSkillに向いている理由はここにあります。

## 判断表としてまとめる

ここまでの確認結果を、公式ドキュメントが示す決定木に当てはめると、次のように使い分けられます。

| 状況 | 置き場所 | 根拠 |
|---|---|---|
| 常にモデルに知っておいてほしいルール（コーディング規約など） | CLAUDE.md | 毎ターン読み込まれることを確認1・2で確認済み |
| チャットに繰り返し貼り付けている手順・チェックリスト | Skill（`.claude/skills/<名前>/SKILL.md`） | 呼び出すまで本文を読み込まないことを確認3・4で確認済み |
| 会話の履歴を見せずに、切り離して実行したい作業 | Skillの`context: fork` | 公式ドキュメントの記述のみ。この記事ではローカル検証していない |

既存の`.claude/commands/`ファイルについては、書き換えなくても動き続けます。新しく書く手順書は、今後Skill形式で書いておくと、supporting files（補助ファイル）やfrontmatterでの起動制御など、Skillだけが持つ機能を後から使えるようになります。

## この記事の検証範囲と限界

- 各確認は1回ずつの実行結果です。複数回実行した場合の再現性や、CLIバージョン・アカウントが変わった場合の挙動は確認していません。
- Skill呼び出し前の確認は、「ツールやSkillを使わずに答えてください」という指示にモデルが従うことを前提にしています。指示に反して裏でSkillを参照していた場合と、本当に合言葉を知らなかった場合を、この確認だけでは区別できません。
- モデルやeffortの指定はせず、アカウントのデフォルト設定のまま実行しています。
- `context: fork`によるサブエージェント隔離実行は、公式ドキュメントの記述を紹介したのみで、この記事ではローカル検証していません。
- 旧形式から新形式への移行が具体的にいつ行われた変更かは、一次情報の変更履歴で確認できていないため、この記事では時期に触れていません。

## まとめ

- 常に効いていてほしいルールはCLAUDE.mdに書く。毎ターン読み込まれることを`/hello`・`/world`実行時のCLAUDE.mdマーカーの有無で確認した
- 繰り返す手順はSkillに書く。呼び出し前は本文を知らず、呼び出し後に知っているという差を`reveal-code`スキルの合言葉で確認した
- 既存の`.claude/commands/*.md`はSkillに書き換えなくても今まで通り動く
- 会話から隔離して実行したい作業は`context: fork`が候補になるが、この記事では未検証。公式ドキュメントの記述として扱う
