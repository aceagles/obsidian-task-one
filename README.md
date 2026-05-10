# Task One plugin for Obsidian

Everybody who practises GTD in any way has their own unique setup. This is mine, built upon the brilliant plugin by Alan Grainger.

## Changes in One vs Zero

### Vim keybindings

The original plugin used J and K for navigating up and down tasks, but it was backwards compared to Vim. I have changed this to match and also added H and L to navigate between the tags.

### Separate Inbox

I don't like seeing the clutter of the inbox when I'm going about my day. I need to be in a special mental space to process this, and so I've given it its own tab.

### Today Tab / Dataview

I like to start my day by looking through my tasks and staging a number of tasks that I think I will complete in the day. I then only want to see these tasks for the duration of the day, so these have their own tab. Additionally, there is a data view for use in a template on the daily note, so that I can also see today's tasks on the daily note, which I tend to use as a scratch pad.

### Projects as Files

For larger projects, it feels a bit too ephemeral to have them just as nested task lists. There is now the option to promote a project into a file-based project. This will create a project, create the file, move all nested tasks and projects into it, and then update links. It will then behave more or less the same as other projects, except they will have an actual location.

### Tasklist Text Wrapping

Tasks will now wrap in the truncate in the task list so that you can always read a full task.

# Task Zero plugin for Obsidian

Task Zero is a keyboard-first GTD task management system for Obsidian.

If you’ve ever used [MyLifeOrganized](https://www.mylifeorganized.net/), the UI will be immediately familiar. I love MLO and used it for many years, and wanted a similar experience inside Obsidian.

No AI was used to make this plugin.

![](https://taskzero.alan.gr/_attachments/main-tasklist.png)

The goals of this project are:

1. Reduce friction as much as possible.
2. Everything can be managed from a single interface on [the main task page](https://taskzero.alan.gr/the-tasklist).
3. Every action can be done with [keyboard shortcuts](https://taskzero.alan.gr/keyboard-shortcuts).
4. Other plugins and scripts can interact with your tasks [via API](https://taskzero.alan.gr/api).

## Documentation

See here: [https://taskzero.alan.gr/getting-started](https://taskzero.alan.gr/getting-started)

## Daily note integration

Press `t` on any task to stage it for today. See [docs/daily-note-integration.md](docs/daily-note-integration.md) for a Dataview snippet you can paste into your daily note template.

## How to install

The plugin is currently going through the review process, so is not yet available in the plugin store. In the meantime, you can install it with BRAT:

1. Install the **BRAT** plugin from the Community Plugins.
2. Open the Settings page for BRAT.
3. Click “Add Beta Plugin”.
4. Paste in this address: `https://github.com/alangrainger/obsidian-task-zero`
5. Choose `latest` under "Select a version".
6. Click “Add Plugin”.
