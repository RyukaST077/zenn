// 項目D: vi.mock / vi.hoisted はトップレベル必須
// 5 のエラー: Error: 1 call in "..." was defined outside of the module's top level scope
// 直し方: 関数の中から出して、モジュールのトップレベルに置く
import { expect, test, vi } from 'vitest'

vi.mock('./fixtures/greeter.ts', () => ({ greet: () => 'mocked' }))

test('D: vi.mock at top level', async () => {
  const mod = await import('./fixtures/greeter.ts')
  expect(mod.greet()).toBe('mocked')
})
