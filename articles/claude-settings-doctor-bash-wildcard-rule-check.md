---
title: "Claude Code 2.1.248: doctorは壊れたBash(...)権限ルールを検知するか検証した"
emoji: "🩺"
type: tech
topics: ["claudecode", "ai", "cli", "settings"]
published: false
---

## 結論から: この壊れ方は`claude doctor`が名指しで教えてくれる

チームの共有 `.claude/settings.json` を管理していて、`2.1.248`（2026-08-27）のチェンジログにある「settings diagnostics」の一行——「起動時にsettingsの読み込み失敗を警告し、`/doctor` と `/status` にも失敗理由を表示する」——を見て、外部のJSONスキーマlintを剥がせるか迷っている場合の答えです。

チェンジログの文言だけでは、これが「JSONとして壊れている」ケースだけを指すのか、「JSONとしては正しいが値がスキーマ的におかしい」ケース（コミュニティのissue #10096で報告されている、`Bash(git reset:* --hard)` のように `:*` の後に空白が入ってしまう権限ルールの書き間違いなど）も含むのかが分かりません。

`Claude Code 2.1.248` で、内容だけが異なる3つの `.claude/settings.json` を用意し、それぞれに対して `claude doctor` を1回ずつ実行して確認しました。

> テストした `Bash(...)` の `:*` 位置ミス（末尾以外に置いてしまう書き間違い）については、`claude doctor` が該当ファイル・該当キー・該当ルール文字列と理由を名指しで警告した。ただし確認できたのはこの1パターンのみ。

以降、検証構成、実際の出力、実務での使い方、そしてこの結論が及ばない範囲を順に示します。

## 検証構成: baseline / syntax-error / schema-invalidの3パターン

固定条件はディレクトリ構成とプロンプト不要の呼び出し方法（`claude doctor` はモデルターンを起こさない）で、変えたのは `.claude/settings.json` の中身だけです。

| フィクスチャ | `.claude/settings.json` の内容 | 期待される壊れ方 |
|---|---|---|
| `baseline` | `{"permissions":{"allow":["Bash(git status)"]}}` | 正常 |
| `syntax-error` | 上記に末尾カンマを追加（JSONとしてパース不能） | ハードなJSONパースエラー |
| `schema-invalid` | `Bash(git reset:* --hard)`（`:*` の後に空白があり、`:*` が末尾にない） | JSONとしては正しいが、ルールの形が不正 |

環境: `claude 2.1.248 (Claude Code)`、`darwin-arm64`、2026-08-30に実行。各フィクスチャは別ディレクトリに置き、そのディレクトリを `cwd` として `claude doctor` を実行しています。

## 実際の出力: baselineは無言、残り2つは名指しで警告

`baseline` では `claude doctor` の出力に `Invalid settings` セクションが一切現れませんでした（`No installation issues found.` のみ）。

`syntax-error`（JSONパース不能）では次が出力されました。

```text
Invalid settings
- $CASE_ROOT/syntax-error/.claude/settings.json: Invalid or malformed JSON
```

そして本題の `schema-invalid`（JSONとしては正しいが `:*` の位置が不正な `Bash(...)` ルール）でも、次の警告が出ました。

```text
Invalid settings
- $CASE_ROOT/schema-invalid/.claude/settings.json › permissions.allow: Invalid permission rule "Bash(git reset:* --hard)" was skipped: The :* pattern must be at the end. Move :* to the end for prefix matching, or use * for wildcard matching
```

この2つ目のメッセージは「settingsの読み込みに失敗した」という汎用文言の使い回しではありません。ファイルパスに加えて `permissions.allow` というキー階層、問題のルール文字列そのもの（`"Bash(git reset:* --hard)"`）、そして「`:*` は末尾に置く必要がある」という具体的な理由まで含んでいます。`syntax-error` の「JSONとして壊れている」というメッセージとは指している場所も理由も別物なので、同じパースエラー文言をたまたま流用しているわけでもありません。

検証前に立てていた予想は逆で、「JSONとしては妥当だがルールの形だけが不正な場合は静かに読み込まれてしまう（サイレントに無視される）」というものでした。実際の記録はこれを否定する形になり、代わりに登録しておいたもう一つの想定結果（両方とも警告される）の方が起きています。

なお、3ケースとも `exit_code` は `0` のままでした。検知はstdoutのテキストにのみ表れ、終了コードの変化としては表れません。CIで自動判定に使うなら、終了コードではなく出力文字列を見る必要があります。

## 実務での判断ルール

`.claude/settings.json` の権限ルールが、必須の `Bash(cmd:*)` という前方一致ワイルドカードの形（`:*` が末尾にある形）から外れて拒否される場合、`claude doctor` はファイル・キー階層・ルール文字列を名指しします。権限ルールを変更したPRでは `claude doctor` の実行をマージ前チェックに加え、`Invalid settings` セクションをこの失敗パターンについては信頼できる情報源として扱ってよいでしょう。少なくともこの1パターンについては、専用のJSONスキーマlintステップを置き換えられます。

ただし他のsettings.jsonの壊れ方（認識されないトップレベルキー、グローバルスコープキーの誤配置、`permissions` 配下の `dangerouslySkipPermissions` など）についてはこの検証の対象外です。これらはコミュニティ報告に基づく未検証の仮説にとどまり、今回は同じ網羅性を主張できません。

## この結論が及ばない範囲

- 検証したのは `claude doctor` 単体コマンドの出力のみです。セッション内の `/doctor` や `/status` は別途確認していません。
- 各フィクスチャは1回のみ実行しており、CLI再起動をまたいだ再現性の確認はしていません。
- 「警告あり」の判定は `/settings/i` と `/(fail|invalid|error|could not|warn|ignore|drop)/i` という単純なキーワード照合で行っていますが、実際に得られた文言（`Invalid settings`、`Invalid permission rule ... was skipped`）はこの条件を意味的にも素直に満たしており、誤検知ではありません。
- テストしたスキーマ不正パターンは `Bash(...)` の `:*` 位置ミス1種類のみです。「すべてのスキーマ違反が検知される」とは主張できません。
- 記録されたCLIバージョン文字列は解決済みバックエンドのスナップショットまでは保証しませんが、今回の検証はローカルファイルのパース挙動のみを対象としており、モデル側の挙動には依存していません。
