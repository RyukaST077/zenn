// Shared data for registration and pipeline tests; registration itself stays real.
export const articleContract = (slug = 'review-continuity-fixture') => ({
  slug, policyVersion: '2026-09-05.1', experimentId: null, arm: 'exploration',
  valueArchetype: 'decision', targetReader: '設定を選ぶ開発者',
  readerDecision: '用途に合う設定を選べる', takeaway: '設定の選択表',
  verificationItems: ['設定A', '設定B', '設定C'], titleDraft: '設定の選択を検証する',
  primaryTopic: 'test', topics: ['test'], demandEvidence: 'fixture',
});
export const researchText = contract => '# Research\n\n## 記事契約\n\n```json\n' + JSON.stringify(contract) + '\n```\n';
