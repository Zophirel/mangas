import { describe, expect, it } from 'vitest'
import { parseChapters, parseChapterNumber, normalizeChapterUrl } from '../src/parser.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Manga } from '../src/types.js'

const fixture = readFileSync(fileURLToPath(new URL('../fixtures/chapter.html', import.meta.url)), 'utf8')
const manga: Manga = {
  id: 'mangaworld:manga/alpha',
  sourceId: 'mangaworld',
  title: 'Alpha',
  url: 'https://www.mangaworld.mx/manga/alpha',
  genres: [],
}
describe('MangaWorld chapter parser', () => {
  it('normalizes the pages style to list', () => {
    expect(normalizeChapterUrl('/manga/alpha/capitolo-12?style=pages', manga.url)).toContain('style=list')
  })
  it('normalizes chapter numbers and metadata', () => {
    const result = parseChapters(fixture, manga, manga.url)
    expect(result[0]).toMatchObject({ number: 12, url: 'https://www.mangaworld.mx/manga/alpha/capitolo-12?style=list' })
    expect(parseChapterNumber('Capitolo 12')).toBe(12)
  })
})
