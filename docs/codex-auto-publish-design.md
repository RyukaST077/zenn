# Codex版 Zenn記事自動投稿パイプライン 構成設計

## 1. 目的

Codex CLIの非対話実行を使い、Zenn記事を次の順で生成し、GitHubの公開用ブランチへpushしてPRを作成する。

```text
テーマ調査 → 実践計画 → 実装・検証 → 記事執筆
  → レビュー ⇄ 修正 → 公開準備 → commit/push → PR作成
```

Claude版の成果物形式と安全策を引き継ぎつつ、Codexのスキル、権限モデル、非対話CLIに合わせて実装する。

## 2. スコープ

### 対象

- Codex用リポジトリスキルの構成
- `codex exec` を段階実行するオーケストレーター
- 成果物による段間連携
- review/reviseループ
- パイプラインの中断・再開
- 公開用ブランチへのcommit/pushとPR作成
- launchdなどからの定期実行
- Claude版と並行運用できる移行方法

### 対象外

- Zennそのものの公開仕様変更
- Claude版スキルの削除
- 初期実装時の自動マージ有効化
- GitHub Actionsへの移行
- CodexにこのリポジトリのGit操作の自由裁量を与える構成

## 3. 設計原則

1. **Codexと公開用Git操作を分離する**  
   Codexは調査、生成、検証、レビュー、公開準備を担当する。このリポジトリのbranch、commit、push、PR作成はオーケストレーターが固定手順で実行する。

2. **段間連携はファイルで行う**  
   各段は独立した`codex exec --ephemeral`として起動し、成果物パスを次段へ渡す。会話セッションの継続には依存しない。

3. **成果物と機械検査を成功条件にする**  
   Codexの終了コードや最終メッセージだけで成功とみなさず、期待ファイル、JSON結果、記事検査を組み合わせて判定する。

4. **非対話時に承認を待たない**  
   `approval=never`で起動し、許可範囲外の操作は失敗として扱う。スキル内でユーザーへの質問や承認待ちは行わない。

5. **公開はPRをゲートにする**  
   `main`へ直接pushしない。`published: true`は公開用ブランチ上だけで作り、PRマージを公開操作とする。

6. **Claude版と並行稼働させる**  
   Codex版は別スクリプト・別スキル配置で作り、通し試験が完了するまでClaude版を変更しない。

## 4. 全体構成

```text
024_zenn/
├── AGENTS.md                              # Codex向けの永続的なリポジトリ規約
├── .agents/
│   └── skills/
│       ├── zenn-search-topic/
│       ├── zenn-plan-practice/
│       ├── zenn-run-practice/
│       ├── zenn-draft-article/
│       ├── zenn-review-article/
│       ├── zenn-revise-article/
│       ├── zenn-prepare-publish/
│       ├── zenn-consult-knowledge/
│       └── zenn-save-knowledge/
├── scripts/
│   ├── auto-publish-codex.sh              # Codex版オーケストレーター
│   ├── auto-publish-codex-launchd.sh      # 定期実行ラッパー
│   ├── check-article.sh                    # 共通の決定的記事検査
│   ├── pipeline-state.mjs                  # JSON状態の読み書き
│   ├── stage-result-contract.mjs           # 段別Schema・prompt・検証契約
│   └── validate-stage-result.mjs           # 成果物と段別契約の最終検証
├── logs/
│   └── codex-pipeline-<timestamp>/
│       ├── state.json
│       ├── pipeline.log
│       ├── 1-search.schema.json
│       ├── 1-search.events.jsonl
│       ├── 1-search.result.json
│       └── ...
└── docs/
    └── codex-auto-publish-design.md
```

Codexの公式なリポジトリスキル配置に合わせ、`.agents/skills`を正とする。既存の`.codex/skills/zenn-topic-research`は、移行完了後に統合または互換用シンボリックリンク化を検討する。

## 5. コンポーネント責務

### 5.1 `AGENTS.md`

全スキルに共通する、変更頻度の低い規約だけを置く。

- Zenn公開の仕組み
- `main`へ直接pushしない規約
- 記事は検証ログにある一次情報だけで書く規約
- 秘密情報を成果物へ含めない規約
- 成果物ディレクトリの意味
- 非対話実行では質問せず、安全側の既定値を選ぶ規約
- 検証コマンド

各工程固有の詳細はスキルへ置き、`AGENTS.md`を巨大化させない。

### 5.2 Codexスキル

各スキルは次の構造を基本とする。

```text
zenn-<action>/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/       # 必要なスキルだけ
└── scripts/          # そのスキル専用の決定処理がある場合だけ
```

`SKILL.md`には工程の目的、入力、出力、禁止事項、実行手順だけを置く。テンプレート、詳細チェックリスト、Zenn仕様は`references/`へ分離する。

### 5.3 オーケストレーター

`scripts/auto-publish-codex.sh`は以下だけを担当する。

- 前提コマンド・認証・Git状態の検査
- 多重起動防止
- Codexの非対話起動
- timeout管理
- 段結果JSONと成果物の検査
- 状態保存とresume
- review/reviseループ
- 公開用ブランチの作成
- 限定的な`git add`、commit、push
- `gh pr create`
- オプション指定時だけPRの自動マージ

記事内容やレビュー判断をシェルへ実装しない。

### 5.4 決定的スクリプト

次の処理はモデル判断ではなくスクリプトへ寄せる。

- Front Matterの構文検査
- `published`値の検査と切り替え
- slug形式とローカル重複の検査
- 画像参照先の存在検査
- コードフェンスなどの簡易構文検査
- 秘密情報らしい文字列の一次検査
- JSON状態の安全な更新
- commit対象ファイルの限定
- 段ごとのstage result Schema・metadata規則の生成と検証

stage result契約は`stage-result-contract.mjs`を唯一の定義元とする。同じ定義からCodexへ渡す
段別Schema、プロンプトの明示規則、バリデータの判定を作り、生成側と検証側のずれを防ぐ。
再開時は、当該段で禁止されているmetadataだけを`null`へ正規化して既存結果を再検証できる。
review判定、slug、PRメタデータなどの必須値は自動生成・補完しない。

## 6. スキル一覧と契約

| 段 | Codexスキル | 入力 | 主成果物 | Codexがしてはいけないこと |
|---|---|---|---|---|
| 1 | `zenn-search-topic` | 検索条件、既存記事 | `research/search-topic-*.md` | 記事執筆、このリポジトリのGit状態を変更する操作 |
| 2 | `zenn-plan-practice` | 調査レポート | `practice/practice-*.md` | 本検証、記事執筆 |
| 3 | `zenn-run-practice` | 実践計画 | `logs/run-*/execution-log.md` | 記事本文作成、このリポジトリのGit状態を変更する操作 |
| 4 | `zenn-draft-article` | 実践ログ | `articles/<slug>.md`、画像 | 未検証事実の補完、`published: true` |
| 5 | `zenn-review-article` | 記事、実践ログ | `logs/review-*.md` | 記事の大幅修正、公開操作 |
| 5R | `zenn-revise-article` | 記事、レビュー、実践ログ | 修正記事、`logs/revise-*.md` | ログにない事実の追加、公開操作 |
| 6 | `zenn-prepare-publish` | 公開可の記事、レビュー | `published: true`の記事、PRメタデータ | branch、commit、push、PR作成 |

`consult/save-knowledge`は補助スキルとし、パイプラインの独立段にはしない。`run-practice`などが必要時に明示利用する。

slug衝突の解消は`zenn-revise-article`の責務とする。記事パス、Front Matter、画像ディレクトリ、画像参照を同時に更新し、再度reviewを通す。

`zenn-prepare-publish`はパイプラインディレクトリへ次を保存する。

- `pr-metadata.json`: `{"title":"...","body_file":"logs/codex-pipeline-<timestamp>/pr-body.md"}`
- `pr-body.md`: PR本文

`title`は空でない文字列、`body_file`は当該パイプラインディレクトリ配下のリポジトリ相対パスとする。オーケストレーターはこのJSONだけからPRタイトルと本文ファイルを取得する。

### 命名方針

Claude版と役割を対応させつつ、グローバルスキルとの衝突を避けるため`zenn-`接頭辞を付ける。

| Claude版 | Codex版 |
|---|---|
| `search-topic` | `zenn-search-topic` |
| `plan-practice` | `zenn-plan-practice` |
| `run-practice` | `zenn-run-practice` |
| `draft-article` | `zenn-draft-article` |
| `review-article` | `zenn-review-article` |
| `revise-article` | `zenn-revise-article` |
| `publish-pr` | `zenn-prepare-publish` |

`publish-pr`を`prepare-publish`へ変えるのは、GitHubへの副作用をスキルからオーケストレーターへ移すためである。

## 7. `codex exec`の起動方式

概念上の起動形式は次のとおりとする。

```bash
codex \
  -a never \
  --search \
  exec \
  --ephemeral \
  --sandbox workspace-write \
  -c sandbox_workspace_write.network_access=true \
  -C "$ROOT" \
  --json \
  --output-schema "$RESULT_SCHEMA" \
  -o "$RESULT_FILE" \
  "$PROMPT"
```

設計上の注意:

- 現在のCLIでは`-a never`は`exec`より前に置く。
- `--ephemeral`で段ごとのセッション保存を抑止する。
- `--json`のイベント列は監査・障害調査用ログへ保存する。
- `-o`で最終結果JSONを別ファイルへ保存する。
- Web調査が不要な段では`--search`を外せるようにする。
- shellからの依存取得が必要な段だけネットワークを許可する。
- モデルとreasoning effortは環境変数からCLI設定へ渡す。
- CodexにはClaudeの`--max-turns`相当がないため、外部timeoutを必須にする。
- preflightで`timeout`を探し、なければ`gtimeout`を探す。どちらもなければfail-fastし、タイムアウトなしでは続行しない。

実装では引数を文字列連結せず、Bash配列が使える環境では配列で組み立てる。macOS標準Bash 3.2互換を維持する場合も、引用を崩す`eval`は使わない。

## 8. 段結果の共通契約

各`codex exec`の最終応答を次のJSONへ統一する。

```json
{
  "status": "ok",
  "artifact": "research/search-topic-20260710-1200.md",
  "reason": "",
  "metadata": {
    "verdict": null,
    "slug": null,
    "pr_metadata": null
  }
}
```

### フィールド

- `status`: `ok`または`abort`
- `artifact`: 主成果物のリポジトリ相対パス。中止時は空文字
- `reason`: 中止理由。成功時は空文字
- `metadata.verdict`: review段だけ`pass`、`fix`、`blocker`
- `metadata.slug`: 記事が確定した段以降のslug
- `metadata.pr_metadata`: prepare-publish段だけ`pr-metadata.json`のリポジトリ相対パス

`--output-schema`にはOpenAI Structured Outputs準拠の厳格なJSON Schemaを使う。各objectに`additionalProperties: false`を指定し、nullableな文字列は`["string", "null"]`の型unionで表現する。

### 成功判定

オーケストレーターは次をすべて確認する。

1. `codex exec`の終了コードが0
2. 結果JSONがSchemaに適合
3. `status`が`ok`
4. `artifact`が許可されたディレクトリ配下の相対パス
5. 成果物が存在し、段開始時のマーカーより新しい
6. 段固有の機械検査を通過

5は当該段の主成果物だけに適用し、resume時に再利用する前段成果物の更新時刻は判定対象にしない。

Codexの文章出力をgrepして成功判定する方式は採用しない。

## 9. パイプライン制御

### 9.1 状態ファイル

`logs/codex-pipeline-<timestamp>/state.json`へ保存する。

```json
{
  "version": 1,
  "base_branch": "main",
  "completed": {
    "preflight": true,
    "search": true,
    "plan": false,
    "run": false,
    "draft": false,
    "review": false,
    "prepare_publish": false,
    "push": false,
    "pr": false,
    "merge": false
  },
  "artifacts": {
    "report": "research/search-topic-20260710-1200.md",
    "task": null,
    "run_log": null,
    "article": null,
    "review": null,
    "revise": null,
    "pr_metadata": null
  },
  "review": {
    "rounds": 0,
    "last_verdict": null,
    "next_stage": "review",
    "history": []
  },
  "publish": {
    "branch": null,
    "commit": null,
    "pr_url": null
  }
}
```

シェルコードをsourceする`state.sh`は使わず、JSONを決定的なヘルパーで更新する。

### 9.2 resume

`--resume <pipeline-dir>`指定時は次を行う。

1. `state.json`のversionと必須フィールドを検査
2. 完了済み成果物が現在も存在するか確認
3. 成果物が欠けていれば、その段と後続段を未完了へ戻す
4. 公開用ブランチ作成後なら、現在ブランチと状態のbranchを照合
5. review未完了なら`review.next_stage`、`review.rounds`、`review.last_verdict`、`review.history`と最新のreview/revise成果物を照合
6. `next_stage`が`revise`なら直前reviewの後から、`review`なら初回reviewまたは直前reviseの後から再開
7. review以外は最初の未完了段から再開

review/revise成果物が欠けている場合は、`review.history`を実在する成果物と一致する最後のエントリまで切り詰め、`rounds`、`last_verdict`、`next_stage`をそのエントリから再計算する。全エントリが失われた場合はreview状態を初期化し、初回reviewから再実行する。

自動的な`git reset`、未コミット変更の破棄、ブランチ削除はしない。

### 9.3 review/reviseループ

```text
review
  ├─ pass    → 公開準備へ
  ├─ fix     → revise → review
  └─ blocker → revise可能ならrevise、素材不足ならabort
```

- 既定上限は3回
- `zenn-review-article`はレビューレポート先頭付近に`verdict: pass`、`verdict: fix`、`verdict: blocker`のいずれかの固定行を必ず1行だけ出力
- verdictは結果JSONと`^verdict: (pass|fix|blocker)$`に一致する固定行だけで照合し、他の本文はパースしない
- 不一致は契約違反として停止
- revise後にslugが変わった場合は記事パスと画像パスを状態へ反映
- review完了時に`rounds`を加算し、verdict、レポートパス、実施時刻を`history`へ追加して`last_verdict`と`next_stage`を更新
- revise完了時に成果物を保存して`next_stage`を`review`へ更新

## 10. Git・GitHub公開フロー

Git操作はCodexの外で次の順に固定する。

1. `main`と追跡ファイルのクリーン状態を確認
2. 必要なら`git pull --ff-only`
3. reviewが`pass`したことを確認
4. `publish/<slug>`ブランチを作成して切り替え
5. `zenn-prepare-publish`を実行
6. `published: true`と記事検査の通過を確認
7. `git add -- articles/<slug>.md images/<slug>/`
8. staged diffに許可外パスがないことを確認
9. commit
10. `git push --set-upstream origin <branch>`
11. `pr-metadata.json`のSchema、タイトル、`body_file`の配置を検査し、`gh pr create --base main --head <branch> --title <title> --body-file <body_file>`
12. PR URLを状態へ保存
13. `main`へ戻す

### 公開ゲート

push前に次を必須とする。

- 最新レビューが`pass`
- blocker 0、warning 0
- `published: true`
- slug、Front Matter、画像、Markdown検査が成功
- `<!-- 要素材 -->`が0件
- 秘密情報の一次検査が成功
- staged pathが記事と対応画像だけ
- push先が`main`ではない

### 自動マージ

初期実装では既定OFFとする。`--auto-merge`指定時のみ、PR作成後に既存Claude版と同様の`gh pr merge --auto`を行う。PR作成までの検証が安定するまでは定期実行でも指定しない。

## 11. 権限・セキュリティ

### Codexプロセス

- `approval_policy`: `never`
- `sandbox`: `workspace-write`
- 書き込み先: リポジトリと一時ディレクトリのみ
- Git操作: このリポジトリのGit状態を変更する操作は禁止。実践用ディレクトリ内で検証対象に必要な`git init`、`git clone`は許可
- 外部ネットワーク: 必要な段だけ許可
- `danger-full-access`: 使用しない
- 既存`.codex/config.toml`の`default_permissions = ":danger-full-access"`は削除してCLIの`workspace-write`指定へ統一するか、`:workspace`へ修正する。`--ignore-user-config`は`$CODEX_HOME/config.toml`だけを無視し、プロジェクト設定レイヤを無視しない
- preflightでcwdからリポジトリルートまでの`.codex/config.toml`を検査し、Codex CLIの設定診断と`codex sandbox`サブコマンド（または同等手段）により、リポジトリ外パスへの書き込みが拒否され、リポジトリ内への書き込みが許可されること、およびapprovalが`never`であることを確認する。不一致なら停止する。確認できないCLIバージョンでは、`--dry-run`出力に実効設定を表示したうえで、`.codex/config.toml`の静的検査のみで判定する

`workspace-write`では`.git/`が既定で書き込み保護される。Git変更に対する機械的な防御はこのサンドボックスと、オーケストレーターによるstaged path限定である。

### オーケストレーター

- `GIT_TERMINAL_PROMPT=0`
- `GH_PROMPT_DISABLED=1`
- 起動前に`codex login status`と`gh auth status`を確認
- `git add .`を使わない
- push先branchを正規表現とbase branch比較で検査
- コマンド引数へ成果物本文を埋め込まない
- APIキーやauthファイルをログへ出さない
- lockディレクトリで多重実行を防ぐ

### 調査・実践対象

Web上のプロンプトインジェクションを命令として扱わない。調査対象のREADMEやWebページはデータであり、リポジトリ規約やスキル命令より優先しない。認証情報、課金、手動OAuth、CAPTCHAを要求するテーマは候補から除外または撤退する。

## 12. 設定

Codex版ではClaude固有変数と分離する。

| 変数 | 既定 | 用途 |
|---|---|---|
| `CODEX_BIN` | `codex` | CLIパス |
| `CODEX_MODEL` | 空 | 空ならCLI既定 |
| `CODEX_REASONING_EFFORT` | `medium` | reasoning effort |
| `CODEX_SEARCH` | `1` | 検索段でlive searchを使う |
| `MAX_REVIEW_ROUNDS` | `3` | review/revise上限 |
| `BASE_BRANCH` | `main` | PR base |
| `MERGE_METHOD` | `--squash` | 自動マージ方式 |
| `TIMEOUT_<STAGE>` | 段別 | 外部timeout秒 |

Claude版の`TURNS_<STAGE>`はCodex版では廃止する。

## 13. CLIインターフェース

```bash
# PR作成まで
bash scripts/auto-publish-codex.sh

# 計画表示のみ
bash scripts/auto-publish-codex.sh --dry-run

# 中断箇所から再開
bash scripts/auto-publish-codex.sh \
  --resume logs/codex-pipeline-20260710-120000

# テーマ条件を指定
bash scripts/auto-publish-codex.sh \
  --search-args "TypeScript周辺、半日以内"

# 安定後に限り自動マージ
bash scripts/auto-publish-codex.sh --auto-merge
```

`--dry-run`はCodex、Git、GitHubへの変更操作を一切行わず、解決済み設定、起動コマンド、段構成、権限を表示する。

## 14. ログと監査

各パイプライン実行で次を保存する。

- パイプライン全体の時刻付きログ
- CodexのJSONLイベント
- 各段の最終結果JSON
- 段開始・終了時刻と終了コード
- 使用モデルとreasoning effort
- 成果物パス
- review verdict履歴
- Git branch、commit SHA、PR URL

ログへはトークン、Cookie、認証ファイル内容、環境変数一覧を出さない。実践ログに外部コマンド出力を保存する場合も秘密情報らしい値をマスクする。

## 15. エラー処理

| 障害 | 動作 |
|---|---|
| Codex終了コード非0 | 段を未完了のまま停止 |
| timeout | プロセスを終了し、resume方法を表示 |
| `timeout`、`gtimeout`なし | preflightで停止し、導入方法を表示 |
| 結果JSON不正 | 契約違反として停止 |
| 成果物なし | 捏造防止のため停止 |
| review verdict不一致 | 公開不可として停止 |
| 依存取得失敗 | knowledge検索後、解決不能なら実践を一部達成/未達にする |
| Git tracked dirty | 開始前に停止 |
| staged path混入 | commit前に停止 |
| push失敗 | branchとcommitを状態へ残して停止 |
| PR作成失敗 | push済みbranchを状態へ残して停止 |
| slug衝突 | 自動公開せず、`zenn-revise-article`へ戻してslugを修正後、reviewを再実行 |

停止時は必ず、原因、該当ログ、状態ディレクトリ、正確なresumeコマンドを出力する。

## 16. テスト戦略

### 16.1 静的検査

- Codexスキルを検証できると確認済みのバリデータで全スキルを検証
- スキル名とディレクトリ名の一致
- 参照ファイルの存在確認
- shellcheck相当のシェル検査
- JSON Schema検証

### 16.2 スキル単体試験

各スキルを読み取りまたは専用fixtureで非対話実行し、次を確認する。

- 明示指定した入力だけを選ぶ
- 想定ディレクトリへ成果物を保存する
- 最終結果がSchemaに適合する
- 不足入力時に質問せず`abort`を返す
- 禁止された後続工程へ進まない

### 16.3 オーケストレーター試験

- `--dry-run`
- Codexコマンドをstub化した正常系
- 各段の失敗・timeout
- 不正JSON
- 成果物パス逸脱
- review/revise上限
- resume
- staged path混入
- push/PR作成失敗

### 16.4 通し試験

1. searchのみ
2. search → plan
3. runまで
4. draft → reviewまで
5. 公開用branch作成とローカルcommitまで
6. テスト用PR作成まで
7. 人間レビュー後に定期実行へ接続

最初の通し試験では`--auto-merge`を使わない。

## 17. 移行計画

### Phase 1: 共通基盤

- 既存`.codex/config.toml`を削除または`workspace-write`前提へ修正
- preflightで実効sandbox / permissionsとapprovalを検証
- `timeout`または`gtimeout`の必須検査
- `AGENTS.md`
- `.agents/skills`の骨格
- `codex exec`にスキル一覧を列挙させ、`.agents/skills`のリポジトリスキルが検出されることを実機確認
- 実機確認結果に基づき、既存`.codex/skills/zenn-topic-research`の統合または削除を決定
- Anthropic skills由来の`quick_validate.py`が`agents/openai.yaml`を含むCodexスキルへ適用可能か確認し、適用できなければCodex向け検証手段を選定
- 共通結果Schema
- Codex起動ラッパー
- JSON状態管理
- `--dry-run`

### Phase 2: 生成系

- `zenn-search-topic`
- `zenn-plan-practice`
- `zenn-run-practice`
- `zenn-draft-article`

### Phase 3: 品質ゲート

- `zenn-review-article`
- `zenn-revise-article`
- 共通記事検査スクリプト
- review/reviseループ

### Phase 4: GitHub連携

- `zenn-prepare-publish`
- branch/commit/push
- PR作成
- resume試験

### Phase 5: 定期実行

- Codex版の通し試験完了後、Claude版skillの記事検査参照を`scripts/check-article.sh`へ切り替えて一本化
- launchdラッパー
- 認証更新の確認
- ログローテーション
- 数回のPR作成実績後に自動マージを検討

## 18. 完了条件

Codex版の初期実装完了は、次をすべて満たした状態とする。

- 7つの主要スキルがCodexから検出される
- 全スキルの静的検証が成功する
- `--dry-run`が変更なしで成功する
- 非対話でテーマ調査から記事レビューまで完走する
- review/reviseループが上限付きで動く
- Codex自身はこのリポジトリのGit状態を変更しない
- オーケストレーターが記事と画像だけをcommitする
- `main`へ直接pushせずPRを作成する
- 途中失敗後に`--resume`で再開できる
- 既存Claude版パイプラインが引き続き利用できる

## 19. 採用決定の要約

| 論点 | 採用 |
|---|---|
| スキル配置 | `.agents/skills` |
| スキル名 | `zenn-`接頭辞付き |
| Codex実行 | 段ごとの`codex exec --ephemeral` |
| 承認 | `never` |
| sandbox | `workspace-write` |
| このリポジトリの公開用Git操作 | オーケストレーター側 |
| 段間連携 | 成果物ファイル＋結果JSON |
| 状態 | `state.json` |
| 成功判定 | Schema＋成果物＋機械検査 |
| 公開経路 | feature branch → PR |
| 自動マージ | 初期OFF |
| Claude版 | 並行維持 |

## 20. 参照資料

以下は設計時点で確認したCodex公式ドキュメントである。実装時は利用するCLIバージョンに応じた最新URLを確認する。

- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex agent skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex sandbox and approvals](https://learn.chatgpt.com/docs/agent-approvals-security)
- 既存Claude版オーケストレーター: `scripts/auto-publish.sh`
- 既存Claude版スキル: `.claude/skills/`
- 既存Codexスキル: `.codex/skills/zenn-topic-research/`
