// 項目B: clearMocks の既定値が true に
// 5 のエラー: AssertionError: expected +0 to be 1
//   → 各テスト前に vi.clearAllMocks() が走り、beforeAll で積んだ履歴が消えている
// 直し方は2通り:
//   (1) 新しい既定に合わせる: 履歴が必要なら beforeAll ではなくテスト内で呼ぶ（本ファイルはこちら）
//   (2) 旧挙動を維持する: vitest.config.ts に clearMocks: false を書く
import { beforeAll, expect, test, vi } from 'vitest'

const spy = vi.fn(() => 'called')

beforeAll(() => {
  spy()
})

test('B: history from beforeAll is cleared on v5 (default clearMocks: true)', () => {
  // 5 の既定では beforeAll の呼び出し履歴は消えているので 0
  expect(spy.mock.calls.length).toBe(0)

  // テスト内で呼べば当然カウントされる
  spy()
  expect(spy.mock.calls.length).toBe(1)
})
