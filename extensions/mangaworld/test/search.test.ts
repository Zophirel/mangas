import { describe, expect, it } from 'vitest'
import { parseSearch } from '../src/parser.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixture = readFileSync(fileURLToPath(new URL('../fixtures/search.html', import.meta.url)), 'utf8')
describe('MangaWorld search parser', () => {
  it('maps entries and absolute URLs', () => {
    const result = parseSearch(fixture, 'https://www.mangaworld.mx/archive?page=1')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      id: 'mangaworld:manga/alpha',
      title: 'Alpha',
      thumbnail: 'https://www.mangaworld.mx/images/alpha.jpg',
    })
    expect(result.hasNextPage).toBe(false)
  })
})
