# Haiku 5.5 / Sonnet 5.5 TypeScript追試キット

3課題の仕様・初期状態・既知正解・採点器・実行器・CSV集計を同梱しています。Claude Code 2.1.295、Node 22、TypeScript 5.9.2が既にPATH上にあり、Claudeへsubscription方式でログイン済みであることが前提です。依存installや認証情報のコピーは行いません。

モデルへ渡すツールはRead/Edit/Writeのみ。モデル自身は公開テストを実行せず、終了後にhostが型/runtime/mutation/構造を採点します。通常のBash付きClaude Codeの総合的な性能は測定しません。mediumは要求値であり実効値が出ない場合は欠測。新規セッションでもcold cacheとは限りません。

## offline検査

```bash
node scripts/articles/claude-haiku55-typescript-task-kit/parser-check.mjs
node scripts/articles/claude-haiku55-typescript-task-kit/run-all.mjs --output results/haiku55-offline-new --preflight-only
```

## 3課題18試行を実行・再採点・集計

```bash
node scripts/articles/claude-haiku55-typescript-task-kit/run-all.mjs --output results/haiku55-new-run
```

出力先が存在すると拒否します。run-allは順番にbug-fix、add-tests、refactorを実行します。各課題はH/S,S/H,H/Sで各model3回。1試行は240秒・16turn、最大18試行72分。採点で正答/誤答の両方を記録します。CLI、認証、計測、保護境界にinvalidが出ると停止し、再試行や課金方式の切替はしません。

結果は課題別case-result.json（候補コード、hash、token内訳と採点）、trials.csv、comparison.md、checklist.md、およびkit-summary/の18行CSV・比較表・checklistです。rawモデル応答、資格情報、環境変数、IDは保存しません。ネットワークやhost全体をOS隔離するツールではありません。自分が信頼するローカルのfixtureとして読み、管理された環境で実行してください。

同梱answersは校正用で、モデルworkspaceへコピーしません。自分の業務仕様で使うときは公開SPEC・初期状態・独立oracle/mutationを合わせて変更し、別実験として比較してください。CLIのVERSION固定を変更する場合も条件変更を記録してください。
