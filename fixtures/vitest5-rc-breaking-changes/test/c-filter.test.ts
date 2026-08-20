// 項目C: -t (testNamePattern) の区切り
// 4.1: suite 名とテスト名はスペース連結 → 'math adds' がマッチ
// 5:   ' > ' 連結のフルネームに照合 → 'math > adds' がマッチ、はず
import { describe, expect, test } from 'vitest'

describe('math', () => {
  test('adds', () => {
    expect(1 + 2).toBe(3)
  })
})
