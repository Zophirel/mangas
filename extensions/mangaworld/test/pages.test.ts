import { describe, expect, it } from 'vitest'
import { parsePages, parseDetails } from '../src/parser.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Chapter, Manga } from '../src/types.js'

const chapterHtml = readFileSync(fileURLToPath(new URL('../fixtures/chapter.html', import.meta.url)), 'utf8')
const mangaHtml = readFileSync(fileURLToPath(new URL('../fixtures/manga.html', import.meta.url)), 'utf8')
const manga: Manga = {
  id: 'mangaworld:manga/alpha',
  sourceId: 'mangaworld',
  title: 'Alpha',
  url: 'https://www.mangaworld.mx/manga/alpha',
  genres: [],
}
const chapter: Chapter = {
  id: 'mangaworld:manga/alpha:capitolo-12',
  mangaId: manga.id,
  name: 'Capitolo 12',
  url: 'https://www.mangaworld.mx/manga/alpha/capitolo-12?style=list',
}
describe('MangaWorld details and pages parser', () => {
  it('maps details and status', () => {
    expect(parseDetails(mangaHtml, manga, manga.url)).toMatchObject({
      author: 'Writer',
      artist: 'Artist',
      status: 'ongoing',
      genres: ['Azione', 'Fantasy'],
      description: 'Una trama di prova.',
    })
  })
  it('maps image pages with referer header', () => {
    const pages = parsePages(chapterHtml, chapter, chapter.url)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toMatchObject({
      index: 0,
      imageUrl: 'https://www.mangaworld.mx/pages/1.jpg',
      headers: { Referer: 'https://www.mangaworld.mx/' },
    })
  })
})
