# Daily note integration

You can embed your staged tasks in a daily note template using a [Dataview](https://blacksmithgu.github.io/obsidian-dataview/) `dataviewjs` block.

Stage a task for today by pressing `t` on it in the task list. The **📅 Today** tab shows all tasks staged for the current day.

## Snippet

````markdown
```dataviewjs
const plugin = app.plugins.plugins['task-one'];
const today = moment().format('YYYY-MM-DD');
const rows = plugin?.settings?.database?.tasks?.rows ?? [];
const staged = rows.filter(t => t.staged === today && t.status !== 'x');

if (staged.length === 0) {
  dv.paragraph('_No tasks staged for today._');
} else {
  const style = dv.container.createEl('style');
  style.textContent = `.dv-today-task { cursor: pointer; border-radius: 3px; padding: 0 3px; }
    .dv-today-task:hover { background: var(--background-modifier-hover); }`;

  const ul = dv.el('ul', '', { cls: 'contains-task-list' });
  for (const t of staged) {
    const li = ul.createEl('li', { cls: 'task-list-item', attr: { 'data-task': ' ' } });

    const cb = li.createEl('input', {
      cls: 'task-list-item-checkbox',
      attr: { type: 'checkbox' }
    });
    cb.addEventListener('click', async (e) => {
      e.stopPropagation();
      const file = app.vault.getAbstractFileByPath(t.path);
      if (!file) return;
      const content = await app.vault.read(file);
      const lines = content.split('\n');
      lines[t.line] = lines[t.line].replace(
        /^(\s*- \[)[ x](\].*)$/,
        (_, a, b) => a + (cb.checked ? 'x' : ' ') + b
      );
      await app.vault.modify(file, lines.join('\n'));
    });

    const span = li.createEl('span', { cls: 'dv-today-task', text: t.text });
    span.addEventListener('click', async () => {
      const file = app.vault.getAbstractFileByPath(t.path);
      if (file) app.workspace.getLeaf().openFile(file, { eState: { line: t.line } });
    });
  }
}
```
````

## Behaviour

- **Checkbox** — toggles the task directly in the source file without navigating away
- **Task text** — clicking anywhere on the text opens the source file scrolled to that line
- Hover highlight uses your current Obsidian theme's colours via `var(--background-modifier-hover)`
