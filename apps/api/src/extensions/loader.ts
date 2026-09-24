import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { ChapterSchema, MangaSchema, PageSchema, SearchResultSchema, SourceManifestSchema } from '@manga/shared'
import type { Chapter, Manga, Page, SearchResult, SourceManifest } from '@manga/shared'

type Method = 'search' | 'details' | 'chapters' | 'pages'
type SourceModule = { manifest: SourceManifest; modulePath: string }
const sourceModules: SourceModule[] = [
  { manifest: SourceManifestSchema.parse({ id: 'demo', name: 'Demo Library', lang: 'it', baseUrl: 'https://demo.local', version: '1.0.0', allowedHosts: ['demo.local'] }), modulePath: fileURLToPath(new URL('./demo.ts', import.meta.url)) },
  { manifest: SourceManifestSchema.parse({ id: 'mangaworld', name: 'MangaWorld', lang: 'it', baseUrl: 'https://www.mangaworld.mx', version: '0.1.0', allowedHosts: ['www.mangaworld.mx', 'cdn.mangaworld.mx'] }), modulePath: fileURLToPath(new URL('../../../../extensions/mangaworld/src/index.ts', import.meta.url)) },
  { manifest: SourceManifestSchema.parse({ id: 'mangafire', name: 'MangaFire', lang: 'en', baseUrl: 'https://mangafire.to', version: '0.1.0', allowedHosts: ['mangafire.to', 's.mfcdn.nl', 'i.mfcdn.nl'] }), modulePath: fileURLToPath(new URL('../../../../extensions/mangafire/src/index.ts', import.meta.url)) },
]

const timeoutMs = 8_000
const outputSchemas = { search: SearchResultSchema, details: MangaSchema, chapters: ChapterSchema.array(), pages: PageSchema.array() }

function source(id: string) { const found = sourceModules.find((item) => item.manifest.id === id); if (!found) throw new Error(`source_not_found:${id}`); return found }

export class SourceLoader {
  list(): SourceManifest[] { return sourceModules.map((item) => item.manifest) }
  async call<T>(sourceId: string, method: Method, args: unknown[]): Promise<T> {
    const selected = source(sourceId)
    return await new Promise<T>((resolve, reject) => {
      const worker = new Worker(new URL('./source-worker-bootstrap.mjs', import.meta.url), { workerData: { modulePath: selected.modulePath } })
      const callTimeoutMs = ['mangaworld', 'mangafire'].includes(selected.manifest.id) && (process.env.FLARESOLVERR_URL || process.env.MANGAWORLD_FLARESOLVERR_URL || process.env.MANGAFIRE_FLARESOLVERR_URL)
        ? 110_000
        : timeoutMs
      const timer = setTimeout(() => { void worker.terminate(); reject(new Error('source_timeout')) }, callTimeoutMs)
      worker.on('message', (message: { ok: boolean; value?: unknown; error?: string }) => {
        clearTimeout(timer); void worker.terminate()
        if (!message.ok) return reject(new Error(message.error ?? 'source_failed'))
        const parsed = outputSchemas[method].parse(message.value)
        resolve(parsed as T)
      })
      worker.on('error', (error: Error) => { clearTimeout(timer); reject(error) })
      worker.postMessage({ method, args })
    })
  }
}

export const loader = new SourceLoader()
export type LoadedManga = Manga
export type LoadedChapter = Chapter
export type LoadedPage = Page
export type LoadedSearch = SearchResult
