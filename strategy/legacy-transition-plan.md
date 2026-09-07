# 未公開ドラフト24本の再設計方針（legacy-transition）

対象: `strategy/draft-inventory.md` で `deprecated` に分類された24本
（`boundary-verification` 18 + `incident-log` 6）。

出力は **5つの束 + 単独で作り直す5本 = 10記事**、加えて既存の公開可能記事1本を証拠で強化する。

## 先に制約

**この10本は EXP-001 の証拠にならない。** 実験の設計が事前にそう決めている。

```
experiments/EXP-001.json  design.treatment.constraints
  "既存の未公開ドラフトを書き直した記事はこの実験に入れない（arm: legacy-transition で別群にする）"
```

したがって契約は全部 `arm: "legacy-transition"` / `experimentId: null` で登録する。
理由は、これらが新policyのスコアリングで選ばれた記事ではなく、旧プロセスで選ばれたものを
後から形だけ整えたものだから。B群に混ぜると「仮説を検証していない記事」で判定が汚れる。

**EXP-001 には別途、新規に選定した `B-payload` 12本が必要。** この再設計はその代わりにならない。
ここでやるのは3つだけ。

1. 書いた検証を捨てない
2. 対照群と同じ型（5いいね0本）の在庫をこれ以上増やさない
3. 公開すればGA4の到達データは増える（`arm` に関係なく計測される）

## 市場からの根拠

`analytics/topic-feedback.md` 節1（上位61本）の実測。

| 価値型 | 本数 | 平均いいね | 最大 |
|---|---:|---:|---:|
| `asset` | 12 | 91.5 | 664 |
| `mental-model` | 10 | 37.5 | 178 |
| `boundary-verification` | **1** | **0.0** | 0 |

束ね先は原則 `asset`、次点 `mental-model`。上位61本に `boundary-verification` は1本しかなく、
しかも0いいね。これは選抜済みサンプルなので「その型の期待値」ではないが、
**上位に入る型として現れない**ことは読める。

---

## 束1: Claude Code の deny ルールが実際に塞ぐ範囲 → `asset` ✅ 執筆済み

**成果物**: `articles/claude-deny-regression-kit.md`（`published: false`）+ `scripts/claude-deny-regression-check.mjs`
**契約**: `analytics/contracts/claude-deny-regression-kit.json`（`asset` / `arm: legacy-transition` / 登録済み）

| | |
|---|---|
| 対象読者 | `permissions.deny` でシークレットを守りつつ `claude -p` を CI で無人実行しているメンテナ |
| readerDecision | Claude Code を上げてよいかを、changelog ではなく自分の環境の exit code で決められる |
| takeaway | 依存なし1ファイルの回帰チェックキット（約30秒・$0.12・回帰時 exit 1）と 2.1.261 実測の対応表 |

材料（3本を吸収）:

- `claude-read-deny-redirect-boundary` — 許可リスト外コマンドへの `<` リダイレクト
- `claude-write-deny-rule-skip-read-verify` — read-skip対象モデルからの未読ファイル上書き
- `claude-grep-glob-symlink-deny-still-blocks` — Grep/Glob の探索起点がsymlink

**当初計画から1本移動した。** `claude-dangling-bash-operator-approval-boundary` は
**束2へ移す**（Codex 指摘）。他3本が `deny` ルールの検証なのに対し、あれは `allow` リストの
prefix マッチと `dontAsk` の話で、読者が触る設定キーが違う。同じ表に混ぜると
「deny をこう書けばここまで塞げる」という主張の対象が曖昧になる。

**方針変更（当初計画との差分）**: 「設定集」ではなく「実行できる回帰キット」にした。
実測して分かったのは、この3本の価値が「2.1.261 でどうだったか」ではなく
**「あなたのバージョンで今どうかを30秒で出せること」**にあったこと。
バージョン依存の対応表は書いた瞬間に古くなるが、キットは古くならない。

実測（2.1.261）: 3経路4チェックとも deny 有効。$0.1178 / 約30秒。
回帰検出も確認済み（意図的に壊したキットで exit 1・実際の secret 漏洩を検出）。

## 束2: CIで無人実行するときの権限設定 → `asset` ✅ 執筆済み

**成果物**: `articles/claude-ci-permission-preflight-kit.md` + `scripts/claude-ci-permission-preflight.mjs`
**契約**: `analytics/contracts/claude-ci-permission-preflight-kit.json`（`asset` / `arm: legacy-transition` / 登録済み）

材料（4本を吸収。束1から1本移動）:

- `claude-bypass-permissions-settings-drop`
- `claude-restricted-mode-drops-project-hooks`
- `claude-settings-doctor-bash-wildcard-rule-check`
- `claude-dangling-bash-operator-approval-boundary`（束1から移動）

2.1.261 で全部取り直した。4本とも再現したうえで、**元記事に無かった発見が3つ**出た。

1. **`--settings` のインラインJSONなら `bypassPermissions` が効く。** 同じJSONでも
   ファイルに置くと無視される。CHANGELOG が挙げる回避策（user/managed settings、
   `--permission-mode`）にこれは入っていない。設定を「データのまま」渡せるので、
   CI では一番使いやすい。
2. **信頼されていないワークスペースでは `permissions.allow` が丸ごと捨てられる。**
   警告は stderr に1行だけ。`git clone` 直後のCIランナーは定義上ここに当たるので、
   「ローカルでは効くのにCIでは効かない」の説明がつく。**この束で一番CIに刺さる。**
3. **`claude doctor` は壊れたルールを名指しするのに全パターンで exit 0。**
   メッセージの質は高い（ファイル名・JSONパス・Suggested fix つき）のに、
   CIが読む経路には届かない。束5の codex doctor と完全に同じ構図だった。

`ls` / `pwd` が allow 無しで通る（`ls /etc` は拒否）ことも実測できたので、
「allow リストが与えた権限のすべてではない」として節を1つ立てた。

## 束3: 効かない環境変数と、効いたことの確認方法 → `asset` ✅ 執筆済み

**成果物**: `articles/claude-env-effect-check-kit.md` + `scripts/claude-env-effect-check.mjs`
**契約**: `analytics/contracts/claude-env-effect-check-kit.json`（`asset` / `arm: legacy-transition` / 登録済み）

材料（4本を吸収）: `claude-subagent-model-force-precedence-gap` /
`claude-tool-memory-limit-macos-gate` / `claude-configdir-override-memory-path-gate` /
`claude-debug-api-cache-control-gap`

2.1.261 で4本とも再現。計画では「代替の確認手段を1つ提示する」としていたが、
実測して分かったのは**確認手段が2か所しかない**ことだった。
`stream-json` の `init` イベントと最終 `result` イベント。それ以外は無い。

そこで記事の骨格を「変数ごとの対応表」から「観測面そのものの説明 + 差分ツール」に変えた。
キットは任意の環境変数について control/treatment を回し、`init` の全フィールドと
`result.modelUsage` と stderr を突き合わせる。読者の変数にも使える。

元記事に無かった発見:

- **`init.agents` には subagent の名前しか載らない。** モデルは入っていないので、
  subagent 系の変数を `init` で確認しようとすると永久に差が出ない。
  実際に1回起動して `result.modelUsage` を見るしかない（キットの `--agent` はこれ）。
- **`CLAUDE_CONFIG_DIR` は `model` の既定値・`skills`・`slash_commands` まで移す。**
  「ログインが壊れた」は症状の一部で、実体は状態ツリーごとの差し替え。
  裏返すと**実機を汚さない隔離セッションが作れる**ので、この記事自身の検証に使った。
- `--debug api` は `cache_control` を0件しか出さないが、`result.usage` には
  `cache_read_input_tokens` も TTL 別内訳も入っている。**確認したいことは取れる。取れる場所が違う。**

## 束4: プラグイン/ツールが出てこない時に見る場所 → `asset` ✅ 執筆済み

**成果物**: `articles/claude-plugin-visibility-kit.md` + `scripts/claude-plugin-visibility-check.mjs`
**契約**: `analytics/contracts/claude-plugin-visibility-kit.json`（`asset` / `arm: legacy-transition` / 登録済み）

材料（3本を吸収）: `agent-plugins-spec-claude-code-half-load`（30.5k字・骨格） /
`claude-plugin-archive-loopback-block` / `claude-toolsearch-disabled-tool-boundary`

**再検証で結論が3つひっくり返った。** 骨格にした1本目は `2.1.227` で、手元は `2.1.261`。

| 元記事の結論 | 2.1.261 |
|---|---|
| 仕様準拠レイアウトは `validate` が exit 1 で落とす | **通る**（exit 0） |
| manifest の `name` が無言で捨てられる | **捨てられない**。skills も出る |
| MCP がログに1行も出ない | 原因が判明: **ファイル名。** `mcp.json` ではなく `.mcp.json` |
| `source: Invalid input` は loopback ブロックの証拠にならない | `marketplace add` は `ECONNREFUSED` を出す（**証拠になる**）。一方 `--plugin-url` は**文言そのものが出ない** |
| ToolSearch は無効化ツールを救わない（TodoWrite で検証） | TodoWrite がそもそも `--tools` に存在しない。**未知名は黙って除去される**として一般化 |

計画には「`claude-plugin-archive-loopback-block` の結論（エラー文言は原因の証拠にならない）を
切り分け表に組み込むこと」と書いていた。組み込んだが、**適用先が入れ替わっていた**ので
その旨を記事内で明示的に訂正した（`:::message alert` の節）。

残った共通構造は「**失敗経路がほぼ全部無言で、真実は `init` イベントにしかない**」。
表は症状 → 見る場所 → よくある原因の3列にした。
MCP は `init.mcp_servers` に名前が出るかどうかが「配置の問題」と「起動の問題」の分水嶺になる。

## 束5: codex の自己申告をどこまで信じるか → `asset` ✅ 執筆済み

**成果物**: `articles/codex-selfreport-preflight-kit.md`（`published: false`）+ `scripts/codex-selfreport-preflight.mjs`
**契約**: `analytics/contracts/codex-selfreport-preflight-kit.json`（`asset` / `arm: legacy-transition` / 登録済み）

材料（3本を吸収）:

- `codex-features-removed-stage-effective-true`
- `codex-rollout-budget-strict-config-reject`
- `codex-doctor-term-dumb-network-gate`

**再検証が必須だった。** 元3本は全て `codex-cli 0.147.0`、手元は `0.152.1`。
取り直した結果、一致したもの・強くなったもの・**消えたもの**があった。

| 観測 | 0.147.0 | 0.152.1 |
|---|---|---|
| `removed` かつ `effective: true` | 8件 | 9件 |
| `stable` かつ `effective: false` | 未計測 | **4件**（逆方向も外れると判明。元記事より強い主張になった） |
| `rollout_budget` の設定 | thread 未起動・文言なし | エラーが要求するキーを足すと別のエラーで拒否 |
| `TERM=dumb` で `terminal.env` が fail | fail | **fail にならない**（症状消失。元記事の前提が成立しない） |
| `doctor --json` の構造 | 入れ子 | フラットマップ + `schemaVersion` |

元記事が「そのままCIで再利用できる」として配っていた `flatten()` ヘルパは、
`0.152.1` のスキーマで `details` の中まで降りて実在しないチェックを1件拾う。
**配った資産が壊れていた**ので、キット側では `checks` を直接引くよう直した。

新たに見つけた3つ目のギャップ: **未知の機能名は `features list` を素通りする**（exit 0）。
弾けるのは `codex exec --strict-config` だけで、そちらは設定が正しいとターンを1回消費する。
無料で確かめられる範囲と有料の範囲が違うので、キットは既定で無料側だけを回し、
`--smoke` を付けたときだけ課金経路に進む。

実測（0.152.1）: 受理されない設定 → exit 1（無料）、typo → `--smoke` で exit 1、正常系 → exit 0。

## 吸収: ブラウザ検証が起動ゲートで死んだ2本 ✅ 完了

- ~~`css-tree-counting-sandbox-gate`~~ — 削除。`claude-sandbox-loopback-eperm-check` に吸収
- ~~`chrome151-soft-navigation-localhost-gate`~~ — 削除。同上

`claude-sandbox-loopback-eperm-check`（`mental-model` / `arm: legacy-transition` / 契約登録済み）に
`## 同じ読み違いが成立しかけた別の2件` を追加した。検証項目は3件→5件。

吸収の形は当初計画どおり「証拠として足す」。ただし足し方は変えた。
2本を要約して並べるのではなく、**元記事の中心主張の反例側に置いた**。

- chrome151: `ERR_CONNECTION_REFUSED` が出ているのに listener の生存記録が無い
  → 文字列は元記事の `connect EPERM` と同種に見えるが、socket 拒否とは読めない
- css-tree: 3エンジンとも page 到達前に落ちた
  → 機能問い合わせの0件は「未対応」ではなく「未観測」

そのうえで「記録が揃っているとき / 欠けているとき」の対応表を1つ足した。
元記事は「揃っているとき」の例しか持っていなかったので、対照が付いたことで
主張が表として使える形になった。元の2本は削除した（単独では持ち帰りが無い）。

## 単独で作り直す5本

束ねる相手がいないので個別に組み替える。

| slug | → 型 | readerDecision | 必要な作業 |
|---|---|---|---|
| `astro72-incremental-build-boundaries` | `quantified` | 増分ビルドを有効にすべきかを決められる | 300ページで測った数値をタイトルに出せる形へ。失効条件と非失効条件を表に |
| `bun-markdown-marked-sanitize-boundary` | `migration` | `marked` から `Bun.markdown` へ移れるかを決められる | 7入力を網羅の形へ増やし、**置換可否に答えを出す**（現状は「判断できない」で終わっている） |
| ~~`hono-query-method-curl-fetch-browser`~~ → **`hono-query-vs-get-body-decision`** ✅ | `mental-model` | GET+body / QUERY をいま採用してよいかを決められる | **完了**。28.8k字 → 6.4k字。時系列を全部捨て、3経路×3メソッドの表に組み替えた |
| ~~`bumblebee-supply-chain-scan-try`~~ → **`bumblebee-catalog-preflight-kit`** ✅ | `asset` | Bumblebee を入れてよいか、入れるなら何を一緒に用意するかを決められる | **完了**。検証項目は7件確保できた。試行ログ → カタログが発火するか判定するキット |
| ~~`wrangler-local-explorer-tracing-try`~~ → **`wrangler-trace-query-kit`** ✅ | `asset` | ログインなしの Local Tracing を使ってよいか、何を書けば「エラー0件」の嘘を踏まないかを決められる | **完了**。検証項目7件。試行ログ → トレースを正しく引くキット |

下2本は元が試行ログなので、契約の「検証項目3つ以上」を満たせない可能性を懸念していた。
**再検証したら両方7件そろった。** 足りなかったのは検証の数ではなく、
試行ログが「詰まった → 直った」で止まっていて、**なぜ黙って通るのかを詰めていなかった**こと。
そこを詰めると、どちらも同じ形の資産になった（下記）。

## 着手順

0. ~~**束1**（deny ルール）~~ — **完了**。パイロットとしてここから着手した。
   理由は当初の順番（束5が先）から変えた: 束1が一番「実行できる資産」に化けやすく、
   `asset` 型が本当に書けるのかを最小コストで確かめられるから。
   得られた型は「対応表ではなく実行できるキット」で、束2・束3・束5にそのまま使える。
1. ~~**束5**（codex 自己申告）~~ — **完了**。改稿量が最小という当初の見立ては外れた。
   元3本が `0.147.0` で、手元が `0.152.1`。再検証が必須で、症状が1つ消えていた。
   **教訓: 束ねる前にバージョンを揃えて取り直す。** 残りの束も同じ扱いにする。
2. ~~**吸収**（ブラウザ2本）~~ — **完了**
3. ~~束2~~ / ~~束3~~ / ~~束4~~ — **全束完了**。
4. ~~単独 `astro` / `bun` / `hono`~~ — **完了**。3本とも Hono 4.13.7 / Astro 7.3.1 / Bun 1.4 で取り直した。
   `hono` では再検証中に**元記事が持っていなかった原因**が出た（下記）。
5. ~~単独 `bumblebee` / `wrangler`~~ — **完了**。両方とも `asset`（キット）として成立した。

### `hono` の再検証で出たこと（元記事に無かった）

元記事は「curl では通るのにボディが届かない」で止まっていて、**どこで捨てられているかを特定していなかった**。
Hono を外した素の `node:http` に同じ curl を投げると 13 バイトそのまま届く。捨てているのは
`@hono/node-server` が `IncomingMessage` を Web の `Request` に変換する箇所で、しかも
`new Request(url, {method:"GET", body})` が `TypeError` を投げるので**そうするしかない**。

つまり `GET` + body を止めているのは fetch 標準の一行で、それが**クライアントとサーバーの両端**に効いている。
これで記事の型が「試したら詰まった話」から「片端を回避してももう片端が残る、という判断の型」に変わった。
小文字 `query` の 400 も、推測で「llhttp が弾いている」と書くのをやめて
`clientError` の `HPE_INVALID_METHOD` を実測で出した。

**教訓: 再検証は『同じ結果が出るか』ではなく『元記事が飛ばした一段を詰められるか』で回す。**

### `bumblebee` / `wrangler` で出たこと — 同じ形が2回出た

両方とも、元の試行ログは「詰まった箇所」を書いて終わっていた。
再検証で詰めたのは**「間違えているのに成功したように見える状態」**のほうで、
2本とも同じ構造だった。

| | 大声で落ちる間違い | **黙って通る**間違い |
|---|---|---|
| bumblebee | スキーマ違い（exit 2） | 版違い / 名前の打ち間違い / ecosystem 違い / `entries: []` / バージョン範囲 → 全部 `exit 0 findings=0` |
| wrangler | `start_time_ms`（SQLITE_ERROR） | `WHERE outcome != 'ok'` が0件 / `json_extract` の素直なパスが全行 NULL |

どちらも **「エラーが無いこと」と「調べられていないこと」が同じ出力になる**。
だから両方のキットが同じ設計に落ち着いた: **陽性対照を内蔵し、
「何も見つからなかった」を証明できないときは合格ではなく exit 2 にする。**

Codex のレビューで、bumblebee 側の初版がまさにこの罠に自分で落ちていたことが分かった
（全エントリが `absent` でも exit 0 を返していた＝何も確かめずに合格を出していた）。
`FIRES` が1件も無い実行を exit 2 に変更。**チェッカーを書くときは、
そのチェッカー自身の陽性対照を先に決める。**

## 数

| | |
|---|---|
| 入力 | 24本（`deprecated`） |
| 出力 | **10記事 + 既存1本の強化 — 全部完了** |
| 削減 | 24 → 10 |
| arm | 全部 `legacy-transition` / `experimentId: null` |
| EXP-001への寄与 | **なし**（別途 `B-payload` 12本が必要） |

EXP-001 の制約に「投稿頻度は対照期間と同水準（月20〜30本ペース）」がある。
この10本と `B-payload` 12本で22本なので、ペースはほぼ維持できる。

## 進捗

| | 状態 | 成果物 |
|---|---|---|
| 束1（deny ルール） | ✅ | `articles/claude-deny-regression-kit.md` + `scripts/claude-deny-regression-check.mjs` |
| 束5（codex 自己申告） | ✅ | `articles/codex-selfreport-preflight-kit.md` + `scripts/codex-selfreport-preflight.mjs` |
| 吸収（ブラウザ2本） | ✅ | `articles/claude-sandbox-loopback-eperm-check.md` に追記、元2本は削除 |
| 束2（CI権限設定・4本） | ✅ | `articles/claude-ci-permission-preflight-kit.md` + `scripts/claude-ci-permission-preflight.mjs` |
| 束3（環境変数・4本） | ✅ | `articles/claude-env-effect-check-kit.md` + `scripts/claude-env-effect-check.mjs` |
| 束4（プラグイン切り分け・3本） | ✅ | `articles/claude-plugin-visibility-kit.md` + `scripts/claude-plugin-visibility-check.mjs` |
| 単独5本 | 未着手 | |

**5つの束で分かった型**（単独5本にも適用する）:

1. **対応表ではなく実行できるキットにする。** バージョン別の表は書いた瞬間に古くなる。
   読者の環境で答えが出るスクリプトは古くならない。
2. **束ねる前にバージョンを揃えて取り直す。** 束5では元3本（`0.147.0`）と手元（`0.152.1`）
   の差で、症状が1つ消えて、新しいギャップが1つ増え、元記事が配っていたヘルパが壊れていた。
   取り直さずに束ねていたら、動かないコードを配っていた。
3. **無料で確かめられる範囲と有料の範囲を分ける。** 束5では未知の機能名の検証だけが
   ターンを消費する。既定を無料側に置き、課金経路はフラグで明示的に選ばせる。
