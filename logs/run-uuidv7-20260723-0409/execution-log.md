# 検証ログ: Node 26 の `randomUUIDv7()` と `randomUUID()`(v4) を書き比べ、SQLiteの並び順で違いを見る

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・出力）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-uuidv7-20260723-0406.md`
- 出典レポート: `research/search-topic-20260723-0403.md`
- 対象技術: Node.js 26.1+ の `crypto.randomUUIDv7()` / `crypto.randomUUID()`(v4) + `node:sqlite`（`DatabaseSync`）
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-23 04:08〜04:14 / 見積もり 4.0h → 実測 約0.5h（AI単独・待ちなしのため短い）
- 実行環境: macOS (Darwin 25.5.0, arm64) / **Node v26.5.0**（当初の既定は v22.17.0 → nvm で 26.5.0 に切替）/ npm 11.17.0 / 追加ライブラリなし
- 採用した撤退ライン: 1タスク30分で詰まったら記録して次へ。Node 26.1+ か `node:sqlite` が用意できなければ中止しテーマ2へ（→ 回避できたので発動せず）
- 判断方針: 引数はタスクパスのみ指定。時間・撤退ラインはデフォルト採用

## 結果サマリー

- 完了条件の判定: **達成**（3スクリプト＋追加2本がエラーなく実行、v4/v7差が数値で観測、timestamp復元誤差0ms、results.md完成）
- 作ったもの: 依存ゼロの検証スクリプト5本 + `results.md` + `uuid-order.sqlite`（`workspace/`）
- スクショ: 0枚（CLI/生成ファイルのみで判定。ブラウザ表示が無いため Playwright 不使用＝タスク前提どおり）
- 詰まった点: 3件（うち解決3 / 未解決0）※撤退0
- knowledge 記録: なし（既知の手順内で解決。新規トラブル報告に値する未記録の詰まりは無かった）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / ファイル） |
|---|---|---|---|
| 1 | 3スクリプトが `node <file>.mjs` でエラーなく実行され、比較結果が標準出力に出る | 達成 | commands.log「PHASE 3-1/3-2/3-3」 |
| 2 | v4は辞書順ソートで生成順とほぼ一致せず、v7はほぼ一致、という差が数値で観測できる | 達成（条件付き） | SQLite: v7=100% / v4=0.20%（PHASE 3-3）。※tight loopでは v7=0.30% と崩れる→4節で解明 |
| 3 | v7のtimestamp復元値が生成時刻と数ms〜数十ms以内で一致 | 達成 | extract-ts: 最大誤差 **0ms**（PHASE 3-2） |
| 4 | `results.md` に3項目の結果表と「詰まった点」が埋まっている | 達成 | `workspace/results.md` / `results.md` |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査

- [x] `node -v` で 26.1+ 確認（見積もり5分 → 実測 約3分。既定 v22.17.0 → nvm で 26.5.0 へ）
  - 実行したコマンド:
    ```bash
    node -v            # → v22.17.0（randomUUIDv7 未実装）
    node -e "const c=require('crypto');console.log(typeof c.randomUUIDv7)"  # → undefined
    export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
    nvm ls-remote 26   # v26.0.0 〜 v26.5.0
    nvm install 26.5.0 && nvm use 26.5.0
    node -v            # → v26.5.0
    ```
  - 出力 / エラー（全文）:
    ```
    v22.17.0
    undefined
    ...
    v26.5.0 *   （ls-remoteの最新）
    Now using node v26.5.0 (npm v11.17.0)
    ```
  - 効いた対処 / 試したこと: nvm がインストール済みだったので `nvm install 26.5.0`。volta/fnm/n は未導入、brew はあるが nvm が最短だった
  - つまずいた理由・分かっていなかった前提: `randomUUIDv7` は 26.1.0 追加。手元の既定 Node が古いと **関数ごと存在しない**（`is not a function` 以前に `undefined`）
  - 記事に書きたい気づき: 「バージョンを冒頭で明記」の重要性。26.0 以下では動かない一次証拠

- [x] `randomUUIDv7` の仕様確認（stable / 警告有無 / options引数 / 非単調クロック注意）（見積もり15分 → 実測 約5分）
  - 実行したコマンド:
    ```bash
    node -e "const c=require('node:crypto'); console.log('typeof v7=',typeof c.randomUUIDv7,'v4=',typeof c.randomUUID)"
    node -e "const c=require('node:crypto'); console.log(c.randomUUIDv7.length); console.log(c.randomUUIDv7({disableMonotonicity:true}))"
    ```
  - 出力 / エラー（全文）:
    ```
    typeof randomUUIDv7 = function
    typeof randomUUID   = function
    randomUUIDv7.length = 1
    options受理OK: 019f8b3c-21e2-7cc5-b650-7687793d436d
    ```
  - 効いた対処 / 試したこと: `.length===1` で options 引数の存在を確認。`{disableMonotonicity:true}` が例外なく受理されることを実行で確認
  - つまずいた理由・分かっていなかった前提: 実行時警告は一切出ない（stable）。**options に `disableMonotonicity` が実在する**＝Nodeが単調性の概念を持つことがここで分かった（→フェーズ4で実測）
  - 公式ドキュメントの一次確認: `https://nodejs.org/docs/latest/api/crypto.html` を WebFetch したが、該当セクションが**取得時に truncate され本文引用できず**。仕様の裏取りは対象タスクの「裏取りメモ」（26.1.0追加/PR #62553・非単調クロック注意/PR #62600）と、上記の自分の実行結果に依拠した。記事化時に公式doc本文を直接確認すること
  - 記事に書きたい気づき: 「stableだが非単調クロックに依存」という注意書きがある一方、APIには `disableMonotonicity` がある。ここは実測で確かめる価値ありと判断

- [x] `node:sqlite` の基本APIとフラグ要否（見積もり10分 → 実測 約2分）
  - 実行したコマンド:
    ```bash
    node --input-type=module -e "import('node:sqlite').then(m=>console.log('typeof DatabaseSync =', typeof m.DatabaseSync))"
    ```
  - 出力 / エラー（全文）:
    ```
    typeof DatabaseSync = function
    ```
    （`--experimental-sqlite` 無し。ExperimentalWarning は**出なかった**）
  - つまずいた理由・分かっていなかった前提: 古い記事では `--experimental-sqlite` が要るとされるが、v25.7 でフラグ不要・警告なしに変わっている（本環境で確認）
  - 記事に書きたい気づき: 「古い記事のコマンドが動かない/余計」典型例

### フェーズ2: 環境構築

- [x] Hello World（v7/v4 を1つずつ出力・バージョン桁確認）（見積もり15分 → 実測 約3分）
  - 実行したコマンド:
    ```bash
    node workspace/hello.mjs
    ```
  - 出力 / エラー（全文）:
    ```
    v7: 019f8b3c-7d73-7643-8eec-8b67199c4a0c
    v4: 41a8c1a0-c58a-4687-9658-b9f0e7a91fec
    v7 version digit (idx14): 7
    v4 version digit (idx14): 4
    typeof randomUUIDv7: function
    ```
  - つまずいた理由・分かっていなかった前提: v7 は先頭がタイムスタンプ由来で `019f8b3c...` と揃う。v4 は完全ランダム。13文字目(index14)がバージョン桁
  - 既存技術と比べて感じた違い: 見た目だけで v7/v4 を判別できる（先頭が時刻順に増えるか否か）

### フェーズ3: 実装・検証【本編】

- [x] `gen-compare.mjs`（辞書順ソート一致率, 各1000件）（見積もり45分 → 実測 約8分）
  - 実行したコマンド:
    ```bash
    node workspace/gen-compare.mjs
    ```
  - 出力 / エラー（全文）:
    ```
    生成件数: 1000 件ずつ
    --- v7 (randomUUIDv7) ---
      辞書順ソート後、生成順と同じ位置: 3/1000 = 0.30%
    --- v4 (randomUUID) ---
      辞書順ソート後、生成順と同じ位置: 0/1000 = 0.00%
    [参考] v7 先頭3件: [ '019f8b3d-5d55-796e-...','019f8b3d-5d55-7ccf-...','019f8b3d-5d55-7c98-...' ]
    ```
  - つまずいた理由・分かっていなかった前提: **予想（v7は高一致率）が外れた**。参考の先頭3件で 7ccf > 7c98 と同一ms内で逆転している。1000件が数msに集中生成され、同一ms内の順序が保証されないため。→ フェーズ4で原因を特定
  - 既存技術と比べて感じた違い: 「v7＝ソート可能」を鵜呑みにすると足をすくわれる。生成ペース依存
  - 記事に書きたい気づき: ナイーブな全体一致テストだと v7 でも 0.3%。ここが記事の入口の“意外性”

- [x] `extract-ts.mjs`（先頭48bit→Unix時刻復元, 誤差）（見積もり40分 → 実測 約5分）
  - 実行したコマンド:
    ```bash
    node workspace/extract-ts.mjs
    ```
  - 出力 / エラー（全文・抜粋 #1）:
    ```
    #1 uuid=019f8b3d-5e08-7334-ab69-5e88222c8a91
        復元ms=1784747482632 (2026-07-22T19:11:22.632Z)
        生成時刻 Date.now(): before=1784747482632 after=1784747482632  範囲外誤差=0ms
    ...
    最大誤差: 0ms（0なら復元値が生成時のミリ秒レンジにぴたり収まった）
    ```
  - 効いた対処 / 試したこと: `uuid.replace(/-/g,'').slice(0,12)` を `parseInt(hex,16)`。RFC 9562 の 48bit unix_ts_ms 定義どおり
  - 既存技術と比べて感じた違い: v7 は主キーから生成時刻が復元できる（v4は不可）。ログ相関やレンジ検索の観点で強い
  - 記事に書きたい気づき: 復元コードは3行。誤差0msで“時刻が埋まっている”ことを体感できる

- [x] `sqlite-order.mjs`（TEXT PK, `ORDER BY id` vs 挿入順, 各1000件, ファイルDB）（見積もり35分 → 実測 約8分）
  - 実行したコマンド:
    ```bash
    node workspace/sqlite-order.mjs
    ```
  - 出力 / エラー（全文）:
    ```
    件数: 1000 件ずつ INSERT / DBファイル: .../workspace/uuid-order.sqlite
    --- v7t: ORDER BY id が挿入順と一致 ---
      1000/1000 = 100.00%  先頭5件のseq=[0,1,2,3,4]
    --- v4t: ORDER BY id が挿入順と一致 ---
      2/1000 = 0.20%  先頭5件のseq=[840,926,599,258,804]
    ```
  - 効いた対処 / 試したこと: `DatabaseSync` + `exec`(DDL) + `prepare/run`(INSERT) + `all`(SELECT)。seq列で挿入順を保持し `ORDER BY id` の位置と突合
  - つまずいた理由・分かっていなかった前提: gen-compare が 0.3% だったのにこちらは **v7=100%**。ファイルDBへのINSERTが生成を遅くし、各IDが別msに分かれたため（→フェーズ4で数値化）。idはTEXT主キー＝**辞書順（文字列比較）**で並ぶ点も明示できた
  - 生成物のパス: `workspace/uuid-order.sqlite`（217KB）
  - 記事に書きたい気づき: 実務ペースの通常INSERTなら v7 の `ORDER BY id` は挿入順と完全一致。v4はほぼ一致しない（0.2%）

### フェーズ4: 深掘り・比較

- [x] 非単調クロックの検証（連続生成の逆転カウント）（見積もり20分 → 実測 約8分）
  - 実行したコマンド:
    ```bash
    node workspace/monotonic.mjs         # 隣接ペアの全文字列逆転（10万件）
    node workspace/verify-monotonic.mjs  # 先頭48bit一致ペアだけに絞って昇順/逆転（20万件）
    node workspace/why-sqlite-100.mjs    # 生成ペースとdistinct ms（1000件, 純生成 vs INSERT付き）
    ```
  - 出力 / エラー（全文・要点）:
    ```
    [monotonic.mjs] 連続10万件の隣接逆転
      既定 randomUUIDv7():                 逆転 49908
      {disableMonotonicity:true}:          逆転 49817
    [verify-monotonic.mjs] 同一ms隣接ペアのみ（20万件）
      既定:                同一msペア199809 / 逆転99983 → 逆転率 50.04%
      disableMonotonicity: 同一msペア199859 / 逆転99875 → 逆転率 49.97%
    [why-sqlite-100.mjs]
      (a) 純生成1000件:        5.76ms / distinct ms 5個（≒200件/ms）
      (b) メモリDB INSERT付き:  16.79ms / distinct ms 13個（≒77件/ms）
    ```
  - つまずいた理由・分かっていなかった前提: **既定でも同一ms内は約50%が逆転**。`disableMonotonicity` を付けても実測差はほぼ無し。Node v26.5.0 の観測では、単調性は（少なくとも同一ms内の狭義の増加としては）効いていないように見えた。SQLiteが100%だったのは単調性ではなく「INSERTが遅く各IDが別msに落ちたから」だと切り分けできた
  - 効いた対処 / 試したこと: 全文字列比較だとタイムスタンプ差の影響が混ざるため、**先頭48bitが同一のペアだけ**に絞って昇順/逆転を数える設計に変更。これで“同一ms内の順序”を純粋に測れた
  - 記事に書きたい気づき（記事の山場）: 「v7はソート可能」は**ミリ秒粒度**の話。同一msに大量生成すると順序は保証されない（本環境50%逆転）。`disableMonotonicity` オプションの有無で実測差が見えなかった点も一次ログとして提示できる（※実装の意図までは断定しない）

- [x] 結果を1表にまとめ、観測範囲を明示（見積もり10分 → 実測 約5分）
  - 生成物: `workspace/results.md`（＝ `results.md` にもコピー）
  - 記事に書きたい気づき: 断定を避け「Node v26.5.0・macOS・約1件/ms という観測範囲では」と前置きする

### フェーズ5: 振り返り・記事化準備

- [x] 詰まった点の棚卸し（下表）／記事への写像を実績で更新（本ファイル末尾）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `randomUUIDv7` が `undefined`（関数が無い） | 既定Nodeが v22.17.0（追加は26.1.0） | nvm で 26.5.0 に切替 | 約3分 | 解決 | 冒頭でバージョン明記の重要性。26.0以下は不可の一次証拠 |
| 2 | v7を辞書順ソートしても生成順と一致しない（0.3%）／連続生成で逆転 | 1000件が数msに集中→同一ms内の順序は保証されない（既定でも50%逆転、disableMonotonicityで差なし） | 先頭48bit一致ペアに絞って計測し原因を特定。生成ペース(distinct ms)で切り分け | 約8分 | 解決 | 記事の山場。「完全にソート可能」の思い込みを一次ログで補正 |
| 3 | gen-compare(0.3%)とsqlite(100%)で逆の結果 | ファイルDBへのINSERTが生成を遅くし各IDが別msに分散したから（単調性ではない） | why-sqlite-100.mjs でペースとdistinct msを実測し因果を確定 | （#2に含む） | 解決 | 「並ぶかどうかは生成ペース依存」という実務的な結論 |

> 予測との差分: 対象タスクの詰まりポイント表は #4「`--experimental-sqlite` が要る誤解」#5「ESM/CJS混在」も挙げていたが、`.mjs`統一＋フラグ無しimportで**未発生**（フェーズ1で先に潰せた）。#3「TEXT主キー＝辞書順」は sqlite-order で実演できた。

## スクリーンショット一覧

なし（ブラウザ表示を伴わないCLI検証のため。完了条件は標準出力・生成ファイルで判定＝対象タスクの前提どおり）。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ファイル | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | v4→v7を自分で確かめた動機。観測範囲の記事だと明示 |
| 2. なぜUUIDv7が話題か | フェーズ1メモ | ソート可能性・DB索引の文脈（一般論、簡潔に） |
| 3. 事前に調べたこと | フェーズ1ログ（typeof/length/options/警告） | 26.1追加・stable・警告なし・options に disableMonotonicity。※公式doc本文は記事化時に直接確認 |
| 4. 環境構築 | フェーズ1(nvm)・フェーズ2(hello.mjs)ログ | v22→26.5切替、`node:sqlite`フラグ不要、Hello World出力 |
| 5. v4とv7を生成して比較 | `gen-compare.mjs` + 出力 | 辞書順ソート一致率 v7=0.3%/v4=0%。予想外の入口 |
| 6. timestamp復元 | `extract-ts.mjs` + 出力 | 先頭48bit→Unix時刻、誤差0ms、3行の復元コード |
| 7. SQLiteで並び順検証 | `sqlite-order.mjs` + 出力 + `uuid-order.sqlite` | v7=100%/v4=0.2%。TEXT PK=辞書順の実演 |
| 8. 詰まった点 | 「詰まった点」表 / commands.log | バージョン差・同一ms逆転・ペース依存 |
| 9. 分かったこと / 比較 | `verify-monotonic.mjs` / `why-sqlite-100.mjs` / `results.md` | 同一ms50%逆転、distinct msでの切り分け、断定回避 |
| 10. まとめ | 結果サマリー / results.md 結論 | ミリ秒粒度で有効・大量同時生成の注意・向いている人 |

## 未達・撤退した項目

- なし（撤退ライン未発動。完了条件はすべて達成）。
- 制約として残ったもの: 公式doc本文の直接引用は WebFetch の truncate で取得できず。記事化時に `crypto.randomUUIDv7` の doc 本文を確認して裏取りすること。

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS (Darwin 25.5.0, arm64) / Node **v26.5.0**（26.1.0以上必須）/ 追加ライブラリなし（`node:crypto` / `node:sqlite`）
- 最短の再現手順:
  ```bash
  nvm install 26.5.0 && nvm use 26.5.0   # randomUUIDv7 は 26.1.0+
  node hello.mjs           # v7/v4 を1つずつ
  node gen-compare.mjs     # 辞書順ソート一致率（各1000件）
  node extract-ts.mjs      # 先頭48bit→Unix時刻の復元誤差
  node sqlite-order.mjs    # TEXT PK の ORDER BY id vs 挿入順
  node verify-monotonic.mjs && node why-sqlite-100.mjs  # 同一ms順序と生成ペース
  ```
- 注意点: v7の並び順は「生成ペース」に依存（≒1件/ms以下なら別msに分かれ整列、同一ms大量生成では約50%逆転）。idをTEXT主キーにすると比較は辞書順。件数(1000)・生成環境で数値は多少ぶれる。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] スクショは無し。コード抜粋・標準出力・results.md の表を本文に貼る
- [ ] 記事化時に公式doc（`crypto.randomUUIDv7` / `node:sqlite` / RFC 9562）本文を直接確認してリンク
