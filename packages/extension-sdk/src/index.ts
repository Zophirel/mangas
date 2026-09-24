import type {
  Manga,
  Chapter,
  Page,
  MangaPage,
  SearchResult,
  SourceManifest,
} from '@manga/shared'

/**
 * Contratto che ogni estensione fonte deve implementare.
 * Le estensioni girano in un worker isolato: niente filesystem,
 * solo fetch HTTP verso host dichiarati nel manifest (allowedHosts),
 * con timeout e rate limit imposti dal loader.
 */
export interface Source {
  readonly id: string
  readonly name: string
  readonly lang: string
  readonly baseUrl: string
  search(query: string, page: number): Promise<MangaPage>
  popular?(page: number): Promise<MangaPage>
  latest?(page: number): Promise<MangaPage>
  details(manga: Manga): Promise<Manga>
  chapters(manga: Manga): Promise<Chapter[]>
  pages(chapter: Chapter): Promise<Page[]>
}

/** Compatibilità con il loader legacy del progetto. */
export interface LegacySource {
  readonly manifest: SourceManifest
  search(query: string, page: number): Promise<SearchResult>
  details(manga: Manga): Promise<Manga>
  chapters(manga: Manga): Promise<Chapter[]>
  pages(chapter: Chapter): Promise<Page[]>
}

export type { Manga, Chapter, Page, MangaPage, SearchResult, SourceManifest }
