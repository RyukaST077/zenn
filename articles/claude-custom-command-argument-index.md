---
title: "Claude Codeの独自コマンドで複数の引数を正しく受け取るテンプレートと確認手順"
emoji: "🔢"
type: "tech"
topics: ["claudecode", "cli", "ai", "productivity"]
published: false
---

Claude Codeでは `.claude/commands/` にMarkdownファイルを置くと、`/コマンド名 引数1 引数2` のように呼び出せる独自スラッシュコマンドを作れます。このとき、複数の引数を「全体の文字列」として使うのか、「1番目」「2番目」と個別に使い分けたいのか迷うことがあります。

ネットで見かける解説記事の中には、`$1` を「1番目の引数」として説明しているものがあります。ところが、Claude Code公式ドキュメント（2026-09-09時点、[code.claude.com/docs/en/slash-commands](https://code.claude.com/docs/en/slash-commands)）では、`$0` が1番目、`$1` が2番目という0始まりのインデックスで説明されています。この記事では、どちらが実際のCLIの挙動と一致するかを、自分の手元で確認できるコマンドファイルと実行手順を示します。検証には Claude Code `2.1.265` を使いました。

## この記事で分かること・前提知識

前提として、JavaScriptの変数・関数の基本、ファイル編集、ターミナルでのコマンド実行ができることを想定します。Claude Codeの `claude -p "..."` での呼び出しは知っている前提とし、`.claude/commands/` に独自コマンドを作ったことがない読者を対象にします。

この記事で新しく扱うのは次の2点です。

- `.claude/commands/*.md` の書き方（frontmatterと本文）
- `$ARGUMENTS`（引数全体の文字列）と `$0` / `$1`（個別の引数、0始まり）の違い

読み終えると、2つの引数を受け取る独自コマンドを書くときに、`$ARGUMENTS` と `$0` / `$1` のどちらを使えば意図した引数を受け取れるかを、自分の環境で確認してから選べるようになります。

## 最初に用意するファイル

`.claude/commands/argindex.md` というファイルを、プロジェクトのルート直下に作ります。

```markdown
---
description: Write the resolved argument placeholders to result.txt
argument-hint: <first> <second>
---
Use the Write tool exactly once to create a file named result.txt in the current directory. The file must contain exactly this single line of text and nothing else, with a trailing newline: ARGUMENTS=[$ARGUMENTS] ARG0=[$0] ARG1=[$1]

Do not use any other tool. Do not add any explanation before or after using the tool.
```

frontmatterの `description` と `argument-hint` はコマンドの説明とヒント表示用です。本文中の `$ARGUMENTS`、`$0`、`$1` が、実際に呼び出し時の引数へ置き換わるプレースホルダーです。この置き換えは、プロンプトがモデルに渡される前にCLI側の文字列処理として行われます。つまりモデルの挙動ではなくCLIの挙動を確認していることになります。

## 実行して確認する

このファイルを含むプロジェクトのルートで、次のコマンドを実行します。

```bash
claude -p "/argindex A B" --setting-sources project --permission-mode bypassPermissions
```

`--permission-mode bypassPermissions` は、`argindex.md` 内のWriteツール呼び出しを承認待ちなしで実行させるためのフラグです。これを付けないと、`-p` での非対話実行中にWriteツールの実行が承認待ちでブロックされ、`result.txt` が作られないことがあります。このフラグは自分の作業ディレクトリでの検証用であり、信頼できないコマンドファイルに対しては使わないでください。

`/argindex` の後ろに渡した `A` と `B` が、それぞれ引数として `argindex.md` 内のプレースホルダーに展開されます。実行が終わると、カレントディレクトリに `result.txt` が作られます。

```
ARGUMENTS=[A B] ARG0=[A] ARG1=[B]
```

これが2026-09-09に Claude Code `2.1.265` で実際に得られた結果です。それぞれの値の意味は次のとおりです。

- `ARGUMENTS=[A B]` — `$ARGUMENTS` は呼び出し時に渡した引数をまとめた文字列そのもの（`"A B"`）に展開される
- `ARG0=[A]` — `$0` は1番目の引数（`"A"`）に展開される
- `ARG1=[B]` — `$1` は2番目の引数（`"B"`）に展開される

この3つの値は同じ1回の呼び出しから得られたものです。`$ARGUMENTS` と `$1` が別の値（`"A B"` と `"B"`）になっている点、`$1` が2番目の引数になっている点が、それぞれ独立して確認できます。

## ブログでよく見る書き方との食い違いに注意する

冒頭で触れたとおり、`$1` を「1番目の引数」として説明している解説記事があります（[alexop.dev、2025-11-22公開](https://alexop.dev/posts/claude-code-slash-commands-guide/)）。もしこの説明を信じて `$1` を「1番目の引数のつもり」で書くと、実際には2番目の引数（今回の例では `"B"`）が展開されてしまいます。

今回の実行結果 `ARG1=[B]` は、`$1` が1番目ではなく2番目の引数に展開されることを直接示しており、この解説記事の説明とは食い違います。1番目の引数を個別に使いたい場合は `$1` ではなく `$0` を書く必要があります。

引数がずれても実行時にエラーは出ません。値が静かに入れ替わるだけなので、コマンドを書いた後に自分で一度実行して確認しておくことが重要です。

## 決定ルール

2つの引数を受け取る独自コマンドを書くときは、次のどちらかを選びます。

- 引数全体をまとめて1つの文字列として使いたい → `$ARGUMENTS`
- 1番目の引数だけを個別に使いたい → `$1` ではなく `$0`
- 2番目の引数だけを個別に使いたい → `$1`

そのうえで、上記の `argindex.md` と同じ形のコマンドファイルを実際のプロジェクトに置き、`claude -p "/<コマンド名> <1番目> <2番目>" --setting-sources project --permission-mode bypassPermissions` を一度実行して `result.txt`（または同等の出力）を見れば、手元のCLIでの実際の展開結果を自分の目で確認できます。

## この記事の範囲に含まれないこと

今回確認したのは、Claude Code `2.1.265` で2つの位置引数（`$0`、`$1`、`$ARGUMENTS`）を1回呼び出した結果です。次の内容はここでは検証していないため、この記事の結果から一般化しないでください。

- `$name` のような名前付き引数、`$ARGUMENTS[N]` のような角括弧インデックス構文
- 3つ以上の引数、または引数が渡されなかった場合のフォールバック挙動
- Claude Code `2.1.265` 以外のバージョンでの挙動
- Codexなど、Claude Code以外のCLIの独自コマンド機構

これらを使う場合は、この記事と同じやり方（コマンドファイルを1つ作り、実際に呼び出して出力を確認する）で、自分の手元のCLIバージョンで個別に確認してください。
