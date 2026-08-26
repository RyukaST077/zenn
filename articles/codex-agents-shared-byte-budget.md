---
title: "Codexのnested AGENTS.mdを共有バイト上限から守る検証gate"
emoji: "📏"
type: tech
topics: [codex, aiagent, cli, automation]
published: true
---

モノレポのルート`AGENTS.md`が大きくなっても、サービス配下の`AGENTS.md`へ移した重要なテスト・migration・生成手順はCodexに届くでしょうか。後の階層に置けば優先されるとしても、そもそもmodel-visibleな入力へ入らなければ、その優先順位は働きません。

2026年8月24日、Codex CLI `0.147.0`で`project_doc_max_bytes=128`に固定し、ルートから`service/`までの2つの`AGENTS.md`を`codex debug prompt-input`で調べました。合計76 bytesのcontrolではroot/leaf markerが`1/1`、rootだけで128 bytesを使うtreatmentでは`1/0`でした。

この1回のboundary caseから得られる実務上の答えは、**nested fileへ移せば必ず見えるとは仮定せず、実際のcwdからcritical markerがrendered inputに入るかをgateする**ことです。少なくとも今回の`0.147.0`では、上限はfileごとではなく、rootから消費される1つの共有budgetとして観測されました。

## 問題は優先順位より前に起きる

OpenAIの`AGENTS.md`ドキュメントは、Codexがproject rootからcwdへ向かってdocumentを集め、**combined size**が`project_doc_max_bytes`へ達すると追加を止める、と説明しています。一方、advanced configurationには各`AGENTS.md`から読む量という表現もあり、fileごとの上限とも読めます。[^agents-md] [^advanced-config]

version固定のsourceでは、`0.147.0`のloaderが1つのremaining counterを作り、rootからleafへ読みながら減らしています。[^agents-source] ただし、sourceを読んだだけでは、手元のCLI、cwd、Git root discovery、設定値を含む実際の入力を確認したことにはなりません。

そこで、modelに「どの指示を読んだか」と答えさせる代わりに、experimental commandの`codex debug prompt-input`を使いました。このcommandはmodel-visibleなprompt inputをJSONとしてrenderするため、instruction discoveryをmodelの応答品質から切り離して検査できます。[^prompt-input]

## controlを先に通す2-probe gateにする

検証では、同じGit-root-to-`service/` topology、同じCLI、cwd、128-byte cap、ASCII marker、parserを使い、root paddingだけを変えました。

| probe | root | leaf | 合計 | 事前に登録した判定 |
| --- | ---: | ---: | ---: | --- |
| short-root control | 38 bytes | 38 bytes | 76 bytes | root/leafが`1/1`でなければinconclusive |
| root-fills-budget | 128 bytes | 38 bytes | 166 bytes | leaf `0`なら共有budget、`1`ならfile別budget |

2つのprobeでleaf fileはbyte-identicalです。treatmentで変えたのはrootへのASCII paddingだけです。したがって、controlが`1/1`なら、cwd relation、Git root discovery、marker countの入口が動作していることを先に確認できます。

実際のchild commandはnested directoryから次の形で呼びました。

```sh
codex -c project_doc_max_bytes=128 \
  debug prompt-input \
  'Render the exact model-visible prompt inputs for this inert project-document budget fixture. Do not start a model turn or perform any task.'
```

実行wrapperは各processを45秒でtimeoutし、networkと使い捨てruntime外へのwriteをmacOS `sandbox-exec`で拒否しました。JSONはmemory上で全string valueを再帰的に走査し、marker count、file size、hash、exit factsだけを残して、生のprompt inputは破棄しました。

判定の核は次の形です。

```text
CONTROL_VALID =
  control.root == 1
  AND control.leaf == 1

SHARED_BUDGET_SUPPORTED =
  CONTROL_VALID
  AND treatment.root == 1
  AND treatment.leaf == 0

PER_FILE_BUDGET_OBSERVED =
  CONTROL_VALID
  AND treatment.root == 1
  AND treatment.leaf == 1

INCONCLUSIVE = 上記以外
```

controlを省いてproduction側のleaf markerだけを数えると、file discoveryの失敗、cwdの誤り、parserの問題まで「budgetを使い切った」と誤判定できます。2-probeにする理由は、この代替説明を先に落とすためです。

## rootが上限を使うとnested markerは消えた

記録された結果は、事前登録した共有budget側のmatrixと一致しました。

| 観測値 | short-root control | root-fills-budget |
| --- | ---: | ---: |
| root marker count | 1 | 1 |
| leaf marker count | 1 | 0 |
| 訪問したJSON string value | 34 | 34 |
| process | exit 0、timeoutなし | exit 0、timeoutなし |

case wrapperとverifierもexit `0`で、verifierは`OUTCOME_SHARED_PROJECT_DOC_BUDGET_SUPPORTED`を出しました。live probeは2回、retryは0回、model turnは0回です。raw prompt JSONは保持していません。

この差は、同じ128 bytesを各fileへ配る解釈とは一致しません。per-fileなら、treatmentでも38-byteのleaf markerが`1`回見えるはずだからです。今回の条件では、rootが128-byte allowanceを使い切った時点で、後続のnested documentはmodel-visible inputに入りませんでした。

## モノレポではcritical markerの可視性を採用条件にする

小さなfixtureを実務へ写すと、次の対応になります。

| fixture | 実運用での意味 | action |
| --- | --- | --- |
| root padding | repository-wide policyとboilerplateの増加 | always-loadedな内容を小さくする |
| nested leaf marker | service固有のtest、migration、生成、完了条件 | automationと同じcwdからpresenceをgateする |
| control `1/1` | discoveryとcounterがknown-good | これが通ってから本番側のabsenceを解釈する |
| treatment `1/0` | earlier documentが共有capを消費 | rootを縮める、detailをon-demandへ移す、または測定後にcapを上げる |
| marker visible | instructionがmodel-visible inputへ到達 | obedienceの保証には使わず、testやlintも残す |

重要なのは、「同じ内容をnested `AGENTS.md`へ分割する」だけでは解決しない点です。root側のbytesが残ったままなら、今回のように後続fileへ到達する前に共有capを使い切れます。常時必要でない詳細はskillやscriptへ移す、root guidanceを短くする、または実測後に`project_doc_max_bytes`を上げる必要があります。

変更後は、workflowが実際に起動するcwdからmarker gateを再実行します。CLI upgrade後も、古いversionの結果を引き継がず再検査します。

## そのまま使える再検証recipe

今回通過したrepository harnessは、次の1 commandで同じcontrol/treatmentを作成し、redacted resultを検証します。

```sh
node scripts/agent-practice/run-experiment.mjs \
  practice/agent/agent-practice-codex-project-doc-shared-budget-20260824-2250.json
```

別のCIへ移植するときも、次の条件はセットで残します。

1. disposable Git rootとnested cwdを作り、CLI versionとcapを固定する
2. controlはroot+leafをcap以下、treatmentはrootだけをcap exactlyにする
3. leaf fileを両probeでbyte-identicalにし、random ASCII markerを使う
4. nested cwdから`debug prompt-input`を各1回、timeout付きで実行する
5. raw JSONをfileやlogへ出さず、memory上でmarker count、size、hash、exit factsへ縮約する
6. control `1/1`を先に要求し、treatment `1/0`だけを共有budgetのsupportとする
7. version、Git root、bytes、JSON parse、uniqueness、processのgateが1つでも崩れたら`INCONCLUSIVE`で止め、retryで押し切らない

productionの`AGENTS.md`そのものへpaddingを足すのではなく、必ずdisposable fixtureで境界を作ります。markerは秘密情報を含まない一意な文字列にし、生の`prompt-input`をartifactへ保存しない設計にします。

## この結果が保証しないこと

これはCodex CLI `0.147.0`、macOS host、`project_doc_max_bytes=128`、ASCII content、rootとnestedの2階層、Git-root discoveryについて、1 manifest case内で2 probeを各1回実行したcase studyです。

次は実行していません。

- documented defaultの32 KiB、より深いdirectory chain、non-Git discovery
- Unicodeのbyte境界、別OS、別CLI versionでのtruncation
- visibleな複数instruction間のprecedence
- modelがvisibleなinstructionへ従うか、task品質が上がるか
- 繰り返しrunや複数machineでの再現率

modelとreasoning effortのoverrideはありませんが、そもそもmodel turnを要求しておらず、backend model snapshotも解決していません。そのため、model性能やtoken効率の比較には使えません。また、使い捨てruntimeとsandboxは今回のevidence boundaryであり、host全体のsecurity保証ではありません。

採用判断は、file配置そのものではなくrendered visibilityへ置きます。**criticalなnested instructionごとに無害なmarkerを設け、実際のcwdからcontrol付きで数える。消えていればrootを縮めるかdetailをon-demandへ移し、必要なら測定してcapを上げた後に再実行する**。これが、root guidanceの成長でservice固有の指示を静かに失わないための最小gateです。

## 参考資料

[^agents-md]: [OpenAI, Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)（2026-08-24閲覧）
[^advanced-config]: [OpenAI, Advanced Configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)（2026-08-24閲覧）
[^prompt-input]: [OpenAI, Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)（2026-08-24閲覧）
[^agents-source]: [openai/codex `agents_md.rs` at `rust-v0.147.0`](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/core/src/agents_md.rs)（2026-08-24閲覧）
