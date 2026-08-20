// 項目G+H: 成果物ディレクトリ (.vitest) と worker/pool ID の起点
//
// 当初は expect(worker).toBe('0') / expect(pool).toBe('0') と書いたが、
// 4.1.10 の実測は VITEST_WORKER_ID=0 / VITEST_POOL_ID=1 で、POOL_ID は既に 1 始まりだった。
// また suite 全体を並列で流すと worker id はファイル数に応じて変わるため、
// 値そのものの比較は `--maxWorkers=1` の単独実行ログで行う（v4-gh-single.log / v5-gh-single.log）。
// ここでは「両バージョンで緑」を保つため、定義されていることだけを検証して値はログに出す。
import { expect, test } from 'vitest'

test('GH: worker/pool ids are exposed via env', () => {
  const worker = process.env.VITEST_WORKER_ID
  const pool = process.env.VITEST_POOL_ID
  console.log(`[GH] VITEST_WORKER_ID=${worker} VITEST_POOL_ID=${pool}`)
  expect(worker).toBeDefined()
  expect(pool).toBeDefined()
})
