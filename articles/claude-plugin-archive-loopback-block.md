---
title: "archiveソースのプラグインが127.0.0.1で弾かれる時、CLIは何と言うか"
emoji: "🔌"
type: tech
topics: ["claudecode", "cli", "security", "plugin", "troubleshooting"]
published: false
---

## 結論から: `source: Invalid input` はドキュメントの loopback ブロックの証拠にならない

社内用の Claude Code プラグインを `"source": "archive"` 形式のマーケットプレイスエントリで配布しようとして、まずは手元の `127.0.0.1` でホスティングして動作確認したい――そう考えた開発者・プラットフォームエンジニア向けの検証結果です。

公式ドキュメント（[Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)、2026-08-22 参照）は `archive` ソースの `url` について一文でこう書いています。

> Claude Code rejects `http://` URLs, along with loopback, link-local, and cloud-metadata hosts. Every redirect hop must satisfy the same rules, or Claude Code refuses the download.

しかし実際のエラーメッセージの例は載っていません。Claude Code 2.1.238 で `url` を `https://127.0.0.1:65535/...` に向けた `archive` エントリを試すと、`claude plugin install` は次のように失敗します。

```text
✘ Failed to install plugin "loopback-boundary-plugin@loopback-boundary-marketplace":
This plugin's marketplace entry is invalid: source: Invalid input
```

**この `source: Invalid input` というテキストには "loopback" も "link-local" も "cloud-metadata" も含まれていません。** ドキュメントが説明するホストクラス由来の拒否だと確認できる文言は一つもなく、これは `source` フィールドに対する汎用的なスキーマ検証エラーです。したがって、このメッセージを見ただけでは「ドキュメント通りの loopback ブロックが発火した」と断定できません。この記事はその一点を、実際に採取したログをもとに示します。

## 何を、どう試したか

検証対象は Claude Code 2.1.238 の `claude plugin marketplace add` → `claude plugin install` の2段階コマンドです。

1. `"source": "archive"`、`url: "https://127.0.0.1:65535/loopback-boundary-plugin.zip"` を含む `marketplace.json` を用意する。
2. `claude plugin marketplace add <dir>` でマーケットプレイスを登録する。
3. `claude plugin install loopback-boundary-plugin@loopback-boundary-marketplace` でインストールを試みる。

実行はモデルセッションを一切介さず、CLIのサブコマンドを直接叩くラッパー経由（`live_model_calls: 0`）で行いました。つまりこれは Claude（モデル）の挙動ではなく、Claude Code のCLI/プラグインサブシステムの挙動に関する検証です。認証情報はCLIのステータスコマンドで確認しただけで、資格情報ファイルは読んでいません。

## 観測結果

| コマンド | 終了コード | 出力の要旨 |
|---|---:|---|
| `claude plugin marketplace add <dir>` | `0` | `✔ Successfully added marketplace: loopback-boundary-marketplace (declared in user settings)` |
| `claude plugin install loopback-boundary-plugin@loopback-boundary-marketplace` | `1` | `This plugin's marketplace entry is invalid: source: Invalid input` |

つまり、`"source": "archive"` エントリの**パース自体は `marketplace add` の時点で成功**しており、`url` が `127.0.0.1` を指していても拒否は起きません。拒否が起きるのは後段の `plugin install` で、しかもそのエラーテキストはホストクラスに一切言及しない、フィールドレベルのスキーマ検証メッセージです。

## この結果は何を確認し、何を確認していないか

確認できたこと:

- Claude Code 2.1.238 で `archive` ソース × loopback `url` を試すと、`plugin install` は失敗する（インストールは通らない）。
- そのとき表示される実際のテキストは `source: Invalid input` であり、ドキュメントが挙げる「loopback / link-local / cloud-metadata」という語は一切現れない。

確認できていないこと（この検証の限界）:

- **非loopbackの対照実験を行っていない。** 同じ `marketplace.json` の `url` だけを実在の非loopbackホストに差し替えて再実行していないため、`source: Invalid input` が「loopbackホストだから」出ているのか、それとも「`archive` エントリ自体がこのビルドのスキーマ上そもそも不完全/未対応だから」出ているのか、この証拠だけでは区別できません。
- サンプルは1回のみで、再現性（フレーク耐性）は未検証です。
- ドキュメントが主張するホストクラス拒否ロジックそのものが機能していないと主張するものではありません。それを否定する対照実験もしていないためです。

**実務上の判断ルール:** `archive` ソースのエントリで `claude plugin install` が `source: Invalid input` を返した場合、それを「ドキュメントのホストクラス拒否ルールが確認された」証拠として扱わないでください。まず実在の非loopback HTTPSホストで同じ `marketplace.json` を再実行し、同じメッセージが出るか確認するのが次の一手です。同じメッセージが出続けるなら、疑うべきは `url` のホストではなく `marketplace.json` エントリの他フィールド（必須項目の不足など）です。メッセージが消えるなら、（証明にはなりませんが）ホストクラスルールとは矛盾しません。

## 副次的な発見: 自動判定の誤検知

この検証は元々、CLIの出力にホストクラス由来の語（`loopback`、`link-local`、`cloud-metadata`、`disallowed host` など）が含まれるかを正規表現で機械的に判定する仕組みで実施されました。今回の実行では、その自動判定は「合格（ドキュメント通りの拒否を確認）」と記録しました。

しかし上で示した通り、実際のCLI出力にそうした語は含まれていません。原因を追うと、判定の正規表現がテストフィクスチャ自身が付けた名前——プラグイン名 `loopback-boundary-plugin` とマーケットプレイス名 `loopback-boundary-marketplace`——にマッチしていました。`marketplace add` の成功メッセージにも `plugin install` の失敗メッセージにも、これらの名前がそのままエコーされて出力に含まれるため、CLIが出した語ではなくテスト側が選んだ命名文字列にヒットして「合格」と誤判定されたことになります。

もう一点、記録データ内部にも矛盾がありました。この自動判定は拒否が起きた段階を `"marketplace_add"` と記録していましたが、実際に失敗（終了コード`1`）したのは `plugin_install` の方で、`marketplace_add` は成功（終了コード`0`）していました。判定ロジックは「どちらかの段階が失敗したか」だけを見ており、「記録された段階が実際に失敗した段階と一致するか」までは検証していなかったため、この矛盾も素通りしました。

**この教訓の射程は狭いことに注意してください。** これは「Claude Codeのエラーメッセージの質が低い」という一般論でも、「境界値テストの方法論一般」についての主張でもありません。あくまで、このフィクスチャの命名選択に起因する、この1回の自動判定固有の欠陥です。ただし、自分で同種の合否判定スクリプトを書く読者への実務的な教訓は明確です。

**判定スクリプトを書く際の教訓:** CLI出力の合否を正規表現で自動判定する場合、その正規表現は**CLI自身が実際に使う語彙**（ドキュメントに引用されている "loopback" "link-local" "cloud-metadata" のような語）にのみマッチさせてください。自分がテストのために選んだリソース名（プラグイン名やマーケットプレイス名）を判定基準に混ぜると、その名前がCLI出力にそのままエコーされるだけで誤って「合格」判定されるリスクがあります。

## まとめ

- **観測事実:** Claude Code 2.1.238で `"source": "archive"` かつ `url` が `127.0.0.1` の loopback を指すエントリは、`marketplace add` は通るが `plugin install` で失敗し、そのエラーテキストは `source: Invalid input` という汎用スキーマメッセージであって、ドキュメントが挙げるホストクラス語は含まない。
- **解釈上の注意:** このメッセージ単体では、ドキュメント記載のホストクラス拒否ルールが発火した証拠にはならない。非loopbackホストとの対照実験なしに「loopbackだから弾かれた」と断定しないこと。
- **副次的教訓:** CLI出力を正規表現で自動判定する仕組みは、CLI自身の語彙にのみマッチさせる。テストフィクスチャ自身の命名にマッチしてしまうと、内容を伴わない誤った合格判定を生む。

## 検証環境・再現条件

- Claude Code: `2.1.238`
- 検証日: 2026-08-22
- 実行方式: `claude plugin marketplace add` → `claude plugin install` をCLIラッパー経由で直接実行（モデルセッションは介さず、`live_model_calls: 0`）
- `marketplace.json` の該当エントリ: `"source": "archive"`、`url: "https://127.0.0.1:65535/loopback-boundary-plugin.zip"`
- サンプル数: 1回、対照実験（非loopbackホスト）なし
