// 項目E: test.sequential / describe.sequential の削除
// 5 のエラー: TypeError: test.sequential is not a function
// 直し方: オプションオブジェクトで { concurrent: false } を渡す
import { expect, test } from 'vitest'

test('E: runs sequentially', { concurrent: false }, () => {
  expect(true).toBe(true)
})
