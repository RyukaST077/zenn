// 項目A: 未 await の非同期 assertion
// 5 のエラー: Promise returned by `expect(actual).resolves.toBe(expected)` was not awaited.
// 直し方: テストを async にして assertion を await する（エラーメッセージが直し方をそのまま提示する）
import { expect, test } from 'vitest'

test('A: resolves with await', async () => {
  await expect(Promise.resolve(1)).resolves.toBe(1)
})
