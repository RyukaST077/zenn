# Zenn の反映は遅い（公開キューの調整根拠）

`published: true` を main に入れても Zenn 側の反映は即時ではない。
公開キューの `retryAfterHours` / `maxAttempts` / `maxPublicationsPer24Hours` は
この実測から決めている。**推測で狭めないこと。**

## まず HTTP ステータスの意味を取り違えないこと

`https://zenn.dev/<user>/articles/<slug>` の応答:

| 応答 | 意味 |
|---|---|
| `200` | 公開されている |
| `403`（`{"message":"この操作は許可されていません"}`） | **Zenn 上に存在するが非公開**（下書き） |
| `404` | Zenn 上にまだ存在しない |

403 を「連携が壊れている」と読むのは誤り。存在しない slug は 404 を返すことで確認できる
（main 上で `published: false` の記事はすべて 403 を返す）。

## 反映時刻の測り方

記事単体APIが Zenn がリポジトリから最後に読んだ時刻を返す。

```
curl -s https://zenn.dev/api/articles/<slug> | jq '.article | {source_repo_updated_at, published_at, body_updated_at}'
```

`source_repo_updated_at` と、その記事の `publish:` コミットが main に入った時刻の差が
反映レイテンシ。公開済み記事すべてについて取れる。

## 実測（2026-09-07 / 公開済み37本）

| 統計 | 値 |
|---|---|
| 中央値 | 12h |
| p75 | 27h |
| p90 | **168h（7日）** |
| 最大 | 638h（26日） |

公開済み記事はどれも `source_repo_updated_at` ≒ `published_at` で、
**Zenn はその記事を公開する瞬間に一度読んだだけ**。日別の読み取り件数は 1〜2 本で、
それ以上にはならない。パイプラインの生産は 1〜2 本/日なので、
Zenn の吸収能力とほぼ同じか、それを上回る。

## ここで一度間違えた記録

2026-09-07 に「Zenn の GitHub 連携が push を反映していない」と診断した。間違い。
根拠にしたのは 403 が6本あることと、記事を触り直す push を1回入れても
403 のままだったこと。実際は:

- 403 は「Zenn 上に下書きとして存在する」＝**連携は動いている**
- 当時の取りこぼし率が高かった（直近7本中5本が未反映）ため、1回の試行では何も判定できない
- retry コミットが記事ファイルを触らないことを「設計上の穴」と判断したが、
  再読込のきっかけは不要だった。必要だったのは待つことだけ

決着させたのは `source_repo_updated_at` の一括取得。
**推測を重ねる前に、Zenn 自身が持っている時刻を取ること。**

## キューの調整

`scripts/zenn-publish-queue.mjs` は先頭1本だけを見て、
`published: true` なのに公開されない記事が `retryAfterHours × maxAttempts` を超えると
`blocked` へ落とす（先頭が後続を人質に取らないため）。この設計自体は妥当。

問題はしきい値だった。当初の `6h × 3 = 18h` は実測 p75（27h）を下回っており、
**まだ待っているだけの記事を恒久的な失敗として捨てていた。**
2026-09-07 時点で `blocked` にあった7本のうち **3本はすでに公開されていた**
（`codex-agents-shared-byte-budget` はコミットの167時間後に公開）。

現在の設定:

| 項目 | 値 | 根拠 |
|---|---|---|
| `retryAfterHours` | 12 | 中央値と同じ間隔で確認する |
| `maxAttempts` | 14 | 12h × 14 = 168h = 実測 p90 |
| `maxPublicationsPer24Hours` | 2 | Zenn が1日に吸収する本数の上限 |

`scripts/test-zenn-publish-queue.mjs` がこの3つを回帰ガードしている
（見切り時間が 168h を下回る、1日あたりの公開が 2 を超える、`blocked` が空でない、のいずれかで落ちる）。

`blocked` に記事を残したまま出荷しない。落とす前に公開APIで実際の状態を確認する。

## 訂正: 校正値は 168h ではなく 156h だった（2026-09-08）

`retryAfterHours * maxAttempts` を諦め時間として書いていたが、これは1窓ぶん過大だった。

`zenn-publish-queue.mjs` の判定順序は次のとおり。

1. `publish` の適用時点で `attempts` が 0 → 1 になる
2. `block` 判定（`attempts >= maxAttempts`）は retry backoff の待機**より前**にある

したがって `attempts` が N に達するのは初回公開から `(N-1) * retryAfterHours` 後で、N 窓後ではない。
`14 × 12h` は 168h に見えて実際は **156h** で、実測 p90（168h）の内側で諦めていた。

- `maxAttempts` を 15 に変更（実待機 168h）
- テストは「回数の積」ではなく `decide`/`apply` を1時間刻みで回し、
  `block` が返るまでの経過時刻が 168h 以上であることを検証する
  （`maxAttempts` を 14 に戻すと `gave up 157h` で落ちることを変異検査で確認）

校正の主張は時間についてのものなので、回数ではなく時間で検証する。
