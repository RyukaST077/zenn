# 公開前レビュー: Vitest 5 RC に上げてみたら、テストより先に npm が落ちた / vitest5-rc-breaking-changes

## レビューの前提

- 対象記事: `articles/vitest5-rc-breaking-changes.md`
- 出典ログ: `logs/run-vitest5-rc-breaking-changes-20260817-0412/execution-log.md`
- レビュー日時: 2026-08-17 04:34
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 4 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - 記事内の数値・回数が本文どうしで食い違っている箇所が3つある（peerDependencies の個数、`.vitest/` 検証の経路数、外した予想の内訳）。いずれも記事内の別の記述または出典ログと突き合わせると誤りが確定できる。
  - `clearMocks` 逃げ道の節で、コードフェンスのファイル名と直後の `--config` 引数が別ファイルを指している。
  - 公開安全（`published: false` / slug / 秘密情報 / 画像参照）は問題なし。blocker は 0。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「テストより先に npm が落ちた」節 L218 — `peerDependencies は13個` → **`12個`**。直上の L80-93 に引用している `npm view` 出力の peer は 12 件（vite / jsdom / happy-dom / @vitest/ui / @types/node / @edge-runtime/vm / @opentelemetry/api / coverage-v8 / browser-preview / coverage-istanbul / browser-playwright / browser-webdriverio）。読者が数えられる位置に正解が載っているので、そのままだと目立つ。
2. [warning] 「8項目の結果まとめ」L625 — 「C は…、G は再現せず、H は…片方だけ。**予想を3つ外した**」の内訳が誤り。C の予想（L64: 4.1 は `'math adds'`／5 は `'math > adds'` がマッチ）は**的中**している。実際に外したのは **A（4.1 で警告が出ると予想 → 出なかった。L396 で本文自身がそう書いている）・G・H** の3つ。C を外した予想として数えない文面に直す。
3. [warning] 「G: `.vitest/` ディレクトリ」L553 — 「試した**3経路**では出なかった」が L537「**4経路**試しました」・L622「再現せず（**4経路**で確認）」と矛盾。L539-544 の表は4行（json / junit / coverage / キャッシュ）なので **`4経路` に統一**する。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「テストより先に npm が落ちた」L218 | peerDependencies の個数が引用出力と合わない（記事は13個、引用は12件） | `peerDependencies は13個あって` → `peerDependencies は12個あって` | 記事 L80-93 の `npm view vitest@rc` 出力（実測）。出典ログ L98-111 も同じ12件（ログ本文の「13個」も同じ誤り） |
| 2 | 「8項目の結果まとめ」L625 | 「予想を3つ外した」の内訳に C が入っているが、C の予想は的中している | 例: 「A は 4.1 で警告が出ると思っていたのに無言だった、G は再現せず、H は変わったのが WORKER_ID の片方だけ。予想を3つ外したことになります。」とし、C は「落ちるのではなくフィルタのマッチ先が入れ替わるだけ（終了コード 0）」として別文に切り出す | 記事 L64（C の予想）と L456-457（C の実測）が一致。出典ログ「一番の収穫」L41-42 が外した3つを A の警告・H の POOL_ID・G の `.vitest` と明記 |
| 3 | 「G: `.vitest/` ディレクトリ」L553 | 経路数が L537・L622 と食い違う（3 vs 4） | `「試した3経路では出なかった」` → `「試した4経路では出なかった」` | 記事 L539-544 の表が4行。出典ログ「詰まった点」#4 が「4経路を試して記録」 |
| 4 | 「B: `clearMocks` の既定が true に」L427・L433 | コードフェンスのファイル名 `vitest.config.ts` と、直後のコマンドの `--config vitest.escape.config.ts` が別ファイルを指している。しかも L400 で「`vitest.config.ts` を書かない」と明言しているため、読者が矛盾に見える | フェンス情報を ` ```ts:vitest.escape.config.ts ` に変更する（`vitest.config.ts` として置くと他の項目の検証条件を壊す、という一文を添えるとなお良い） | 出典ログ 4-1「設定ファイルなら効く」の実行コマンドが `--config vitest.escape.config.ts`。記事 L400 の「`vitest.config.ts` を書かない」条件 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L163 / L263 / L591 の `RUN vX /Users/.../vitest5-check` | 「全文」と銘打った端末出力のうち、実際の作業ディレクトリ（`fixtures/vitest5-rc-breaking-changes`）を記事の再現手順に合わせて `vitest5-check` に書き換えている | 「以降のログはホームパスをマスクし、ディレクトリ名を再現手順の `vitest5-check` に揃えています」と一言添えると、貼ったログの改変が意図的だと伝わり信頼性が上がる |
| 2 | 「F: `toThrow('')` が任意一致に」L520-531（after ブロック） | after のコードで `boom` を使っているが、定義は before ブロックにしかない | after 側にも `function boom(): never { throw new Error('boom happened') }` を残すと、ブロック単体でコピーして動く |
| 3 | 冒頭 L9 の `<!-- 前提: 出典ログ ... -->` | 前提コメントが残っている（既存の公開済み記事も同様に残しているため慣行どおり） | 意図的な運用なら現状維持で問題なし。消す運用に寄せるなら公開前に削除 |
| 4 | 「H: worker/pool ID が1始まりに」L570 | 「5 に上げて変わったのは `VITEST_WORKER_ID` だけ（0 → 1）」の 5 側の実測値が本文に出ていない（表 L623 にはある） | この節にも 5.0.0-rc.1 の `VITEST_WORKER_ID=1` / `VITEST_POOL_ID=1` の実測行を1行足すと、片方だけ変わった話が節内で完結する |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug 27文字・具体的・ローカル重複なし（`vitest4-browser-mode-...` とは別）。鍵・トークン・接続文字列なし。ローカルパスは全て `/Users/.../` にマスク済み |
| Front Matter | OK | title 36文字（script の74は**バイト数**での誤検知）、type=tech、topics 5個、emoji 1つ。誇大表現なし |
| 事実性（ログ照合） | 要修正 | 実行コマンド・エラー全文・所要時間・終了コードはすべてログに裏付けあり。数値の食い違いが3件（warning 1〜3） |
| 画像 | OK | 画像参照なし。出典ログもスクショ0枚（CLI 完結）と明記しており整合する |
| Markdown構造 | OK | フェンス74行で閉じ、`:::` 8行で閉じ、H2 のみで階層破綻なし、参考リンク2件あり |
| 文章品質・トーン | OK | 経験談トーン。詰まった点（npm クラッシュ・F の `.not`・G 再現せず・H の予想外れ）を全て記載。再現環境と検証日、RC 注記あり |
| 完成度 | 要修正 | `要素材`・プレースホルダの残存なし。warning 4 の記述矛盾のみ |

## 事実整合の照合結果（ログとの突合）

- 結論: 記事「8項目中5項目が落ちて、全部直せました」「G は再現せず」 ↔ ログ「完了条件の判定: **達成**」「落ちたのは A・B・D・E・F の5項目」「項目G: 未達（再現せず）」 → **一致**
- 主要な数値・出力の照合（すべてログに裏付けあり）:
  - dist-tags / engines / peerDependencies の引用（L18-101）↔ ログ フェーズ1-2 の出力全文 → 一致
  - `added 44 packages ... in 18s`、`8 passed (8)` / `Duration 1.45s`、exit 0 → ログ 2-2・3-8 と一致
  - `Cannot read properties of null (reading 'edgesOut')`、7秒・exit 1、arborist スタックトレース、切り分け5行の表 → ログ 3-9 と一致（ログは `consult-knowledge` 検索を含む6試行、記事は内部作業のその1行を除いた5試行。妥当な省略）
  - `5 failed | 3 passed (8)` / `Tests 3 failed | 3 passed (6)` / exit 1、失敗5件のエラー全文 → ログ 3-10 と一致
  - `-t` の2×2 表と両バージョン exit 0 → ログ 3-3・4-2 と一致
  - `--clearMocks` の `CACError: Unknown option` → ログ 4-1 と一致
  - `.vitest/` の `find` / `ls` 出力 → ログ 4-3 と一致
  - `VITEST_WORKER_ID=0` / `VITEST_POOL_ID=1`（4.1）、5 で WORKER_ID=1 → ログ 3-7・項目別結果表と一致
  - `8 passed (8)` / `9 passed (9)` / `1.45s → 1.51s`、Duration 表示形式の変化 → ログ 4-4 と一致
  - チェックリスト（L641-661）→ ログ「コピペ用チェックリスト」と逐語一致
- ログを超えた断定: なし。速度については「この規模では速度の話はできません」、G については「試した経路では出なかった以上のことは言えません」と、いずれもログの慎重な結論をそのまま維持している
- 創作の疑いがある記述: なし（コードブロックはすべてログ収録の fixture / 出力由来）
- ログ側にあって記事に無く、書き足す価値がありそうな一次情報（任意）:
  - `npm test` と `npx vitest run` の出力差はバナー2行のみ（ログ 2-6）
  - 見積もり 435分に対する実測（ログ 12分）は**AI単独の値**でありログ側に「記事にそのまま書かない」と注記があるため、記事が所要時間を書いていないのは**正しい判断**
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/vitest5-rc-breaking-changes.md (slug=vitest5-rc-breaking-changes) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=27 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 74文字 (60字目安)
[PASS] emoji あり: 🧪
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=74
[PASS] ::: ブロックが閉じている: 8 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 163,165,186,263,284,591
SUMMARY fail=0 warn=2
```

機械チェックの WARN 2件は、いずれも目視で **false positive** と判断した:

- `title が長い: 74文字` … 74 は**バイト数**。実際の文字数は 36 文字で、60字目安を大きく下回る。指摘に採用しない。
- `秘密情報の疑い [user-path]` … 該当6行すべて `/Users/.../` の形にマスク済みで、ユーザ名・ホスト名・社内情報は露出していない（L186 の npm デバッグログのパスも `/Users/.../.npm/_logs/...`）。公開安全上の問題なし。ただしマスクの旨を明記すると親切（suggestion 1）。

## 適用した修正

なし（レポートのみ・記事本文は未変更）。

## 次のアクション

- [ ] warning 1〜4 を直す（`/revise-article` で本レポートを渡すと機械的に片付く粒度）
- [ ] suggestion は任意。1（マスクの明記）と 2（after ブロックの `boom` 定義）は低コストで効果あり
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で `published: true` にして PR を作成（「サイト内で既に使用されています」が出たら slug を具体化。`knowledge/2026-07-01-zenn-slug-already-used.md`）
