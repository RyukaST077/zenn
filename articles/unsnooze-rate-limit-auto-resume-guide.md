---
title: "unsnoozeでClaude Code・Codexをレートリミット解除後に自動再開する"
emoji: "⏰"
type: "tech"
topics: ["claudecode", "codex", "cli", "aiagent"]
published: false
---

Claude CodeやCodex CLIに長い作業を任せていると、利用上限で停止し、解除された後も「続きを進めて」と入力するまで作業が止まることがあります。

**unsnoozeを導入すると、利用上限による停止を追跡し、解除時刻を待って同じセッションへ再開メッセージを送れます。** この記事では、導入から通常の起動、状態確認、自動再開の停止までを扱います。利用上限そのものが増えるわけではありません。[公式README](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/README.md)

:::message
対象は2026年9月24日に確認した **unsnooze v1.19.1** です。導入手順は公式資料に基づき、挙動は固定版のローカルテストで検証しました。実アカウントをレートリミットに到達させ、解除後のAPI成功まで確かめた記事ではありません。
:::

## まず導入して、いつものCLIを起動する

前提は、Claude CodeまたはCodex CLIをすでにインストールし、認証して普段の作業を実行できることです。unsnoozeは、そのCLIの停止を見守る追加ツールです。再開後の利用料金・利用上限は、使用するエージェント側の契約に従います。

Node.jsは **20.12以上** が必要です。以下はmacOS/Linuxのシェルで実行する導入コマンドです。検証対象に合わせて版を固定しています。[package.json](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/package.json)

```bash
node --version
npm install -g unsnooze@1.19.1
unsnooze setup
```

`setup` では監視するエージェントを選び、自動再開を有効にします。設定によって、シェルの起動ファイルにラッパーが入り、Claude用の停止通知hookや `~/.unsnooze/config.json` が設定されます。ラッパーは、普段の `claude` / `codex` コマンドを監視付きで起動するための仕組みです。変更対象ファイルはバックアップされます。[固定版の導入ドキュメント](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/website/app/docs/page.jsx)

**設定後は新しいシェルを開きます。** そのシェルでインストール状態と自動再開の設定を確認してください。

```bash
unsnooze doctor
unsnooze config get autoResume
```

`doctor` に問題が出た場合は、その指摘を解消します。`autoResume` が無効なら、次のコマンドで有効にできます。既定値は `true` です。[設定リファレンス](https://unsnooze.dev/docs/settings/)

```bash
unsnooze config set autoResume on
```

準備ができたら、作業したいプロジェクトのディレクトリで、使う方のCLIを通常どおり起動します。

```bash
claude
# Codexを使う場合は、代わりに次を実行
codex
```

新しく起動した監視対象セッションで作業を始めます。この記事の手順は、この起動経路を対象にしています。GUIアプリの監視には別途daemonが必要です。

tmuxなどの「複数の端末画面を管理するツール」があれば、その画面を監視できます。なくてもheadless方式で動きますが、その場合は同じ画面へ文字を入力するのではなく、再開プロセスを起動します。tmuxを使う場合、終了したセッションの復帰には3.2以上が必要です。[起動方式の違い](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/website/app/docs/page.jsx)

## 制限が来たら、状態と再開予定を確認する

基本の流れは次のとおりです。

```text
いつものCLIで作業
  → 利用上限による停止を検知
  → セッションと解除時刻を記録して待機
  → 再開できる状態か確認
  → 元のセッションへ再開メッセージを渡す
```

別のターミナルから、追跡中のセッションを確認できます。

```bash
unsnooze status
unsnooze preview
```

`status` では、対象エージェント、作業ディレクトリ、停止状態、解除予定時刻などを確認します。対話端末ではダッシュボード表示になる場合があります。`preview` は「今ならどこへ何を送るか」「何が理由で待機しているか」を表示する確認用コマンドで、入力の送信や画面の起動は行いません。[コマンドリファレンス](https://unsnooze.dev/docs/commands/)

模擬テストでは、解除時刻より前は `waiting`、解除後に自分のものと確認できる待機中の画面があれば `inject`、画面を使えない場合は `reopen` になる判断を確認しました。また、処理中の画面にはそのまま割り込まず、再開を延期するケースも通りました。

`preview` の終了コードには注意が必要です。**今すぐ再開可能な対象があると `2`、待機中なら `0`** になります。`2` を一般的なコマンド失敗として扱わないでください。この振る舞いと、previewが状態や画面を変更しないことは、固定版の [previewテスト](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/test/preview.test.js) でも確認しました。

### 「同じタスクを再開する」の意味

ここでの再開は、以前の会話を引き継いでメッセージを送る処理です。固定版のテストでは、Claudeの模擬セッションIDが再開引数に保持され、Codexのheadless再開では `codex exec … resume <セッションID> <メッセージ>` の形になることを確認しています。[Claudeの引数テスト](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/test/headless-resume.test.js)、[Codexを含む再開計画のテスト](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/test/preview.test.js)

再開後に作業をどう進めるかは、元の指示とエージェント側の状態に依存します。作業の完了やテスト成功まで保証する機能ではありません。

## 再開メッセージと、待機中の変更への対応を決める

再開時に送る内容は設定できます。以下は日本語メッセージの設定例です。記事用の設定例であり、この文面を実エージェントへ送った検証結果ではありません。

```bash
unsnooze config set resumeMessage "現在のリポジトリ状態を確認し、中断したタスクの続きを進めてください。"
```

待っている間に自分や別のエージェントがファイルを編集する運用なら、変更を検知した際に一度止める設定もあります。

```bash
unsnooze config set workspaceGuard pause
```

`workspaceGuard` の既定値 `inform` は、変更の情報を再開メッセージに付けて再開します。`pause` は保留するため、**リポジトリが変わった場合の再開には人の確認が必要になります**。無人での継続を優先するか、変更後に確認を挟むかで選びます。[設定とガード](https://unsnooze.dev/docs/settings/)

模擬リポジトリを変更するテストでは、`pause` が保留状態にし、再開入力を送らないことを確認しました。[ガードのテスト](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/test/resumer.test.js)

## 自動再開を止める・手動で再開する

運用時に使うコマンドをまとめます。`SESSION_ID` は `unsnooze status` に表示される対象IDへ置き換えてください。

| 目的 | コマンド | 効果 |
|---|---|---|
| 自動再開を一時停止する | `unsnooze config set autoResume off` | 停止の追跡は続け、自動での再開を抑止する |
| 自動再開を再び有効にする | `unsnooze config set autoResume on` | 自動再開を許可する |
| 対象の追跡を取り消す | `unsnooze cancel SESSION_ID` | その対象を再開待ちから外す |
| 全対象の追跡を取り消す | `unsnooze cancel --all` | 追跡中のセッションをまとめて取り消す |
| 確認後に手動再開する | `unsnooze resume-now SESSION_ID` | 解除予定時刻を待たず、明示的に再開を指示する |

`cancel` は追跡の取り消しです。すでに作業を再開したエージェントのプロセスを終了するコマンドではありません。また、`resume-now` は `autoResume off` のときも手動操作として進められます。利用上限が解除されていなければ、再び停止する可能性があります。[コマンド](https://unsnooze.dev/docs/commands/)、[手動再開のテスト](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/test/toggles.test.js)

別機能のprompt queueを使っている場合、その配送は `autoResume off` では止まりません。この記事の手順ではqueueへの登録は行っていません。[queueの仕様](https://unsnooze.dev/docs/commands/)

## 再開されないときの確認表

まず `unsnooze status` と `unsnooze preview` で、追跡されているか、待っている理由が何かを見ます。

| 見えている状態・状況 | 確認すること | 次の操作 |
|---|---|---|
| 対象が追跡されていない | setup後の新しいシェルから起動したか | `unsnooze doctor` で設定を確認 |
| 解除予定がまだ先 | 表示された解除時刻と待機理由 | 解除を待つ |
| 自動再開が無効 | `unsnooze config get autoResume` | 自動化するなら `on` に戻す |
| リポジトリ変更で保留 | `workspaceGuard pause` と待機中の変更 | 差分を確認し、問題なければ対象だけ `resume-now` |
| 画面が処理中 | 元エージェントがまだ動いていないか | 処理完了後に再確認 |
| 復帰に失敗している | `status` のエラーと `unsnooze logs` | CLIの認証・実行環境など、表示された原因を確認 |

認証や権限確認が必要な場合は、エージェント側で対応します。unsnoozeは権限モデルを変更するものではなく、承認操作を自動的に通すためのツールでもありません。[固定版の権限・動作説明](https://github.com/saaranshM/unsnooze/blob/af23435994bdd020d19b2fd3a202a3f1f76c70c5/README.md#trust--security)

## ローカル検証で確認できた範囲

macOS、Node.js v22.17.1、npm 10.9.2で、unsnooze v1.19.1のcommit `af23435994bdd020d19b2fd3a202a3f1f76c70c5` を固定して検証しました。依存関係はlockfileに従って導入し、通知と更新確認を抑止して、模擬セッションや偽の端末操作を使っています。

| 検証項目 | 結果 | 確認した内容 |
|---|---:|---|
| 導入処理・CLI | 22 / 22 pass | 隔離した設定ファイルへのwrapper/hook処理など |
| 設定の既定値 | 20 / 20 pass | 自動再開などの設定値 |
| 停止検知・待機 | 63 / 63 pass | 合成した停止情報、時刻解析、解除前の待機 |
| preview・再開方式 | 48 / 48 pass | 非送信、セッションIDを渡す再開引数 |
| 停止設定・ガード | 101 / 101 pass | 自動再開off、手動override、変更時の保留など |

**合計254件はsuiteの重複実行を含む延べ件数**です。254回の実サービス復帰を測定したものではありません。テスト時には `UNSNOOZE_NOTIFICATIONS=off` が「通知の既定値はtrue」という期待と衝突したため、設定の既定値テストだけ環境変数の上書きを外して分離しました。

今回確認したのは、固定版が模擬入力に対して正しい待機・再開判断をする範囲です。グローバルインストールと対話setupの実機操作、実アカウントの上限解除後の成功、PCスリープからの復帰、GUIアプリは検証していません。導入後は自分の環境で `doctor`・`status`・`preview` を確認し、最初の再開結果を見て運用範囲を決めてください。
