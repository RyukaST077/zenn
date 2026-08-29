---
title: "Claude Code 2.1.251前でもsymlink探索起点へのRead denyは効くか実測した"
emoji: "🔗"
type: tech
topics: ["claudecode", "ai", "cli", "security"]
published: false
---

## 結論から: 探索起点そのものがsymlinkでも、`permissions.deny`はブロックしていた

Claude Codeの changelog `2.1.251`（2026-08-28）にはこう書かれています。

> Fixed Grep and Glob not applying `Read(...)` deny rules to files reached through a symlinked search path

これだけを読むと、「`permissions.deny: ["Read(~/.ssh/**)"]` のようなルールを設定していても、`~/.ssh` に解決されるsymlinkをGrep/Globの探索対象に渡せば素通りしていたのでは」と不安になります。特にモノレポのワークスペースリンクや共有設定用のsymlinkは珍しくない構成なので、「自分の環境は`2.1.251`より前から漏れていたのか」を確認したくなるはずです。

ただし changelog にはどのsymlink配置が脆弱だったかの記載がなく、permissionsドキュメント側もsymlink解決の一般原則（symlink自体か解決先のどちらかがマッチすればdenyが効く、`~/.ssh`の例で説明）を述べるのみで、「Grep/Globの探索起点引数そのものがsymlink」というケースを名指ししていません。そこで、ローカルにインストールされていた修正前バージョン `2.1.248` 上で、この最も一般的な形（探索起点引数自体がsymlink）を実際に動かして確認しました。

> `permissions.deny: ["Read(./secret-dir/**)"]` を設定した状態で、`workspace/link-to-secret -> ../secret-dir` というsymlinkをGrep/Globの探索起点（`path`引数）に直接渡した場合、`2.1.248`は両ツールともブロックしていた。denyルールなしの対照ケースでは同じsymlink経由で普通にマーカーファイルが見つかることも確認済み。

以降、検証構成、実際のイベントストリーム、そしてこの結論が及ばない範囲（＝changelogの修正が実際にはどこを塞いだのか）を順に示します。

## 疑っていた失敗モード

symlinkを渡されたGrep/Globが、denyルールの評価前にOSレベルでsymlinkを解決してしまい、解決後のパスに対するパーミッションチェックを素通りする——という経路がありえます。これがchangelogの文言から連想される「探索起点がsymlinkなら常に危険」という解釈です。今回の検証はこの解釈が、少なくとも「symlinkが探索起点引数そのもの」という最も単純で一番遭遇しやすい形について成立するかどうかを問うものでした。

## 検証構成: control/treatmentでdenyルールの有無だけを変えた

固定した条件（プロンプト、モデル、ターン上限、ツール構成、symlinkのレイアウト）は2ケースで同一にし、変えたのは `permissions.deny` だけです。

| ケース | `permissions.deny` | 期待される結果 |
|---|---|---|
| `no-deny-control` | `[]` | Grep/Globが`workspace/link-to-secret`経由でマーカーファイルを見つける |
| `deny-symlink-treatment` | `["Read(./secret-dir/**)"]` | Grep/Globとも`permission_denied`で拒否される |

`secret-dir`を探索起点の外側に作り、`workspace/link-to-secret -> ../secret-dir`というsymlinkを用意した上で、両ケースとも次の形の非対話呼び出しを行いました。

```sh
claude -p "<prompt>" \
  --tools Grep,Glob \
  --settings '{"permissions":{"deny":["Read(./secret-dir/**)"]}}' \
  --setting-sources "" \
  --permission-mode bypassPermissions \
  --output-format stream-json --verbose \
  --max-turns 3
```

（control側はdenyを空配列にしただけの同一コマンド。）判定はモデルの自然文回答ではなく、`stream-json`の生イベントに現れる`system`/`permission_denied`イベントとtool_resultの`is_error`フラグで行っています。CLIバージョンは `2.1.248 (Claude Code)`、検証日は本記事執筆時点（2026-08-29の実行ログに基づく）です。

## 挙動確認: 生イベントストリームで何が起きたか

**control（denyルールなし）**: Grepは `pattern: GREP_GLOB_SYMLINK_MARKER_4B7E1A`、`path: workspace/link-to-secret`、`output_mode: files_with_matches` で呼ばれ、`"Found 1 file\nworkspace/link-to-secret/marker.txt"` を返しました。Globも `pattern: **/*`、同じ`path`で呼ばれ、`workspace/link-to-secret/marker.txt`を返しています。どちらの呼び出し後にも`permission_denied`イベントは一切現れませんでした。モデルの最終回答も「Yes — found in `workspace/link-to-secret/marker.txt`」でした。

**treatment（`Read(./secret-dir/**)`のdenyルールあり）**: 同一のGrep呼び出し（同じpattern・同じpath・同じoutput_mode）は、直後に

```
{"type":"system","subtype":"permission_denied","tool_name":"Grep","message":"Permission to read workspace/link-to-secret has been denied."}
```

というシステムイベントと、`is_error: true`のtool_resultを伴って拒否されました。続くGlob呼び出し（同一pattern・同一path）も同様に`permission_denied`イベントと`is_error: true`で拒否されています。モデルの最終回答は「Both tool calls were denied permission ... No result to report.」でした。

controlとtreatmentで反転させた変数（denyルールの有無）どおりに、結果も反転しています。symlink探索起点に対するdenyチェックが素通りする、という懸念していた失敗モードは、少なくともこの構成では再現しませんでした。

## 自動検証がfailだった理由（tooling上のバグで、結果自体は揺らがない）

このフィクスチャの`metrics.json`は両ケースとも`passed: false`、`verifier_exit_code: 1`と記録しています。これは検証結果ではなく、フィクスチャの`verify.mjs`側のバグです。ライブのClaude Code CLIは`init.tools`をアルファベット順`["Glob","Grep"]`で返しますが、`verify.mjs`は`["Grep","Glob"]`という順序固定の配列比較をしているため、両ケースとも`init tool surface mismatch`で機械的に失敗します。deny判定そのものとは無関係な不具合です。

もう一点、controlケースの`case-result.json.observation`は`"unregistered"`（本来期待される`"control-marker-visible"`ではない）になっていますが、これもラッパー側の検出ロジックの限界です。ラッパーはtool_result本文にマーカー文字列そのものが含まれるかだけを見ますが、Grepを`files_with_matches`モードで呼んでいるため結果に含まれるのはファイルパスのみで、マーカー文字列自体は返りません（Globも同様にパス一覧のみ）。生のイベントストリームを見る限り、Grep/Globともsymlink経由でマーカーファイルを正しく発見しており、この項目はラッパーの検出ヒューリスティックの穴であって、探索そのものが失敗したわけではありません。

つまり、両ケースとも`passed: false`ですが、そこから「denyルールが機能しなかった」と読むのは誤りです。実際の判定材料は`case-result.json.observation`（treatmentは事前登録した2つの結果のうち`"deny-applied"`）と、上記の生イベントです。

## この結論が及ばない範囲(安全境界)

- **サンプル数はケースあたり1回**。統計的な確証を狙った設計ではありません。
- **テストした形は「symlinkが探索起点引数そのもの」のみ**。非symlinkのルート配下を辿っている途中でsymlinkに出会うケース、Globのパターンの一部にsymlinkセグメントが含まれるケース、パーミッションチェック後にsymlinkが差し替えられるTOCTOU的なケースは対象外です。これらはchangelogが挙げている他の修正内容と重なる可能性があり、`2.1.251`の修正が実際にどこを塞いだのかは今回の検証では特定できていません。
- **`2.1.248`固定、`bypassPermissions`固定、`--setting-sources ""`固定、このdenyルール文字列のみ**。他のパーミッションモード（`default`、`plan`など）、他のdenyルール構文、他バージョンでの挙動は未確認です。`2.1.251`自体を動かして比較してもいません。
- 自動verifierは両ケースとも失敗しており、この記事の結論は`metrics.json`の`passed`フラグではなく、生の`events.jsonl`と`case-result.json.observation`の目視突き合わせに基づいています。
- 使い捨てワークスペースでの実行後diff比較は観測上の境界であり、ホストのファイルシステムやネットワークに対するセキュリティ境界としてClaudeプロセスを隔離しているわけではありません。マニフェスト上の`network: false`もランナー側の設定で、Claudeホストプロセス自体をOSレベルで隔離するものではありません。

## 採用判断のルール

- すでに`permissions.deny`でsymlink先を含むディレクトリを保護しており、そのsymlinkを**そのままGrep/Globの探索起点引数として渡す**構成であれば、`2.1.248`時点でもdenyルールは機能していた。この最も一般的な構成について、changelogの文言を読んで慌てて設定を見直す必要はない。
- 一方で、「非symlinkのルートを再帰的に辿っている途中でsymlinkに遭遇する」「Globパターンの中間にsymlinkが挟まる」「パーミッションチェック後にsymlinkが差し替えられる」といった形は今回検証していない。これらの形でsymlinkを使った構成がある場合は、個別に同じ手法（`--output-format stream-json`でのイベント突き合わせ）で再検証したほうがよい。
- 再検証する場合は、モデルの自然文回答ではなく、ストリーム中の`system`/`permission_denied`イベントと`is_error: true`のtool_resultの有無で判定するのが確実。今回の二重ケース構成（denyなし/denyあり、変数はdenyルールのみ）自体がその最小の再現レシピになっている。
