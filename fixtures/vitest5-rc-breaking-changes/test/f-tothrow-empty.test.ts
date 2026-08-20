// 項目F: toThrow('') の意味変更
// 5 のエラー: AssertionError: expected [Function boom] to throw error not including ''
//   → 空文字はどのメッセージにも「含まれる」ため、toThrow('') が任意のエラーに一致する
// 直し方: 空文字マッチに頼らず、意図を明示的に書く
import { expect, test } from 'vitest'

function boom(): never {
  throw new Error('boom happened')
}

function silent(): never {
  throw new Error('')
}

test("F: toThrow('') now matches any error message", () => {
  // 5 では空文字が任意一致になったので、これが通る（4.1 では落ちた）
  expect(boom).toThrow('')
})

test('F: 「空メッセージだけに一致させたい」ときは正規表現で厳密に書く', () => {
  expect(silent).toThrow(/^$/)
  expect(boom).not.toThrow(/^$/)
})
