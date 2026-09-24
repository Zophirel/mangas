<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type View = 'library' | 'search' | 'downloads' | 'settings' | 'detail' | 'reader'
type Manga = { id: string; title: string; author: string; status: string; genre: string; cover: string; progress: number; chapters: number; description: string; source: string }
type Chapter = { id: string; mangaId: string; name: string; url: string; number?: number; uploadDate?: number }
type ReaderPage = { index: number; imageUrl: string; headers?: Record<string, string> }
type Download = { title: string; chapter: string; progress: number; status: 'In coda' | 'In corso' | 'Completato'; size: string; cover: string }
const covers = {
  night: 'https://images.unsplash.com/photo-1535231540604-72e8fbaf8cdb?auto=format&fit=crop&w=700&q=80',
  blue: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=700&q=80',
  red: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?auto=format&fit=crop&w=700&q=80',
  green: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=700&q=80',
  yellow: 'https://images.unsplash.com/photo-1620325867502-221cfb5faa5f?auto=format&fit=crop&w=700&q=80',
}
const manga: Manga[] = [
  { id: '1', title: 'Jujutsu Kaisen', author: 'Gege Akutami', status: 'In corso', genre: 'Azione', cover: covers.night, progress: 68, chapters: 267, source: 'MangaWorld', description: 'Yuji Itadori si unisce agli stregoni jujutsu per affrontare le maledizioni che minacciano il mondo.' },
  { id: '2', title: 'Blue Box', author: 'Kouji Miura', status: 'In corso', genre: 'Romance', cover: covers.blue, progress: 32, chapters: 164, source: 'MangaDex', description: 'Una storia di crescita, sport e sentimenti che nasce ogni mattina nella palestra della scuola.' },
  { id: '3', title: 'Chainsaw Man', author: 'Tatsuki Fujimoto', status: 'In corso', genre: 'Seinen', cover: covers.red, progress: 100, chapters: 172, source: 'MangaWorld', description: 'Denji e il suo demone-motosega affrontano un mondo folle, violento e sorprendentemente umano.' },
  { id: '4', title: 'Frieren', author: 'Kanehito Yamada', status: 'In corso', genre: 'Fantasy', cover: covers.green, progress: 12, chapters: 141, source: 'MangaDex', description: 'Dopo la fine del viaggio dell’eroe, un’elfa millenaria impara a conoscere le persone che ha lasciato indietro.' },
  { id: '5', title: 'Dandadan', author: 'Yukinobu Tatsu', status: 'In corso', genre: 'Sovrannaturale', cover: covers.yellow, progress: 0, chapters: 169, source: 'MangaWorld', description: 'Alieni e fantasmi si incontrano in una commedia d’azione dal ritmo imprevedibile.' },
]
const downloads = ref<Download[]>([
  { title: 'Jujutsu Kaisen', chapter: 'Capitolo 267', progress: 74, status: 'In corso', size: '18.4 MB', cover: covers.night },
  { title: 'Frieren', chapter: 'Capitolo 141', progress: 0, status: 'In coda', size: '—', cover: covers.green },
  { title: 'Chainsaw Man', chapter: 'Capitolo 171', progress: 100, status: 'Completato', size: '24.1 MB', cover: covers.red },
])
const currentView = ref<View>('library')
const selectedId = ref('1')
const searchQuery = ref('')
const selectedSource = ref<'mangaworld' | 'mangafire'>('mangaworld')
const apiStatus = ref<'online' | 'offline' | 'checking'>('checking')
const filter = ref('Tutti')
const sidebarOpen = ref(false)
const remoteManga = ref<Manga[]>([])
const catalogLoaded = ref(false)
const catalogLoading = ref(false)
const sourceError = ref('')
const chapterItems = ref<Chapter[]>([])
const chaptersLoading = ref(false)
const chapterError = ref('')
const readerPages = ref<ReaderPage[]>([])
const activeChapter = ref<Chapter>()
const currentPageIndex = ref(0)
const readerLoading = ref(false)
const readerError = ref('')
const readerNotice = ref('')
const readerSettingsOpen = ref(false)
const readingDirection = ref<'ltr' | 'rtl'>(localStorage.getItem('mangrove-reading-direction') === 'rtl' ? 'rtl' : 'ltr')
const pageMode = ref<'single' | 'double'>(localStorage.getItem('mangrove-page-mode') === 'double' ? 'double' : 'single')
const chapterCache = new Map<string, Chapter[]>()
const visibleReaderPages = computed(() => readerPages.value.slice(currentPageIndex.value, currentPageIndex.value + (pageMode.value === 'double' ? 2 : 1)))
const readerPageLabel = computed(() => {
  if (!visibleReaderPages.value.length) return `0 / ${readerPages.value.length}`
  const first = currentPageIndex.value + 1
  const last = currentPageIndex.value + visibleReaderPages.value.length
  return first === last ? `${first} / ${readerPages.value.length}` : `${first}–${last} / ${readerPages.value.length}`
})
const nextChapter = computed(() => {
  const currentChapter = activeChapter.value
  if (!currentChapter) return undefined
  if (currentChapter.number !== undefined) {
    return chapterItems.value
      .filter((chapter) => chapter.number !== undefined && chapter.number > currentChapter.number!)
      .sort((a, b) => a.number! - b.number!)[0]
  }
  const index = chapterItems.value.findIndex((chapter) => chapter.id === currentChapter.id)
  return index > 0 ? chapterItems.value[index - 1] : undefined
})
const readerIsAtEnd = computed(() => readerPages.value.length > 0 && currentPageIndex.value + visibleReaderPages.value.length >= readerPages.value.length)
const selectedManga = computed(() => [...manga, ...remoteManga.value].find((item) => item.id === selectedId.value) ?? manga[0])
const filteredManga = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  return manga.filter((item) => (!query || `${item.title} ${item.author} ${item.genre}`.toLowerCase().includes(query)) && (filter.value === 'Tutti' || item.genre === filter.value))
})
const navItems: { label: string; icon: string; view: View }[] = [
  { label: 'Biblioteca', icon: '▦', view: 'library' }, { label: 'Esplora', icon: '⌕', view: 'search' },
  { label: 'Download', icon: '⇩', view: 'downloads' }, { label: 'Impostazioni', icon: '⚙', view: 'settings' },
]
const catalogItems = computed(() => catalogLoaded.value ? remoteManga.value : filteredManga.value)
function go(view: View, id?: string) { if (id) selectedId.value = id; currentView.value = view; sidebarOpen.value = false; window.location.hash = id ? `${view}/${encodeURIComponent(id)}` : view }
function openManga(id: string) { chapterItems.value = []; chapterError.value = ''; readerPages.value = []; activeChapter.value = undefined; go('detail', id) }
function continueReading(item: Manga) { go('reader', item.id) }
async function fetchMangaDetails(id: string) {
  try {
    const response = await fetch(`/api/manga/details?id=${encodeURIComponent(id)}`)
    const body = await response.json()
    if (!response.ok) throw new Error(body.message ?? body.error ?? 'Impossibile caricare i dettagli del manga.')
    const item = mapApiManga(body)
    const existingIndex = remoteManga.value.findIndex((mangaItem) => mangaItem.id === id)
    if (existingIndex < 0) remoteManga.value = [...remoteManga.value, item]
    else remoteManga.value = remoteManga.value.map((mangaItem, index) => index === existingIndex ? item : mangaItem)
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : 'Impossibile caricare i dettagli del manga.'
  }
}
async function fetchChapters(id: string): Promise<Chapter[]> {
  const cached = chapterCache.get(id)
  if (cached) { chapterItems.value = cached; return cached }
  chaptersLoading.value = true
  chapterError.value = ''
  try {
    const response = await fetch(`/api/manga/chapters?id=${encodeURIComponent(id)}`)
    const body = await response.json()
    if (!response.ok) throw new Error(body.message ?? body.error ?? 'Impossibile caricare i capitoli.')
    const items = (body.items ?? []) as Chapter[]
    chapterCache.set(id, items)
    chapterItems.value = items
    return items
  } catch (error) {
    chapterItems.value = []
    chapterError.value = error instanceof Error ? error.message : 'Impossibile caricare i capitoli.'
    return []
  } finally { chaptersLoading.value = false }
}
async function fetchChapterPages(chapter: Chapter) {
  readerLoading.value = true
  readerError.value = ''
  readerNotice.value = ''
  readerPages.value = []
  currentPageIndex.value = 0
  activeChapter.value = chapter
  try {
    const response = await fetch(`/api/chapters/pages?id=${encodeURIComponent(chapter.id)}`)
    const body = await response.json()
    if (!response.ok) throw new Error(body.message ?? body.error ?? 'Impossibile caricare le pagine.')
    readerPages.value = (body.pages ?? []) as ReaderPage[]
    if (!readerPages.value.length) throw new Error('Questo capitolo non contiene pagine leggibili.')
  } catch (error) {
    readerError.value = error instanceof Error ? error.message : 'Impossibile caricare le pagine.'
  } finally { readerLoading.value = false }
}
async function startReader(id: string) {
  if (!['mangaworld:', 'mangafire:'].some((prefix) => id.startsWith(prefix))) return
  readerLoading.value = true
  readerError.value = ''
  readerPages.value = []
  currentPageIndex.value = 0
  activeChapter.value = undefined
  const items = await fetchChapters(id)
  const chapter = items[0]
  if (!chapter) {
    readerError.value = chapterError.value || 'Nessun capitolo disponibile.'
    readerLoading.value = false
    return
  }
  await fetchChapterPages(chapter)
}
function readChapter(chapter: Chapter) {
  go('reader', selectedManga.value.id)
  void fetchChapterPages(chapter)
}
function changePage(delta: number) {
  if (delta > 0 && readerIsAtEnd.value) {
    if (nextChapter.value) void fetchChapterPages(nextChapter.value)
    else readerNotice.value = 'Sei all’ultimo capitolo disponibile.'
    return
  }
  const step = pageMode.value === 'double' ? 2 : 1
  const target = Math.max(0, Math.min(readerPages.value.length - 1, currentPageIndex.value + delta * step))
  currentPageIndex.value = pageMode.value === 'double' ? Math.floor(target / 2) * 2 : target
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function changePageFromSide(side: 'left' | 'right') {
  const next = readingDirection.value === 'ltr' ? side === 'right' : side === 'left'
  changePage(next ? 1 : -1)
}
function toggleLibrary(item: Manga) { item.progress = item.progress === 100 ? 0 : item.progress }
function startDownload(item: Manga) { downloads.value.unshift({ title: item.title, chapter: `Capitolo ${item.chapters}`, progress: 0, status: 'In coda', size: '—', cover: item.cover }); go('downloads') }
function syncRoute() { const [view, ...idParts] = window.location.hash.replace('#', '').split('/'); if (['library', 'search', 'downloads', 'settings', 'detail', 'reader'].includes(view)) currentView.value = view as View; if (idParts.length) { try { selectedId.value = decodeURIComponent(idParts.join('/')) } catch { selectedId.value = idParts.join('/') } } }
async function checkApi() { try { const response = await fetch('/health'); apiStatus.value = response.ok ? 'online' : 'offline' } catch { apiStatus.value = 'offline' } }
function mapApiManga(item: { id: string; title: string; author?: string; status?: string; genres: string[]; thumbnail?: string; description?: string; sourceId: string }): Manga {
  const status: Record<string, string> = { ongoing: 'In corso', completed: 'Finito', paused: 'In pausa', cancelled: 'Cancellato' }
  return { id: item.id, title: item.title, author: item.author ?? 'Autore sconosciuto', status: status[item.status ?? ''] ?? item.status ?? 'Disponibile', genre: item.genres[0] ?? 'Manga', cover: item.thumbnail ?? covers.night, progress: 0, chapters: 0, description: item.description ?? 'Nessuna descrizione disponibile.', source: item.sourceId }
}
async function fetchCatalog() {
  catalogLoading.value = true
  sourceError.value = ''
  try {
    const params = new URLSearchParams({ source: selectedSource.value, page: '1' })
    if (searchQuery.value.trim()) params.set('query', searchQuery.value.trim())
    const response = await fetch(`/api/manga?${params}`)
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error === 'internal_error' ? 'La fonte ha rifiutato la richiesta o richiede una verifica anti-bot.' : body.error ?? 'Impossibile interrogare la fonte.')
    remoteManga.value = (body.items ?? []).map(mapApiManga)
    catalogLoaded.value = true
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : 'Errore di connessione alla fonte.'
    catalogLoaded.value = false
  } finally { catalogLoading.value = false }
}
onMounted(() => { syncRoute(); window.addEventListener('hashchange', syncRoute); checkApi() })
onUnmounted(() => window.removeEventListener('hashchange', syncRoute))
watch(currentView, () => window.scrollTo({ top: 0, behavior: 'smooth' }))
watch(currentView, (view) => { if (view === 'search') void fetchCatalog() })
watch([readingDirection, pageMode], ([direction, mode]) => {
  localStorage.setItem('mangrove-reading-direction', direction)
  localStorage.setItem('mangrove-page-mode', mode)
})
watch(pageMode, (mode) => {
  if (mode === 'double') currentPageIndex.value = Math.floor(currentPageIndex.value / 2) * 2
})
watch([currentView, selectedId], ([view, id]) => {
  if (view !== 'detail' && view !== 'reader' || !['mangaworld:', 'mangafire:'].some((prefix) => id.startsWith(prefix))) return
  if (view === 'detail') {
    void fetchMangaDetails(id)
    void fetchChapters(id)
  } else if (activeChapter.value?.mangaId !== id) {
    readerError.value = ''
    void startReader(id)
  }
})
watch([searchQuery, selectedSource], () => { if (currentView.value === 'search') void fetchCatalog() })
</script>

<template>
  <div class="app-shell">
    <div class="mobile-overlay" :class="{ visible: sidebarOpen }" @click="sidebarOpen = false" />
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="brand"><div class="brand-mark">M</div><div><strong>mangrove</strong><span>your personal library</span></div></div>
      <div class="sidebar-label">Workspace</div>
      <nav><button v-for="item in navItems" :key="item.view" class="nav-item" :class="{ active: currentView === item.view }" @click="go(item.view)"><span class="nav-icon">{{ item.icon }}</span>{{ item.label }}<span v-if="item.view === 'downloads'" class="nav-count">3</span></button></nav>
      <div class="sidebar-label source-label">Fonti attive</div><div class="source-row"><span :class="['source-dot', apiStatus === 'online' ? 'green' : 'red-dot']" /> MangaWorld <small>IT · {{ apiStatus === 'online' ? 'API' : 'offline' }}</small></div><div class="source-row"><span class="source-dot blue-dot" /> MangaDex <small>EN · demo</small></div>
      <div class="sidebar-bottom"><div class="storage-head"><span>Spazio utilizzato</span><span>2.4 GB</span></div><div class="storage-bar"><i /></div><small>di 10 GB disponibili</small><button class="user-card"><span class="avatar">FC</span><span><b>Francesco</b><small>Amministratore</small></span><span class="dots">···</span></button></div>
    </aside>
    <main class="main-content">
      <header class="topbar"><button class="mobile-menu" @click="sidebarOpen = true">☰</button><div class="breadcrumbs"><span>Mangrove</span><b>/</b><strong>{{ currentView === 'library' ? 'Biblioteca' : currentView === 'search' ? 'Esplora' : currentView === 'downloads' ? 'Download' : currentView === 'settings' ? 'Impostazioni' : selectedManga.title }}</strong></div><div class="top-actions"><div class="api-pill"><span :class="['api-dot', apiStatus]" /> API {{ apiStatus === 'online' ? 'online' : apiStatus === 'checking' ? 'in connessione' : 'offline' }}</div><button class="icon-button">⌕</button><button class="icon-button">☼</button></div></header>
      <div class="page-wrap">
        <section v-if="currentView === 'library'" class="page-section">
          <div class="hero-row"><div><p class="eyebrow">MERCOLEDÌ, 24 SETTEMBRE 2026</p><h1>La tua biblioteca<span class="orange-dot">.</span></h1><p class="subtitle">Riprendi da dove avevi lasciato.</p></div><button class="primary-button" @click="go('search')"><span>＋</span> Aggiungi manga</button></div>
          <div class="continue-card"><div class="continue-cover" :style="{ backgroundImage: `url(${manga[0].cover})` }"><span class="cover-tag">IN LETTURA</span></div><div class="continue-info"><p class="eyebrow">RIPRENDI LA LETTURA</p><h2>Jujutsu Kaisen</h2><p class="muted">Capitolo 267 · pagina 14 di 21</p><div class="progress-line"><i style="width: 68%" /></div><div class="continue-meta"><span>68% completato</span><span>Ultimo accesso 2 ore fa</span></div><button class="dark-button" @click="continueReading(manga[0])">Continua a leggere <span>→</span></button></div><div class="continue-art">両面宿儺</div></div>
          <div class="section-heading"><div><h2>La tua collezione</h2><p>5 titoli salvati · ordinati per attività recente</p></div><button class="text-button" @click="go('search')">Vedi catalogo <span>→</span></button></div>
          <div class="manga-grid"><article v-for="item in manga" :key="item.id" class="manga-card" @click="openManga(item.id)"><div class="card-cover" :style="{ backgroundImage: `url(${item.cover})` }"><span class="status-pill">{{ item.status }}</span><button class="bookmark" @click.stop="toggleLibrary(item)">{{ item.progress > 0 ? '♥' : '♡' }}</button></div><div class="card-body"><h3>{{ item.title }}</h3><p>{{ item.author }}</p><div class="card-bottom"><span>{{ item.chapters }} capitoli</span><span v-if="item.progress" class="card-progress">{{ item.progress }}%</span></div><div v-if="item.progress" class="mini-progress"><i :style="{ width: `${item.progress}%` }" /></div></div></article></div>
        </section>
        <section v-else-if="currentView === 'search'" class="page-section"><div class="hero-row"><div><p class="eyebrow">CATALOGO · {{ selectedSource === 'mangafire' ? 'MANGAFIRE' : 'MANGAWORLD' }}</p><h1>Esplora manga<span class="orange-dot">.</span></h1><p class="subtitle">Risultati caricati dal backend e dalla fonte configurata.</p></div><select v-model="selectedSource" class="source-select" aria-label="Scegli fonte"><option value="mangaworld">MangaWorld · IT</option><option value="mangafire">MangaFire · EN</option></select></div><div class="search-box"><span>⌕</span><input v-model="searchQuery" placeholder="Cerca per titolo, autore o genere..." /><kbd>⌘ K</kbd></div><div v-if="sourceError" class="source-alert"><span class="alert-icon">!</span><div><b>Fonte {{ selectedSource === 'mangafire' ? 'MangaFire' : 'MangaWorld' }} non disponibile</b><p>{{ sourceError }}</p></div><button class="outline-button small" @click="fetchCatalog">Riprova</button></div><div v-if="catalogLoading" class="catalog-loading"><span class="spinner" /> Interrogo {{ selectedSource === 'mangafire' ? 'MangaFire' : 'MangaWorld' }} tramite l'API…</div><div class="filter-row"><button v-for="tag in ['Tutti', 'Azione', 'Romance', 'Fantasy', 'Seinen', 'Sovrannaturale']" :key="tag" :class="{ selected: filter === tag }" @click="filter = tag">{{ tag }}</button><span class="results-count">{{ catalogItems.length }} risultati{{ catalogLoaded ? ' · API' : ' · demo' }}</span></div><div class="manga-grid search-grid"><article v-for="item in catalogItems" :key="item.id" class="manga-card" @click="openManga(item.id)"><div class="card-cover" :style="{ backgroundImage: `url(${item.cover})` }"><span class="status-pill">{{ item.status }}</span><button class="bookmark" @click.stop="toggleLibrary(item)">{{ item.progress > 0 ? '♥' : '＋' }}</button></div><div class="card-body"><h3>{{ item.title }}</h3><p>{{ item.author }} · {{ item.genre }}</p><div class="card-bottom"><span>{{ item.source }}</span><span>{{ item.chapters ? `${item.chapters} capitoli` : 'Catalogo API' }}</span></div></div></article></div></section>
        <section v-else-if="currentView === 'detail'" class="page-section detail-page"><button class="back-button" @click="go('search')">← Torna al catalogo</button><div class="detail-hero"><div class="detail-cover" :style="{ backgroundImage: `url(${selectedManga.cover})` }" /><div class="detail-copy"><div class="detail-tags"><span>{{ selectedManga.genre }}</span><span>{{ selectedManga.status }}</span></div><h1>{{ selectedManga.title }}<span class="orange-dot">.</span></h1><p class="author">di {{ selectedManga.author }}</p><p class="detail-description">{{ selectedManga.description }}</p><div class="detail-actions"><button class="primary-button" @click="continueReading(selectedManga)">▶ Continua lettura</button><button class="outline-button" @click="startDownload(selectedManga)">⇩ Scarica ultimo capitolo</button></div><div class="detail-stats"><div><b>{{ chapterItems.length || selectedManga.chapters }}</b><span>Capitoli</span></div><div><b>{{ selectedManga.progress }}%</b><span>Letto</span></div><div><b>{{ selectedManga.source }}</b><span>Fonte</span></div></div></div></div><div class="chapter-header"><div><h2>Capitoli</h2><p>Gli ultimi aggiornamenti di {{ selectedManga.title }}</p></div><button class="outline-button small" @click="chapterItems.reverse()">↓ Ordina recenti</button></div><div v-if="chaptersLoading" class="reader-message">Carico i capitoli…</div><div v-else-if="chapterError" class="source-alert"><span class="alert-icon">!</span><div><b>Capitoli non disponibili</b><p>{{ chapterError }}</p></div></div><div v-else-if="chapterItems.length" class="chapter-list"><div v-for="chapter in chapterItems" :key="chapter.id" class="chapter-row"><span class="chapter-number">{{ chapter.number ?? '•' }}</span><div><b>{{ chapter.name }}</b><small>{{ chapter.uploadDate ? new Date(chapter.uploadDate).toLocaleDateString('it-IT') : 'Data non disponibile' }}</small></div><span class="chapter-size">{{ chapter.name }}</span><button class="row-action" :aria-label="`Leggi ${chapter.name}`" @click="readChapter(chapter)">→</button></div></div><div v-else class="reader-message">Nessun capitolo disponibile.</div></section>
        <section v-else-if="currentView === 'reader'" class="reader-page">
          <div class="reader-top">
            <button class="back-button" @click="go('detail', selectedManga.id)">← Esci dal reader</button>
            <div><b>{{ selectedManga.title }}</b><span>{{ activeChapter?.name ?? 'Capitolo' }}</span></div>
            <button class="reader-settings-button" :aria-expanded="readerSettingsOpen" @click="readerSettingsOpen = !readerSettingsOpen">⚙ Lettura</button>
          </div>
          <div v-if="readerSettingsOpen" class="reader-settings">
            <div class="reader-setting-group"><b>Direzione</b><button :aria-pressed="readingDirection === 'ltr'" @click="readingDirection = 'ltr'">Sinistra → destra</button><button :aria-pressed="readingDirection === 'rtl'" @click="readingDirection = 'rtl'">Destra → sinistra</button></div>
            <div class="reader-setting-group"><b>Pagine</b><button :aria-pressed="pageMode === 'single'" @click="pageMode = 'single'">Pagina singola</button><button :aria-pressed="pageMode === 'double'" @click="pageMode = 'double'">Doppia pagina</button></div>
          </div>
          <div class="reader-content">
            <div class="reader-label">{{ activeChapter?.name ?? 'LETTURA' }} · PAGINA {{ readerPageLabel }}</div>
            <h1>{{ selectedManga.title }}</h1>
            <div v-if="readerLoading" class="reader-message">Carico le pagine…</div>
            <div v-else-if="readerError" class="reader-message error">{{ readerError }}</div>
            <template v-else-if="visibleReaderPages.length">
              <div class="reader-page-stage" :class="[`mode-${pageMode}`, `direction-${readingDirection}`]">
                <div v-for="page in visibleReaderPages" :key="page.index" class="reader-page-frame"><img class="reader-page-image" :src="page.imageUrl" :alt="`${selectedManga.title} - ${activeChapter?.name} - pagina ${page.index + 1}`" @error="readerError = 'Impossibile caricare questa pagina.'" /></div>
                <button class="reader-click-zone left" :aria-label="readingDirection === 'ltr' ? 'Vai alla pagina precedente' : 'Vai alla pagina successiva'" @click="changePageFromSide('left')" />
                <button class="reader-click-zone right" :aria-label="readingDirection === 'ltr' ? 'Vai alla pagina successiva' : 'Vai alla pagina precedente'" @click="changePageFromSide('right')" />
              </div>
              <div class="reader-controls"><button class="outline-button" :disabled="currentPageIndex === 0" @click="changePage(-1)">← Pagina precedente</button><span>{{ readerPageLabel }}</span><button class="outline-button" :disabled="readerIsAtEnd && !nextChapter" @click="changePage(1)">{{ readerIsAtEnd ? nextChapter ? 'Capitolo successivo →' : 'Ultimo capitolo' : 'Pagina successiva →' }}</button></div>
              <p v-if="readerNotice" class="reader-message">{{ readerNotice }}</p>
            </template>
            <div v-else-if="!['mangaworld:', 'mangafire:'].some((prefix) => selectedManga.id.startsWith(prefix))" class="reader-image" :style="{ backgroundImage: `url(${selectedManga.cover})` }"><div class="reader-overlay">La lettura demo non è collegata a una fonte.<br /><span>Apri un manga dal catalogo.</span></div></div>
          </div>
        </section>
        <section v-else-if="currentView === 'downloads'" class="page-section"><div class="hero-row"><div><p class="eyebrow">CACHE LOCALE</p><h1>I tuoi download<span class="orange-dot">.</span></h1><p class="subtitle">Leggi anche quando sei offline.</p></div><button class="outline-button" @click="downloads = downloads.filter(d => d.status !== 'Completato')">Svuota completati</button></div><div class="download-summary"><div><span class="summary-icon orange">⇩</span><div><b>{{ downloads.filter(d => d.status !== 'Completato').length }}</b><span>In coda o in corso</span></div></div><div><span class="summary-icon green-bg">✓</span><div><b>{{ downloads.filter(d => d.status === 'Completato').length }}</b><span>Completati</span></div></div><div><span class="summary-icon purple">◒</span><div><b>2.4 GB</b><span>Spazio utilizzato</span></div></div></div><div class="download-list"><div v-for="download in downloads" :key="download.title + download.chapter" class="download-row"><div class="download-thumb" :style="{ backgroundImage: `url(${download.cover})` }" /><div class="download-main"><div class="download-title"><b>{{ download.title }}</b><span>{{ download.chapter }}</span></div><div class="progress-line"><i :class="download.status === 'Completato' ? 'done' : ''" :style="{ width: `${download.progress}%` }" /></div><div class="download-meta"><span :class="download.status === 'Completato' ? 'complete-text' : ''">{{ download.status }}</span><span>{{ download.size }}</span></div></div><button class="row-action">{{ download.status === 'Completato' ? '⋮' : '×' }}</button></div><div v-if="!downloads.length" class="empty-state"><span>⇩</span><h3>Nessun download</h3><p>I capitoli che salvi per la lettura offline appariranno qui.</p></div></div></section>
        <section v-else class="page-section settings-page"><div><p class="eyebrow">CONFIGURAZIONE</p><h1>Impostazioni<span class="orange-dot">.</span></h1><p class="subtitle">Personalizza la tua esperienza di lettura.</p></div><div class="settings-layout"><div class="settings-nav"><button class="selected">Generale</button><button>Fonti</button><button>Lettore</button><button>Archiviazione</button></div><div class="settings-panel"><div class="setting-group"><h2>Preferenze generali</h2><p>Gestisci il comportamento dell'applicazione.</p><label class="setting-item"><span><b>Tema scuro</b><small>Riduce l'affaticamento visivo durante la lettura serale.</small></span><span class="toggle on"><i /></span></label><label class="setting-item"><span><b>Aggiorna automaticamente</b><small>Controlla nuovi capitoli all'avvio.</small></span><span class="toggle on"><i /></span></label></div><div class="setting-group"><h2>Server API</h2><p>Connessione al backend Mangrove.</p><div class="server-input"><span class="api-dot online" /><input value="http://localhost:3001" readonly /><span class="connected">Connesso</span></div></div><div class="setting-group danger"><h2>Zona pericolosa</h2><p>Azioni che modificano i dati locali.</p><button class="danger-button">Cancella cache locale</button></div></div></div></section>
      </div>
    </main>
  </div>
</template>
