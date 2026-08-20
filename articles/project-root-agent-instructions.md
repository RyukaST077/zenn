---
title: "CLAUDE.mdとAGENTS.mdを「置いただけ」で終わらせない検証ハーネス"
emoji: "🧭"
type: tech
topics: ["claudecode", "codex", "aiagent", "cli"]
published: true
---

`CLAUDE.md` や `AGENTS.md` にプロジェクト固有の手順を書いても、ファイルが存在するだけでは、その指示が実行結果へ反映された証拠にはなりません。メインのテストが通っていても、指示ファイルにだけ書いた追加作業が抜けている可能性は残ります。

そこで、同じタスクを「指示ファイルなし」と「あり」で実行し、指示ファイルにだけ書いたマーカーと変更範囲を比較しました。2026年8月11日にClaude CodeとCodex CLIで各2ケース、合計4ケースを実行したところ、マーカーが現れたのは両製品ともguidedケースだけでした。

この記事の結論はシンプルです。

> `CLAUDE.md` と `AGENTS.md` は、置いたことではなく、baseline・指示固有の完了条件・変更範囲を使って「行動」で確認する。

これは製品性能の比較ではありません。プロジェクト指示をCIや非対話CLIで使うときの、小さな検証ハーネスの作り方です。

## 4ケースではguidedだけにマーカーが出た

Claude CodeとCodex CLIについて、同じ実装プロンプトをbaselineとguidedへ1回ずつ渡しました。

| ケース | ルートの指示 | マーカー | 変更ファイル | テスト |
|---|---|---|---|---|
| Claude baseline | なし | なし | `src/greet.js` | 成功 |
| Claude guided | `CLAUDE.md` | `AGENT_RULE_APPLIED` | `src/greet.js`, `verification.txt` | 成功 |
| Codex baseline | なし | なし | `src/greet.js` | 成功 |
| Codex guided | `AGENTS.md` | `AGENT_RULE_APPLIED` | `src/greet.js`, `verification.txt` | 成功 |

4ケースすべてでエージェントと検証コマンドは終了コード0でした。保護対象の `test.mjs` と `package.json` は変更されず、許可していないパスへの変更もありませんでした。

guidedケースだけに追加された差分は、次の1ファイルです。

```diff
diff --git a/verification.txt b/verification.txt
new file mode 100644
+AGENT_RULE_APPLIED
```

この結果から確認できるのは、記録した条件でルートの指示ファイルにだけ書いた作業が、guidedケースの行動へ現れたことです。

## テスト成功だけでは指示を確認できない

4ケースへ渡した共通プロンプトは次の通りです。

```text
Implement src/greet.js so greet(name) returns exactly Hello, <name>! for the existing tests. Run node test.mjs and finish only after it passes.
```

このプロンプトには、`verification.txt` も `AGENT_RULE_APPLIED` も含めていません。一方、guidedケースの `CLAUDE.md` と `AGENTS.md` には、製品ごとにファイル名だけを変えて次の内容を置きました。

```md
# Completion requirements

- Modify only `src/greet.js`.
- Run `node test.mjs` and require it to pass.
- After the test passes, create `verification.txt` containing exactly `AGENT_RULE_APPLIED`.
```

通常の実装タスクは4ケースすべてで成功しています。つまり、`node test.mjs` の成功だけを見ても、プロジェクト指示が行動へ反映されたかは区別できません。

そこで、次の2つを分けて検証しました。

- 共通プロンプトの完了条件: `node test.mjs` が成功する
- 指示ファイル固有の完了条件: `verification.txt` が完全一致する

さらにbaselineを対にしたことで、モデルが偶然マーカーを作った可能性と、指示ファイルを追加したケースの差を分けています。

## 検証ハーネスは5つの部品で作れる

今回の方法を一般化すると、必要なのは次の5つです。

1. **同じタスク**: baselineとguidedへ同じプロンプトとCLI設定を渡す
2. **指示固有の完了条件**: 共通プロンプトにない観測可能な作業を、指示ファイルだけへ書く
3. **通常の検証**: テストやビルドで本来のタスクが完了したことを確認する
4. **変更範囲の検証**: 保護対象と変更可能なパスを先に決め、実行後の差分を確認する
5. **matched baseline**: guidedから指示ファイルだけを外したケースと比べる

今回の `verification.txt` は、指示ファイルの影響を切り分けるための実験用マーカーです。実務では、プロジェクトごとの客観的な完了条件へ置き換えます。

| 実験で使ったもの | 実務での置き換え例 |
|---|---|
| `verification.txt` | 生成物、migration、ドキュメント更新、lint結果 |
| `node test.mjs` | テスト、ビルド、型チェック |
| `test.mjs`, `package.json` の保護 | テスト、ポリシー、lockfileなど変更禁止ファイル |
| `src/greet.js` だけ変更可 | タスクごとに許可したwrite scope |
| 指示なしbaseline | 同じタスクから指示ファイルだけを外した実行 |

例えば「実装後に型生成を行う」というルールを `CLAUDE.md` に書くなら、エージェントの最終メッセージではなく、生成物の差分と型チェックの成功を完了条件にできます。

## 指示ファイルは強制機構ではない

Anthropicは、プロジェクトの `CLAUDE.md` と起動時の読み込みを公式ドキュメントで説明しています。`claude -p` は非対話実行用で、`--bare` と `--safe-mode` は `CLAUDE.md` を無効にするため今回の対象外です。[How Claude remembers your project](https://code.claude.com/docs/en/memory)・[Run Claude Code programmatically](https://code.claude.com/docs/en/headless)・[Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)

OpenAIも、Codexが実行ごとにプロジェクトルートから `AGENTS.md` などの指示チェーンを組み立てることと、`codex exec` が非対話実行用であることを説明しています。[Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)・[Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

ただし、今回直接観測したのは内部コンテキストではなく、ファイル生成という行動です。別の実行でマーカーが作られなかったとしても、それだけで「ファイルが探索されなかった」とは断定できません。指示が読み込まれても、モデルが従わない可能性があるためです。

したがって、指示ファイルは次の用途へ分けて考える必要があります。

- `CLAUDE.md` / `AGENTS.md`: エージェントへプロジェクト固有の手順を伝える
- テスト、差分検査、sandbox: 実行結果と変更範囲を強制・判定する

セキュリティ境界や合否判定を、指示ファイルだけに任せることはできません。

## 再現条件と安全上の注意

記録したハーネスは、フィクスチャをケースごとの一時ディレクトリへコピーし、guidedケースだけルートへ指示ファイルを追加します。リポジトリ内の実行入口は次の通りです。

```bash
node scripts/agent-practice/run-experiment.mjs \
  practice/agent/agent-practice-project-instruction-loading-20260811-1133.json
```

記録した条件は次の通りです。

- 検証日: 2026年8月11日
- Claude Code: `2.1.227 (Claude Code)`
- Codex CLI: `codex-cli 0.147.0`
- Node.js: `v22.17.0`（manifestでは固定していない）
- モデルと推論量: 両CLIとも明示指定なし
- 実行回数: baseline／guidedを各1回、合計4回
- タイムアウト: 1ケース300秒
- Codex: `workspace-write` sandboxでタスク用ネットワークを無効化
- Claude: `claude -p` と `bypassPermissions` をホスト上で使用し、OSレベルのファイルシステム隔離とネットワーク隔離は強制していない

最後のClaude条件は、再利用を勧める安全なテンプレートではありません。`bypassPermissions` は権限確認と安全チェックを無効にします。再実行するなら、インターネットへ接続できないコンテナ、VM、dev containerなどでOSレベルに隔離するか、`bypassPermissions` を外して必要な操作だけを許可します。[Choose a permission mode](https://code.claude.com/docs/en/permission-modes)

一時フィクスチャと実行後の差分検査は、ホスト上の他のファイルやネットワークへの副作用を防ぐセキュリティ境界ではありません。

## この結果を使える範囲

今回の結果は、記録したバージョンと設定における単発の成功例です。

- 1ケース1回なので、指示追従率やばらつきは分からない
- CLIデフォルトを使ったため、正確なバックエンドモデルは記録できていない
- ルート直下だけを確認し、ネストした優先順位、override、fallback、切り詰めは未検証
- 対話モード、Claudeの `--bare` / `--safe-mode` は未検証
- 内部コンテキストそのものは観測していない
- 所要時間、コスト、実装品質、製品間の優劣を比較する設計ではない

この範囲を超えて「毎回従う」「一方の製品が優れている」と結論づけることはできません。

## 判断基準

プロジェクト固有の手順を非対話エージェントへ渡すなら、`CLAUDE.md` や `AGENTS.md` を置くだけで完了にしないことが重要です。

同じタスクのbaselineを用意し、指示ファイルにだけ観測可能な完了条件を書き、通常のテストと変更範囲も一緒に検証します。実務では、そのマーカーを生成物、lint、型チェック、migrationなどへ置き換えます。

採用判断は、次の一文にまとめられます。

> 指示ファイルはプロジェクトの手順を伝えるために使い、実行の合否は決定的な検証とwrite boundaryで判断する。

## 参考文献

- [Anthropic: How Claude remembers your project](https://code.claude.com/docs/en/memory)（2026-08-11参照）
- [Anthropic: Run Claude Code programmatically](https://code.claude.com/docs/en/headless)（2026-08-11参照）
- [Anthropic: Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)（2026-08-11参照）
- [Anthropic: Choose a permission mode](https://code.claude.com/docs/en/permission-modes)（2026-08-11参照）
- [OpenAI: Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)（2026-08-11参照）
- [OpenAI: Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)（2026-08-11参照）
