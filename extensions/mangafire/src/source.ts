import { ChapterSchema, MangaPageSchema, MangaSchema, PageSchema } from '@manga/shared'
import type { Source } from '@manga/extension-sdk'
import type { Chapter, Manga, MangaPage, Page } from '@manga/shared'

const baseUrl = 'https://mangafire.to'
type StageData = { table: string; key: string; iv: number }
// MangaFire's public API requires a VRF signature on every request.
const stages: StageData[] = [
  { table: 'yINlmUNho8VYJT+ibTIP+9ESiULpVEtMOoD6U6lRE0R/xwXo/Xp9NrUgC4cw/Lmo33vUyjUE40kUoEWIr/fxfNNcq2s79ShQ5NhNrFnJ4hXPwOu/SuXzIbuTQKGFvfm08E9jvCfqAtoDqvQq3dVWPQFmJjgvkISBeXY3BgANR+yVnjGbcxZ47d6kLNfZPIayTq3/YGySb1KuVZodWp/WGNAO5pfMcpaK53Hhs0allBszaMaxuouOwdxbwgxIw6YunSsXjI05Yi0j9j4eHKfSXR8Ifo/Od+8iamRfCXTyvm7NGRGYdcQ0ywcK/u6RXhrbcCm4t2eCtrDgQVecJGkQ+A==', key: '0Ec58JOY3uBzJK9m3zqIOpdlF7UFiax9DmA=', iv: 0x5a },
  { table: 'IUFltCxD3Oc2cwCgkJffthaOg9cgPUb0LgW6H/VtfcF0kc5F25t+aWj6JH9VOhOaY0rAFdUxlDnl5BLNvwEJvQtP5qcw7vdb/K+chnbwnspSHT8mz5lqwz41TezG0hkO06FTjJZhsyNuFLDpD2ZZxQj/QIRcF90zpmQ7Byu483WsQqUE0C342HL+JXngRB6fRzxRyVTaKu83h7UYTJ0QMt6ixFh6S3F8gqkKwrGTL3jHNBsD45UnifK8+RGtishQV2K3rujLKEkiZxpr2dYcudFW4oFsDKhad3CLBvuyTqsCo4B7mL5IKQ1vXo/MOOvq1I1d8ar9X6Ttu5KF4fZgiA==', key: 'AAdjb1iPY8CiDmq9H34tKTBF8a3oDQ==', iv: 0x35 },
  { table: 'NQHlu1/wVO5EmkwQymF810qqY2xG1k2obcas4Z9mCsPEIFl9pRIjFxbJ7ybMHbBckT5Ton85E0FOeHezbh/mjlEYpmpnlXOS8dgrqeq2KfxImTh1YK9y0PeMNhzA1OQzSY9brYOJq/l2QnE/hwOeZIhPixVSKIUlDb5vLcH6RWKxkIEMuP0bDwIqQ71AJJaEaMJL7A6YtyIwoRT+L5v4aZzodN/0+3nOGsfblFjgxSfPzVDjNFeNl5P26+kEC/8AHgdrpAbt3hHz3HrRN1Y6e+JHgF7ncFWnoF0y3THL1S71WgWGCa6KtSzTCCG58n68nTyj2T3Sshk7utqCtMi/ZQ==', key: 'DELOJgPsVaCcblDtTGMdHzM=', iv: 0xba },
]
const decodedStages = stages.map((stage) => ({ table: Buffer.from(stage.table, 'base64'), key: Buffer.from(stage.key, 'base64'), iv: stage.iv }))
type ApiManga = { hid: string; title: string; poster?: { medium?: string }; synopsis?: string; status?: string; authors?: { name: string }[]; genres?: { name: string }[] }
type ApiChapter = { id: number; number?: number; name?: string; language?: string; type?: string; pages?: { url: string }[] }
type ApiResponse<T> = { items?: T[]; data?: T }

function signedUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(`/api/${path.replace(/^\//, '')}`, baseUrl)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.sort()
  let bytes = Buffer.from(`${url.pathname.replace(/^\/api\//, '/')}${url.search}`)
  for (const stage of decodedStages) {
    const output = Buffer.alloc(bytes.length)
    let previous = stage.iv
    for (let i = 0; i < bytes.length; i++) {
      previous = stage.table[bytes[i]! ^ stage.key[i % stage.key.length]! ^ previous]!
      output[i] = previous
    }
    bytes = output
  }
  url.searchParams.set('vrf', bytes.toString('base64url'))
  return url
}

async function api<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = signedUrl(path, params)
  const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', Referer: `${baseUrl}/`, 'User-Agent': process.env.MANGAFIRE_USER_AGENT ?? 'Mangrove/0.1 (+self-hosted manga library)' }
  const flareSolverrUrl = process.env.MANGAFIRE_FLARESOLVERR_URL || process.env.FLARESOLVERR_URL
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) {
      throw new Error(response.status === 403 ? 'mangafire_vrf_or_cloudflare_rejected' : `mangafire_http_${response.status}`)
    }
    return await response.json() as T
  } catch (error) {
    if (!flareSolverrUrl) throw error
    return await apiViaFlareSolverr<T>(url, headers, flareSolverrUrl)
  }
}

async function apiViaFlareSolverr<T>(url: URL, headers: Record<string, string>, solverUrl: string): Promise<T> {
  const endpoint = new URL(solverUrl)
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('flaresolverr_url_invalid')
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(65_000), body: JSON.stringify({ cmd: 'request.get', url: url.href, maxTimeout: 60_000, headers }) })
  if (!response.ok) throw new Error(`flaresolverr_http_${response.status}`)
  const result = await response.json() as { status?: string; message?: string; solution?: { response?: string; status?: number } }
  if (result.status !== 'ok' || !result.solution?.response || (result.solution.status ?? 200) >= 400) throw new Error(result.message ?? 'flaresolverr_failed')
  try { return JSON.parse(result.solution.response) as T } catch { throw new Error('mangafire_flaresolverr_non_json_response') }
}

function manga(item: ApiManga): Manga {
  const id = `mangafire:${item.hid}`
  return { id, sourceId: 'mangafire', title: item.title, url: `${baseUrl}/title/${item.hid}`, thumbnail: item.poster?.medium, description: item.synopsis, status: item.status?.toLowerCase(), author: item.authors?.map((author) => author.name).join(', '), genres: item.genres?.map((genre) => genre.name) ?? [] }
}
function mangaId(mangaItem: Manga): string {
  const id = mangaItem.id.startsWith('mangafire:') ? mangaItem.id.slice('mangafire:'.length) : new URL(mangaItem.url ?? '').pathname.split('/').filter(Boolean).at(-1) ?? ''
  if (!/^[\w-]+$/.test(id)) throw new Error('mangafire_manga_id_invalid')
  return id
}
function chapter(item: ApiChapter, mangaItem: Manga): Chapter {
  return { id: `${mangaItem.id}:${item.id}`, mangaId: mangaItem.id, name: [`Ch. ${item.number ?? ''}`, item.name, item.language ? `(${item.language})` : ''].filter(Boolean).join(' '), number: item.number, url: `${baseUrl}/title/${mangaId(mangaItem)}/chapter/${item.id}` }
}

export class MangaFireSource implements Source {
  readonly id = 'mangafire'; readonly name = 'MangaFire'; readonly lang = 'en'; readonly baseUrl = baseUrl
  async search(query: string, page: number): Promise<MangaPage> {
    const result = await api<ApiResponse<ApiManga>>('titles', { page: String(page), limit: '40', ...(query ? { keyword: query } : {}) })
    return MangaPageSchema.parse({ items: (result.items ?? []).map(manga), hasNextPage: (result.items?.length ?? 0) >= 40 })
  }
  async popular(page: number): Promise<MangaPage> {
    const result = await api<ApiResponse<ApiManga>>('top-titles', { page: String(page), limit: '40' })
    return MangaPageSchema.parse({ items: (result.items ?? []).map(manga), hasNextPage: (result.items?.length ?? 0) >= 40 })
  }
  async latest(page: number): Promise<MangaPage> { return this.search('', page) }
  async details(item: Manga): Promise<Manga> {
    const result = await api<ApiResponse<ApiManga>>(`titles/${mangaId(item)}`)
    if (!result.data) throw new Error('mangafire_manga_not_found')
    return MangaSchema.parse(manga(result.data))
  }
  async chapters(item: Manga): Promise<Chapter[]> {
    const result = await api<ApiResponse<ApiChapter>>(`titles/${mangaId(item)}/chapters`, { sort: 'number', order: 'desc', page: '1', limit: '200' })
    return ChapterSchema.array().parse((result.items ?? []).map((entry) => chapter(entry, item)))
  }
  async pages(chapterItem: Chapter): Promise<Page[]> {
    const id = chapterItem.id.slice(chapterItem.id.lastIndexOf(':') + 1)
    if (!/^\d+$/.test(id)) throw new Error('mangafire_chapter_id_invalid')
    const result = await api<ApiResponse<ApiChapter>>(`chapters/${id}`)
    const pages = result.data?.pages ?? []
    return PageSchema.array().parse(pages.map((page, index) => ({ index, imageUrl: page.url, headers: { Referer: `${baseUrl}/` } })))
  }
}
export const source = new MangaFireSource()
