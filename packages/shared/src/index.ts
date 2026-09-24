import { z } from 'zod'

// ---------- Entita' di dominio ----------

export const MangaSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  title: z.string(),
  url: z.string(),
  thumbnail: z.string().optional(),
  author: z.string().optional(),
  artist: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  genres: z.array(z.string()),
})

export const ChapterSchema = z.object({
  id: z.string(),
  mangaId: z.string(),
  name: z.string(),
  url: z.string(),
  number: z.number().optional(),
  uploadDate: z.number().optional(),
})

export const PageSchema = z.object({
  index: z.number().int().nonnegative(),
  imageUrl: z.string(),
  headers: z.record(z.string()).optional(),
})

export const SearchResultSchema = z.object({
  items: z.array(MangaSchema),
  hasNextPage: z.boolean(),
})

export const MangaPageSchema = SearchResultSchema

// ---------- Manifest estensione ----------

export const SourceManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string(),
  lang: z.string().length(2),
  baseUrl: z.string().url(),
  version: z.string(),
  allowedHosts: z.array(z.string()),
})

// ---------- Database / API ----------

export const LibraryEntrySchema = z.object({
  mangaId: z.string(),
  addedAt: z.number(),
})

export const ReadingProgressSchema = z.object({
  chapterId: z.string(),
  pageIndex: z.number().int().nonnegative(),
  completed: z.boolean(),
  updatedAt: z.number(),
})

export const DownloadStatusSchema = z.enum(['queued', 'downloading', 'done', 'error'])

export const Manga = MangaSchema
export const Chapter = ChapterSchema
export const Page = PageSchema
export const SearchResult = SearchResultSchema
export const SourceManifest = SourceManifestSchema
export const LibraryEntry = LibraryEntrySchema
export const ReadingProgress = ReadingProgressSchema
export const DownloadStatus = DownloadStatusSchema

export type Manga = z.infer<typeof MangaSchema>
export type Chapter = z.infer<typeof ChapterSchema>
export type Page = z.infer<typeof PageSchema>
export type SearchResult = z.infer<typeof SearchResultSchema>
export type MangaPage = z.infer<typeof MangaPageSchema>
export type SourceManifest = z.infer<typeof SourceManifestSchema>
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>
export type ReadingProgress = z.infer<typeof ReadingProgressSchema>
export type DownloadStatus = z.infer<typeof DownloadStatusSchema>
