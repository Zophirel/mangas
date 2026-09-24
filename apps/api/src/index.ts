import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { sources, libraryEntries } from './db/schema'
import { loader } from './extensions/loader'

const app = Fastify({ logger: true })
await app.register(cors, { origin: true })

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({ error: 'validation_failed', issues: err.issues })
  }
  app.log.error(err)
  return reply.code(500).send({ error: 'internal_error' })
})

// ---------- Health ----------

app.get('/health', async () => ({ status: 'ok', time: Date.now() }))

// ---------- Sources ----------

app.get('/api/sources', async () => loader.list().map((source) => ({ ...source, enabled: true })))

// ---------- Library ----------

app.get('/api/library', async () => db.select().from(libraryEntries))

const MangaIdParams = z.object({ mangaId: z.string().min(1) })
const IdParams = z.object({ id: z.string().min(1) })

app.post('/api/library/:mangaId', async (req, reply) => {
  const { mangaId } = MangaIdParams.parse(req.params)
  await db
    .insert(libraryEntries)
    .values({ mangaId, addedAt: Date.now() })
    .onConflictDoNothing()
  return reply.code(201).send({ ok: true })
})

app.delete('/api/library/:mangaId', async (req) => {
  const { mangaId } = MangaIdParams.parse(req.params)
  await db.delete(libraryEntries).where(eq(libraryEntries.mangaId, mangaId))
  return { ok: true }
})

// ---------- Catalogo / estensioni ----------

const SearchQuery = z.object({
  query: z.string().optional(),
  source: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
})

app.get('/api/manga', async (req) => {
  const params = SearchQuery.parse(req.query)
  const sourceId = params.source ?? 'demo'
  return loader.call(sourceId, 'search', [params.query ?? '', params.page])
})

app.get('/api/manga/:id', async (req) => {
  const { id } = IdParams.parse(req.params)
  const sourceId = id.split(':', 1)[0]
  return loader.call(sourceId, 'details', [{ id, sourceId, title: '', url: '', genres: [] }])
})

app.get('/api/manga/:id/chapters', async (req) => {
  const { id } = IdParams.parse(req.params)
  const sourceId = id.split(':', 1)[0]
  const items = await loader.call<unknown[]>(sourceId, 'chapters', [{ id, sourceId, title: '', url: '', genres: [] }])
  return { mangaId: id, items }
})

app.get('/api/chapters/:id/pages', async (req) => {
  const { id } = IdParams.parse(req.params)
  const sourceId = id.split(':', 1)[0]
  const mangaId = id.slice(0, id.lastIndexOf(':'))
  const pages = await loader.call(sourceId, 'pages', [{ id, mangaId, name: id, url: '' }])
  return { chapterId: id, pages }
})

// ---------- Downloads (stub) ----------

app.get('/api/downloads', async () => [])
app.post('/api/downloads', async () => ({ error: 'not_implemented' }), )

// ---------- Start ----------

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
