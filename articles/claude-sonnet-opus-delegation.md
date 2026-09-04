---
title: "Sonnet 5だけAgent treeが増える理由――Claude Codeの4層で切り分ける"
emoji: "🌲"
type: "tech"
topics: ["claudecode", "aiagent", "subagent", "sonnet5", "opus5"]
published: true
---

Claude Codeで同じくらいの作業を頼んでも、Sonnet 5ではsubagentやforkが次々に現れ、Opus 5ではmain threadがそのまま処理するように見えることがあります。

この差を「Sonnetの性格」で片づけると、設定で直せる問題までモデル変更で解決しようとしてしまいます。現時点の情報は、次の4層に分けると整理できます。

| 層 | 確認できること | Sonnet 5 / Opus 5の差への意味 | 根拠の強さ |
|---|---|---|---|
| モデル | Sonnet 5はagentic動作、Opus 5は長い仕事の維持と自己検証を強化 | 委譲する／mainで抱える判断と整合するが、頻度の直接証拠ではない | 公式発表 |
| Claude Code共通機構 | background、3層nesting、interactive fork、同時20件 | 一度始まった委譲を目立たせ、木として増幅できる | 公式docs |
| モデル別steering | 2.1.260にOpus 5向けreduced-delegation sectionがある | Opus 5側だけ委譲の入口を狭める構造がある | ローカル静的解析 |
| ローカル設定 | depth、concurrency、forkを別々に制御できる | 症状に合う増幅器だけ止められる | 公式docs＋変数名の静的確認 |

今回、Claude Code 2.1.258〜2.1.260のバイナリを読み取り専用で比較しました。結論は、**Sonnet側では共通機構がfan-outを増幅しやすく、Opus 5側には未依頼の委譲を抑えるモデル別sectionがある**、です。ただし、後者は非公開実装の静的な状況証拠であり、各sessionで有効だったことまでは証明しません。

この記事の持ち帰りは、**Sonnet 5 / Opus 5の委譲差を切り分ける4層診断表と、depth・fork・concurrencyを制御する設定レシピ**です。

## まず、Sonnet 5の「agentic」とAgent call数は分ける

AnthropicはSonnet 5を“the most agentic Sonnet model yet”と位置づけ、planning、browserやterminalのtool use、自律実行の改善を説明しています。[Introducing Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5)

この設計は、Sonnet 5が探索・検証・独立タスクを自律的に分解するという観測と整合します。一方、公式発表は「Opus 5よりAgent toolを何回多く呼ぶ」とは述べていません。ここから直接、subagent頻度のモデル差を断定することはできません。

Opus 5の公式発表は、長いmulti-step analysisを維持し、自分で別手段による検証まで行う例を強調しています。掲載された顧客評価には、Opus 4.8比で約3分の1少ないturn/tool callだった例や、以前なら小さく分割した仕事をそのまま扱えたという報告もあります。[Introducing Claude Opus 5](https://www.anthropic.com/news/claude-opus-5)

こちらもSonnet 5との統制比較ではありません。言えるのは、次の仮説が双方の公式な位置づけと矛盾しない、という範囲です。

```text
Sonnet 5: 自律的に仕事を分ける入口が強い可能性
Opus 5: 長い仕事をmain threadで維持できる可能性
```

## Claude Code側の3変更が、1回の委譲をAgent treeへ増幅する

モデルがAgentを1回呼ぶだけなら、まだ小さな差です。体感を大きく変えるのはClaude Code側の共通機構です。

### 1. v2.1.198でbackgroundが既定になった

公式CHANGELOGでは、v2.1.198からsubagentがbackgroundで動くのが既定になりました。main agentはsubagentの完了待ちだけに専念せず、別の作業を続けられます。同じ版でExplore agentはHaiku固定ではなくmain sessionのmodelを継承し、subagentもextended thinking設定を継承するようになりました。[Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)

直列なら「Aを呼ぶ→待つ→次へ」だった処理が、backgroundでは「Aを開始→mainが継続→Bを開始」に見えます。spawn数が同じでも、画面上の並列性は強くなります。

### 2. v2.1.219でnested depthの既定が3へ戻った

現行docsでは、subagentはmainの下3層まで別のsubagentをspawnできます。変更履歴は次のとおりです。[Create custom subagents](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)

| Claude Code | 既定の最大層 | 意味 |
|---|---:|---|
| 2.1.172〜2.1.216 | 5 | 深いnestingが可能、設定変更不可 |
| 2.1.217〜2.1.218 | 1 | 子は再委譲しない |
| 2.1.219以降 | 3 | 子、孫まで再委譲できる |

各agentが3つに分けると、理論上は次の形を作れます。

```text
main
└─ 3 agents
   └─ 9 agents
      └─ 27 agents
```

実際には、Agent toolから同時実行できるsubagentは既定20件です。ただしdocsは、session全体の総spawn数には固定上限がないとも説明しています。[Concurrent subagent limit](https://code.claude.com/docs/en/sub-agents#concurrent-subagent-limit)

### 3. v2.1.232以降、interactive sessionではfork modeが既定on

forkは通常のsubagentと違い、親のconversation history、system prompt、tools、model、prompt cacheを引き継ぎます。背景をdelegation promptへ要約し直さず、同じ出発点から別方向を調べたいときに合理的です。[Fork the current conversation](https://code.claude.com/docs/en/sub-agents#fork-the-current-conversation)

現行docsでは、fork modeはinteractive sessionで既定on、`-p`とAgent SDKでは既定offです。fork modeがonのときは、fork以外を含むsubagent spawnもbackgroundになります。このため、長い会話ほど「forkして並列に調べる」選択がUI上で目立ちます。

まとめると、Sonnet側の体感は次の掛け算として理解できます。

```text
委譲を始める判断
× backgroundで並行表示
× 最大3層の再委譲
× 親文脈を再利用できるfork
= 目立つAgent tree
```

## Opus 5には2.1.260でもreduced-delegation sectionがある

Sonnet / Opusの非対称性を最も具体的に説明するのが、Claude Codeのモデル別system-prompt assemblyです。ただし、ここからは公式仕様ではなくバイナリの静的解析です。

2026年7月のGitHub Issueでは、Claude Code 2.1.219 / 2.1.220に次の趣旨の文面があり、`opus_5_prompt_bundle` capabilityでgateされていたと報告されました。

```text
Do not call the AgentTool unless the user requested it
```

Issue投稿者は、2.1.218にはなく2.1.219から現れたこと、別の環境では暗黙依頼で0/14、明示依頼で12/14のdispatchだったことも報告しています。[Issue #80988](https://github.com/anthropics/claude-code/issues/80988)、[Issue #82456](https://github.com/anthropics/claude-code/issues/82456)

これはAnthropicの公式説明ではなく、特定版・特定ユーザーによるreverse engineeringと再現結果です。さらに、現在も同じ完全一致文があるとは限りません。

### 2.1.258〜2.1.260を静的比較した結果

2026-09-05に、手元に残っていた3版をmodel APIを呼ばずにscanしました。

| Version | 旧い完全一致文 | 更新文の安定部分 | `opus5_reduced_delegation` | gate token |
|---|---:|---:|---:|---:|
| 2.1.258 | 0 | 2 | 2 | 2 |
| 2.1.259 | 0 | 2 | 2 | 2 |
| 2.1.260 | 0 | 2 | 2 | 2 |

件数はバイナリ内の出現数であり、promptへの注入回数ではありません。旧い完全一致文は0件でしたが、次の更新templateの安定部分は3版にありました。`${…}`はminify後の内部変数名で、版によって変わります。

```text
Do not use the ${…} tool, workflows, or deep-research unless the user,
a CLAUDE.md file, or a skill asks for it
```

2.1.260ではさらに、次を機械検証しました。

- `claude-opus-5`のmodel entryは`opus_5_prompt_bundle` capabilityを持つ
- `claude-sonnet-5`のmodel entryは同capabilityを持たない
- `opus5_reduced_delegation` sectionはmodel capabilityのgateを確認する
- `tengu_slate_bittern`というflagをdefault trueとして確認する分岐がある
- 旧文面または更新文がdynamic sectionに含まれる場合、重複追加を避ける分岐がある

ここまでなら、Opus 5にだけ未依頼の委譲を抑える構造がある、という説明には強い根拠があります。しかし、静的にcodeがあることと、対象sessionでそのsectionが有効だったことは別です。server/client-data flagの実値、実際に組み立てられたsystem prompt、同一taskでのAgent call数は今回測れていません。

したがって、この記事では次の強さで扱います。

| 言える | 言えない |
|---|---|
| 2.1.260にOpus 5向けreduced-delegation構造がある | すべてのOpus 5 sessionで必ず有効 |
| Sonnet 5 entryには同じcapabilityがない | Sonnet 5が必ずAgentを大量spawnする |
| 観測されたSonnet / Opus差と整合する | このsteeringだけが差の原因 |

## 症状から、止める増幅器を選ぶ

Agent treeが気になるとき、いきなりOpus 5へ替える前に症状を見ます。

| 症状 | 最初に疑う層 | 選ぶ対策 |
|---|---|---|
| 子がさらに子を作る | nesting | spawn depthを`1`にする |
| 横に多数が同時起動する | concurrency | 同時数をworkloadに合う値へ下げる |
| 長い会話でforkが増える | fork mode | forkだけoffにする |
| background表示が多く、待たずに増える | background / fork | fork modeまたはbackground運用を見直す |
| Opus 5が自発的にcustom agentを選ばない | model steering候補 | prompt、CLAUDE.md、skillで必要な委譲を明示する |
| Agent自体が不要 | tool permission | Agent toolをdenyする |

公式docsに基づく、3つをまとめた`settings.json`例です。

```json
{
  "env": {
    "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1",
    "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "4",
    "CLAUDE_CODE_FORK_SUBAGENT": "0"
  }
}
```

- `MAX_SUBAGENT_SPAWN_DEPTH=1`: mainからの1層は許すが、subagent自身の再委譲を止める
- `MAX_CONCURRENT_SUBAGENTS=4`: Agent tool経由の同時spawnを4件に絞る。`4`は例であり、固定の推奨値ではない
- `FORK_SUBAGENT=0`: interactiveを含む全sessionでfork modeをoffにする

この3設定を一度に入れる必要はありません。たとえば「子が子を作る」だけならdepth 1で十分です。forkの文脈継承が役立っているなら、forkを残してconcurrencyだけ下げる方が目的に合います。[環境変数と挙動の公式説明](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)

なお、今回のsuccessful runで確認したのは3変数が2.1.260に存在することまでです。設定値を変えたlive model behaviorは、利用枠のため測定できませんでした。値の意味は公式docsを根拠にしています。

## 自分の版でprompt候補を確認する

Issueにある旧文面だけを検索すると、2.1.260では「消えた」と誤解します。旧文面、現行section名、更新文の安定部分を分けて確認します。

```bash
binary="$(readlink "$(command -v claude)")"

grep -a -F "Do not call the AgentTool unless the user requested it" "$binary"
grep -a -F "opus5_reduced_delegation" "$binary"
grep -a -F "tool, workflows, or deep-research unless the user" "$binary"
```

何も出ないことは、「steeringが存在しない」ことの完全な証明ではありません。文面やminified symbolが変わる可能性があり、server側だけで追加される情報も静的scanでは見えないためです。逆に文字列が出ても、そのsessionへ実際に注入された証明にはなりません。

## 結論: モデルを替える前に、4層を順番に見る

Sonnet 5でAgent treeが目立つ現象は、少なくとも次の組み合わせで説明できます。

1. Sonnet 5は公式にagenticな自律実行を強化している
2. Claude Codeはsubagentをbackgroundで動かしやすい
3. nested subagentは既定3層まで増えられる
4. interactive sessionではfork modeが既定on

Opus 5側では、長いtaskをmain threadで扱う公式なモデル特性に加え、2.1.260にも未依頼のAgent利用を抑えるモデル別sectionが静的に確認できました。ここは観測差を説明する強い状況証拠ですが、各sessionでの有効化や因果までは未確認です。

判断順はシンプルです。子が増えるならdepth、横に増えるならconcurrency、forkが目立つならfork modeを先に調整します。それでもSonnet / Opusで入口の差が残るときに、モデル特性とモデル別steeringを疑う。この順なら、有用な並列性を全部捨てずに、必要な増幅器だけ止められます。

## 検証条件と参考資料

- 検証日: 2026-09-05
- Current CLI: Claude Code 2.1.260
- 比較binary: 2.1.258、2.1.259、2.1.260
- 方法: Node.jsによるread-only static scan。model API、network、binary writeは不使用
- 制限: 1台のmacOS環境、3版、静的解析のみ。実modelのfan-out頻度比較ではない

参考資料:

- [Introducing Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5)
- [Introducing Claude Opus 5](https://www.anthropic.com/news/claude-opus-5)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [GitHub Issue #80988](https://github.com/anthropics/claude-code/issues/80988)
- [GitHub Issue #82456](https://github.com/anthropics/claude-code/issues/82456)
