import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  lang: text('lang').notNull(),
  baseUrl: text('base_url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
})

export const manga = sqliteTable(
  'manga',
  {
    id: text('id').primaryKey(), // `${sourceId}:${remoteId}`
    sourceId: text('source_id').notNull(),
    remoteId: text('remote_id').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    thumbnail: text('thumbnail'),
    metadataJson: text('metadata_json'),
  },
  (t) => ({ mangaSourceRemoteIdx: uniqueIndex('manga_source_remote_idx').on(t.sourceId, t.remoteId) }),
)

export const chapters = sqliteTable(
  'chapters',
  {
    id: text('id').primaryKey(), // `${mangaId}:${remoteId}`
    mangaId: text('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    remoteId: text('remote_id').notNull(),
    url: text('url').notNull(),
    name: text('name').notNull(),
    number: integer('number'),
    uploadDate: integer('upload_date'),
  },
  (t) => ({ chaptersMangaRemoteIdx: uniqueIndex('chapters_manga_remote_idx').on(t.mangaId, t.remoteId) }),
)

export const libraryEntries = sqliteTable('library_entries', {
  mangaId: text('manga_id').primaryKey(),
  addedAt: integer('added_at').notNull(),
})

export const readingProgress = sqliteTable('reading_progress', {
  chapterId: text('chapter_id').primaryKey(),
  pageIndex: integer('page_index').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').notNull(),
})

export const downloads = sqliteTable('downloads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chapterId: text('chapter_id').notNull(),
  status: text('status', { enum: ['queued', 'downloading', 'done', 'error'] })
    .notNull()
    .default('queued'),
  progress: integer('progress').notNull().default(0),
  filePath: text('file_path'),
  error: text('error'),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
})
