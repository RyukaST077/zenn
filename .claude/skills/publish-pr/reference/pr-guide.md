# PR作成・公開準備ガイド

`publish-pr` の Step 2〜Step 6 で使う。公開ゲート判定、git/ブランチ運用、gh の検出と
フォールバック、公開時の slug 衝突対処。

## Publish Gate（公開ゲート）

次をすべて満たすときだけPRを作る。1つでも欠けたら中止して理由を出す。

1. **対象ドラフトが published:false**
   ```bash
   grep -qE '^published:[[:space:]]*false' articles/<slug>.md
   ```
   true になっていたら、既にどこかで公開準備済みの可能性。理由を出して中止し、確認を促す。

2. **レビュー通過（公開可）**
   最新のレビュー報告を読む。
   ```bash
   ls -t logs/review-<slug>-*.md 2>/dev/null | head -1
   ```
   * 報告が無い → 「先に /review-article でレビューしてください」で中止。
   * 判定行（例: `**判定: 公開可 / 要修正 / 公開不可**`、または「判定:」を含む行）を読む。
     公開可でない（blocker/warning が残る）→ 「直して再レビューしてください」で中止。
   * 引数で強制作成が指定されたときのみ、警告を残して続行してよい（既定は中止）。

3. **機械チェックに blocker 無し**
   review-article のスクリプトを再実行する。
   ```bash
   bash .claude/skills/review-article/scripts/check-article.sh articles/<slug>.md
   ```
   * 末尾 `SUMMARY fail=.. warn=..` を見る。この時点では published は false のはずなので
     `[PASS] published=false` になる。
   * published 以外の `[FAIL]`（秘密情報 / slug 不正 / 画像欠落 / コードフェンス未閉じ）が
     1つでもあれば中止する。

ゲートを通ったら Step 3（published を true 化）に進む。

## Git Flow（ブランチ運用）

**`main` に直接 commit / push しない。** 必ず feature ブランチを使う。

```bash
# 現在ブランチの確認（main なら必ず分岐する）
git rev-parse --abbrev-ref HEAD

# base を最新化（任意・失敗しても致命的でない）
git fetch origin main 2>/dev/null || true

# feature ブランチを作成して切り替え（既定名 publish/<slug>）
branch="publish/<slug>"
# 同名が既にあれば日時サフィックスを足す
git show-ref --verify --quiet "refs/heads/$branch" && branch="${branch}-$(date +%Y%m%d-%H%M)"
git switch -c "$branch" origin/main 2>/dev/null || git switch -c "$branch"
```

### 記事＋画像だけをコミット

無関係な変更（skills 変更・ログ・他記事）を**巻き込まない**。対象を明示して add する。

```bash
git add "articles/<slug>.md" "images/<slug>/"
# 念のため、ステージされたものが記事＋画像だけか確認する
git diff --cached --name-only
git commit -m "docs(article): publish <slug>" -m "<記事タイトル>" \
  -m "Co-Authored-By: <実行エージェントに応じたトレーラ>"
```

* コミットメッセージ書式は `reference/pr-template.md` の Commit を参照。
* 末尾の Co-Authored-By トレーラは環境の規約に従って付ける。
* `images/<slug>/` が存在しない（画像なし記事）の場合は記事だけを add する。

### push（origin へ。main には push しない）

```bash
git push -u origin "$branch"
```

## gh の検出とフォールバック

```bash
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  # gh が使える
  gh pr create --base main --head "$branch" \
    --title "<PRタイトル>" --body-file <本文一時ファイル>
else
  # フォールバック: push 済みブランチに対する compare URL を出す
  # origin の owner/repo を導出（https / git@ どちらも対応）
  originurl="$(git remote get-url origin)"
  repo="$(printf '%s' "$originurl" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"
  echo "PR作成URL: https://github.com/$repo/compare/main...$branch?expand=1"
  echo "（上記を開き、下記タイトル/本文を貼り付けてPRを作成してください）"
  # タイトルと本文（reference/pr-template.md）を標準出力に出す
fi
```

* `gh` はあるが未認証（`gh auth status` が失敗）の場合もフォールバックに倒す。
* フォールバック時は「ブランチは push 済み」「URLを開けばPRを作れる」ことを明記する。
* PR本文はファイルにも保存しておくと貼り付けやすい（例: `logs/pr-<slug>-<日時>.md`）。

## 公開時の slug 衝突（既知トラブル）

PRを **マージした後**、Zenn側のデプロイで
「Slug『…』はサイト内で既に使用されています」が出ることがある（slug はZenn全体で一意）。

* 予防: PR本文のチェックリストで「slug が汎用的すぎないか」を確認させる。
* 発生時: 記事ファイル名（slug）を具体的な名前にリネームして再push。
* 詳細: `knowledge/2026-07-01-zenn-slug-already-used.md`。

git push / gh のエラーは、まず `consult-knowledge` で `knowledge/` を検索してから対処する。

## やってはいけないこと

* `main` に直接 commit / push する。`main` 上で published を true にする。
* `git add -A` / `git add .` で無関係な変更を巻き込む。
* ゲート未通過（レビュー無し・blocker 残存）でPRを作る。
* PRをマージ・公開まで進める（人間の操作に委ねる）。
