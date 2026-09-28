---
title: "AGENTS.md移行チェックリスト:確認できた3項目、再現しなかった2項目、そして--setting-sourcesという伏兵"
emoji: "🗂️"
type: tech
topics: ["claudecode", "aiagent", "cli", "productivity"]
published: false
---

## 誰のための記事か

Claude Codeと、AGENTS.mdを読む他のツール(Codex・Cursor・Copilotなど)を同じリポジトリで併用しているチームが対象です。特に次のどちらかに当てはまる場合を想定しています。

- 2026-09-18リリース(v2.1.277)より前に、AGENTS.mdをClaude Codeにも読ませるための回避策(CLAUDE.mdからのimportやsymlink)を組んでいる
- リポジトリ共有の指示はAGENTS.mdに書きつつ、個人用に`CLAUDE.local.md`を使っている

知りたいのは「v2.1.277以降のネイティブfallbackへ移行して既存の回避策を外してよいか」「外す場合、Project instructions設定はどのファイル・どのスコープに書けば実際に効くのか」です。

この記事の結論を先に言うと、**AGENTS.md移行チェックリストの5項目のうち、実機検証(Claude Code 2.1.283)で確定的に再現できたのは3項目、再現しなかったのは2項目でした**。再現しなかった2項目には、`--setting-sources project`という、CI・バッチ実行で普段から使われがちなCLIフラグが交絡している可能性が浮上しています。

## 検証条件

- CLI: `claude 2.1.283 (Claude Code)`(文書化されたバージョンゲートはv2.1.277、Bedrock/テレメトリ無効セッション等での安定化はv2.1.281)
- 各ケースは使い捨てのfixtureディレクトリで1回ずつ実行(繰り返しなし)
- 起動コマンドは全ケース共通で以下の形(`command.json`記録どおり、フラグ単位で5ケースとも同一)。`--setting-sources project`だけでなく`--output-format stream-json --verbose --no-session-persistence`も含めて再現してください。これらの共通フラグは今回検証したい変数ではなく、実行基盤(ランナー)側が固定していたものです。

```
claude -p "<task>" \
  --output-format stream-json --verbose --no-session-persistence \
  --setting-sources project \
  --permission-mode bypassPermissions \
  --tools Read,Edit,Write,Bash
```
- 判定方法: 各fixtureにマーカー文字列入りのAGENTS.md/CLAUDE.md/CLAUDE.local.mdを配置し、セッションがどのマーカーを`result.txt`に書き出すかで「どのファイルの指示に従ったか」を観測

## 確認できた3項目

### 1. AGENTS.mdだけがある場合は直接読まれる

`AGENTS.md`のみを配置したfixtureで実行すると、`result.txt`に`AGENTS_MD_MARKER`が書かれ、verifierは exit 0。ネイティブfallbackが機能していることを直接確認できました(`agents-md-native-fallback/verify.log`)。

### 2. CLAUDE.mdが並存すると既定でAGENTS.mdは無視される

同じディレクトリに`AGENTS.md`と`CLAUDE.md`を両方置くと、観測されたのは`CLAUDE_MD_MARKER`。`CLAUDE.md`が既定で優先され、AGENTS.mdは沈黙して無視されます(`claudemd-suppresses-agentsmd/verify.log`、exit 0)。

### 3. プロジェクトスコープのsettings.jsonキーは無視される

`pluginConfigs["agents-md@builtin"].options.instructionFiles`をプロジェクトスコープの`.claude/settings.json`に書いても、観測は`CLAUDE_MD_MARKER`のまま変化しませんでした(`project-scope-setting-ignored/verify.log`、exit 0)。つまりこのキーをプロジェクトスコープに書く回避策は効果がないと確認できます。

```json
// .claude/settings.json (プロジェクトスコープ) — このキーは無視される
{
  "pluginConfigs": {
    "agents-md@builtin": {
      "options": { "instructionFiles": "agents-md" }
    }
  }
}
```

このほか、`AGENTS.local.md`・`AGENTS.override.md`・`.agents/notes.md`という「読まれないはずのファイル」も、5ケース全てのfixtureに配置しましたが、いずれの`result.txt`にもこれらのマーカーは一度も出ませんでした。デコイファイルが無視されるという前提は、5回とも崩れませんでした。

バージョンゲートについても、全5ケースの`verify.log`で`claude_version=2.1.283`が記録されており、文書化された2.1.277/2.1.281のどちらの基準も満たしています。

## 再現しなかった2項目 — ここは自分の環境で検証してから使う

### 4. CLAUDE.local.mdだけでの抑制トラップ

「`CLAUDE.md`が無く`CLAUDE.local.md`だけがある場合も、既定ではAGENTS.mdが読まれず沈黙する」という想定で検証したところ、観測されたマーカーは`CLAUDE_LOCAL_MD_MARKER`でも`AGENTS_MD_MARKER`でもなく、**`NONE`**でした。verifier自体が「事前登録した主・対抗どちらの結果とも一致しない」として exit 1 を返しています(`claudelocal-suppresses-agentsmd/verify.log`)。

セッションの生ログ(`events.jsonl`)を確認すると、モデルはツールを使わずに直接`result.txt`へ`NONE`を書き込み、最終メッセージで「このセッションではプロジェクト指示が一つも読み込まれなかった」と述べています。つまり「AGENTS.mdを見て無視した」のではなく「そもそも何も読めなかった」という報告です。ワークスペース側の`CLAUDE.local.md`はセッション開始前に(`fs.writeFileSync`で同期的に)作成済みだったため、書き込みタイミングの競合は原因として除外できます。

### 5. --settingsファイルでAGENTS.mdを強制するという修正

「プロジェクトスコープには効かないが、`--settings <file>`で同等のキーを渡せばAGENTS.mdを`CLAUDE.md`より優先させられる」という想定も検証しましたが、観測は`CLAUDE_MD_MARKER`のまま。verifierはexit 0で「事前登録した対抗(=修正が効かない)結果」と一致したと判定しました。つまり、この`--settings`ファイル経由の修正は、少なくともこの実行では効きませんでした。

### なぜ再現しなかったのか — 有力な容疑者は`--setting-sources project`

上の2項目は、他の3項目と違って`CLAUDE.local.md`を絡めた構成です。5ケース全ての`command.json`を突き合わせると、起動フラグは`--setting-sources project`まで含めてバイト単位で同一でした。このフラグは`local`スコープの設定源を除外する可能性があり、`CLAUDE.local.md`の扱いに影響していても不思議ではありません。

ただし、これは今回の証拠だけでは切り分けられない交絡です。生ログは「モデルが何も読めなかった」ことは示していますが、「なぜ読めなかったか」までは示していません。したがって、

- 「`CLAUDE.local.md`単体でのAGENTS.md抑制は文書通り機能しない」
- 「`--settings`ファイル経由の修正は効かない」

のどちらも、**この実行結果だけを根拠に確定した結論として扱うべきではありません**。逆に「Anthropicの文書が誤っている」と断定する材料でもありません。「この検証ハーネス(固定の`--setting-sources project`)では再現しなかった」というのが正確な言い方です。

## 実務への影響 — CIやバッチ実行にそのまま関わる

`claude -p`をCIやバッチツールから叩く場合、動作を固定する目的で`--setting-sources`を明示的に渡すのは一般的なやり方です。今回の結果は、そのフラグ自体が「どのメモリファイルが読まれるか」に影響しうることを示しています。エラーは出ず、挙動だけが変わるタイプの罠なので、`CLAUDE.local.md`や`--settings`ファイルに依存した設計をスクリプト化する前に、実際に使う起動コマンドの形(特に`--setting-sources`の有無)でこの記事と同じ確認を自分の環境で行うことを推奨します。

## 移行チェックリスト

| # | 項目 | この検証での結果 | 対応 |
|---|---|---|---|
| 1 | AGENTS.mdのみ配置 | 確認済み・直接読まれる(exit 0) | v2.1.281以降なら回避策を外して問題ない |
| 2 | AGENTS.md + CLAUDE.md | 確認済み・CLAUDE.mdが勝つ、エラーなし(exit 0) | 両方残すならCLAUDE.mdが常に優先される前提で設計する |
| 3 | プロジェクトスコープ`.claude/settings.json`への`agents-md@builtin`キー | 確認済み・無効(exit 0、観測不変) | プロジェクトスコープに書かない |
| 4 | AGENTS.md + CLAUDE.local.mdのみ(CLAUDE.mdなし) | **未確認**・事前登録外の`NONE`が観測(verifier exit 1) | 本番投入前に自分の起動コマンドで直接検証する。`--setting-sources`の指定有無を最初に疑う |
| 5 | `--settings <file>`経由でのAGENTS.md強制 | **未確認**・対抗(修正が効かない)結果を観測(exit 0だが期待と不一致) | 「効く」と決め打ちで手順書に書かない。自分の環境で再検証する |
| — | デコイ(AGENTS.local.md/AGENTS.override.md/.agents/) | 確認済み・5ケース全てで無視 | これらのファイル名に頼った設計は不要 |
| — | バージョンゲート | 確認済み・全ケースで`2.1.283`(2.1.277/2.1.281を満たす) | `claude --version`を移行前に必ず確認する |

このチェックリストは「`pluginConfigs["agents-md@builtin"]`を正しいスコープ(`--settings <file>`)に置いた、動作確認済みのsettings.json全文」までは提供していません。項目5(`--settings`経由の修正)がこの実行では効かない結果(競合仮説どおり`CLAUDE_MD_MARKER`)を観測したため、確認できていない設定例を「動く手順」として載せることは避けました。正しいスコープでの確認済み設定が必要な場合は、自分の環境で項目5を再検証してください。

## この検証の限界

- 各ケース1回のみの実行で、再試行によるばらつきは測っていません。
- `result.txt`への書き込みは行動プロキシであり、モデルがツール使用の指示に反した場合は信号が汚染されるリスクがありますが、`claudelocal-suppresses-agentsmd`のログではツール使用前に`NONE`が書かれており、その点でのリスクは顕在化していません。
- 起動コマンド固定フラグ`--setting-sources project`が交絡している可能性は、今回の解析で新たに気づいた点であり、事前の実験計画には記載されていませんでした。項目1〜3・デコイ・バージョンゲートは同じフラグの下でも期待通りの結果を再現しているため、影響は項目4・5に限られます。
- プロジェクトスコープの検証は`pluginConfigs["agents-md@builtin"].options.instructionFiles`という特定のキーパスのみが対象で、他の設定キー一般に一般化はできません。
- Codexなど他ツールとの比較は行っていません。

## まとめ

Claude Code 2.1.283での実機検証では、AGENTS.md/CLAUDE.mdの既定優先順位・プロジェクトスコープ設定の無効化・デコイファイルの無視・バージョンゲートの4種は文書通りに動作しました。一方で、`CLAUDE.local.md`単体でのAGENTS.md抑制と、`--settings`ファイル経由でAGENTS.mdを強制する修正の2つは、この検証では再現せず、共通の固定フラグ`--setting-sources project`が交絡している可能性が残っています。移行チェックリストの1〜3・デコイ・バージョンゲートは安心して適用してよい一方、4・5は「文書通りに動く」と決め打ちせず、自分たちの実際のCLI起動形(特に`--setting-sources`)で先に検証してから手順書に載せることを推奨します。
