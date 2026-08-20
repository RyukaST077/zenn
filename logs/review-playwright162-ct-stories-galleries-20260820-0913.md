# 公開前レビュー: Playwright 1.62 の stories & galleries でコンポーネントテストを最小構成から作ってみた / playwright162-ct-stories-galleries

## レビューの前提

- 対象記事: `articles/playwright162-ct-stories-galleries.md`（引数で明示指定）
- 出典ログ: `logs/run-playwright-ct-stories-galleries-20260820-0213/execution-log.md`（引数で明示指定）
- レビュー日時: 2026-08-20 09:13
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 4 件 / suggestion: 5 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全は全項目クリア（`published: false` / slug 妥当・一意 / 秘密情報・個人パスなし）。blocker なし。
  - ただし本文に貼った `tests/components/button.spec.ts` がファイル名付きコードブロックなのに **`Disabled` テストを落としており、直後の実行結果ブロックにはその `Disabled` テストが出てくる**（W1）。
  - `Counter.story.tsx` と `Button.tsx` の中身が本文に一度も出てこないため、記事末尾の「最短の再現手順」に従っても `components/Counter/Default` / `Stateful` を再現できない（W2）。
  - `npm view` の出力ブロックが、ログのどちらの実出力とも一致しない合成・整形された引用になっている（W3）。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「config と story と spec」節の `ts:tests/components/button.spec.ts` ブロック（articles/playwright162-ct-stories-galleries.md:455 付近） — `Disabled story renders a disabled button` テスト（ログ全文にある3行）を追記し、ログどおりの34行の全文にする。現状は4テストしか載っていないのに、L526 の実行結果では `✓ 4 ... Disabled story renders a disabled button` が出ていて自己矛盾している。
2. [warning] 「config と story と spec」節 — `src/components/Counter.story.tsx`（ログ7行の全文）を追記する。`Button.story.tsx` と `Counter.tsx` は載っているが `Counter.story.tsx` が無く、`counter.spec.ts` が使う `components/Counter/Default` / `components/Counter/Stateful` の定義が読者に一切示されていない。あわせて `src/components/Button.tsx`（ログ13行の全文）も追記する（`wc -l` の内訳表には両方出てくるのに本文に無い）。
3. [warning] 「バージョンを 1.62.1 に固定した理由」節 L82-86 — `npm view` の出力ブロックをログの実出力に置き換える。ログの `@playwright/test` 側の実出力は `{ rc: '1.18.0-rc1', beta: '1.62.1-beta-1785366875000', latest: '1.62.1', next: '1.63.0-alpha-2026-08-19' }` の4キー。記事のブロックは `rc` を落とし、`@playwright/experimental-ct-react` 側の出力の整形（3行書き）に `@playwright/test` の `next` を混ぜた形になっており、どちらの実出力とも一致しない。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| W1 | 「config と story と spec」/ `ts:tests/components/button.spec.ts` ブロック（L455 付近） | ファイル名付きブロック（＝全文の体裁）なのに `Disabled` テストが欠落。L526 の実行結果には `Disabled story renders a disabled button` が現れるので、記事内で矛盾する。また L494 の `wc -l` 表は同ファイルを34行としているが、掲載分はそれより短い | ログ（execution-log.md「`tests/components/button.spec.ts`（全文 / 34行）」）の3行を該当位置に追記する:<br>`test('Disabled story renders a disabled button', async ({ mount }) => {`<br>`  const component = await mount('components/Button/Disabled');`<br>`  await expect(component.getByRole('button')).toBeDisabled();`<br>`});`<br>（`Primary` の直後・`short-form` の直前。ログの並び順どおり） | 出典ログ フェーズ3「story / spec を書いて…」の全文 |
| W2 | 「config と story と spec」節全体 | `src/components/Counter.story.tsx`（7行）と `src/components/Button.tsx`（13行）の中身が本文に存在しない。`counter.spec.ts` は `Counter/Default` と `Counter/Stateful` を mount し、`Button.story.tsx` は `./Button` を import しているので、末尾の「最短の再現手順」に従っても読者は再現できない | ログにある両ファイルの全文を、`Counter.tsx` / `Button.story.tsx` の近くにコードブロックとして追記する（`tsx:src/components/Counter.story.tsx` / `tsx:src/components/Button.tsx`）。行数は `wc -l` 表の7行・13行と一致するはず | 出典ログ フェーズ2（`Button.tsx` 全文）/ フェーズ3（`Counter.story.tsx` 全文） |
| W3 | 「バージョンを 1.62.1 に固定した理由」L82-86 | `npm view` の出力として貼っているブロックが、ログのどの実出力とも一致しない（`@playwright/test` の出力から `rc: '1.18.0-rc1'` が消え、`@playwright/experimental-ct-react` の出力の整形に `@playwright/test` の `next` 値が入っている）。結論（latest=1.62.1）自体はログどおりだが、コマンド出力の引用としては不正確 | ブロックをログの実出力に差し替える:<br>`{`<br>`  rc: '1.18.0-rc1',`<br>`  beta: '1.62.1-beta-1785366875000',`<br>`  latest: '1.62.1',`<br>`  next: '1.63.0-alpha-2026-08-19'`<br>`}`<br>あわせて直前の一文に実行コマンド（`npm view @playwright/test dist-tags`）を明記する | 出典ログ フェーズ1「`npm view @playwright/test dist-tags`」の出力全文 |
| W4 | 「まとめ」L922 | 「初見でここに数時間持っていかれるのは覚悟しておくといい」という所要時間の見積もりがログに裏付けられていない。ログの実測はエージェント単独で合計約12分（gallery 自力実装は約1分、full reload の原因究明が約2分）で、「人がやれば数時間」はログ外の推測。また「コードを書く時間より gallery の契約を理解する時間のほうが長かった」も実測とは対応しない（原因切り分けが実装より長かった点だけはログどおり） | 数値を伴う断定をやめ、ログに残っている事実だけに寄せる。例:「手を動かす部分は 232行しかなくて、実際に時間を食ったのはコードを書くところではなく、gallery の契約を読み解くところと、上の3番の原因を切り分けるところでした」。読者向けの所要時間の目安を残したいなら「あくまで見立てですが」と明示的に断る（記事は他の箇所で見立てをきちんと断っているので、体裁を揃える） | 出典ログ「所要時間」表・注記（「実測は AI エージェント単独の値。記事にそのまま書かない」） |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| S1 | 「1件だけ毎回落ちる」L517 | 「毎回同じ1件目です」と書いているが、直後に貼った実行結果では失敗しているのは `✘ 2` の行（並び順は worker 依存）。ログの表現も「7テストのうち1件だけが毎回落ちる」で「1件目」ではない | 「毎回同じ1件（`button.spec.ts:4:1` の Primary）」に直すと、貼った出力と本文が一致して読者が混乱しない |
| S2 | Front Matter `title` | 61文字で目安の60文字をわずかに超える（機械チェックは通過） | 例:「Playwright 1.62 の stories & galleries でコンポーネントテストを作ってみた」まで縮めると一覧での見切れが減る |
| S3 | L9 の前提コメント `<!-- 前提: 出典ログ ... -->` | パイプラインの申し送りメモが本文先頭に残っている（HTML コメントなので表示はされない） | 公開時に消しておくと、記事ファイル単体で見たときに内部メタが混ざらない。残す運用なら現状のままでも可 |
| S4 | L502 付近「gallery ページをブラウザで直接開いて、devtools から `await window.mount(...)` を叩ける」 | ログ上の実際の操作はスクリーンショット用スクリプト（`shot.mjs`）から `page.evaluate` で `window.mount` を呼んだもの。「devtools から叩ける」はログの気づき欄の表現をそのまま採用したもので、実演はしていない | 「（今回はスクショ用スクリプトから `page.evaluate` で同じことをやりました）」と一言添えると、検証範囲と推測の境界がより明確になる |
| S5 | 「旧方式との比較」「どんな人に向いていそうか」 | 移行コストの見立て・旧パッケージのフェードアウト評価は、記事内できちんと「見立て」と断れていて良い。強い断定は見つからなかった | 現状維持。W4 の書き方をこの節の水準に合わせるとトーンが全体で揃う |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false`。slug `playwright162-ct-stories-galleries`（34文字・`a-z0-9-` のみ・汎用語なし・`articles/` 内で一意）。`/Users/` 等の個人パス・APIキー・トークン・内部ホスト名はいずれも検出なし（ログ引用のパスも `.../pw162-ct/...` にマスク済み） |
| Front Matter | OK | title/emoji/type(tech)/topics(5件・英小文字)/published すべて妥当。title 61文字のみ suggestion（S2） |
| 事実性（ログ照合） | 要修正 | 結論・主要な数値・エラー全文はログと一致。掲載コードの欠落（W1/W2）と出力引用の不一致（W3）、所要時間の推測（W4）が残る |
| 画像 | OK | 参照7枚すべて `images/playwright162-ct-stories-galleries/` に実在（01〜07、`screenshots/` とバイト数一致）。孤立画像なし。全てに説明的な alt あり。詰まった点の節にもスクショが添えられている |
| Markdown構造 | OK | コードフェンス86本（偶数）、`:::` 6本（`message`×1・`details`×2 が開閉一致）。見出しは H2 のみで H1 乱用なし（`### Bug Fixes` はコードフェンス内）。プレースホルダリンク・`example.com`・空リンクなし。参考リンク5本は公式ドメイン |
| 文章品質・トーン | OK（一部 suggestion） | 経験談トーン。CT 初挑戦・旧方式は未経験という立場を冒頭で明示し、比較部分は「見立て」と断れている。詰まった点は6件相当を具体的に記述し、未解決の1件と「エラー全文を残せなかった」反省まで書いている。環境（macOS 26.5 arm64 / Node v22.17.0 / npm 10.9.2 / 各ライブラリ版）も表で明記 |
| 完成度 | OK | `要素材` / TODO / FIXME / `<slug>` の残存なし。構成・分量（934行）は公開に耐える |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「最終的に7テスト全部 pass して、HTML レポートも残りました」 ↔ ログ「完了条件の判定: **達成（5/5）**」「FINAL verification run `7 passed (1.6s)` / `screenshots/07-html-report.png`（All 7 / Passed 7 / Failed 0）」 → **一致**
- ログで裏付けを確認できた主な記述:
  - 1.62.1 の Bug Fixes 5件の全文と「3件が `[Regression]` / fatal since 1.62」→ ログ フェーズ1と一致
  - `npm ls --depth=0` の9行（Vite 8.2.1 / TS 6.0.3 / React 19.2.8 / oxlint 1.79.0）→ 一致
  - `init-skills` の `✅ Skill installed` 3行、生成物16ファイル・2710行・コード0行、`--help` の出力、`ls` の `no matches found` → 一致
  - chromium キャッシュ7世代・1世代299〜356MB・2.2GB超、`install chromium` が0秒 → 一致
  - 最初の実行の失敗全文（`element(s) not found` / accessibility snapshot / `page reload playwright/gallery/index.html`）→ 一致
  - 仮説A（`optimizeDeps.entries`）棄却 → 仮説B（dev server が gallery より先に起動）確定の過程、再現手順6行、最終 `7 passed` かつ `page reload` 行なし、5連続5/5 green → 一致
  - 壊した版の全文（`Expected: "3" / Received: "2"` / `14 × locator resolved to ...`）と diff の3行 → 一致
  - `tsconfig.pw.json` の全文、型引数あり `TS2353`・なし `TS6133` → 一致
  - story リネーム時の `exit=0` / `✓ built in 380ms` / `Unknown story:` 2件 / `2 failed 3 passed (2.5s)` → 一致
  - `net::ERR_CONNECTION_REFUSED`、`The gallery page does not define window.mount().` → 一致
  - 1.62.0 回帰2件（`Failed to resolve "extends" path` / `"references" path` + `No tests found`）、1.62.1 で `7 passed (1.5s)`、`npx tsc -p tests/tsconfig.json` の TS2307 2件 → 一致
  - 旧パッケージ: latest 1.62.1・deprecated 指定なし・alpha は 2026-08-07 で停止 vs `@playwright/test` は 2026-08-19 → 一致
  - `migration.md` の "after" 例の矛盾2点 → 一致
  - 手書き232行の `wc -l` 内訳9行、`vite build` の `✓ built in 112ms` / `dist/index.html` のみ → 一致
  - 未解決の1件（全22回中1回・5連続green・2仮説を各3回試して再現せず・`tail` でエラー全文を失った）→ 一致
- 創作の疑いがある記述: **創作コード・創作エラーは検出されず**。掲載コードはすべてログの workspace 由来。ただし
  - `npm view` の出力ブロックはログの実出力を合成・整形したもの（W3）
  - `button.spec.ts` は全文の体裁で一部テストが欠落（W1）
  - `Counter.story.tsx` / `Button.tsx` は本文に不掲載（W2）
  - 「初見で数時間」はログ外の推測（W4）
- 残存する `要素材` マーカー: **0 件**

## 機械チェック結果（scripts/check-article.sh）

```
$ bash .claude/skills/review-article/scripts/check-article.sh articles/playwright162-ct-stories-galleries.md --expect-published false
OK: articles/playwright162-ct-stories-galleries.md (slug=playwright162-ct-stories-galleries, published=false)
EXIT=0
```

## 適用した修正

なし（引数で修正適用が指定されていないため、記事本文は一切変更していない）。

## 次のアクション

- [ ] W1〜W4（特に W1・W2 のコードブロック補完）を直す。補完に使う一次情報はすべて `logs/run-playwright-ct-stories-galleries-20260820-0213/execution-log.md` にある
- [ ] 余力があれば S1〜S4 も反映する
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
