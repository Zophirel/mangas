import * as cheerio from 'cheerio'
import type { Chapter, Manga, MangaPage, Page } from './types.js'

export const sourceId = 'mangaworld'
export const baseUrl = 'https://www.mangaworld.mx'
const chapterNumberRegex = /capitolo\s+([0-9]+(?:[.,][0-9]+)?)/iu
const italianMonths: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
}

function absoluteUrl(value: string | undefined, pageUrl: string): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value, pageUrl).href
  } catch {
    return undefined
  }
}

function idFromUrl(url: string): string {
  return `${sourceId}:${new URL(url).pathname.replace(/^\/+|\/+$/g, '')}`
}

export function parseChapterNumber(name: string): number | undefined {
  const value = name.match(chapterNumberRegex)?.[1]?.replace(',', '.')
  const number = value ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : undefined
}

export function parseChapterDate(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')
  const italianDate = normalized.match(/^(\d{1,2})\s+([a-zà-ú]+)(?:\s+(\d{4}))?$/u)
  if (italianDate) {
    const day = Number(italianDate[1])
    const month = italianMonths[italianDate[2]!]
    const year = Number(italianDate[3] ?? new Date().getFullYear())
    if (month !== undefined && day >= 1 && day <= 31)
      return Date.UTC(year, month, day)
  }
  const date = Date.parse(value.trim())
  return Number.isNaN(date) ? undefined : date
}

function mangaFromElement(element: unknown, pageUrl: string): Manga | undefined {
  const node = cheerio.load(element as string)
  const link = node('a').first()
  const url = absoluteUrl(link.attr('href'), pageUrl)
  if (!url) return undefined
  const title = link.attr('title')?.trim() || link.text().trim()
  if (!title) return undefined
  return {
    id: idFromUrl(url),
    sourceId,
    title,
    url,
    thumbnail: absoluteUrl(node('a.thumb img').attr('src') || node('a.thumb img').attr('data-src'), pageUrl),
    genres: [],
  }
}

export function parseSearch(html: string, pageUrl: string): MangaPage {
  const $ = cheerio.load(html)
  const items = $('div.comics-grid .entry')
    .toArray()
    .flatMap((element) => {
      const manga = mangaFromElement(element, pageUrl)
      return manga ? [manga] : []
    })
  const pagination = html.match(/"totalPages":(\d+),"visiblePages":\d+,"page":(\d+)/)
  const currentPage = Number(new URL(pageUrl).searchParams.get('page') ?? pagination?.[2] ?? 1)
  const totalPages = pagination ? Number(pagination[1]) : undefined
  const hasNextLink = $('.pagination-container a, #pagination a, a[rel="next"]').toArray().some((element) => {
    const href = $(element).attr('href')
    if (!href) return false
    const nextUrl = absoluteUrl(href, pageUrl)
    return nextUrl ? Number(new URL(nextUrl).searchParams.get('page') ?? 0) > currentPage : false
  })
  return {
    items,
    hasNextPage: totalPages !== undefined ? currentPage < totalPages : hasNextLink || items.length >= 16,
  }
}

export function parseDetails(html: string, manga: Manga, pageUrl: string): Manga {
  const $ = cheerio.load(html)
  const info = $('div.comic-info').first()
  if (!info.length) throw new Error('mangaworld_manga_not_found')
  const statusText = info.find('a[href*="/archive?status="]').first().text().trim().toLowerCase()
  const status: Record<string, string> = {
    'in corso': 'ongoing',
    finito: 'completed',
    'in pausa': 'paused',
    cancellato: 'cancelled',
  }
  const alternativeTitles = $('div.meta-data > div')
    .toArray()
    .map((el) => $(el).text().trim())
    .find((text) => text.toLowerCase().includes('titoli alternativi'))
  const description =
    [$('div#noidungm').text().trim(), alternativeTitles].filter(Boolean).join('\n\n') || manga.description
  const url = absoluteUrl(manga.url, pageUrl) ?? pageUrl
  return {
    ...manga,
    url,
    title: $('h1').first().text().trim() || manga.title,
    author: info.find('a[href*="/archive?author="]').first().text().trim() || undefined,
    artist: info.find('a[href*="/archive?artist="]').first().text().trim() || undefined,
    thumbnail: absoluteUrl(info.find('.thumb > img').first().attr('src'), pageUrl) ?? manga.thumbnail,
    description,
    status: status[statusText] ?? (statusText || undefined),
    genres: info
      .find('div.meta-data a.badge')
      .toArray()
      .map((el) => $(el).text().trim())
      .filter(Boolean),
  }
}

export function normalizeChapterUrl(value: string, pageUrl: string): string {
  const url = new URL(value, pageUrl)
  if (!url.searchParams.has('style')) url.searchParams.set('style', 'list')
  else if (url.searchParams.get('style') === 'pages') url.searchParams.set('style', 'list')
  return url.href
}

export function parseChapters(html: string, manga: Manga, pageUrl: string): Chapter[] {
  const $ = cheerio.load(html)
  return $('.chapters-wrapper .chapter')
    .toArray()
    .flatMap((element) => {
      const node = $(element)
      const rawUrl = node.find('a.chap').attr('href')
      const url = rawUrl ? normalizeChapterUrl(rawUrl, pageUrl) : undefined
      const name = node.find('span.d-inline-block').text().trim()
      if (!url || !name) return []
      return [
        {
          id: `${manga.id}:${new URL(url).pathname.split('/').filter(Boolean).pop() ?? name}`,
          mangaId: manga.id,
          name,
          url,
          number: parseChapterNumber(name),
          uploadDate: parseChapterDate(node.find('.chap-date').last().text()),
        },
      ]
    })
}

export function parsePages(html: string, chapter: Chapter, pageUrl: string): Page[] {
  const $ = cheerio.load(html)
  const imageUrls = $('div#page img[src], div#page img[data-src]')
    .toArray()
    .flatMap((element) => {
      const imageUrl = absoluteUrl($(element).attr('src') || $(element).attr('data-src'), pageUrl)
      return imageUrl ? [imageUrl] : []
    })
  const chapterData = html.match(/"chapter"\s*:\s*\{[^{}]*?"pages"\s*:\s*(\[[^\]]*\])/s)?.[1]
  if (chapterData && imageUrls.length) {
    try {
      const pageNames: unknown = JSON.parse(chapterData)
      const baseImageUrl = new URL(imageUrls[0]!)
      if (
        Array.isArray(pageNames) &&
        pageNames.length &&
        pageNames.every((name) => typeof name === 'string' && name !== '.' && name !== '..' && !name.includes('/'))
      ) {
        const imageDirectory = new URL('./', baseImageUrl)
        return pageNames.map((name, index) => ({
          index,
          imageUrl: new URL(name, imageDirectory).href,
          headers: { Referer: `${baseUrl}/` },
        }))
      }
    } catch {
      // Fall back to image elements when the site's embedded chapter data changes.
    }
  }
  return imageUrls.map((imageUrl, index) => ({
    index,
    imageUrl,
    headers: { Referer: `${baseUrl}/` },
  }))
}
