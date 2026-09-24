import { ChapterSchema, MangaPageSchema, MangaSchema, PageSchema } from '@manga/shared'
import type { Source } from '@manga/extension-sdk'
import type { Chapter, Manga, MangaPage, Page } from '@manga/shared'

const baseUrl = 'https://atsu.moe'
const headers = { Accept: 'application/json', Referer: `${baseUrl}/`, 'User-Agent': process.env.ATSU_USER_AGENT ?? 'Mangrove/0.1 (+self-hosted manga library)' }

type SearchDocument = { id: string; title: string; posterMedium?: string; synopsis?: string; status?: string; authors?: string[]; genreNames?: string[] }
type AtsuMangaPage = { id: string; title: string; poster?: { mediumImage?: string; image?: string }; synopsis?: string; status?: string; authors?: { name: string }[]; genres?: { name: string }[] }
type ApiChapter = { id: string; title?: string; number?: number; createdAt?: number }
type ApiPage = { number: number; image: string }

function absoluteUrl(path: string | undefined) { return path ? new URL(path, baseUrl).href : undefined }
function mangaId(item: Manga) {
  const id = item.id.startsWith('atsu:') ? item.id.slice('atsu:'.length) : ''
  if (!/^[\w-]+$/.test(id)) throw new Error('atsu_manga_id_invalid')
  return id
}
function fromSearch(item: SearchDocument): Manga {
  return MangaSchema.parse({ id: `atsu:${item.id}`, sourceId: 'atsu', title: item.title, url: `${baseUrl}/manga/${item.id}`, thumbnail: absoluteUrl(item.posterMedium), description: item.synopsis, status: item.status?.toLowerCase(), author: item.authors?.join(', '), genres: item.genreNames ?? [] })
}
function fromPage(item: AtsuMangaPage): Manga {
  return MangaSchema.parse({ id: `atsu:${item.id}`, sourceId: 'atsu', title: item.title, url: `${baseUrl}/manga/${item.id}`, thumbnail: absoluteUrl(item.poster?.mediumImage ?? item.poster?.image), description: item.synopsis, status: item.status?.toLowerCase(), author: item.authors?.map((author) => author.name).join(', '), genres: item.genres?.map((genre) => genre.name) ?? [] })
}
async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, baseUrl)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`atsu_http_${response.status}`)
  return await response.json() as T
}

export class AtsuSource implements Source {
  readonly id = 'atsu'; readonly name = 'Atsumaru'; readonly lang = 'en'; readonly baseUrl = baseUrl
  async search(query: string, page: number): Promise<MangaPage> {
    const result = await getJson<{ hits?: { document: SearchDocument }[] }>('/api/search/manga', { q: query, query_by: 'title', page: String(page), per_page: '40' })
    const items = (result.hits ?? []).map((hit) => fromSearch(hit.document))
    return MangaPageSchema.parse({ items, hasNextPage: items.length === 40 })
  }
  async popular(page: number): Promise<MangaPage> { return this.search('', page) }
  async latest(page: number): Promise<MangaPage> { return this.search('', page) }
  async details(item: Manga): Promise<Manga> {
    const result = await getJson<{ mangaPage?: AtsuMangaPage }>('/api/manga/page', { id: mangaId(item) })
    if (!result.mangaPage) throw new Error('atsu_manga_not_found')
    return fromPage(result.mangaPage)
  }
  async chapters(item: Manga): Promise<Chapter[]> {
    const id = mangaId(item)
    const result = await getJson<{ chapters?: ApiChapter[] }>('/api/manga/allChapters', { mangaId: id })
    return ChapterSchema.array().parse((result.chapters ?? []).map((chapter) => ({ id: `atsu:${id}:${chapter.id}`, mangaId: `atsu:${id}`, name: chapter.title ?? `Chapter ${chapter.number ?? ''}`.trim(), number: chapter.number, url: `${baseUrl}/read/${id}/${chapter.id}`, uploadDate: chapter.createdAt })))
  }
  async pages(chapter: Chapter): Promise<Page[]> {
    const parts = chapter.id.split(':')
    if (parts.length !== 3 || parts[0] !== 'atsu') throw new Error('atsu_chapter_id_invalid')
    const [, mangaId, chapterId] = parts
    const result = await getJson<{ readChapter?: { pages?: ApiPage[] } }>('/api/read/chapter', { mangaId, chapterId })
    return PageSchema.array().parse((result.readChapter?.pages ?? []).map((page, index) => ({ index, imageUrl: absoluteUrl(page.image)!, headers: { Referer: `${baseUrl}/` } })))
  }
}

export const source = new AtsuSource()
