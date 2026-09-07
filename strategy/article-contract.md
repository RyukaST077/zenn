# 記事契約（Article Contract）

`search-topic` がテーマを1本選ぶときに発行し、`plan-practice` → `run-practice` →
`draft-article` → `review-article` が**そのまま持ち回る**仕様書。

## なぜ契約という形にするのか

改善ループは方針（`strategy/topic-selection-policy.json`）を更新していくが、方針が更新されても
**書きかけの記事の設計は変わってはいけない**。途中で前提が変わると、その記事がどの方針の結果なのか
分からなくなり、あとで「この型は効いたのか」を判定できなくなる。

そこで記事ごとに、選定した時点の `policyVersion` と設計意図を凍結する。これが契約。

- 契約は search-topic が作る。後工程は**契約を満たすか否か**だけを見る。
- 契約は後付けで書き換えない。書き換えたい場合は理由を `logs/` に残す。
- `review-article` は契約未達を **blocker** として扱う（公開ゲート）。

## 置き場所

`search-topic` のレポート（`research/search-topic-*.md`）の末尾に、下記の JSON ブロックを
そのまま埋め込む。`plan-practice` はこのブロックを読んで実践タスクを組む。

````md
## 記事契約

```json
{ ...下記スキーマ... }
```
````

公開時は `scripts/analytics/register-article.mjs` でこの契約を
`analytics/article-ledger.jsonl` に事前登録する（公開前に登録するのが必須。
公開後に結果を見てから型を書き足すと、後付け解釈になって判定に使えなくなる）。

## スキーマ

| フィールド | 必須 | 意味 |
|---|---|---|
| `slug` | ✅ | 記事の slug。`articles/<slug>.md` と一致させる |
| `policyVersion` | ✅ | 選定時に読んだ policy の `policyVersion` |
| `experimentId` | ✅ | 実験ID（`experiments/EXP-*.json`）。実験に入れない場合は明示的に `null`。**省略は不可**（省略を実施中の実験で埋めると、仮説を検証していない記事が判定を汚す） |
| `arm` | ✅ | 群。`"B-payload"`（EXP-001の実験対象）/ `"exploration"`（探索枠）/ `"legacy-transition"`（旧ドラフトの書き直し）。実験IDを指定した場合はその実験が定義する arm でなければ棄却される |
| `valueArchetype` | ✅ | policy の `valueArchetypes[].id` のどれか。`stage: deprecated` は選べない |
| `targetReader` | ✅ | 誰か。「新人エンジニア」では粗すぎる。「Claude Code を業務で使い始めて権限設定でつまずいている人」の粒度 |
| `readerDecision` | ✅ | 読者がこの記事を読んで下せる判断。**1文・1つだけ** |
| `takeaway` | ✅ | 読者が持ち帰る成果物。設定全文／スクリプト／チェックリスト／判断表のいずれか |
| `verificationItems` | ✅ | 検証項目。**3つ以上**。1つしか無い候補はこの時点で棄却する |
| `quantifiedMetric` | | `valueArchetype` が `quantified` の場合は必須。測る指標と測定条件 |
| `titleDraft` | ✅ | タイトル案。検証行為ではなく読者の利得を主語にする |
| `primaryTopic` | ✅ | 市場比較の基準になるトピック。`analytics/topic-feedback.md` の「primaryTopic に選べるトピック」で**「続行判断まで測れる」以上**のものから選ぶ。`d30-45` コホートが育っていないトピック（記事の流量が多すぎる `ai` など）を選ぶと、D30の市場順位が計算できず改善ループが何も学習できない |
| `topics` | ✅ | Zenn の topics（4〜5個） |
| `demandEvidence` | ✅ | 需要の根拠。同トピック上位記事のいいね数や検索結果など、観測した事実 |

### 例

```json
{
  "slug": "claude-code-permission-settings-recipe",
  "policyVersion": "2026-09-05.1",
  "experimentId": "EXP-001",
  "arm": "B-payload",
  "valueArchetype": "asset",
  "targetReader": "Claude Code を業務で使い始めて、permissions の deny をどこまで信用していいか分からない人",
  "readerDecision": "自分のリポジトリの deny 設定を、どこまでOS側の防御に頼らず書けるか決められる",
  "takeaway": "検証済みの settings.json の deny ルール全文と、抜けた経路の一覧表",
  "verificationItems": [
    "許可リスト内リーダーへのリダイレクト",
    "許可リスト外コマンドへのリダイレクト",
    "symlink 経由の到達",
    "Write による上書き",
    "grep/glob 経由の読み出し"
  ],
  "quantifiedMetric": null,
  "titleDraft": "Claude Code の deny 設定はどこまで信用できるか、5経路試して残った穴と使える設定",
  "primaryTopic": "claudecode",
  "topics": ["claudecode", "security", "permissions", "aiagent"],
  "demandEvidence": "claudecode トピックは taggings 13545。上位は「個人的claude code設定」657いいねで、設定そのものを配る型が最も伸びている。"
}
```

## 群（arm）の使い分け

改善ループはこれで記事を分ける。間違った群に入れると実験の判定が汚れる。

| arm | experimentId | 用途 |
|---|---|---|
| `B-payload` | `"EXP-001"` | 新方針（policy）で選定した実験対象。`asset` / `migration` / `quantified` のみ |
| `exploration` | `null` | 探索枠。`stage: candidate` の価値型（`mental-model` / `decision`） |
| `legacy-transition` | `null` | 方針導入前に書かれた未公開ドラフトを束ね直した記事 |
| `historical-control` | `null` | ループが自動で付ける。方針導入前に公開済みの記事。手で指定しない |

### 旧ドラフトを書き直すとき（legacy-transition）

方針導入前の未公開ドラフト（`published: false`）には、deprecated な型のものが残っている。
これらは**そのまま公開しない**。同じ `readerDecision` に寄与するものを3〜5件束ね、
`asset` / `migration` / `decision` に再設計して、**新しい slug と新しい契約**で出す。

- `arm: "legacy-transition"`、`experimentId: null` で登録する
- EXP-001 の判定には使わない（新policyで選定していないので、仮説を検証していない）
- 束ねても持ち帰る成果物や読者の判断が作れないもの、対象バージョンが古すぎるものは
  **公開せず保管のまま**にする

## 契約が満たせないと分かったとき

`run-practice` の途中で検証が3つ揃わない、成果物が出ない、と分かることがある。
そのときは**記事を無理に成立させない**。契約違反として `logs/` に記録し、
`review-article` で不合格にして、テーマを差し替える。

低反応の記事を1本増やすより、契約を守れないテーマを捨てるほうが改善ループの精度が上がる。
