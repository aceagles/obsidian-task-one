import { Task, TaskStatus, TaskType } from './task.svelte'
import TaskZeroPlugin from '../main'
import { type App, type CachedMetadata, debounce, type ListItemCache, TFile } from 'obsidian'
import { Database } from './table'
import { DatabaseEvent, dbEvents } from './database-events'
import { moment, debug, getOrCreateFile } from '../functions'
import { TaskInputModal } from '../views/task-input-modal'

export interface CacheUpdate {
  file: TFile
  data: string
  cache: CachedMetadata
}

export type CacheUpdateItem = {
  task: Task
  cacheItem: ListItemCache
  hasChanges: boolean
}

export const TaskChangeEvent = 'tz:tasks-change'

export class Tasks {
  readonly app: App
  readonly plugin: TaskZeroPlugin
  readonly db: Database
  #noteUpdateQueue: Set<number> = new Set([])
  readonly #debounceQueueUpdate: () => void

  constructor (plugin: TaskZeroPlugin) {
    this.plugin = plugin
    this.app = plugin.app
    this.db = new Database(this.plugin)

    this.#debounceQueueUpdate = debounce(() => {
      debug('Processing debounced queue')
      void this.processQueue()
    }, 5000, true)

    plugin.registerEvent(this.app.vault.on('delete', file => {
      if (file instanceof TFile) void this.#handleFileDelete(file)
    }))
  }

  get blockPrefix () {
    return this.plugin.settings.taskBlockPrefix
  }

  taskLineRegex (id: number) {
    const prefix = this.blockPrefix
    return new RegExp(`^[ \\t]*- \\[.][^\n]+\\^${prefix}${id}[ \\t]*$`, 'm')
  }

  async processTasksFromCacheUpdate (cacheUpdate: CacheUpdate) {
    debug('⚙️ Processing cache update for ' + cacheUpdate.file.path)

    if (noteIsExcluded(cacheUpdate, this.plugin)) {
      // This note is excluded from processing, orphan any existing tasks
      this.orphanTasksFromPath(cacheUpdate.file.path)
      return
    }

    // If this is a project file, find the linked task so new top-level tasks
    // are automatically parented to it, and compute the baseDepth so write-back
    // generates correctly indented lines (top-level tasks should be at indent 0)
    let projectParentId = 0
    const projectBaseDepth = this.#getProjectBaseDepth(cacheUpdate.file)
    if (cacheUpdate.cache?.frontmatter?.type === 'project') {
      const linkedRow = this.db.rows().find(row =>
        !row.orphaned && row.text.includes(`[[${cacheUpdate.file.basename}]]`)
      )
      projectParentId = linkedRow?.id || 0
    }

    const processed: CacheUpdateItem[] = []
    for (const item of (cacheUpdate.cache.listItems?.filter(x => x.task) || [])) {
      const res = new Task(this).initFromListItem(item, cacheUpdate, processed, projectParentId)
      if (res.valid) {
        processed.push({
          task: res.task,
          cacheItem: item,
          hasChanges: res.hasChanges
        })
      }
    }
    const updated = processed.filter(x => x.hasChanges)

    // Orphan tasks in the DB which are no longer present in the note
    const processedIds = processed.map(x => x.task.id)
    this.orphanTasksFromPath(cacheUpdate.file.path, processedIds)

    // Update the file markdown contents if needed, for example to add task IDs
    if (updated.length) {
      let updatedCount = 0
      await this.plugin.app.vault.process(cacheUpdate.file, data => {
        if (cacheUpdate.data === data) {
          // The live file contents is the same as the expected contents from the cache
          // (this is the ideal case)
          const lines = cacheUpdate.data.split('\n')
          for (const row of updated) {
            const newLine = row.task.generateMarkdownTask(projectBaseDepth)
            if (lines[row.cacheItem.position.start.line] !== newLine) {
              lines[row.cacheItem.position.start.line] = newLine
              updatedCount++
            }
          }
          if (updatedCount) data = lines.join('\n')
        } else {
          // Cache and file differ - this is bad.
          // We don't want to modify the file here and risk content loss.
          // Orphan these tasks in the DB and re-process them again next time.
          debug('Cache and file differ')
          updated.forEach(row => {
            if (row.task.id) {
              debug('Orphaning task ' + row.task.id)
              row.task.orphaned = moment().valueOf()
              this.db.update(row.task.getData())
            }
          })
        }
        return data
      })
    }

    debug(`Updated ${updated.length} tasks in ${cacheUpdate.file.path}, with ${processed.length - updated.length} tasks unchanged`)
    if (updated.length) {
      dbEvents.emit(DatabaseEvent.TasksExternalChange)
    }
  }

  getTaskById (id: number) {
    const task = new Task(this)
    task.initFromId(id)
    return task
  }

  /**
   * Get all active tasks, i.e.:
   * - not orphaned
   * - not completed
   * - exists in a note
   */
  getTasks (type?: TaskType) {
    return this.db.rows()
      .filter(row => {
        // Match INBOX type to tasks which have no type set
        const typeMatch = !type || row.type === type || (type === TaskType.INBOX && !row.type)
        return typeMatch &&
          !row.orphaned &&                  // Not orphaned
          row.status !== TaskStatus.DONE && // Not completed
          row.path                          // Is associated with a note
      })
      .map(row => new Task(this).initFromRow(row).task)
      // Sort by created date - oldest task first
      .sort((a, b) => a.created.localeCompare(b.created))
  }

  /**
   * This is the main task list that a user works from, in opinionated GTD order
   */
  getTasklist () {
    const allTasks = this.getTasks()
      .filter(task =>
        // Is not scheduled for the future
        (!task.scheduled || moment(task.scheduled).isSameOrBefore(moment(), 'day')))

    const tasks = allTasks.filter(task => task.isDue)
      // Get due tasks, and order by earliest date first
      .sort((a, b) => {
        const dateA = [a.due, a.scheduled].filter(Boolean).sort()[0]
        const dateB = [b.due, b.scheduled].filter(Boolean).sort()[0]
        return dateA.localeCompare(dateB)
      })
      // Inbox tasks
      .concat(allTasks.filter(task => task.type === TaskType.INBOX))
      // Projects that have no next action (i.e. no sub-tasks)
      .concat(allTasks.filter(task => task.type === TaskType.PROJECT)
        .filter(project => !this.db.rows().filter(subtask => subtask.parent === project.id && subtask.status !== TaskStatus.DONE && !subtask.orphaned).length
        ))
      // Next Actions
      .concat(allTasks.filter(task => task.type === TaskType.NEXT_ACTION))
      // Waiting-On
      .concat(allTasks.filter(task => task.type === TaskType.WAITING_ON))

    // Deduplicate, keeping the first instance of any task
    return Array.from(
      new Map(tasks.map(task => [task.id, task])).values()
    )
  }

  /**
   * Queue tasks for update in the original note, using the data from the DB
   */
  addTaskToUpdateQueue (id: number) {
    debug('Adding to queue: ' + id)
    this.#noteUpdateQueue.add(id)
    this.#debounceQueueUpdate()
  }

  async processQueue () {
    // Split queue into files
    const grouped: Record<string, Task[]> = {}
    this.#noteUpdateQueue.forEach(id => {
      const task = new Task(this).initFromId(id).task
      if (task.valid()) {
        if (!grouped[task.path]) grouped[task.path] = []
        grouped[task.path].push(task)
      }
    })
    this.#noteUpdateQueue = new Set([])

    for (const path of Object.keys(grouped)) {
      await this.updateTasksInNote(path, grouped[path])
    }
  }

  /**
   * Update existing task(s) data in a note. This will only match
   * existing tasks based on their ID. If no exact match(es) found,
   * nothing will be changed.
   */
  async updateTasksInNote (path: string, tasks: Task[]) {
    const tfile = this.app.vault.getFileByPath(path)
    if (tfile) {
      const baseDepth = this.#getProjectBaseDepth(tfile)
      await this.app.vault.process(tfile, data => {
        debug(`Updated ${tasks.length} tasks in ${path}`)
        for (const task of tasks) {
          data = data.replace(this.taskLineRegex(task.id), task.generateMarkdownTask(baseDepth))
        }
        return data
      })
    }
  }

  /**
   * For project files, returns the baseDepth needed so top-level tasks
   * in the file render at indent 0. Returns 0 for regular notes.
   */
  #getProjectBaseDepth (tfile: TFile): number {
    const metadata = this.app.metadataCache.getFileCache(tfile)
    if (metadata?.frontmatter?.type !== 'project') return 0
    const linkedRow = this.db.rows().find(row =>
      !row.orphaned && row.text.includes(`[[${tfile.basename}]]`)
    )
    if (!linkedRow) return 0
    const projectTask = new Task(this).initFromId(linkedRow.id).task
    return projectTask.ancestors.length + 1
  }

  async addTaskToDefaultNote (task: Task) {
    if (!task.valid() || !this.plugin.settings.defaultNote) return
    const file = await getOrCreateFile(this.app, this.plugin.settings.defaultNote)
    await this.app.vault.append(file, task.generateMarkdownTask() + '\n')
  }

  /**
   * Quick capture task modal
   */
  openQuickCapture () {
    new TaskInputModal(this.plugin, null, taskText => {
      if (taskText.trim().length) {
        const task = new Task(this).initFromText(taskText).task
        void this.addTaskToDefaultNote(task)
      }
    }).open()
  }

  /**
   * Promote a project task to a dedicated file-based project.
   * Creates a new file in the projects folder, moves all subtasks into it,
   * and replaces the original task line with a linked task.
   */
  async promoteToFileProject (task: Task) {
    const folder = this.plugin.settings.projectsFolder || 'Projects'
    const filePath = `${folder}/${task.text}.md`
    const descendants = task.descendants
    const baseDepth = task.ancestors.length + 1

    // Build the project file content
    const taskLines = descendants.map(d => d.generateMarkdownTask(baseDepth)).join('\n')
    const fileContent = `---\ntype: project\n---\n\n# ${task.text}\n\n${taskLines}\n`

    // Create the project file (create folder if needed)
    try {
      if (!this.app.vault.getFolderByPath(folder)) {
        await this.app.vault.createFolder(folder)
      }
      await this.app.vault.create(filePath, fileContent)
    } catch (e) {
      debug('Failed to create project file: ' + e)
      return
    }

    // Remove descendant lines and replace project task with linked task in the original file
    const descendantIds = new Set(descendants.map(d => d.id))
    const linkedTask = `- [ ] ${task.generateMarkdownTask().split('- [ ] ')[1]?.split(task.text)[0] || ''}[[${task.text}]] ^${this.blockPrefix}${task.id}`
    const originalFile = this.app.vault.getFileByPath(task.path)
    if (originalFile) {
      await this.app.vault.process(originalFile, data => {
        let lines = data.split('\n')
        // Remove descendant lines (walk backwards to preserve indices)
        for (let i = lines.length - 1; i >= 0; i--) {
          const idMatch = lines[i].match(new RegExp(`\\^${this.blockPrefix}(\\d+)\\s*$`))
          if (idMatch && descendantIds.has(parseInt(idMatch[1], 10))) {
            lines.splice(i, 1)
          }
        }
        // Replace project task line with linked task
        const projectLineIndex = lines.findIndex(l => l.endsWith(`^${this.blockPrefix}${task.id}`))
        if (projectLineIndex !== -1) {
          lines[projectLineIndex] = linkedTask
        }
        return lines.join('\n')
      })
    }

    // Update each descendant's path in the DB
    descendants.forEach(d => {
      d.path = filePath
      this.db.update(d.getData())
    })

    dbEvents.emit(DatabaseEvent.TasksExternalChange)
  }

  /**
   * Remove completed tasks from a note specified by path,
   * and move to the Archived Tasks note
   */
  async archiveTasksFromPath (path: string) {
    if (!this.plugin.settings.archiveNote) return
    const file = this.app.vault.getFileByPath(path)
    let completedTasks: string[] = []
    // Remove tasks from original file
    if (file instanceof TFile) {
      await this.app.vault.process(file, data => {
        const lines = data.split('\n')
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].match(/^[ \t]*- \[x]/)) {
            completedTasks.unshift(...lines.splice(i, 1))
          }
        }
        return lines.join('\n')
      })
    }
    if (completedTasks.length) {
      // Add tasks to the archive file
      const archiveNote = await getOrCreateFile(this.app, this.plugin.settings.archiveNote)
      await this.app.vault.append(archiveNote, completedTasks.join('\n') + '\n')
    }
  }

  /**
   * Orphan tasks from a given path, excluding ones from the keepIds array
   */
  orphanTasksFromPath (path: string, keepIds: number[] = []) {
    const tasks = this.db.rows()
      .filter(row =>
        !row.orphaned &&
        row.path === path &&
        !keepIds.includes(row.id))
    if (!tasks.length) return

    tasks.forEach(task => {
      debug('Orphaning task ' + task.id)
      task.orphaned = moment().valueOf()
      this.db.update(task)
    })
    dbEvents.emit(DatabaseEvent.TasksExternalChange)
  }

  async #handleFileDelete (file: TFile) {
    const wikilinkRow = this.db.rows().find(row =>
      !row.orphaned && row.text.includes(`[[${file.basename}]]`)
    )
    if (wikilinkRow) {
      this.db.rows()
        .filter(row => row.path === file.path)
        .forEach(row => this.db.delete(row.id))
      this.db.delete(wikilinkRow.id)
      await this.#removeTaskLineFromNote(wikilinkRow.path, wikilinkRow.id)
      dbEvents.emit(DatabaseEvent.TasksExternalChange)
    } else {
      this.orphanTasksFromPath(file.path)
    }
  }

  async #removeTaskLineFromNote (path: string, taskId: number) {
    const tfile = this.app.vault.getFileByPath(path)
    if (!tfile) return
    const regex = this.taskLineRegex(taskId)
    await this.app.vault.process(tfile, data =>
      data.split('\n').filter(line => !regex.test(line)).join('\n')
    )
  }

  cleanOrphans () {
    const now = moment().valueOf()
    if (this.plugin.settings.database.lastCleanup > now - 1000 * 60 * 60 * 24) return

    debug('🗑️ Cleaning up orphaned tasks')
    this.plugin.settings.database.lastCleanup = now
    void this.plugin.saveSettings()

    const existingNotes = new Set<string>()
    const deletedNotes = new Set<string>()
    const rows = this.db.rows()
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      if (row.orphaned) {
        // Remove orphaned tasks older than 14 days
        if (row.orphaned < now - 1000 * 60 * 60 * 24 * 14) {
          this.db.delete(row.id)
        }
      } else if (!row.path) {
        // Orphan tasks with no associated note
        row.orphaned = now
      } else if (deletedNotes.has(row.path)) {
        // We know this note no longer exists; orphan the task
        row.orphaned = now
      } else if (existingNotes.has(row.path)) {
        // We know that this note exists, so there's nothing to orphan
      } else {
        // Check to make sure the note still exists
        const file = this.app.vault.getFileByPath(row.path)
        if (file) {
          existingNotes.add(row.path)
        } else {
          row.orphaned = now.valueOf()
          deletedNotes.add(row.path)
        }
      }
    }
    dbEvents.emit(DatabaseEvent.TasksExternalChange)
  }
}

/**
 * Check that if the note contains the #exclude-all-tasks tag.
 * This checks for the tag both with and without the # symbol
 */
export function noteIsExcluded (cacheUpdate: CacheUpdate, plugin: TaskZeroPlugin) {
  if (!cacheUpdate) return false
  const tag = plugin.settings.excludeTags.note.replace(/#/g, '')
  const tags = [tag, `#${tag}`]
  let standard: string[] = [], body: string[] = [], list: string[] = []
  // The standard frontmatter tags array
  try {
    standard = (cacheUpdate.cache?.frontmatter?.tags || []).map((x: {
      tag: string
    }) => x.tag).filter((tag: string) => tags.includes(tag))
  } catch (e) { debug(e) }
  // If the tag exists in the body of the note
  try {
    body = (cacheUpdate.cache?.tags || []).map(x => x.tag).filter((tag: string) => tags.includes(tag))
  } catch (e) { debug(e) }
  // In case the user has put tags into the frontmatter with # symbol, causing them to become a list
  try {
    list = (cacheUpdate.cache?.frontmatter?.tags || []).filter((tag: string) => tags.includes(tag))
  } catch (e) { debug(e) }

  const excluded = standard?.length || body?.length || list?.length
  if (excluded) debug(`Note ${cacheUpdate.file.path} is excluded from processing because it has the tag #${tag}`)
  return !!excluded
}
