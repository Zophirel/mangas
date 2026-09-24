import { MangaSchema, ChapterSchema, PageSchema, MangaPageSchema } from '@manga/shared'
import type { Source } from '@manga/extension-sdk'
import type { Chapter, Manga, MangaPage, Page, HttpClientOptions } from './types.js'
import { baseUrl, parseChapters, parseDetails, parsePages, parseSearch } from './parser.js'

export class SourceProtectionError extends Error {
  constructor(message = 'mangaworld_protection_detected') {
    super(message)
    this.name = 'SourceProtectionError'
  }
}
export class SourceHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'SourceHttpError'
  }
}

const challengePattern = /document\.cookie\s*=\s*["']MWCookie|cf-chl-|challenge-platform|Just a moment\.\.\./i

class SafeHttpClient {
  private lastRequest = 0
  constructor(private readonly options: Required<HttpClientOptions>) {}
  private async waitTurn() {
    const delay = this.options.minIntervalMs - (Date.now() - this.lastRequest)
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    this.lastRequest = Date.now()
  }
  async text(url: string, referer = `${baseUrl}/`): Promise<string> {
    const target = new URL(url)
    if (target.hostname !== 'www.mangaworld.mx') throw new Error('source_host_not_allowed')
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.waitTurn()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs)
      try {
        const response = await fetch(target, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.options.userAgent,
            Referer: referer,
            Accept: 'text/html,application/xhtml+xml',
          },
        })
        if (!response.ok) {
          if (response.status !== 429 && response.status < 500)
            throw new SourceHttpError(response.status, `source_http_${response.status}`)
          throw new SourceHttpError(response.status, `source_retryable_http_${response.status}`)
        }
        const text = await response.text()
        if (new TextEncoder().encode(text).byteLength > this.options.maxResponseBytes)
          throw new Error('source_response_too_large')
        if (challengePattern.test(text))
          throw new SourceProtectionError()
        return text
      } catch (error) {
        lastError = error
        if (error instanceof SourceProtectionError || (error instanceof SourceHttpError && error.status < 500)) {
          if (this.options.flareSolverrUrl && (error instanceof SourceProtectionError || error.status === 403 || error.status === 429))
            return this.withFlareSolverr(target)
          throw error
        }
        if (attempt === 2) throw error
      } finally {
        clearTimeout(timer)
      }
    }
    if (this.options.flareSolverrUrl && lastError) return this.withFlareSolverr(target)
    throw lastError instanceof Error ? lastError : new Error('source_request_failed')
  }

  private async withFlareSolverr(target: URL): Promise<string> {
    const endpoint = new URL(this.options.flareSolverrUrl)
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password)
      throw new Error('flaresolverr_url_invalid')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 65_000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          cmd: 'request.get',
          url: target.href,
          maxTimeout: 60_000,
        }),
      })
      if (!response.ok) throw new Error(`flaresolverr_http_${response.status}`)
      const body = await response.text()
      if (new TextEncoder().encode(body).byteLength > this.options.maxResponseBytes + 128_000)
        throw new Error('flaresolverr_response_too_large')
      const result = JSON.parse(body) as {
        status?: string
        message?: string
        solution?: { response?: string; status?: number }
      }
      const html = result.solution?.response
      if (result.status !== 'ok' || typeof html !== 'string')
        throw new Error(result.message ? `flaresolverr_failed:${result.message}` : 'flaresolverr_failed')
      if (result.solution?.status && result.solution.status >= 400)
        throw new SourceHttpError(result.solution.status, `source_http_${result.solution.status}`)
      if (new TextEncoder().encode(html).byteLength > this.options.maxResponseBytes)
        throw new Error('source_response_too_large')
      if (challengePattern.test(html)) throw new SourceProtectionError()
      return html
    } finally {
      clearTimeout(timer)
    }
  }
}

export class MangaworldSource implements Source {
  readonly id = 'mangaworld'
  readonly name = 'MangaWorld'
  readonly lang = 'it'
  readonly baseUrl = baseUrl
  private readonly http = new SafeHttpClient({
    timeoutMs: 10_000,
    maxResponseBytes: 4_000_000,
    minIntervalMs: 900,
    userAgent: process.env.MANGAWORLD_USER_AGENT ?? 'Mangrove/0.1 (+self-hosted manga library)',
    flareSolverrUrl: process.env.FLARESOLVERR_URL || process.env.MANGAWORLD_FLARESOLVERR_URL || '',
  })
  private mangaUrl(manga: Manga): string {
    if (manga.url) return manga.url
    const prefix = `${this.id}:`
    if (!manga.id.startsWith(prefix)) throw new Error('mangaworld_manga_id_invalid')
    return new URL(manga.id.slice(prefix.length).replace(/^\/+/, ''), this.baseUrl).href
  }

  async search(query: string, page: number): Promise<MangaPage> {
    const url = new URL('/archive', this.baseUrl)
    url.searchParams.set('page', String(page))
    if (query) url.searchParams.set('keyword', query)
    return MangaPageSchema.parse(parseSearch(await this.http.text(url.href), url.href))
  }
  async popular(page: number): Promise<MangaPage> {
    const url = new URL('/archive', this.baseUrl)
    url.searchParams.set('sort', 'most_read')
    url.searchParams.set('page', String(page))
    return MangaPageSchema.parse(parseSearch(await this.http.text(url.href), url.href))
  }
  async latest(page: number): Promise<MangaPage> {
    const url = new URL('/archive', this.baseUrl)
    url.searchParams.set('sort', 'newest')
    url.searchParams.set('page', String(page))
    return MangaPageSchema.parse(parseSearch(await this.http.text(url.href), url.href))
  }
  async details(manga: Manga): Promise<Manga> {
    const mangaUrl = this.mangaUrl(manga)
    const result = parseDetails(await this.http.text(mangaUrl), manga, mangaUrl)
    return MangaSchema.parse(result)
  }
  async chapters(manga: Manga): Promise<Chapter[]> {
    const mangaUrl = this.mangaUrl(manga)
    const url = new URL(mangaUrl)
    url.searchParams.set('style', 'list')
    return ChapterSchema.array().parse(parseChapters(await this.http.text(url.href, mangaUrl), manga, url.href))
  }
  async pages(chapter: Chapter): Promise<Page[]> {
    let chapterUrl = chapter.url
    if (!chapterUrl) {
      const mangaPath = this.mangaUrl({
        id: chapter.mangaId,
        sourceId: this.id,
        title: '',
        url: '',
        genres: [],
      })
      const chapterKey = chapter.id.startsWith(`${chapter.mangaId}:`)
        ? chapter.id.slice(chapter.mangaId.length + 1)
        : ''
      if (!chapterKey) throw new Error('mangaworld_chapter_id_invalid')
      chapterUrl = new URL(`${new URL(mangaPath).pathname.replace(/\/$/, '')}/read/${chapterKey}`, this.baseUrl).href
    }
    return PageSchema.array().parse(parsePages(await this.http.text(chapterUrl, chapterUrl), chapter, chapterUrl))
  }
}

export const source = new MangaworldSource()
