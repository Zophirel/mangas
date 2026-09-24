# Manga Platform

Piattaforma manga self-hosted: Vue 3 + Fastify + Drizzle/SQLite, monorepo pnpm.

## Bootstrap

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm db:push
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Struttura

```text
apps/web        Vue 3 + Vite + Tailwind CSS 4
apps/api        Fastify + Drizzle + SQLite
packages/shared Tipi e schema Zod condivisi
packages/extension-sdk  Contratto per le estensioni
```

## Stato attuale

- API: health, sources, library (CRUD) funzionanti; catalogo/capitoli/pagine sono stub
  in attesa del loader estensioni (worker isolato, vedi packages/extension-sdk).
- Web: shell con sidebar e check di salute dell'API; pagine da implementare.

## MangaWorld, MangaFire e FlareSolverr

MangaFire invia le richieste API firmate tramite FlareSolverr quando
`MANGAFIRE_FLARESOLVERR_URL` o `FLARESOLVERR_URL` è impostato. MangaWorld usa
richieste HTTP dirette per impostazione predefinita e passa a FlareSolverr se
incontra una challenge. Docker Compose avvia FlareSolverr insieme all'API; puoi
sovrascrivere l'endpoint `/v1` tramite `FLARESOLVERR_URL`:

```bash
docker compose up --build
```

Per lo sviluppo senza Docker, avvia FlareSolverr separatamente e imposta
`FLARESOLVERR_URL=http://localhost:8191/v1` prima di avviare l'API. Le richieste
tramite FlareSolverr hanno un timeout più lungo.

# mangas
