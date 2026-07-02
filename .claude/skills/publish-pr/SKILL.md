---
name: publish-pr
description: 【コマンド起動】review-article を通過した記事ドラフト（articles/<slug>.md）を公開準備し、GitHubのPRを作成する。feature ブランチ上で published を true に変え、記事＋画像（images/<slug>/）だけをコミット・push し、PRを作成する。PRを main にマージするとZennで公開される（マージ＝公開ゲート）。main へ直接 push はしない。gh CLI があれば使い、無ければ push＋PR作成URLを出力する。レビュー未通過や blocker がある場合はPRを作らず中止する。対象記事・ブランチ名・base を引数で渡せる（無指定でも最新の通過済みドラフトで動作）。
---

# Zenn 記事 公開準備・PR作成

> このSkillはユーザーが `/publish-pr` で明示的に起動する前提。自動起動はしない。
> **非対話（headless）実行を前提とする**（例: `claude -p "/publish-pr ..."`）。
> 途中でユーザーに確認・質問しない。`AskUserQuestion` は使わず、情報が不足する場合は
> 常に下記のデフォルト前提を採用してそのまま最後まで進める。
> 詳細な参照データは `reference/` に分離してある。各ステップで必要になったら該当ファイルを読む。

## パイプライン上の位置づけ

このSkillはパイプラインの**最終段（公開準備・PR作成）**にあたる。

```
/search-topic  → research/search-topic-*.md
/plan-practice → practice/practice-*.md
/run-practice  → logs/run-*/execution-log.md
/draft-article → articles/<slug>.md (published:false)
/review-article→ logs/review-<slug>-*.md（判定: 公開可 など）
/publish-pr    → feature ブランチ + PR（マージ＝Zenn公開）  ← これ
```

## Goal

`review-article` を**通過した**記事ドラフトを、GitHubのPRとして公開準備する。目的は、
「PRをマージすれば公開される」状態を安全に作ること。具体的には feature ブランチ上で
`published: false` → `true` に変え、**記事＋画像だけ**をコミット・push し、PRを作成する。

このリポジトリは **GitHub連携で `main` に published:true の記事が入ると自動公開**される。
したがって:

* **公開のトリガはPRのマージ**。人間がPRをマージした瞬間に公開される（＝マージが公開ゲート）。
* 本Skillは **`main` へ直接 push しない**。必ず feature ブランチを作り、PR経由にする。
* published を true にするのは feature ブランチの中だけ。マージまで公開は起きない。

最終成果物:

* feature ブランチ（`publish/<slug>`）に、`published: true` の記事＋画像をコミットした状態
* 作成したPR（`gh` があればPR番号/URL、無ければ push 済みブランチ＋PR作成用URL）
* PR本文（記事の要約・レビュー結果・公開の性質・レビュアー向けチェックリスト・出典リンク）

## 起動方法と引数

`/publish-pr` で起動。以下を引数（自然言語）で渡せる。すべて省略可。

* 対象記事: `articles/<slug>.md` のパス（無指定なら最新の `published: false` ドラフト）
* base ブランチ（無指定なら `main`）
* ブランチ名（無指定なら `publish/<slug>`）
* レビュー未通過でも作成する上書き（例: 強制作成）。**既定は未通過なら中止**
* PRタイトル（無指定なら記事タイトルから生成）

### 引数が無い/不足のときのデフォルト前提

* 対象記事: `articles/` の中で `published: false` かつ最も新しく更新されたドラフト
* base: `main` / ブランチ名: `publish/<slug>`
* レビュー: 対応する最新の `logs/review-<slug>-*.md` の判定が **公開可** であることを要求する
* 公開の扱い: **published を true に変える**（マージ＝公開）

不足情報があっても止まらず、採用した前提を標準出力とPR本文に明示したうえで進める。
ユーザーへの追加質問は行わない（非対話実行のため応答を待てない）。

## Assumptions

* 入力は `review-article` を通過した記事ドラフト。本Skillは記事の執筆・レビューはしない。
* 公開の最終判断（マージ）は人間が行う。本Skillはマージまではしない（PR作成まで）。
* 記事＋画像だけをPRに含める。レビュー/実践ログはPR本文からパスで参照する（コミットに含めない）。

## 公開安全（必須 / これを破らない）

* **`main` へ直接 push・commit しない**。必ず feature ブランチを作る（`main` に居たら分岐する）。
* published を true にするのは **feature ブランチ内だけ**。main では絶対に true 化しない。
* **公開ゲート（下記）を満たさない限りPRを作らない**。レビュー未通過・blocker 残存・秘密情報の
  疑いがあれば中止し、理由を表示する。
* PRのマージ・公開そのものはしない（人間の操作）。

## 公開ゲート（PR作成の前提条件）

次をすべて満たすときだけPRを作る。1つでも欠けたら**中止**して理由を表示する。

1. 対象ドラフトが存在し、現状 `published: false` である。
2. 対応する `logs/review-<slug>-*.md`（最新）が存在し、判定が **公開可**（blocker 0・warning 0）。
   * レビューが無い → 「先に `/review-article` でレビューしてください」で中止。
   * 判定が 要修正 / 公開不可 → 「blocker/warning を直して再レビューしてください」で中止。
   * 引数で強制作成が指定された場合のみ、警告を残して続行してよい（既定は中止）。
3. `scripts/check-article.sh`（review-article のもの）を再実行し、**published 以外の blocker が無い**
   （秘密情報・slug 不正・画像欠落・コードフェンス未閉じ が無い）。この時点では published は
   false のはずなので、`published=false` を確認する。

ゲート判定の詳細は `reference/pr-guide.md` の Publish Gate を参照。

## Input Resolution（入力の特定）

1. **記事特定**: 引数にパスがあればそれを使う。無ければ `published: false` のドラフトのうち
   最も新しく更新されたものを選ぶ（`review-article` と同じ選び方）。
2. **レビュー特定**: `ls -t logs/review-<slug>-*.md 2>/dev/null | head -1`。無ければゲートで中止。
3. **出典特定**: 記事冒頭コメントや最新の `logs/run-*/execution-log.md`（PR本文の出典リンク用）。
4. **フォールバック**: `articles/` に対象ドラフトが無い場合、
   「公開準備できるドラフトが無い。先に `/draft-article` と `/review-article` を実行してください」と
   標準出力に表示して**そこで終了する**（PRを捏造しない）。

## Workflow

### Step 1: 入力を確定する
上記「Input Resolution」に従い、対象記事・レビュー報告・出典を確定する。採用した前提
（記事パス／base／ブランチ名）を控える。

### Step 2: 公開ゲートを判定する
上記「公開ゲート」を評価する。`scripts/check-article.sh` を実行し、レビュー報告の判定を読む。
満たさなければ**理由を表示して中止**（ブランチ作成・commit・push・PR作成をしない）。

### Step 3: 公開準備（published を true にする）
ゲート通過後、対象記事の Front Matter を `published: false` → `true` に変更する。
本文・slug・画像参照は変更しない（公開準備は published の切替と最小限に留める）。

### Step 4: ブランチを作る
`reference/pr-guide.md` の Git Flow に従う。`main` に居る場合は必ず feature ブランチ
（既定 `publish/<slug>`）を作成して切り替える。既存の同名ブランチがあれば日時サフィックスを足す。

### Step 5: 記事＋画像だけをコミットする
`git add` は **`articles/<slug>.md` と `images/<slug>/` だけ**を対象にする（他の変更は含めない）。
コミットメッセージは `reference/pr-template.md` の Commit 書式に従い、環境の規約どおり
末尾に Co-Authored-By トレーラを付ける。

### Step 6: push して PR を作成する
feature ブランチを `origin` に push する（`main` には push しない）。
`gh` が使えれば `gh pr create --base <base> --head <branch>` でPRを作る。使えなければ
`reference/pr-guide.md` の Fallback に従い、compare URL とPRタイトル/本文を標準出力に出す。
PR本文は `reference/pr-template.md` のテンプレートで組み立てる（マージ＝公開である旨を明記）。

### Step 7: 結果を出力する
後述の Output に従い、ブランチ名・PR URL（または compare URL）・公開の性質・次のアクションを
標準出力に表示する。git/gh の失敗時は「トラブル対応」に従う。

## トラブル対応（knowledge ループ）

* git push / gh のエラーに当たったら、まず `consult-knowledge` で `knowledge/` を検索する。
* 公開時に「Slug『…』はサイト内で既に使用されています」が出る可能性がある。これは既知
  （`knowledge/2026-07-01-zenn-slug-already-used.md`）。PR本文のチェックリストで slug の
  一意性を確認させ、衝突時は slug をより具体的な名前にリネームする旨を案内する。
* 新しいトラブルを解決したら `save-knowledge` で記録する。

## Output

1. 作成した feature ブランチ名
2. PR の URL（`gh` 使用時）または push 済みブランチ＋PR作成用 compare URL（フォールバック時）
3. 公開の性質: 「このPRを `main` にマージすると Zenn で公開される（published: true）」
4. レビュー結果の要約（判定・出典 `logs/review-*.md` のパス）
5. 次のアクション:
   * PRをレビューし、問題なければ `main` にマージする（＝公開）
   * 公開時に「サイト内で既に使用されています」が出たら slug を具体的な名前にリネーム
     （`knowledge/2026-07-01-zenn-slug-already-used.md`）
   * 取り下げる場合はブランチを削除する

## Quality Rules

* 公開ゲート（現状 published:false・レビュー公開可・機械チェックに blocker 無し）を満たすときだけPRを作る。
* `main` へ直接 push・commit しない。必ず feature ブランチ経由。published の true 化はブランチ内だけ。
* `git add` は記事＋画像だけに限定する（無関係な変更を巻き込まない）。
* マージ＝公開であることをPR本文に明示し、レビュアー向けチェックリストを付ける。
* gh が無い環境でも動くフォールバック（push＋compare URL）を必ず用意する。
* 採用した前提（対象記事・base・ブランチ名・レビュー結果）を出力とPR本文に明示する。
* マージ・公開そのものはしない（人間の操作に委ねる）。

## Anti-Patterns

* レビュー未通過・blocker 残存・秘密情報の疑いがあるのにPRを作る。
* `main` に直接 commit / push する、または `main` 上で published を true にする。
* 記事以外の無関係な変更（skills 変更・ログ等）を巻き込んでコミットする。
* PRをそのままマージ・公開してしまう（人間の公開ゲートを飛ばす）。
* gh が無い前提を無視して失敗し、フォールバックを出さない。
* 対象ドラフトが無いのにブランチやPRを捏造する。
