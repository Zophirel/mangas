import type { Chapter, Manga, Page, MangaPage } from '@manga/shared'

export type { Chapter, Manga, MangaPage, Page }

export type HttpMethod = 'GET'

export type HttpClientOptions = {
  timeoutMs?: number
  maxResponseBytes?: number
  userAgent?: string
  minIntervalMs?: number
  flareSolverrUrl?: string
}
