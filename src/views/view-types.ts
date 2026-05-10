import type { Task } from '../classes/task.svelte'

export interface State {
  tasks: Task[];
  activeId: number;
  tabs: Tab[],
  activeTab: string;
  sidebar: {
    open: boolean;
    fields: {
      text: HTMLTextAreaElement;
    }
  }
  viewIsActive: boolean;
}

export interface Tab {
  label: string,
  tag?: string,
  icon?: string,
  filter?: (task: Task) => boolean
}

export enum DefaultTabs {
  INBOX = '📨 Inbox',
  TASKS = '✅ Tasks',
  PROJECTS = '🗃️ Projects',
  SOMEDAY = '💤 Someday'
}
