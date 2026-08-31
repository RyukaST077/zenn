---
title: "Claude Code 2.1.248でCLAUDE_CONFIG_DIR上書きを試したらログインごと壊れた話"
emoji: "🗝️"
type: "tech"
topics: ["claudecode", "anthropic", "security", "devops", "ci"]
published: false
---

## この記事で分かること

Claude Code の CHANGELOG には、`2.1.251` で「プロジェクト直下の `.claude/settings.json` の `env` から `CLAUDE_CONFIG_DIR` / `CLAUDE_CODE_TMPDIR` / `TMPDIR` などを読まないようにした」と書かれています。裏を返せば、それ以前のバージョンではプロジェクト設定の `env` がこれらを読んでいた可能性がある、という含みです。

ピン留めした `2.1.248`(3バージョン前)を CI で使っていて、初見リポジトリを自動処理する場合、この changelog の1行だけでは「自分の環境が今どれだけ危険か」は判断できません。`.claude/settings.json` の `env.CLAUDE_CONFIG_DIR` を書き換えるだけで、信頼していないリポジトリが Claude 自身の設定ディレクトリへの書き込み先を差し替えられるのか——それを実機の `2.1.248` で直接確認しようとした記録です。

結論から言うと、**きれいな合否判定には到達しませんでした**。ただし、判定が壊れる直前に取れた生テレメトリは、「このプロジェクト設定の上書きは少なくとも1つの内部パス解決サブシステムに届いている」ことを示しており、「`2.1.248` は保護されている」と決め打ちしてよい根拠にはなりません。

## 検証条件

- Claude Code `2.1.248` (macOS 26.5 arm64)、`--permission-mode bypassPermissions` の非対話1ターン
- プロンプトは `Respond with exactly PROBE_OK and nothing else. Do not use any tool.` のみ、ツール呼び出しなし
- 比較した2ケース(差分は `.claude/settings.json` の中身のみ)

| ケース | `.claude/settings.json` | 期待される観測先 |
|---|---|---|
| `configdir-control` | `{"env": {}}` | `safe-default-config`(既定) |
| `configdir-treatment` | `{"env": {"CLAUDE_CONFIG_DIR": ".../override-config"}}` | 上書きが効けば `override-config`、効かなければ `safe-default-config` |

事前登録した判定ルールは「エージェントの終了コードが 0 でないケース(タイムアウト含む)は、上書きが効いた/効いていないのどちらの結果としても報告してはならない」という inconclusive 扱いでした。

## 何が起きたか:両ケースともログイン認証で即死した

両ケースとも `agent_exit_code: 1`、`verifier_exit_code: 1`、`marker_observed: null` で、事前登録した検証ゲート自体を通過できませんでした。

```text
verify: agent exit code was 1, expected 0
```

生イベントを見ると、どちらのケースも1ターン目で認証エラーとして終了しています。

```json
{"error":"authentication_failed","content":[{"type":"text","text":"Not logged in · Please run /login"}]}
```

これは狙って壊したわけではなく、テスト用ハーネスの設計が原因です。認証情報を漏らさないため、ハーネスは `CLAUDE_CONFIG_DIR` を毎回「使い捨ての空ディレクトリ」に強制し、環境変数からも資格情報らしき値を除去しています。つまりこの構成では、上書きが効こうが効くまいが、どちらのケースも有効なログインセッションに到達できないよう最初から作られていました。認証失敗は「この上書きの有無で結果が変わる」観測ではなく、隔離設計そのものの副作用です。

事前登録ルール通りに読めば、両ケースとも終了コード 1 のため、`CLAUDE_CONFIG_DIR` の上書きが効くか効かないかについて、この実験は**判定不能**です。

## それでも壊れる前に見えたもの:`memory_paths.auto` の分岐

認証失敗より前、プロセス起動直後の `system/init` イベントには `memory_paths.auto` という内部フィールドが記録されます。この値が、コントロール/トリートメントの2ケースで正確に分かれていました。

```text
configdir-control:
  memory_paths.auto = .../probe-configdir-control/safe-default-config/projects/.../memory/

configdir-treatment:
  memory_paths.auto = .../probe-configdir-treatment/override-config/projects/.../memory/
```

この実験で制御された変数は `.claude/settings.json` の中身だけです。他に差がない以上、この分岐の説明は「プロジェクト設定の `env.CLAUDE_CONFIG_DIR` が読まれ、自動メモリパスの計算に反映された」以外に見当たりません。

一方、同じプロセスが起動直後に書き込むグローバルな `.claude.json`(と そのバックアップ)は、トリートメント側でも `safe-default-config`(ハーネスが強制した既定の環境変数側)に書かれていました。

```text
configdir-control:    .claude.json → safe-default-config/
configdir-treatment:  .claude.json → safe-default-config/   ← override-config ではない
```

つまり同一プロセス内で、少なくとも次の2つの結果が両立していました。

- `memory_paths.auto`(プロジェクトメモリのパス計算): プロジェクト設定の上書きに追随した
- `.claude.json` の書き込み先: 起動直後に強制された環境変数側のまま、上書きに追随しなかった

これは「上書きが効く/効かない」の単純な二値ではなく、サブシステムごとに読みに行くタイミングや情報源が異なる可能性を示しています。ただし `override_entries: []` が示す通り、トリートメント側の `override-config` ディレクトリには最終的に何も書き込まれておらず(ログイン失敗で1ターンで終了したため)、他のサブシステムが実際にそこへ書き込みまで進んだかどうかは、今回の証拠からは確認できません。

## この結果をどう扱うべきか

**判定不能な実験を「上書きは効かない」の根拠にしてはいけません。** `memory_paths.auto` の分岐は、プロジェクト設定の `CLAUDE_CONFIG_DIR` が少なくとも1つの内部パス解決に届いていることを直接示す観測であり、「無害だった」と読み替える余地はありません。

現時点で取れる実務上の判断は次の2点です。

1. **`2.1.248` ピン留め環境は「保護されている」とみなさない。** 終了コード 0 で完走した両ケースの比較が取れるまでは、`2.1.248` はプロジェクト設定の `CLAUDE_CONFIG_DIR` 上書きに対して未検証かつ露出している可能性がある、という前提で扱うべきです。`CLAUDE_CONFIG_DIR` はプロジェクト単位ではなく、ユーザー設定または管理設定(managed settings)側でピン留めし、初見・信頼していないリポジトリの `.claude/settings.json` に決定権を渡さない構成にしてください。
2. **`CLAUDE_CONFIG_DIR` を隔離するCI/自動化ハーネスは、認証状態を別途確保する。** 今回のハーネスのように `CLAUDE_CONFIG_DIR` を使い捨てディレクトリへ強制すると、有効なセッション資格情報もそこから見えなくなり、ログイン自体が即座に落ちます。これはこの実験特有の失敗ではなく、同種の隔離を行う自動化パイプライン全般で再現するはずの運用上の罠です。

## この結果の限界

- ケースごとに1回のみの実行で、`memory_paths.auto` の分岐が安定した挙動か偶然かは未確認です。
- 事前登録していたファイルシステム上のオラクル(`override_entries` / `safe_default_entries`)は、プロセスが1ターンで異常終了したため、判定に使える書き込みを一度も観測できませんでした。使えた手がかりは `memory_paths.auto` という診断用メタデータのみで、これは元々の判定基準ではありません。
- macOS/arm64 の1ホスト、`2.1.248`、ツール呼び出しなしの2ターン制限プロンプトという条件に閉じた結果です。`CLAUDE_CODE_TMPDIR` / `TMPDIR`、`settings.local.json`、対話セッション、他バージョンについては何も示していません。
- 再現可能な確定的な設定レシピ(「これを書けば安全」)は、今回の証拠からは得られていません。オフラインのプリフライト(フェイクCLIでのリハーサル)はハーネス自体の配線としては両ケースとも成功しており、認証を通す形に直せば再実行は可能です。

## まとめ:次に何をすべきか

`2.1.248` を使い続けるなら、`CLAUDE_CONFIG_DIR` はプロジェクト設定に委ねず、ユーザー/管理設定側で固定してください。これは changelog が推奨する `2.1.251` 以降の挙動を先取りする形の防御であり、判定不能だった今回の結果のもとでも取れる保守的な選択です。あわせて、同様の境界を自動テストするハーネスを組む場合は、`CLAUDE_CONFIG_DIR` の隔離と有効なログインセッションの両立を先に検証してから、本題の上書き挙動を計測する順序にすることを勧めます。
