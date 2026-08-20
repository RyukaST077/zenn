# 公開前レビュー: Agent Plugins 1.0.0の仕様どおりに作ったプラグインをClaude Codeに読ませたら半分だけ読めた / agent-plugins-spec-claude-code-half-load

## レビューの前提

- 対象記事: `articles/agent-plugins-spec-claude-code-half-load.md`（引数で明示）
- 出典ログ: `logs/run-agent-plugins-spec-20260815-0413/execution-log.md`（引数で明示。`RESULTS.md` も補助的に照合）
- レビュー日時: 2026-08-15 04:39
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 6 件
- 根拠（判定を決めた主な指摘）:
  - warning-1: 「予想7項目のうち的中5・半分外し1・想定外1」という数え方が、出典ログの実測マトリクス（予想7項目＝半分外れ1＋的中6）と合わない。記事内で2か所（L116 / L727）繰り返されており、読者が足し算しても 5+1=6 で7に届かない。
- 公開安全（`published: false` / slug / 秘密情報）は3項目とも問題なし。事実整合も、上記1点を除き出典ログとほぼ逐語で一致していた。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「事前に調べたこと」L116 および「まとめ」L727 — 「的中したのが5、半分外したのが1」を、出典ログの `RESULTS.md` 差分表（行1が半分外れ、行2〜7が的中）に合わせて「**的中6・半分外し1**」に直すか、「7項目のうち判定できたのは6項目」と分かる書き方に改める。
2. [suggestion] 冒頭 L9 の前提コメント `<!-- 前提: 出典ログ ... -->` — 公開前に削除する（読者向けの情報ではない）。
3. [suggestion] L36「以前に `CLAUDE.md` / `AGENTS.md` を検証した話」 — 該当記事 `articles/project-root-agent-instructions.md` へのリンクを張る（現状は参照先が読者から辿れない）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | L116「ここで、結果を見る前に…」/ L727「事前に書いた7項目の予想のうち」 | 予想の内訳「的中5・半分外し1・想定外1」が7項目と整合しない（想定外の発見は予想ではないため、判定済みは6項目になる）。出典ログの `RESULTS.md` 差分表を数えると、行1（マニフェスト位置）だけが半分外れで行2〜7の6件が的中 | 2か所とも「的中6・半分外し1、加えてまったく予想していなかった発見が1」に修正する。あるいは「7項目のうち1つを半分外し、残りは的中。別に予想していなかった発見が1つ」と、数の内訳を明示しない書き方にする | 出典ログ `execution-log.md` L677 は「的中5 / 半分外れ1 / 想定外1」と書いているが、同ログ添付の `RESULTS.md` 差分表（8行中 行1=⚠️半分外れ、行2〜7=✅的中、行8=🆕想定外）と食い違う。ログ側の要約行の誤りを記事が引き継いでいる |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L9 前提コメント | `<!-- 前提: 出典ログ logs/... -->` がドラフト用のまま残っている | 公開記事にパイプライン内部のパスを残さずに済む。（レンダリングはされないが、GitHub 上のソースには見える） |
| 2 | L36 | 過去記事への言及がリンクになっていない | 読者が `articles/project-root-agent-instructions.md` の内容に辿れる。Zenn 内リンクで回遊も増える |
| 3 | L30「その過程で採った出力と、詰まった4か所を書きます。」 | 「採った出力」がやや不自然な日本語 | 「その過程で得られた出力と、詰まった4か所を書きます。」等にすると読み出しが素直になる |
| 4 | L214 `"name": "RyukaST077"` | `author.email` は `<masked-email>` にマスクしているのに、`author.name`（GitHubハンドル）はそのまま。直後の L256 で「雛形出力をそのまま貼ると個人情報が載る」と注意している文脈と整合しない | 公開ハンドルなので実害はないが、`<masked-name>` に揃えるか「name はハンドルなのでそのまま載せています」と一言添えると、注意喚起の説得力が上がる |
| 5 | title（59文字） | Zenn の一覧では末尾が省略されやすい長さ | 例:「Agent Plugins 1.0.0 の仕様どおりに作ったプラグインをClaude Codeに読ませたら半分だけ読めた」→「仕様どおりのAgent PluginsをClaude Codeに読ませたら半分だけ読めた」のように短縮すると一覧での視認性が上がる（※機械チェックの「117文字」はバイト数カウントによる誤検出。実文字数は59文字で目安60字以内） |
| 6 | L64「確かめたいことは5つに絞りました」以降 | 出典ログにある空振りした予告2件（`--plugin-dir` の入れ子実行が失敗する / `agent-plugins.org` のスキーマURLに繋がらない）に触れていない | 「予想が空振りした」話も1〜2行入れると、予想と実測の対比という記事の軸がさらに濃くなる（任意。現状でも事実として誤りではない） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug 40文字・具体的・ローカル重複なし / 秘密情報の検出なし。ホームパスは `~/.../` に、メールは `<masked-email>` にマスク済み |
| Front Matter | OK | title/emoji/type/topics/published すべて揃う。type=tech、topics 4個（claudecode, mcp, aiagent, jsonschema）、emoji 🧩。title 59文字は目安内 |
| 事実性（ログ照合） | 要修正 | 引用出力・コマンド・数値はほぼ逐語一致。予想の内訳（warning-1）のみ要確認 |
| 画像 | OK | 参照7枚すべて `images/agent-plugins-spec-claude-code-half-load/` に実在。孤立画像なし。全画像に説明的な alt あり。詰まった点の節にもスクショあり |
| Markdown構造 | OK | コードフェンス96行（偶数・閉じ済み）、`:::` 6行（`:::message` / `:::message alert` / `:::details` すべて閉じ済み）。H2/H3/H4 の階層に破綻なし。H1 の乱用なし。リンクは全て実在ドメインでプレースホルダなし |
| 文章品質・トーン | OK | 新人としての観測レンジを明示（`:::message` で対象バージョンと有効期限を宣言）、詰まった点4件を具体的に記述、環境表で再現性を担保。断定は「2026-08-15・2.1.227での観測」に限定されている |
| 完成度 | OK | `要素材` マーカー0件。機械チェックのプレースホルダ警告は誤検出（下記） |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「仕様準拠のプラグインをClaude Code 2.1.227に渡した結果は『半分だけ読める』（スキルは読める / 名前は捨てられる / MCPは登録されない / `claude plugin validate` は exit 1）」 ↔ ログ `RESULTS.md`「結論」節の4点 → **一致**（4項目とも順序・内容とも同一）
- 逐語で照合が取れた主な一次情報:
  - 環境値（Node v22.17.0 / npx 10.9.2 / ajv-cli 5.0.0 / Claude Code 2.1.227 / macOS 26.5 / spec commit `bd38355...`）→ ログ L14 と一致
  - ajv の draft2020 エラー全文、`--spec=draft2020` で valid になる出力 → ログ フェーズ2と一致
  - npx 初回 4.29s / 2回目以降 2.13s → ログ L178, L184 と一致
  - `--debug` では2行しか出ず `--debug-file` で201行 → ログ L385, L709 と一致
  - `claude plugin validate` の両レイアウト出力（`No manifest found in directory. ...` / `Validation passed with warnings`）→ ログ L359, L371 と一致
  - 違反(a)〜(d)＋対照 `totallyBogusField` の出力、`displayName` が正規フィールドと確定した経緯 → ログ L497〜L579 と一致
  - `name` 決定実験（`/renamed-plugin:hello` → Unknown command、`/hello-plugin-renamed:hello` → `SPEC_SKILL_LOADED`）→ ログ L414〜L434 と一致
  - MCP: 仕様レイアウトは grep-exit=1（言及ゼロ）、CC レイアウトは 539ms で接続成功、両方置きは 127ms → ログ L436〜L479, L639 と一致
  - サブプロセス env（`PLUGIN_ROOT=` / `PLUGIN_DATA=` が空、cwd が呼び出し元）と 仕様 §9 / §7.2.2 への言及 → ログ L477〜L479 と一致
  - `extensions` の4段階出力と `--strict` exit=1 → ログ L596〜L618 と一致
  - 再帰探索（`/nested-plugin:deeper` が Unknown command、§7.1 の SHOULD report は出なかった）→ ログ L650〜L668 と一致
  - `claude plugin init` の雛形が仕様スキーマで invalid、`~/.claude/skills/<name>/` に作られ次セッションで自動ロード、`author.email` が git config から自動充填 → ログ L188〜L253 と一致
  - ハマりどころ末尾の `Warning: no stdin data received in 3s` → ログ L669, L797 と一致
  - `ajv-formats` 不要（両スキーマに `format` 0ヒット）→ ログ L71 と一致
  - 仕様の公開日 2026-08-06 → `research/search-topic-20260815-0403.md` L48（同日発表）で裏付けあり
- 創作の疑いがある記述: **なし**。記事のコードブロック（`plugin.json` / `SKILL.md` / `mcp.json` / `echo-server` / 各種CLI出力）はすべて出典ログの workspace 由来の抜粋として確認できた
- 数値の裏付けが取れなかった記述: 予想の内訳「的中5」1件のみ（上記 warning-1）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/agent-plugins-spec-claude-code-half-load.md (slug=agent-plugins-spec-claude-code-half-load) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=40 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 117文字 (60字目安)
[PASS] emoji あり: 🧩
[PASS] topics 4個
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/01-two-layouts.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/02-ccvalidate-asymmetry.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/03-name-precedence.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/04-validator-asymmetry.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/05-extensions-ignored.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/06-mcp-contrast.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/07-nested-skills.png
[PASS] コードフェンスが閉じている: フェンス行=96
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[WARN] プレースホルダ (TODO/FIXME/<slug>/<...> 等) が残っている
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=2
```

### 機械チェックの誤検出の切り分け

- `[WARN] title が長い: 117文字` → **誤検出**。スクリプトが `title:` 行のバイト長を数えているため。実文字数は59文字で目安60字以内。ただし一覧表示の視認性の観点から suggestion-5 として別途記載した。
- `[WARN] プレースホルダが残っている` → **誤検出**。ヒットは以下5か所で、いずれも実出力の引用または一般的なパス表記であり、書き忘れではない。
  - L107 `validate [options] <path>` … `claude plugin --help` の実出力
  - L212 `"description": "TODO: describe what this plugin provides"` … `claude plugin init` が吐いた雛形の実内容（記事の論点そのもの）
  - L215 `"email": "<masked-email>"` … 意図的なマスク
  - L256 / L722 / L759 / L760 `~/.claude/skills/<name>/`, `skills/<name>/SKILL.md`, `--debug-file <path>` … 変数部分を示す一般表記

## 適用した修正

なし（レポートのみの非破壊レビュー）。

## 次のアクション

- [ ] warning-1（予想の内訳の数え方）を直す。`RESULTS.md` の差分表を数え直して「的中6・半分外し1・想定外1」に揃えるのが妥当
- [ ] suggestion-1〜3（前提コメント削除・過去記事リンク・L30の言い回し）は低コストなので同時に対応推奨
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で `published: true` に変えて PR を作成（PR を main にマージすると Zenn で公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。`knowledge/2026-07-01-zenn-slug-already-used.md`）
