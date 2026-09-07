# テーマ選定の継続的改善ループ

「どのテーマで書けば読まれるか」を、観測 → 方針 → 記事 → 再観測で回す仕組み。
パイプラインの各段（`search-topic` / `plan-practice` / `draft-article` / `review-article`）が
このドキュメントを参照する。

## なぜこの形なのか（前提となった実測）

2026-09-05 時点の実測。設計判断はすべてこの数字から出ている。

| 観測 | 値 |
|---|---|
| 自分の公開記事 | 57本 |
| いいね 合計 / 平均 / 最大 | 42 / 0.74 / 3 |
| 5いいね以上（hit） | **0本** |
| 公開ペース | 2026-07: 20本 / 2026-08: 31本 |
| 市場（`claudecode` 新着48本） | 中央値 **0** いいね / 0いいねが60% / p90=4 / 5+到達 6% |

読み方は2つある。

1. **自分のデータには信号が無い。** 最大3いいねで分散がほぼゼロ。
   「どの記事が当たったか」を自分の実績から学習しようとしても、返ってくるのはノイズだけ。
   → **仮説は市場（他者の上位記事）から取る。** 自分のデータは劣化検知に使う。

2. **平均を上げても知名度は取れない。** いいねはゼロ過剰・裾が重い分布で、
   市場でも中央値は0、勝ちは上位数%の裾にしかない。自分の平均0.74は市場の新着中央値を
   下回っているわけではなく、問題は**裾に一度も入れていない**こと。
   → **平均いいねを目標にしない。** 目標は「同時期・同トピック市場の上位層に入る記事を出せること」。

診断された主因は、テーマの粗いカテゴリ（Claude Code / Node / TypeScript）ではない。
それらは市場と合っている。主因は、その中で「Read denyがリダイレクトを塞ぐか」のような
**単一の境界条件を1記事にしていて、読者の持ち帰りが無く対象読者が極小になっている**こと。

## 構成要素

```
Zenn公開API（認証不要）
   ├── /api/articles?username=<user>              自分の記事
   ├── /api/articles?topicname=<t>&order=latest    市場ベースライン（年齢を揃えた分母 / 週1で46日分まで遡る）
   └── /api/articles?order=liked_count             市場の勝ち型（仮説の供給源）
              │
              ▼  scripts/analytics/fetch-zenn-metrics.sh
                 scripts/analytics/collect-zenn-metrics.mjs
   analytics/article-ledger.jsonl   記事ごとの契約＋D7/D30観測＋市場内順位
   analytics/market-index.json      トピック×記事年齢の他者いいね分布
              │
              ▼  scripts/analytics/build-topic-feedback.mjs
   analytics/topic-feedback.md      観測レポート（★方針ではない）
              │
              ▼  scripts/analytics/evaluate-policy.mjs
   strategy/proposals/<date>-<exp>.md   方針変更の提案 → PR → 人間がマージ
              │
              ▼
   strategy/topic-selection-policy.json  ★正式な選定方針
              │
              ▼  search-topic が必ず読む
   記事契約（research/search-topic-*.md の末尾 JSON）
              │
              ▼  plan → run → draft → review が執行
   articles/<slug>.md
```

### ファイルの役割と権限

| ファイル | 役割 | 誰が書き換えるか |
|---|---|---|
| `strategy/topic-selection-policy.json` | **正式な選定方針**。唯一の権威 | 人間がPRをマージしたときだけ |
| `strategy/decision-log.md` | なぜそう決めたかの履歴 | 人間（本文）／スクリプト（提案履歴の追記のみ） |
| `strategy/proposals/*.md` | 方針変更の提案 | `evaluate-policy.mjs` |
| `analytics/topic-feedback.md` | 観測結果 | `build-topic-feedback.mjs`（毎回上書き） |
| `analytics/contracts/<slug>.json` | **契約の正本**（不変・記事単位） | `register-article.mjs` |
| `analytics/article-ledger.jsonl` | 契約＋APIから導出される台帳 | `register-article.mjs`（公開前）／`collect-zenn-metrics.mjs`（公開後） |
| `analytics/market-index.json` | トピック×記事年齢の他者いいね分布 | `collect-zenn-metrics.mjs` |
| `experiments/EXP-*.json` | 事前登録した実験 | 人間 |

台帳（`article-ledger.jsonl`）は**導出物**。契約の正本は `analytics/contracts/<slug>.json` にあり、
台帳の行が隔離worktreeや同時書き込みで失われても、次の収集で契約から復元される
（失われた行を heuristic 分類で埋め直してしまうと、事前登録の意味が消える）。

**重要**: 観測（`topic-feedback.md`）が方針（`policy.json`）を自動で書き換えることはない。
観測で見えた傾向は提案を経由し、人間のPRマージで初めて方針になる。
このリポジトリには「publish PRを人間がマージ＝公開ゲート」という前例があり、方針変更も同じゲートに乗せている。

## 各段のふるまい

### search-topic

1. `strategy/topic-selection-policy.json` を読む（**必須**。無ければ中止）。
2. `analytics/topic-feedback.md` を読む（あれば）。無い・古い・件数不足は**中立**として扱い、
   マイナス評価には使わない。
3. `topic-feedback.md` の「1. 市場の勝ち型」は、集計表だけでなく**上位記事の生データを自分で読んで
   分類し直す**。正規表現の推定分類（`guessValueArchetype`）は取りこぼすので、集計を鵜呑みにしない。
4. policy の `scoring.gates` を全部通った候補だけを `scoring.weights` で採点する。
   `stage: deprecated` の価値型は選べない。
5. 候補の25%は探索枠。ただし探索先は `stage: candidate` の価値型に割り当てる（deprecated には振らない）。
6. 契約の `primaryTopic` は、`topic-feedback.md` の「primaryTopic に選べるトピック」で
   **「続行判断まで測れる」以上**のトピックから選ぶ。`d30-45` コホートが育っていないトピックを選ぶと、
   記事を出しても市場順位が計算できず、改善ループが何も学習できない。
7. 選んだ1本について**記事契約**を発行し、レポート末尾に `## 記事契約` + JSON ブロックで埋め込む
   （スキーマは `strategy/article-contract.md`）。`experimentId` と `arm` は必ず明示する
   （省略すると `register-article.mjs` が exit 2 で棄却する）。
8. 過去の実績（`topic-feedback.md`）が、真実性・実行可能性・一次情報より優先されることはない。

### plan-practice

- 契約の `verificationItems`（3件以上）をそのまま実践タスクのチェックリストにする。
- 検証が1件しか組めないと分かったら、**記事を成立させずテーマを差し替える**。
  単一境界条件の記事を1本増やすより、契約を守れないテーマを捨てるほうがループの精度が上がる。
- 契約の `takeaway`（読者が持ち帰る成果物）を作る作業を、タスクに明示的に含める。

### draft-article

- 記事の骨格は**実験の時系列ではなく、契約の `readerDecision`（読者が下す判断）**を中心に組む。
- `takeaway` を本文に実物として置く（設定全文・スクリプト・チェックリスト・判断表）。
- タイトルは検証行為ではなく読者の利得を主語にする。
- 本文の事実は実行ログの一次情報だけを使う（この原則は従来どおり優先）。

### review-article

契約未達は **blocker**（公開不可）として扱う。契約そのものが無い記事は、
方針導入前のドラフトなら warning（`legacy-transition` として再設計する対象）、
方針導入後に選定された記事なら **blocker**（事前登録を飛ばしている）。

- [ ] 契約の必須項目が埋まっている
- [ ] `readerDecision` が1つに絞られている
- [ ] `takeaway` が本文に実物として存在する
- [ ] 検証項目が3件以上、本文に結果として現れている
- [ ] `valueArchetype` が `deprecated` でない

## GA4 の接続（露出と内容を分離する）

Zenn のユーザー別 Google Analytics 設定で、`zenn.dev/<user>` 配下に自分の測定IDが注入されている。
`zenn.dev/zenn` やトップページには GA タグが無いので、取れるのは**自分の記事のPVだけ**（他者のPVは見えない）。

これが効くのは、**Zenn APIだけでは分離できなかった2つを分けられる**ため。

| 指標 | 出どころ | 意味 |
|---|---|---|
| 到達（reach） | GA4 `screenPageViews` | 記事ページに到達したか |
| 反応（response） | Zenn `liked_count` ÷ 到達 | 来た人に刺さったか |

いいね0の原因が「誰も来ていない」（＝テーマ・タイトル・トピックの問題）と
「来たが刺さらない」（＝本文・持ち帰りの問題）に割れる。**直す場所が違う**。
2×2 は `analytics/topic-feedback.md` の節0に出る。

**GA4のPVは「露出」ではなく「到達」。** Zennのフィードや検索結果に何回表示されたか
（インプレッション）は取れない。到達が低いことは露出が低いことを含意するが、逆は言えない。
到達が低い理由にはタイトル・Zenn内での表示・検索順位・公開時刻も含まれるので、
到達の低さを即「テーマが悪い」と読まない。

**この診断で何を撤回するかは、データを見る前に決めてある。**
`experiments/EXP-GA4-DIAG-001.json` に判定線（`R=100` / `R=300` / `impliedRate=0.005`）ごと
事前登録済み。事後に線を動かして物語を作らないための仕掛け。

### なぜ MCP ではなくサービスアカウントか

このループは launchd から `claude -p` / `codex exec` で無人実行される。
対話セッションが無いので、OAuth のユーザー同意フローや MCP コネクタは使えない。
サービスアカウントのJWTなら鍵ファイルだけで完結する。実装は `node:crypto` で
RS256 署名しているので、`gcloud` も npm パッケージも不要。

### セットアップ（コンソール操作なのでコマンドでは代行できない）

1. **GCPプロジェクトで Analytics Data API と Analytics Admin API を有効化**
   （API とサービス → ライブラリ → `Google Analytics Data API` / `Google Analytics Admin API`）
2. **サービスアカウントを作る** → 鍵（JSON）を作成してダウンロード。
   ロールは不要（GA側で権限を与えるため、GCPのIAMロールは付けなくてよい）。
3. ダウンロードした鍵を **リポジトリの外** に置く。

```bash
mkdir -p ~/.config/zenn-ga4
mv ~/Downloads/<鍵>.json ~/.config/zenn-ga4/service-account.json
chmod 600 ~/.config/zenn-ga4/service-account.json
```

   `config/ga4-service-account.json` も `.gitignore` 済みで動くが、そこに置かない。
   このリポジトリは**公開**で、同じツリーを自律エージェント（launchd から無人で動く
   `claude -p` / `codex exec`）が読み書きする。`.gitignore` は `git add -A` を止めるが、
   エージェントが鍵を読むことは止めない。ツリーの外に出せばその経路自体が消える。
   `fetch-ga4-metrics.mjs` は鍵が repo 内にある場合と、owner 以外に読める場合に警告する。
4. **GA4 側でそのサービスアカウントに閲覧権限を与える**
   （GA管理画面 → 該当プロパティ → プロパティのアクセス管理 → サービスアカウントの
   メールアドレス `...@....iam.gserviceaccount.com` を「閲覧者」で追加）。
   ここが手順3と別なのを忘れやすい。403 が出たらまずここを疑う。
5. `config/ga4.json` を作る（`config/ga4.json.example` をコピー）。

```json
{
  "keyFile": "~/.config/zenn-ga4/service-account.json",
  "measurementId": "G-HVE1W77CWV",
  "pathPrefix": "/clopy/articles/",
  "trackingStartDate": "2026-07-01",
  "completeLagDays": 2
}
```

`measurementId`（`G-...`）と `propertyId`（数値）は別物で、Data API が要るのは後者。
`measurementId` を書いておけば Admin API から自動解決するので、数値IDを探す必要はない。

`trackingStartDate` と `completeLagDays` は**正しさに直結する**ので省略しない。

- `trackingStartDate` … GAタグが実際に動き出した日。これより前の日はGA4が行を返さないが、
  それは「0PV」ではなく「不明」。指定しないと最古の行がある日から推定するが、
  推定は「トラフィックが無かった初日」を「タグ導入日」と誤認しうるので、分かるなら書く。
- `completeLagDays` … GA4の処理が終わっていない直近の日数（既定2）。当日を含む窓を
  「実測」と呼ぶと、処理途中の途中集計を確定値として読むことになる。

6. **疎通確認**（何も書き込まない）

```bash
node scripts/analytics/fetch-ga4-metrics.mjs --probe
```

見るべきは3つ。

- `event data retention` … 既定は `TWO_MONTHS`。**14か月に変更していないと、直近2か月ぶんしか
  遡れない**（過去記事のD7/D30は復元できない）。GA管理画面 → データ設定 → データ保持で変更できるが、
  **変更しても過去は復活しない**ので、早めに14か月にしておく。
- `reporting timezone` … `Asia/Tokyo` 以外なら **fetch は exit 2 で止まる**（警告ではない）。
  GA4は `date` をプロパティのタイムゾーンで区切り、Zennは `+09:00` で公開時刻を打つので、
  ずれていればD7/D30窓が1日単位でずれる。無人運用なので、警告を出して続行はしない。
  受け入れる場合だけ `config/ga4.json` に `"allowTimeZone": "<実際のTZ>"` を書く。
- `distinct article paths with data` / `earliest date with data` … 実際にどの範囲が取れているか。

7. **収集**

```bash
node scripts/analytics/fetch-ga4-metrics.mjs                      # → analytics/raw/ga4/<date>.json
node scripts/analytics/collect-ga4-metrics.mjs --report-json <上のパス>
#   → analytics/private/ga4-ledger.jsonl   （記事別の実数。git管理外）
node scripts/analytics/build-topic-feedback.mjs
#   → analytics/topic-feedback.md          （帯と本数だけ。コミットされる）
#   → analytics/private/ga4-detail.md      （記事別の表。git管理外）
```

`bash scripts/auto-improve-topics.sh` は `config/ga4.json` があれば自動でこの2段を挟む。
鍵が無い・APIが失敗した場合も**ループ全体は止めない**（Zenn APIだけで動作を継続する）。

### GA4データの扱いで守っていること

- **日次内訳（`date` × `pagePath`）で取る。** これによりD7/D30の窓を**正確に、かつ遡って**計算できる。
  スナップショットの差分ではないので、保持期間内なら過去記事にも実測のD7/D30到達が付く。
- **「要求した範囲」を「測れた範囲」と呼ばない。** APIに投げた日付範囲ではなく、
  それを `trackingStartDate` と `completeThrough`（今日 − `completeLagDays`）で挟んだ
  `coverage` が計測範囲。窓が `coverage` に完全に収まっていない限り実測扱いしない。
- **「0PV」と「データが無い」を混同しない。** 値は `null` で、理由が付く。

  | basis | 意味 |
  |---|---|
  | `measured` | 窓が計測範囲に収まっており、GA4の行欠落も無い |
  | `outside-tracking-coverage` | タグ導入前、または保持期間より前。行0件は0PVではない |
  | `window-not-closed` | 窓がまだ閉じていない（処理途中の直近数日を含む） |
  | `report-data-loss` | GA4が行を `(other)` に丸めた、または閾値で伏せた。合計が不完全 |

  カバー範囲内で行が無い日は**実測の0**として扱う。
- **分子と分母の期間が揃っていないいいね率は作らない。** これが一番効く。
  過去記事の `observations.d30.likes` は `current-upper-bound`、つまり
  **今日までの累積いいね**。これを公開後30日のPVで割ると率が跳ね上がるので、
  `likeRateBasis: "numerator-not-aligned"` として率を出さない。
  率が出るのは `measured-on-time`（＝日次収集がD30に間に合った記事）だけ。
  **到達は過去記事でも復元できるが、D30いいね率は復元できない。**
- **PVが少なすぎる記事のいいね率は出さない。** PV30未満は `likeRate: null`
  （3PVで1いいねを「33%」と読むのは無意味）。これは**表示上の下限**であって、
  「到達していない」の判定線ではない（29PVは到達している）。
- **日次 `totalUsers` の合計をユニークユーザー数と呼ばない。** GA4は行の中でしか
  重複排除しないので、複数日に来た同一人物が日数分数えられる。フィールド名は
  `userDays`。窓ごとのユニークユーザー数は別レポートが必要で、今は取っていない。
- **流入元をD7/D30の値として読まない。** 流入元レポートに日付の軸が無いため
  窓で切れない。フィールド名は `sourceMediumWholeRange` で、取得範囲全体の値。
- **記事別の実数を公開リポジトリに入れない。** GA4由来の数値は
  `analytics/private/`（`.gitignore` 済み、worktree同期対象外）にのみ書き、
  コミットされる `analytics/topic-feedback.md` には帯（`10-29` 等）と本数と比率だけを出す。
  `scripts/auto-improve-topics.sh --pr` は `analytics/private/` が staging に
  入っていたらコミットを拒否する。
- **他者のいいね率は測れない。** 自分のGA4は自分の記事しか見えないので、
  いいね率の良し悪しは自分の記事間の相対比較でしか判断できない。
- **ZennダッシュボードのPVとは一致しない。** bot除外の基準が違う。GA4側の数字で一貫させる。
- **`evaluate-policy.mjs` はGA4を一切読まない。** GA4は観測・診断レポート専用で、
  方針の昇格・撤回を自動判定しない。判定線は `experiments/EXP-GA4-DIAG-001.json` に
  事前登録してあり、判断するのは人間のPRマージ。

## 計測の仕組み（ここを壊すと全部が無意味になる）

### 市場コホートは「週1の深いスイープ」でしか育たない

`claudecode` は1日に約24本公開される。最新ページ（48本）だけを毎日取っても、
記事は**7日・30日になる前にページから流れて消える**。つまり日次収集だけでは
`d7-14` と `d30-45` のコホートが永久に空になり、**主指標のD30順位が計算できない**。

```bash
bash scripts/analytics/fetch-zenn-metrics.sh --deep   # 46日分まで遡る（週1・launchdは日曜）
```

市場インデックスは累積するので、1回の深いスイープで全ブラケットが埋まる。

流量が多すぎて上限（既定30ページ = 1440本）でも46日前に届かないトピックもある
（`ai` は1日約73本なので届かない）。そういうトピックは `d30-45` が0のままになるので、
**`primaryTopic` に選んではいけない**。どのトピックが測れるかは `analytics/topic-feedback.md` の
「primaryTopic に選べるトピック」に出る。

### 年齢ブラケットは観測窓に揃えてある

`d0-1` / `d2-6` / `d7-14` / `d15-29` / `d30-45` / `d46+`。
D30観測の順位は `d30-45` のコホートに対して計算する。広い `d30+` だと、
公開30日の記事を1年前の記事と比べてしまう。

### 順位は観測と一緒に凍結する

`observations.d30.relative` に、そのD30時点のいいね数・コホート・実年齢とセットで
パーセンタイルを保存する。台帳の `entry.relative` は**今日の年齢での順位**であり、
レポート表示用。判定に使うと3日目の順位と40日目の順位を混ぜることになる。

### 観測の質は3段階で区別する

| basis | 意味 |
|---|---|
| `measured-on-time` | 観測窓の頭で取れた（日次収集が動いていた） |
| `late-measured` | 窓内だが遅れて取れた（収集を数日落とした） |
| `current-upper-bound` | 窓を過ぎてから初観測。いいねは増える一方なので現在値は上限。**順位は付かない** |

ループ導入前の57本はほぼ全部 `current-upper-bound`。よって**対照群のD30順位は存在しない**
（収集開始時にちょうど30〜45日だった数本だけが例外で、それも少なすぎて対照値にならない）。
B群の順位は対照群ではなく**市場そのもの（中央値50）**と比べる。パーセンタイルとはそういう指標。

### コホートの必要サンプル数

| n | 使えること |
|---|---|
| 20以上 | レポート表示のみ |
| 50以上 | 順位で方針の続行を判断できる |
| 100以上 | 価値型の昇格根拠に使える |

n=20 で上位10%を語ると、上位はたった2本。それで方針を変えてはいけない。

## 判定指標（4層）

| 層 | 指標 | 用途 |
|---|---|---|
| 品質ゲート | 記事契約の充足 | 公開可否。**成果指標ではない** |
| 短期（主指標） | D30の市場コホート内パーセンタイル中央値 / 上位25%到達率 | 方針を続けるか降りるか |
| 劣化検知 | 0いいね率 / 非ゼロ率 / 平均いいね | 明確な悪化の検出**のみ** |
| 最終成果 | D30で上位10% / 5いいね以上 | 長期確認。昇格の必須条件にはしない |

### やってはいけない読み方

- **平均いいねの増減で方針を昇格・棄却する。** 裾が重い分布では1本の当たりが平均を支配する。
  12本のバッチなら、4いいねが1本出るだけで平均が+0.3動く。
- **hit（5いいね以上）が1本出たことを勝ち型の証拠にする。** 市場のhit率は約6%。
  12本での期待hit数は0.7本、1本以上出る確率は約54%。**出ても偶然、出なくても偶然**。
  hitは「その価値型を追試する」発見シグナルとしてのみ扱う。
- **十数本のバッチで有意差を主張する。** 出ない。方針変更は複数バッチの一貫した向きで判断する。
- **順位算出済nが小さいうちに市場順位中央値を読む。** 年齢を揃えたコホートが20本そろって
  初めて順位が付き、方針の続行判断に使えるのは50本から。収集開始直後は数本しか順位が付かない。
- **対照群のD30順位と比べる。** 存在しない（ほぼ全部 `current-upper-bound`）。市場中央値50と比べる。

## 価値型（valueArchetype）と昇格の段階

価値型は「読者が何を持ち帰るか」の分類で、**ループが学習する単位**。
記事ごとに公開前に事前登録する（公開後に結果を見てから分類すると後付け解釈になる）。

| stage | 意味 |
|---|---|
| `candidate` | 市場の上位記事で型を発見した段階。探索枠で試す |
| `provisional` | 市場側で上位層への偏りが確認でき、契約として形式化できた段階。**自分のhitは不要** |
| `preferred` | 公開済み・D30実測済み・コホート n>=100 で順位が出た記事が累計24本以上あり、そのうち市場上位10%が異なる2バッチから出て、上位25%到達率が市場の自然発生率25%を下回っていない |
| `deprecated` | 新規記事に割り当てない。ただし検証内容は他の型の証拠として再利用する |

現在の割り当ては `strategy/topic-selection-policy.json` の `valueArchetypes` を見る。

## 群（arm）

| arm | experimentId | 用途 |
|---|---|---|
| `historical-control` | `null` | 方針導入前に公開済みの記事。ループが自動で付ける歴史的対照群 |
| `B-payload` | `EXP-001` | 新方針で選定した実験対象（`asset` / `migration` / `quantified`） |
| `exploration` | `null` | 探索枠（`stage: candidate` の価値型） |
| `legacy-transition` | `null` | 方針導入前の未公開ドラフトを束ね直した記事。**実験判定には使わない** |

`experimentId` は契約で必ず明示する。省略を実施中の実験で自動的に埋めると、
仮説を検証していない記事（探索枠・旧ドラフトの書き直し）がB群に混ざって判定が汚れる。
`register-article.mjs` は省略を exit 2 で棄却する。

### 未公開ドラフト33本の扱い

方針導入時点で `published: false` のドラフトが33本ある。タイトルの正規表現ではなく本文を読んで
分類した結果、**24本（73%）が deprecated な型**だった（内訳と根拠は `strategy/draft-inventory.md`、
束ね方は `strategy/legacy-transition-plan.md`）。当初「約1/3」と見積もっていたのは
タイトルのヒューリスティックを鵜呑みにしたためで、実数はその倍だった
（「〜検証した」「〜話」）。これらは**そのまま公開しない**。

- 同じ `readerDecision` に寄与するものを3〜5件束ね、`asset` / `migration` / `decision` に
  再設計して、新しい slug・新しい契約で出す
- `arm: "legacy-transition"`、`experimentId: null` で登録する
- 束ねても持ち帰る成果物が作れないもの、対象バージョンが古すぎるものは**公開せず保管のまま**

## 実験の枠組み

同時期A/Bはやらない。現行型（`boundary-verification`）は57本で5いいね以上が0本なので、
対照群に新規6〜8本を割くのは負け筋に生産枠を捨てる行為。よって:

- 新規記事は全部新方針に振る
- 過去57本を**歴史的対照群**（`arm: "historical-control"`）として使う
- 交絡（Zenn全体のトレンド変動・季節性）は、同時期・同トピック市場コホートとの**相対順位**で補正する
- 対照群のD30値は復元できないので、現在値（生涯累積）を保守的な上限として扱う
  → 対照群に有利な向きの誤差なので、新方針が勝った場合の結論は強くなる

実験定義は `experiments/EXP-*.json` に事前登録する。仮説・割り付け・本数・指標・停止条件を
公開前に固定するのが目的。

## この仕組みで言えないこと

- **露出（インプレッション）**: Zenn自身のPV/インプレッションは非公開でAPIから取得できない。
  自前のGA4で取れるのは「記事ページへの到達」だけで、フィードや検索結果に何回表示されたかは
  分からない。「到達が低い」までは言えるが、その原因が露出なのかタイトルなのかは分けられない。
- **過去記事のD30いいね率**: GA4から過去記事のD30**到達**は復元できるが、D30時点の
  **いいね数**は復元できない（`current-upper-bound` = 今日までの累積しか無い）。
  よって過去分は到達の分析にしか使えない。片側だけ救える論法は
  `experiments/EXP-GA4-DIAG-001.json` の `oneSidedTrick` に書いてある
  （分子が過大なので「率が低い」は結論に使えるが「率が高い」は使えない）。
- **窓ごとのユニークユーザー数**: 日次 `totalUsers` の合計は user-days であって
  ユニークユーザー数ではない。記事ごとに30日窓のレポートを別途投げないと出ない。
- **タイトル単体の効果**: 57本中55本が35文字以上で、短いタイトルは2本しかない。
  効果を判定できるデータが無いので独立した実験にはせず、契約側の定性ルールだけ課している。
- **ループ導入前のD30**: 復元できない。`basis: "current-upper-bound"` と記録され、順位は付かない。
- **流量が多すぎるトピックのD30**: `ai` のように1日70本以上流れるトピックは、深いスイープでも
  46日前に届かず `d30-45` が埋まらない。測れないので `primaryTopic` に使わない。

## 運用

```bash
# 日次: 収集（自分＋市場の最新ページ）→ 観測レポート更新
bash scripts/analytics/fetch-zenn-metrics.sh
node scripts/analytics/build-topic-feedback.mjs

# 週1（必須）: 市場を46日分まで遡る。これをやらないとD30順位が永久に出ない
bash scripts/analytics/fetch-zenn-metrics.sh --deep

# 記事の公開前: 契約を事前登録（未登録の記事は改善ループの学習対象にならない）
node scripts/analytics/register-article.mjs --from-research research/search-topic-<日時>.md

# 実験の判定と方針提案（提案が出たらPRにして人間がマージ）
node scripts/analytics/evaluate-policy.mjs

# 全部まとめて
bash scripts/auto-improve-topics.sh                   # 収集＋レポート
bash scripts/auto-improve-topics.sh --deep            # ＋深いスイープ
bash scripts/auto-improve-topics.sh --evaluate --pr   # 判定して提案PRまで（policyへ実差分を書く）
```

`--pr` は `evaluate-policy.mjs --apply` を呼び、**ブランチ上の policy に実際の差分を書く**。
提案文書だけのPRはマージしても何も変わらないので、承認の意味が無くなる。
policy が変わるのは人間がそのPRをマージしたときだけ、という原則は保たれている。

launchd での定期実行は `config/launchd/com.zenn.improve-topics.plist`。
