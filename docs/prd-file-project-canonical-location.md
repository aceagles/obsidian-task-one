# PRD: File Project Canonical Task Location

_2026-05-10_

## Problem Statement

When a project task is promoted to a file, the wikilink that replaced it in the original note remains interactive: tasks can be added both nested under the wikilink in the original note and directly inside the project file. Both paths correctly link tasks to the project in the database, but the result is that a project's tasks are scattered across two files with no clear source of truth. Users cannot tell where to look, and the system has no way to enforce consistency.

## Solution

Make the project file the single canonical home for all tasks that belong to a file-backed project. The wikilink in the original note becomes a read-only pointer. Any attempt to add tasks beneath it — through the UI or by manually editing the markdown — results in those tasks being silently migrated into the project file. The wikilink row's checkbox is disabled; project completion is derived automatically when all active descendants in the project file are done.

## User Stories

1. As a user, I want new tasks I add to a file-backed project from the task list to land in the project file, so I always know where to look for a project's tasks.
2. As a user, I want a modal confirmation that tells me which file a new task will be added to before I submit it, so I am not surprised by where it lands.
3. As a user, I want tasks I previously nested under a project wikilink in the original note to be automatically moved to the project file on the next cache update, so I do not need to manually migrate old tasks.
4. As a user, I want tasks I manually type under a project wikilink (outside the UI) to be automatically migrated to the project file, so the canonical-location rule is enforced even when I bypass the UI.
5. As a user, I want migrated tasks to appear at the end of the project file's task list, so my existing ordering is preserved.
6. As a user, I want the wikilink row's checkbox to be non-interactive (but not visually greyed out), so I am not confused about whether clicking it will do anything.
7. As a user, I want the project wikilink row to auto-complete when all active descendants in the project file are done, so project completion reflects the real state of work without me needing to manually tick it.
8. As a user, I want the wikilink text in the task list to render as a clickable link, so I know at a glance that this row is a file-backed project.
9. As a user, I want to be able to open the project file by pressing `o` on the project row in the task list (in addition to the existing Ctrl+Enter), so I can navigate to the project file without using the mouse.
10. As a user, I want the project file and all its tasks to be deleted when I delete the project file from my vault, so I am not left with orphaned database entries.
11. As a user, I want the wikilink row in the original note to be removed from the markdown when its project file is deleted, so I am not left with a dead checkbox in my notes.
12. As a user, I want the task database to correctly update all stored file paths when I rename a project file, so tasks in the renamed file are not orphaned.
13. As a user, I want a completed project (all tasks done) to simply remain as a completed wikilink in the original note without being auto-archived, so I retain control over when to archive.
14. As a user, I want tasks staged for Today that belong to a file-backed project to behave identically to any other staged task, so there are no surprises in the Today tab.

## Implementation Decisions

### Modules to modify

- **Task processing (`processTasksFromCacheUpdate`)** — detect tasks nested directly under a wikilink row that resolves to a file-backed project, and queue them for migration to the project file rather than assigning them a parent in the current note.
- **Task creation (`addSubtask` / `newTask` flow)** — when the active task is a file-backed project row, write the new task to the project file instead of the current note. Pass the target file path through to the input modal for display.
- **Input modal** — display a single line of context ("Adding to Projects/ProjectName.md") when the new task will be routed to a project file.
- **Wikilink row rendering (TaskTable)** — make the checkbox non-interactive for file-backed project rows. Do not grey it out visually; just prevent the click handler from firing.
- **Project completion derivation** — after each cache update for a project file, recompute whether the wikilink row should be marked complete based on `activeDescendants`. Write the completion status back to the wikilink row's markdown if changed.
- **Vault rename handler** — register a `vault.on('rename')` listener; when a project file is renamed, update the `path` field of all tasks in the database whose path matches the old path.
- **Vault delete handler** — register a `vault.on('delete')` listener; when a project file is deleted, cascade-delete all tasks whose path matches the deleted file, then remove the wikilink row from the original note's markdown via the existing `updateTasksInNote` mechanism.
- **Hotkey handler (`hotkeys.ts`)** — add `o` as an alternative binding to open the linked file when the active task is a file-backed project row (mirrors existing Ctrl+Enter behaviour).

### Key invariants

- A task nested under a wikilink row in any note is migrated to the project file if and only if that wikilink resolves to a file with `type: project` frontmatter.
- The wikilink row's `status` field is set by the system (derived from descendants), never by user interaction.
- Project completion uses the same `activeDescendants` check already used to determine whether a project has a next action.
- Migration appends tasks to the end of the project file's task list, preserving existing ordering.

### Out of scope constraints

- Multiple wikilinks pointing to the same project file are not detected or warned about. The first matching row wins (existing behaviour).
- Completed projects are not auto-archived.
- There is no direct "create file project from scratch" flow; promotion remains the only creation path.

## Testing Decisions

- Tests should verify observable state changes (database row contents, markdown file contents) rather than internal method calls.
- **Migration path**: given a note with a wikilink row that has nested tasks, after a cache update the nested tasks should appear in the project file and be absent from the original note.
- **New task routing**: given a file-backed project row is active, submitting a new task should result in a task row in the project file and no change to the original note.
- **Cascade delete**: given a project file is deleted, all tasks with that file path should be removed from the database and the wikilink row should be removed from the original note's markdown.
- **Rename handling**: given a project file is renamed, all tasks should update their stored path to the new filename, and the wikilink in the original note should resolve correctly (Obsidian handles the wikilink text update automatically).
- **Completion derivation**: given all tasks in a project file are toggled to complete, the wikilink row's status in the database and markdown should reflect `x`.

## Out of Scope

- Creating a file project from scratch without promotion.
- Detecting or enforcing the single-wikilink constraint across notes.
- Auto-archiving completed project files.
- Sub-project nesting (a task within a project file that is itself a file-backed project) — this falls through to existing behaviour and is not modified here.
- Any changes to inline (non-file-backed) project behaviour.

## Further Notes

- The `vault.rename` and `vault.delete` listeners should be registered in the same place as the existing metadata cache listener to keep event handling centralised.
- The "disabled but not greyed out" checkbox requirement means the visual state of the checkbox element must not change; only the click event handler should be suppressed.
- The `o` hotkey should only activate when the selected row is a file-backed project (i.e., has a resolvable wikilink path); pressing `o` on any other row type should be a no-op or fall through to existing behaviour.
