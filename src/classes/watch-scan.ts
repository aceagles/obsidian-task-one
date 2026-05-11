import { Notice, TFile } from 'obsidian'
import type TaskZeroPlugin from '../main'
import { debug } from '../functions'

export class WatchScan {
  readonly #plugin: TaskZeroPlugin
  #pendingFiles: Set<string> = new Set()
  #settleTimeout: ReturnType<typeof setTimeout> | null = null

  constructor (plugin: TaskZeroPlugin) {
    this.#plugin = plugin

    plugin.registerEvent(plugin.app.vault.on('modify', file => {
      if (file instanceof TFile && file.extension === 'md') this.#onFileChange(file.path)
    }))

    plugin.registerEvent(plugin.app.vault.on('create', file => {
      if (file instanceof TFile && file.extension === 'md') this.#onFileChange(file.path)
    }))

    plugin.app.workspace.onLayoutReady(() => { void this.#runStartupScan() })
  }

  #getWatchPaths (): string[] {
    return (this.#plugin.settings.watchPaths || '')
      .split('\n')
      .map(p => p.trim())
      .filter(Boolean)
  }

  #matchesWatchPaths (filePath: string): boolean {
    return this.#getWatchPaths().some(watchPath => {
      const normalized = watchPath.replace(/\/$/, '')
      return filePath === normalized || filePath.startsWith(normalized + '/')
    })
  }

  #onFileChange (filePath: string) {
    if (!this.#matchesWatchPaths(filePath)) return
    this.#pendingFiles.add(filePath)
    if (this.#settleTimeout !== null) clearTimeout(this.#settleTimeout)
    this.#settleTimeout = setTimeout(() => { void this.#processPendingFiles() }, 5000)
  }

  async #processPendingFiles () {
    this.#settleTimeout = null
    const files = [...this.#pendingFiles]
    this.#pendingFiles.clear()
    const { newTasks, fileCount } = await this.#scanFiles(files)
    if (newTasks > 0) {
      new Notice(`Task One: Found ${newTasks} new task${newTasks !== 1 ? 's' : ''} across ${fileCount} file${fileCount !== 1 ? 's' : ''}`)
    }
  }

  async #runStartupScan () {
    const watchPaths = this.#getWatchPaths()
    if (!watchPaths.length) return

    const lastScan = this.#plugin.settings.lastStartupScan ?? 0
    const filesToScan: string[] = []

    for (const watchPath of watchPaths) {
      for (const file of this.#getFilesForPath(watchPath)) {
        if (file.stat.mtime > lastScan) filesToScan.push(file.path)
      }
    }

    if (filesToScan.length) {
      debug(`Watch scan: checking ${filesToScan.length} files modified since last startup`)
      const { newTasks, fileCount } = await this.#scanFiles(filesToScan)
      if (newTasks > 0) {
        new Notice(`Task One: Found ${newTasks} new task${newTasks !== 1 ? 's' : ''} across ${fileCount} file${fileCount !== 1 ? 's' : ''}`)
      }
    }

    this.#plugin.settings.lastStartupScan = Date.now()
    await this.#plugin.saveSettings()
  }

  #getFilesForPath (watchPath: string): TFile[] {
    const vault = this.#plugin.app.vault
    const normalized = watchPath.replace(/\/$/, '')
    if (vault.getFolderByPath(normalized)) {
      return vault.getMarkdownFiles().filter(f => f.path.startsWith(normalized + '/'))
    }
    const file = vault.getFileByPath(normalized)
    return file instanceof TFile ? [file] : []
  }

  async #scanFiles (filePaths: string[]): Promise<{ newTasks: number; fileCount: number }> {
    let newTasks = 0
    let fileCount = 0
    const app = this.#plugin.app

    for (const filePath of filePaths) {
      const file = app.vault.getFileByPath(filePath)
      if (!(file instanceof TFile)) continue
      const cache = app.metadataCache.getCache(filePath)
      if (!cache) continue

      const beforeCount = this.#plugin.tasks.db.rows().length
      const data = await app.vault.cachedRead(file)
      await this.#plugin.tasks.processTasksFromCacheUpdate({ file, data, cache })
      const added = this.#plugin.tasks.db.rows().length - beforeCount

      if (added > 0) {
        newTasks += added
        fileCount++
      }
    }

    return { newTasks, fileCount }
  }
}
