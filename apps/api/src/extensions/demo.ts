import type { Chapter, Manga, Page, SearchResult, LegacySource, SourceManifest } from '@manga/extension-sdk'

const manifest: SourceManifest = {
  id: 'demo', name: 'Demo Library', lang: 'it', baseUrl: 'https://demo.local', version: '1.0.0', allowedHosts: ['demo.local'],
}

const catalog: Manga[] = [
  { id: 'demo:moonlit-archive', sourceId: 'demo', title: 'The Moonlit Archive', url: 'https://demo.local/manga/moonlit-archive', thumbnail: 'https://images.unsplash.com/photo-1535231540604-72e8fbaf8cdb?auto=format&fit=crop&w=700&q=80', author: 'Mangrove Studio', description: 'Una bibliotecaria scopre che ogni libro custodisce un ricordo ancora da vivere.', status: 'ongoing', genres: ['Fantasy', 'Avventura'] },
  { id: 'demo:paper-stars', sourceId: 'demo', title: 'Paper Stars', url: 'https://demo.local/manga/paper-stars', thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=700&q=80', author: 'Ari Kato', description: 'Due amici inseguono una costellazione disegnata su un vecchio quaderno.', status: 'ongoing', genres: ['Romance', 'Slice of life'] },
  { id: 'demo:iron-garden', sourceId: 'demo', title: 'Iron Garden', url: 'https://demo.local/manga/iron-garden', thumbnail: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?auto=format&fit=crop&w=700&q=80', author: 'N. Ferri', description: 'In una città costruita sul ferro, la natura torna a reclamare il suo spazio.', status: 'completed', genres: ['Azione', 'Seinen'] },
]

const chaptersByManga = new Map<string, Chapter[]>(catalog.map((item) => [item.id, Array.from({ length: 8 }, (_, index) => ({
  id: `${item.id}:chapter-${index + 1}`, mangaId: item.id, name: `Capitolo ${index + 1}`, url: `${item.url}/chapter/${index + 1}`, number: index + 1, uploadDate: Date.now() - (7 - index) * 86_400_000,
}))]))

export const demoSource: LegacySource = {
  manifest,
  async search(query, page): Promise<SearchResult> {
    const normalized = query.trim().toLowerCase()
    const items = catalog.filter((item) => !normalized || `${item.title} ${item.author} ${item.genres.join(' ')}`.toLowerCase().includes(normalized))
    const pageSize = 20
    return { items: items.slice((page - 1) * pageSize, page * pageSize), hasNextPage: page * pageSize < items.length }
  },
  async details(manga) { return catalog.find((item) => item.id === manga.id) ?? manga },
  async chapters(manga) { return chaptersByManga.get(manga.id) ?? [] },
  async pages(chapter): Promise<Page[]> {
    return Array.from({ length: 5 }, (_, index) => ({ index, imageUrl: `https://picsum.photos/seed/${encodeURIComponent(chapter.id)}-${index}/1200/1800` }))
  },
}

export default demoSource
