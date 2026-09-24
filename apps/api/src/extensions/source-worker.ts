import { parentPort, workerData } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import type { LegacySource, Source } from '@manga/extension-sdk'

const imported = await import(pathToFileURL(workerData.modulePath as string).href)
const source = (imported.default ?? imported.source) as LegacySource | Source
type Method = 'search' | 'details' | 'chapters' | 'pages'
parentPort?.on('message', async ({ method, args }: { method: Method; args: unknown[] }) => {
  try {
    const value = await (source[method] as (...input: unknown[]) => Promise<unknown>)(...args)
    parentPort?.postMessage({ ok: true, value })
  } catch (error) {
    parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : 'source_failed' })
  }
})
