import { Modal, Setting } from 'obsidian'
import type TaskZeroPlugin from '../main'
import type { Task } from '../classes/task.svelte'

export class PromoteToFileModal extends Modal {
  #plugin: TaskZeroPlugin
  #task: Task

  constructor (plugin: TaskZeroPlugin, task: Task) {
    super(plugin.app)
    this.#plugin = plugin
    this.#task = task
  }

  onOpen () {
    const { contentEl } = this
    const folder = this.#plugin.settings.projectsFolder || 'Projects'
    const filePath = `${folder}/${this.#task.text}.md`
    const fileExists = !!this.#app.vault.getFileByPath(filePath)

    new Setting(contentEl)
      .setHeading()
      .setName('Promote to file project')

    contentEl.createEl('p', { text: `This will create a new file at:` })
    contentEl.createEl('code', { text: filePath })

    if (fileExists) {
      contentEl.createEl('p', {
        text: '⚠️ A file at this path already exists. Promotion cancelled.',
        cls: 'mod-warning'
      })
      new Setting(contentEl)
        .addButton(btn => btn
          .setButtonText('Close')
          .onClick(() => this.close()))
      return
    }

    const descendantCount = this.#task.descendants.length
    contentEl.createEl('p', {
      text: `${descendantCount} subtask${descendantCount !== 1 ? 's' : ''} will be moved into the new file.`
    })

    const confirm = async () => {
      this.close()
      await this.#plugin.tasks.promoteToFileProject(this.#task)
    }

    contentEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); void confirm() }
    })

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()))
      .addButton(btn => btn
        .setButtonText('Promote')
        .setCta()
        .onClick(confirm))
  }

  onClose () {
    this.contentEl.empty()
  }

  get #app () {
    return this.#plugin.app
  }
}
