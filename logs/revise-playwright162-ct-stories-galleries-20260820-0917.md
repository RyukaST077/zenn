# 修正適用レポート: playwright162-ct-stories-galleries

## 採用した前提

- 対象記事: `articles/playwright162-ct-stories-galleries.md`（引数で明示指定）
- レビューレポート: `logs/review-playwright162-ct-stories-galleries-20260820-0913.md`（引数で明示指定・判定「要修正」/ blocker 0・warning 4・suggestion 5）
- 出典ログ: `logs/run-playwright-ct-stories-galleries-20260820-0213/execution-log.md`（引数で明示指定）
- 適用範囲: blocker ＋ warning（既定）。suggestion は安全・機械的なもののみ
- slug リネーム: 指摘なしのため実施せず
- 過去の修正レポート: なし（本記事に対する `logs/revise-*` は今回が初回。ループ懸念なし）

## 適用した修正

| # | 重大度 | 分類 | 箇所 | 適用内容 | 出典 |
|---|---|---|---|---|---|
| W1 | warning | B（ログ由来の補完） | `ts:tests/components/button.spec.ts` ブロック | `Disabled story renders a disabled button` テスト（4行）を `Primary` の直後・`short-form` の直前に追記。掲載分がログ全文どおりの34行になり、後段の実行結果ブロック（`✓ 4 ... Disabled story ...`）および `wc -l` 表の「34 tests/components/button.spec.ts」と一致した | execution-log.md フェーズ3「`tests/components/button.spec.ts`（全文 / 34行）」 |
| W2 | warning | B（ログ由来の補完） | 「config と story と spec」節 | `tsx:src/components/Button.tsx`（13行）を `Counter.tsx` の直前に、`tsx:src/components/Counter.story.tsx`（7行）を `Button.story.tsx` の直後に追記。導入文も最小限（「Button は props をそのまま流すだけの素朴なものです。」「Counter 側の story は2つだけです。」）で追加。行数は `wc -l` 表の 13 / 7 と一致することを確認済み | execution-log.md フェーズ2（`Button.tsx` 全文）/ フェーズ3（`Counter.story.tsx` 全文 / 7行） |
| W3 | warning | C→B（不正確な引用をログの実出力に置換） | 「バージョンを 1.62.1 に固定した理由」 | 合成・整形されていた `npm view` 出力ブロックを、ログの `@playwright/test dist-tags` の実出力全文（`rc` を含む4キー）に差し替え。直前の一文にも実行コマンド `npm view @playwright/test dist-tags` を明記した | execution-log.md フェーズ1「`npm view @playwright/test dist-tags`」の出力全文 |
| W4 | warning | C（削減修正） | 「まとめ」 | ログ外の推測だった「初見でここに数時間持っていかれるのは覚悟しておくといい」という所要時間の断定を削除。レビューの提案文どおり「手を動かす部分は 232行しかなくて、実際に時間を食ったのは…gallery の契約を読み解くところと、上の3番の原因を切り分けるところでした」に置換し、読者向けの目安は「あくまで見立てですが」と明示的に断る形（数値なし）に弱めた | execution-log.md「所要時間」表の注記（「実測は AI エージェント単独の値。記事にそのまま書かない」）/ 詰まった点 #3（原因究明 約2分 > 実装） |
| S1 | suggestion | A（機械修正） | 「1件だけ毎回落ちる」 | 「毎回同じ1件目です」→「毎回同じ1件（`button.spec.ts:4:1` の Primary）です」。直後に貼った実行結果（失敗は `✘ 2` の行）との矛盾を解消 | 記事内の実行結果ブロック / ログ 詰まった点 #3 |
| S4 | suggestion | A（機械修正・追記1文節） | gallery を devtools から叩ける旨の段落 | 「（今回はスクショ用スクリプトから `page.evaluate` で同じことをやりました）」を末尾に追記し、実演した範囲と一般論の境界を明示 | execution-log.md のスクリーンショット取得手順（`shot.mjs` の `page.evaluate`） |

適用件数: **blocker 0 件 / warning 4 件 / suggestion 2 件**

## 適用しなかった指摘

| # | 重大度 | 理由 |
|---|---|---|
| S2 | suggestion | Front Matter `title` の短縮（61→目安60文字以内）。機械チェックは通過しており、タイトルは記事の主旨に関わる著者判断のため最小修正の原則から見送った。一覧での見切れが気になる場合はレビュー提案文（「Playwright 1.62 の stories & galleries でコンポーネントテストを作ってみた」）へ差し替え可 |
| S3 | suggestion | 冒頭の前提コメント `<!-- 前提: ... -->` は HTML コメントで表示されず、レビュー自身も「残す運用なら現状のままでも可」としているため現状維持（パイプラインの申し送りとして有用） |
| S5 | suggestion | 「現状維持」との指摘のため対応不要。W4 をこの節の水準（見立てと断る書き方）に合わせる点は W4 の修正で反映済み |

未解消の blocker / warning: **なし**（修正不能と判断した指摘はゼロ）

## セルフチェック結果

```
$ bash .claude/skills/review-article/scripts/check-article.sh articles/playwright162-ct-stories-galleries.md --expect-published false
OK: articles/playwright162-ct-stories-galleries.md (slug=playwright162-ct-stories-galleries, published=false)
EXIT=0
```

追加の手動確認:

- `published: false` を維持（Front Matter 6行目）
- コードフェンス 90本（偶数・追加4ブロック分で 86 → 90）
- 追記した3ブロックの行数がログおよび記事内 `wc -l` 表と一致（button.spec.ts=34 / Button.tsx=13 / Counter.story.tsx=7）
- slug リネームなし・画像参照の変更なし・秘密情報の新規混入なし

## 次のアクション

- `/review-article articles/playwright162-ct-stories-galleries.md` で再レビューし、判定が「公開可」になったら `/publish-pr` へ
