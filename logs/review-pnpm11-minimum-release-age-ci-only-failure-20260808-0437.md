# 公開前レビュー: pnpm 11のminimumReleaseAge既定24hを踏みに行ったら、手元では通ってCIだけ落ちた / pnpm11-minimum-release-age-ci-only-failure

## レビューの前提

- 対象記事: `articles/pnpm11-minimum-release-age-ci-only-failure.md`
- 出典ログ: `logs/run-pnpm11-minimum-release-age-20260808-0411/execution-log.md`（引数で明示指定。記事冒頭コメントの指定とも一致）
- レビュー日時: 2026-08-08 04:37
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開不可（blocker あり）**

- blocker: 1 件 / warning: 1 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - blocker-1: 個人を特定できるローカルパス `/Users/katayamaryuunosuke/...` とユーザー名が本文コードブロックに 7 箇所そのまま残っている。このリポジトリの既存公開記事はすべて `/Users/<user>/` や `/Users/.../` に伏せており、本記事だけが例外になっている。
  - warning-1: 「単一パッケージのプロジェクトでも pnpm 11 は `pnpm-workspace.yaml` を作る」という断定が、同じ記事内のケースB（range 指定では作られなかった）と矛盾している。ログの表現は「作ることがある」。

## 最優先で直すべき指摘（上位3件）

1. [blocker] 本文 L113-L119 / L198 / L265 / L510 — `/Users/katayamaryuunosuke/` を `/Users/<user>/` に、`ls -la` 出力の所有者列 `katayamaryuunosuke  staff` を `<user>  staff` に置換する。
2. [warning] 「CIで気をつけたいこと」節 L540 — 「単一パッケージのプロジェクトでも pnpm 11 は `pnpm-workspace.yaml` を作るので」→「単一パッケージのプロジェクトでも pnpm 11 は `pnpm-workspace.yaml` を作ることがある（今回は exact 指定の `pnpm add` で作られた）ので」に直す。
3. [suggestion] 「はじめに」L30 の「1.37時間」と L178 の表「1.39h」— どちらもログ由来の実測値だが読者には食い違いに見える。L178 の表に「（走査タイミング差で 1.37h → 1.39h）」等の一言を添えるか、どちらかに揃える。

## 指摘一覧（重大度順）

### blocker

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「検証環境」L113,114,116,118,119 / 「exact 指定で踏みに行く」L198 / 「エラーにならないケースがあった」L265 / 「CIで気をつけたいこと」L510 | 個人パス・OSユーザー名 `katayamaryuunosuke` がそのまま公開本文に載る。ホームディレクトリ名は個人特定につながる情報で、リポジトリの既存公開記事（`playwright-passkey-dependency-failure.md` = `/Users/<USER>/`、`bun-sql-sqlite-crud-try.md` = `/Users/<user>/`、`node26-experimental-import-text-try.md` = `/Users/.../`）はすべて伏せている | 該当7行を機械的に置換する:<br>・`/Users/katayamaryuunosuke/Library/pnpm/store/v11` → `/Users/<user>/Library/pnpm/store/v11`（L113,116,198,265,510）<br>・同 `.../store/v10` → `/Users/<user>/Library/pnpm/store/v10`（L114）<br>・`drwxr-xr-x@ 258 katayamaryuunosuke  staff` → `drwxr-xr-x@ 258 <user>  staff`（L118,119）<br>※ L625,627 の `file:///Users/.../pnpm/dist/pnpm.mjs` は既に伏せ済みなので変更不要 | 機械チェック `[WARN] 秘密情報の疑い [user-path]` ＋ 目視 ＋ 既存公開記事の慣行 |

### warning

| # | 箇所 | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「CIで気をつけたいこと」L540 | 「単一パッケージのプロジェクトでも pnpm 11 は `pnpm-workspace.yaml` を作るので」と無条件で断定している。しかし同記事 L276（ケースB / range 指定）では「`pnpm-workspace.yaml` も作られません」と自分で書いており、記事内で矛盾する。出典ログ L692 も「作る**ことがある**」と限定している | 「単一パッケージのプロジェクトでも、pnpm 11 は exact 指定の `pnpm add` のときに `pnpm-workspace.yaml` を作ることがあるので」に直す（range 指定では作られないことは L276 で既出なので、その旨の一言でもよい） | 出典ログ L279 / L692、記事 L276 との内部矛盾 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 「はじめに」L30 と「24時間以内に公開された版を探す」L178 | 同じ `@types/node@26.2.0` の経過時間が 1.37h と 1.39h で揺れている（どちらもログ実測値。走査タイミングの差） | 一言の注記か表記統一で、読者が「どちらが正しいのか」と止まらずに済む |
| 2 | 「SQLiteストアでinstall時間はどうなったか」L456-L461 | 「70パッケージ」と書いた直後に「`package_index` に 68 行 / JSON 68 個」が並び、数のずれの説明がない（ログでも 70 エントリ / 68 行で同じ） | 「`node_modules/.pnpm` は 70 エントリ、ストアの索引は 68 行（直接依存分の差）」のように一言添えると、実データ提示の説得力が落ちない |
| 3 | 「blockExoticSubdeps を踏むまでに3回空振りした」L420-L424 | 引用したエラー出力から、ログにある `This error happened while installing the dependencies of fixture-d-child@1.0.0` の行が落ちている | この1行は「推移依存で落ちた」ことの直接の証拠なので、残すと主張と出力が直結する |
| 4 | 冒頭コメント L9 `<!-- 前提: 出典ログ ... -->` | 消し忘れかの確認 | このリポジトリでは公開済み記事14本すべてが同じコメントを保持しており、**意図的な運用**と判断。対応不要（記録のため記載） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | NG | `published: false` ✓ / slug ✓（42字・具体的・重複なし）/ 秘密情報のうち **個人パス7箇所が blocker** |
| Front Matter | OK | title/emoji/type/topics/published すべて有り。type=tech、topics 5個（pnpm/nodejs/npm/security/ci、すべて英小文字・既存記事でも使用実績あり）、emoji ⏳ |
| 事実性（ログ照合） | OK | 下記「事実整合の照合結果」参照。warning-1 のみ表現の行き過ぎ |
| 画像 | OK | 画像参照なし。出典ログ L23「スクショ 0 枚（すべて CLI 出力のため）」と整合。ターミナル出力を全文引用しており素材不足ではない |
| Markdown構造 | OK | コードフェンス96行（偶数・閉じ）、`:::` 6行（3ブロック・閉じ）、H1なし・H2/H3の階層破綻なし、リンクはすべて実在URL（pnpm公式3本 + pnpm/pnpm Issue 3本）でプレースホルダなし |
| 文章品質・トーン | OK | 予測を外した過程・3回の空振り・grepの早合点まで書かれており経験談トーン。再現性（OS/Node/npm/pnpm3版/日時）は「検証環境」表に明記 |
| 完成度 | OK | `要素材` マーカーなし、TODO/プレースホルダなし、末尾に最短再現手順と未検証項目の列挙あり |

## 事実整合の照合結果（ログとの突合）

出典ログ全701行と本文全710行を突き合わせた。**引用された実行出力・数値は、確認した範囲ですべてログに一致した。**

- 結論（達成/一部/未達）: 記事「予測①②は外れ、③は当たり。素の既定では入る／range は黙って古い版に落ちる／CI のロック検証で落ちる」 ↔ ログ L20「完了条件の判定: 達成（8項目すべて）」・L28「素の既定では*入る*。手元では入るのに CI で落ちる」 → **一致**
- 主要な引用の裏付け（記事 → ログ）:
  - `npm view pnpm dist-tags` 出力（L15-24） → ログ L64-71 一致
  - 新既定の表（L42-53） → ログ L86-97 一致（一次情報の英文引用も含め一致）
  - 版ゲート出力（L86-92） → ログ L113-119 一致
  - `runner.sh`（L99-106） → ログ L128-134 一致
  - ケースA `pnpm add @types/node@26.2.0`（L193-208, exit=0, elapsed_ms=5130） → ログ L202-217 一致
  - ケースA' pnpm 10.13.1（L237-247, elapsed_ms=3651） → ログ L239-249 一致
  - ケースB range → 26.1.2（L260-273, elapsed_ms=3614） → ログ L259-272 一致
  - ケースB' strict / `ERR_PNPM_NO_MATURE_MATCHING_VERSION`（L300-304, cutoff 2026-08-06T19:16:07.950Z） → ログ L292-296 一致
  - ケースC `.npmrc` 無視（L331-336, cutoff ...19:16:29.531Z）と C-4 判別表（L350-354） → ログ L315-319 / L332-336 一致
  - ケースD `ERR_PNPM_EXOTIC_SUBDEP`（L420-424）、`NON_EXOTIC_RESOLVED_VIA`（L394-400）、D-5/D-6/D-7 の言及 → ログ L358-410 一致
  - SQLite ストア（L434-472、`index.db` 1,208,320 bytes / 68行 / `sqlite3 select key` 5件） → ログ L417-467 一致
  - install 時間表 全12値（L484-489） → ログ L446-451 一致。warm 1回目の外れ値（9810ms / 10714ms）と「原因は特定できていない」も一致
  - ケースF `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`（L503-518, cutoff ...19:25:05.568Z）と F-5 で通る（L530-537） → ログ L529-558 一致
  - Issue 突き合わせ表（L546-550, #10438 当てはまらず / #11982 確認できず / #10100 未検証） → ログ L568-572 一致
  - E系（`strictDepBuilds` / `onlyBuiltDependencies` / `allowBuilds` リスト→map / `verifyDepsBeforeRun`）（L556-631） → ログ L471-523 一致
  - 設定対応表 9行（L602-612） → ログ L588-598 一致
  - エラーコード表 4行（L635-640）と grep の反省（L642） → ログ L604-611 一致
  - 未検証項目の列挙（L662-668） → ログ L646-653 一致（記事側の追加分「`minimumReleaseAgeExclude` の手書き」もログ L524 に記載あり）
  - 冒頭の npm 12 `allowScripts` 記事への言及（L36） → ログ L701 の指示どおり。`articles/npm12-allowscripts-local-fixture.md` は実在
- 創作の疑いがある記述: **なし**。ログに無い成功・数値・コードは検出されなかった
- ログを超えた断定: 1件（warning-1、`pnpm-workspace.yaml` を「作る」と無条件断定）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/pnpm11-minimum-release-age-ci-only-failure.md (slug=pnpm11-minimum-release-age-ci-only-failure) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=42 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 101文字 (60字目安)
[PASS] emoji あり: ⏳
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=96
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 113,114,116,198,265,510,625,627
SUMMARY fail=0 warn=2
```

### 機械チェックの切り分け

- `[WARN] title が長い: 101文字` → **false positive（指摘に含めない）**。101 はバイト数で、実際の文字数は 55 字。既存の公開済み記事にはこれより長いタイトル（`vite8-rolldown-build-benchmark-log.md` 128B/55字、`typescript6-deprecated-tsconfig-already-error.md` 117B/52字 など）が複数あり、本記事は公開実績の範囲内。
- `[WARN] 秘密情報の疑い [user-path]` → **8行中6行（L113,114,116,198,265,510）＋ 所有者列2行（L118,119）が真の指摘 → blocker-1 に昇格**。L625,627 の `file:///Users/.../pnpm/dist/pnpm.mjs` は既に `...` で伏せ済みのため **false positive**。
- `[INFO] /images 参照なし` → CLI 出力のみの検証で、出典ログでもスクショ0枚と明記されているため問題なし。

## 適用した修正

なし（引数で修正適用の指定がなかったため、記事は一切変更していない）。

## 次のアクション

- [ ] blocker-1（個人パス7行の伏せ字化）を直す ← これだけで公開不可は解消できる
- [ ] warning-1（`pnpm-workspace.yaml` を「作ることがある」に緩める）を直す
- [ ] 余裕があれば suggestion 1〜3 に対応する
- [ ] 直したら `/revise-article` → `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
