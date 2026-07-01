# CLAUDE.md

Claude Code 向けのプロジェクトガイド。

<!-- agent-container:knowledge-loop:start -->
## ナレッジループ（agent-container 自動生成 / このブロックは再実行で更新されます）

このプロジェクトには開発トラブルを「記録して再利用する」ループが導入されています。
マーカー内は `npx agent-container` の再実行で上書きされます。手書きの追記はマーカーの外で行ってください。

### スキルの読み込み
スキルは `.claude/skills/` から自動で読み込まれます。下記トリガに該当すると自律的に起動します。

### トラブルが起きたら（まず最初に）
ゼロから調査する前に、`knowledge/` に同じトラブルの解決記録がないか確認する。
- スキル: `consult-knowledge`
- 手動検索: `bash .claude/skills/consult-knowledge/scripts/search-knowledge.sh "<語1>" "<語2>"`

### トラブルが解決したら
未記録の新しいトラブルは `save-knowledge` で `knowledge/YYYY-MM-DD-<slug>.md` に記録する。

### その他のスキル
- `implement` … 実装計画書に沿って実装。TaskCreate / TaskUpdate でタスク管理し、最後に必ずシステムを起動して Playwright で動作確認する。
- `update-skill` … 既存スキルを安全に更新する。

運用ルールの詳細は `knowledge/README.md` を参照。
<!-- agent-container:knowledge-loop:end -->
