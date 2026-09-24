---
title: "Claude Codeのフックを4つ重ねても動く設定、ただし発火順序には頼れない"
emoji: "🪝"
type: "tech"
topics: ["claudecode", "hooks", "automation", "cli", "aiagent"]
published: true
---

## 結論から: 重ねてよい、ただし2つの前提は捨てる

危険コマンドのブロック・監査ログ・編集後の自動整形。Claude Code のフックを1つずつ場当たり的に足してきて、「これらを1つの `.claude/settings.json` にまとめても互いを壊さないか」を確認していない人向けの結果です。ここで検証したのは、同一イベントに複数のフックエントリを重ねたときの発火順序とブロック伝播、および `SessionStart` の `startup`/`resume` マッチャーの出し分けの2点です(完了通知フックや、セッション開始時にコンテキストを注入する用途は今回の検証対象に含まれません)。

Claude Code `2.1.270` で、同じ `PreToolUse` / `matcher: "Bash"` に4つの独立したエントリ(`guard` → ブロック判定、`audit`・`dupA`・`dupB` → ログのみ)を並べて実行した結果:

- **まとめて1つの `settings.json` に書く構成自体は動く。** ブロックしたコールでも、他の3エントリはちゃんと実行されていた(あとで生ログで確認)。
- **ただし「配列に書いた順で発火する」という前提は成り立たなかった。** 2回とも宣言順どおりには発火せず、しかも2回のコール間でエントリ同士の相対順序も入れ替わった。
- **「ブロックされた側のフックは動いたか」を確認する方法にも罠がある。** 位置ベースの検証(ブロックしたエントリの後に来ているかどうかで判定)は、たまたま `guard` が最後に発火したせいで「スキップされた」と誤読した。実際は生ログにきちんと2回ずつ `fired` が記録されていた。

したがって、同一イベントに複数エントリを重ねる設定を書くなら、「順序に依存しない」「自分のエントリが動いたかは自分自身の副作用(ログ・カウンタ)で確認する」の2点を前提にする必要があります。相対順序を保証したい処理は、複数エントリに分けず1本のスクリプトに内部で順序づけて書いてください。

## 検証した設定 (settings.json + フックスクリプト全文)

検証に使ったのはこの `.claude/settings.json` です。

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node hooks/guard.mjs" } ] },
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node hooks/audit.mjs" } ] },
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node hooks/dupA.mjs" } ] },
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node hooks/dupB.mjs" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "node hooks/format-append.mjs" } ] }
    ],
    "SessionStart": [
      { "matcher": "startup", "hooks": [ { "type": "command", "command": "node hooks/session-startup.mjs" } ] },
      { "matcher": "resume", "hooks": [ { "type": "command", "command": "node hooks/session-resume.mjs" } ] }
    ]
  }
}
```

対応するスクリプトは次の7本です(いずれも自前のログファイルに追記するだけで、hookのstdin/JSONスキーマを一切解釈しない、依存ゼロの最小構成)。

`hooks/guard.mjs`(危険コマンドブロック役。ここでは呼び出し回数が2回目になったら常にブロックする単純な実装):

```js
#!/usr/bin/env node
import fs from "node:fs";

const counterFile = "call-count.txt";
const previous = fs.existsSync(counterFile) ? (parseInt(fs.readFileSync(counterFile, "utf8"), 10) || 0) : 0;
const current = previous + 1;
fs.writeFileSync(counterFile, String(current));
fs.appendFileSync("order.log", `${Date.now()} guard call=${current}\n`);

if (current >= 2) {
  process.stderr.write(`guard: blocking bash call #${current}\n`);
  process.exit(2);
}
process.exit(0);
```

`hooks/audit.mjs`(監査ログ役。ブロックせず観測するだけ。`dupA.mjs` / `dupB.mjs` も同一ロジックで出力先ファイル名だけが違う):

```js
#!/usr/bin/env node
import fs from "node:fs";

fs.appendFileSync("order.log", `${Date.now()} audit\n`);
fs.appendFileSync("audit.log", "fired\n");
process.exit(0);
```

`hooks/format-append.mjs`(`PostToolUse` の自動整形役。`Write`/`Edit` 対象の固定ファイルに追記する):

```js
#!/usr/bin/env node
import fs from "node:fs";

const target = "notes.txt";
if (fs.existsSync(target)) {
  fs.appendFileSync(target, "\n// formatted-by-hook\n");
  fs.appendFileSync("format.log", "fired\n");
}
process.exit(0);
```

`hooks/session-startup.mjs` / `hooks/session-resume.mjs`(`SessionStart` の `startup` / `resume` 出し分け役。両方とも自分のマッチャー名を `session.log` に追記するだけ):

```js
#!/usr/bin/env node
import fs from "node:fs";

fs.appendFileSync("session.log", "startup\n"); // resume版は "resume\n"
process.exit(0);
```

この構成はこのまま、自分のホスト・バージョンで同じ検証を再現するために使えます。

## 何を、どう確認したか

エージェントに Bash を2回連続で呼ばせるタスクと、`notes.txt` を1回 `Write` させるタスクを与え、`--setting-sources project --permission-mode bypassPermissions` で実行。各フックは自分専用のログファイルに追記するだけなので、Claude Code のトランスクリプト(`stream-json`)を介さずに「誰が何回発火したか」「どの順で発火したか」を生ファイルから直接確認できます。

実測は次の1本の `order.log`(タイムスタンプ + イベント名)にすべて残ります。

```
1790111018045 audit
1790111018045 dupA
1790111018046 guard call=1
1790111018046 dupB
1790111025913 audit
1790111025915 dupB
1790111025915 dupA
1790111025937 guard call=2
```

1回目の Bash コール(ブロックなし)は `audit, dupA, guard, dupB` の順、2回目(`guard` がブロック)は `audit, dupB, dupA, guard` の順で発火しています。設定ファイルに書いた宣言順は `guard, audit, dupA, dupB` でしたが、どちらの回もこの順にはなっていません。しかも `dupA` と `dupB` の相対順序自体が1回目と2回目で入れ替わっており、「常に逆順」のような固定ルールでも説明がつきません。各エントリの発火完了はどのバッチも1〜24ミリ秒程度の間隔に収まっており、宣言順を保証しない並行的な起動に見えます(この1サンプルだけでは、真の並行実行なのか別の非宣言順ルールなのかまでは切り分けられません)。

## 検証項目ごとの結果

事前に立てた5つの確認項目それぞれの結果です。

| 検証項目 | 結果 |
|---|---|
| ブロック用エントリと監査ログ用エントリを同一 `PreToolUse` に重ねたときのブロック伝播 | `guard` がブロックしたコールでも `audit.log` / `dupA.log` / `dupB.log` は各2行 `fired` を記録しており、非ブロック側エントリは実行されていた。ただし後述の検証器の誤読に注意。 |
| 記述順と実際の発火順の一致 | 一致せず。2回のコールとも宣言順(`guard, audit, dupA, dupB`)どおりに発火しなかった。 |
| `PostToolUse`(`Edit\|Write`)による自動整形の起動と反映 | 動作した。`Write` 後に1回だけ発火し、`notes.txt` に `// formatted-by-hook` が追記された。 |
| `SessionStart` の `startup`/`resume` 出し分け | `startup` のみ発火、`resume` は非発火。ただしこの実行は通常起動(`--resume` なし)のみで、実際の resume 起動での正発火は未検証(否定方向のみ確認)。 |
| 同一 matcher を持つ独立2エントリ(`dupA`/`dupB`)の多重発火 | 両エントリともブロックの有無に関わらず2回ずつ発火。ただし2エントリ間の相対順序はコールごとに入れ替わった。 |

## 「スキップされた」という表示を鵜呑みにしてはいけない理由

今回使った検証スクリプトは、`order.log` を2回の `guard` 発火の間で機械的に区切り、「2回目の `guard` より後にどのエントリが出現したか」でブロック後の発火有無を判定していました。しかし2回目のコールでは `guard` がバッチの中で最後に発火したため、この区切り方だと「`guard` の後」には何も残らず、判定結果は次のようになりました。

```
BLOCK=audit_dupA_dupB_skipped_after_block;ORDER=diverges_from_declared_order;RESUME=resume_did_not_fire
```

文字どおり読むと「ブロック後、他の3エントリはスキップされた」という意味に見えます。しかし `audit.log` / `dupA.log` / `dupB.log` を直接開くと、それぞれ2行ずつ `fired` が記録されており、2回目のコールでも確かに実行されていたことが分かります。つまり `skipped_after_block` は「実行されなかった」ではなく、「たまたま `guard` より前の位置に記録された」ことを意味していただけでした。

これは、発火有無を「ブロック役との相対位置」で判定する検証方法そのものが持つ弱点です。宣言順が保証されない以上、ブロック役がバッチの最後に来ることもあり、その場合「位置ベースの判定」は簡単に false negative を出します。自分のフックが動いたかどうかを知りたいときは、他のエントリとの相対位置ではなく、そのエントリ自身が残す副作用(ログ行、カウンタファイルなど)を直接確認してください。

## 決定ルール

- 同一イベント・同一 `matcher` に複数の `PreToolUse` エントリを並べて設定ファイルに書くこと自体は問題ない(ブロック用・監査用・重複ロガーが共存し、どれも動作した)。
- ただし配列に書いた順序を、実行順序の保証だと思って設計しないこと。相対順序を固定したい処理があるなら、複数エントリに分割せず1本のスクリプトの内部で順序づけて実装する。
- 「あるフックが、ブロックされたコールでも動いたか」を知りたいときは、ログの相対位置ではなく、そのフック自身が書き込む副作用(専用ログファイル、カウンタ)を確認する。
- `PostToolUse`(`Edit|Write`)の自動整形フック、`SessionStart` の `startup` マッチャーは、この検証の範囲では素直に動作しており、単体機能としての信頼度は高い。

## 前提条件と再現方法

- 検証日: 2026-09-22(UTC)、対象バージョンは Claude Code `2.1.270`。他バージョンでの再現性は未確認。
- 実行方法: `claude -p "<タスク指示>" --output-format stream-json --verbose --no-session-persistence --setting-sources project --permission-mode bypassPermissions --tools Read,Edit,Write,Bash` で直接起動。とくに `--tools Read,Edit,Write,Bash` はエージェントが呼べるツールをこの4種に絞る指定であり、記事内で示した「Bashを2回・Writeを1回」という呼び出し列を再現する上で必要。1サンプル(1ケース1回実行)の観測であり、順序・並行性についての結論は反復検証で裏取りされていない。
- `resume` マッチャーは、通常起動で発火しないことのみを確認した。実際の `--resume` 起動でこのエントリが正しく発火するかどうかはこの検証では確認していない。
- `PreToolUse` 個々のエントリの起動・応答は、Claude Code の `stream-json` トランスクリプトには個別イベントとして現れない。今回の順序・発火有無の根拠はすべてフック自身が書き込んだ `order.log` などのファイル側の記録であり、CLI 側で計測したタイミングではない。
- マニフェストの `network: false` はランナー側のサンドボックス設定であり、Claude Code のホストプロセス自体をネットワーク隔離するものではない。今回の検証結果には直接関係しないが、設定の意味を誤解しないための注記として記載する。
- 検証後、フックスクリプトや `.claude/settings.json` 自体が書き換えられた形跡はなく(`protected_paths_changed: []`)、変更はフィクスチャが許可した出力ファイルのみだった。
