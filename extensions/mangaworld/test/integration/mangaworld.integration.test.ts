import { describe, it } from 'vitest'
import { source } from '../../src/index.js'

describe.skip('MangaWorld live integration (opt-in)', () => {
  it('searches the live site only when explicitly enabled', async () => {
    if (process.env.RUN_MANGAWORLD_INTEGRATION !== '1') return
    await source.search('one piece', 1)
  })
})
