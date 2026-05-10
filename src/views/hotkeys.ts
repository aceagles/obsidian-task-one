import { Modal, Setting } from 'obsidian'
import TaskZeroPlugin from '../main'

export enum HotkeyAction {
  TASKLIST_MOVE_UP = 'tasklist-move-up',
  TASKLIST_MOVE_DOWN = 'tasklist-move-down',
  TASKLIST_MOVE_UP_ALT = 'tasklist-move-up-alt',
  TASKLIST_MOVE_DOWN_ALT = 'tasklist-move-down-alt',
  TASKLIST_SIDEBAR_CLOSE = 'tasklist-sidebar-close',
  TASKLIST_OPEN_ACTIVE_ROW = 'tasklist-open-active-row',
  TASKLIST_MOVE_TASK = 'tasklist-move-task',
  TASKLIST_NEW_TASK = 'tasklist-new-task',
  TASK_SET_TYPE_PROJECT = 'task-set-type-project',
  TASK_SET_TYPE_NEXT_ACTION = 'task-set-type-next-action',
  TASK_SET_TYPE_SOMEDAY = 'task-set-type-someday',
  TASK_SET_TYPE_WAITING_ON = 'task-set-type-waiting-on',
  TASKLIST_TOGGLE_COMPLETED = 'task-toggle-completed',
  OPEN_KEYBOARD_SHORTCUTS = 'open-keyboard-shortcuts',
  TASKLIST_PREV_TAB = 'tasklist-prev-tab',
  TASKLIST_NEXT_TAB = 'tasklist-next-tab',
  TASKLIST_STAGE_TODAY = 'tasklist-stage-today',
  TASKLIST_PROMOTE_TO_FILE = 'tasklist-promote-to-file',
}

export const HOTKEY_DESCRIPTIONS: Record<HotkeyAction, string> = {
  [HotkeyAction.TASKLIST_MOVE_UP]: 'Move up the tasklist',
  [HotkeyAction.TASKLIST_MOVE_DOWN]: 'Move down the tasklist',
  [HotkeyAction.TASKLIST_MOVE_UP_ALT]: 'Alternative key to move up the tasklist',
  [HotkeyAction.TASKLIST_MOVE_DOWN_ALT]: 'Alternative key to move down the tasklist',
  [HotkeyAction.TASKLIST_SIDEBAR_CLOSE]: 'Close the sidebar',
  [HotkeyAction.TASKLIST_OPEN_ACTIVE_ROW]: 'Open the currently active row in the sidebar',
  [HotkeyAction.TASKLIST_MOVE_TASK]: 'Move the highlighted task into a project',
  [HotkeyAction.TASKLIST_NEW_TASK]: 'Create a new task. If a project is highlighted, a subtask will be created for that project instead',
  [HotkeyAction.TASK_SET_TYPE_PROJECT]: 'Set the task type to "Project"',
  [HotkeyAction.TASK_SET_TYPE_NEXT_ACTION]: 'Set the task type to "Next Action"',
  [HotkeyAction.TASK_SET_TYPE_SOMEDAY]: 'Set the task type to "Someday"',
  [HotkeyAction.TASK_SET_TYPE_WAITING_ON]: 'Set the task type to "Waiting On"',
  [HotkeyAction.TASKLIST_TOGGLE_COMPLETED]: 'Toggle the completed status of the task',
  [HotkeyAction.OPEN_KEYBOARD_SHORTCUTS]: 'Open this help screen',
  [HotkeyAction.TASKLIST_PREV_TAB]: 'Move to the previous tab',
  [HotkeyAction.TASKLIST_NEXT_TAB]: 'Move to the next tab',
  [HotkeyAction.TASKLIST_STAGE_TODAY]: 'Stage task for today',
  [HotkeyAction.TASKLIST_PROMOTE_TO_FILE]: 'Promote project to a file-based project',
}

export class HotkeyModal extends Modal {
  plugin: TaskZeroPlugin

  constructor (plugin: TaskZeroPlugin) {
    super(plugin.app)
    this.plugin = plugin
  }

  onOpen () {
    const { contentEl } = this

    new Setting(contentEl)
      .setHeading()
      .setName('Keyboard Shortcuts')

    const list = contentEl.createEl('div', { cls: 'task-zero-shortcut-list' })

    for (const [key, description] of Object.entries(HOTKEY_DESCRIPTIONS)) {
      if (key === HotkeyAction.OPEN_KEYBOARD_SHORTCUTS) continue
      const hotkey = this.plugin.settings.hotkeys[key as HotkeyAction]
      if (!hotkey) continue
      renderShortcutRow(list, [hotkey], description)
    }

    renderShortcutRow(list,
      [{ key: 'q', modifiers: [] }, { key: '?', modifiers: ['Shift'] }],
      HOTKEY_DESCRIPTIONS[HotkeyAction.OPEN_KEYBOARD_SHORTCUTS]
    )
    renderShortcutRow(list,
      [{ key: 'Enter', modifiers: ['Ctrl'] }, { key: 'o', modifiers: [] }],
      'Navigate to task / project location (o: file projects only)'
    )
  }

  onClose () {
    const { contentEl } = this
    contentEl.empty()
  }
}

type ShortcutKey = { key: string; modifiers?: string[] }

function renderShortcutRow (container: HTMLElement, hotkeys: ShortcutKey[], description: string) {
  const row = container.createEl('div', { cls: 'task-zero-shortcut-row' })
  const keysEl = row.createEl('span', { cls: 'task-zero-shortcut-keys' })

  hotkeys.forEach((hotkey, i) => {
    if (i > 0) keysEl.createSpan({ cls: 'task-zero-shortcut-sep', text: '/' })
    for (const mod of (hotkey.modifiers ?? [])) {
      keysEl.createEl('kbd', { cls: 'task-zero-kbd', text: mod })
    }
    keysEl.createEl('kbd', { cls: 'task-zero-kbd', text: remapKeyName(hotkey) })
  })

  row.createEl('span', { cls: 'task-zero-shortcut-desc', text: description })
}

function remapKeyName (hotkey: ShortcutKey): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Escape': 'Esc',
  }
  return keyMap[hotkey?.key] ?? hotkey?.key ?? ''
}
