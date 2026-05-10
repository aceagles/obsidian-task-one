# Issues — File Project Canonical Location

_2026-05-10_

See also: [[prd-file-project-canonical-location]]

---

## Issue 1 — File-backed project row UI hardening

**Type**: AFK
**Blocked by**: None
**User stories covered**: 6, 9

Two UI changes to the wikilink row for file-backed projects. First, add `o` as an alternative hotkey to Ctrl+Enter for opening the linked project file when the active row is a file-backed project — no-op on all other row types. Second, suppress the checkbox click handler on file-backed project rows so the checkbox does not respond to clicks. No visual change to the checkbox — it renders identically to an active checkbox, it simply does not toggle status.

### Acceptance criteria

- [ ] Pressing `o` on a file-backed project row opens the project file in the active Obsidian leaf.
- [ ] Pressing `o` on a non-project row does nothing.
- [ ] Ctrl+Enter continues to work unchanged on file-backed project rows.
- [ ] Clicking the checkbox on a file-backed project row does not change the task status.
- [ ] The checkbox visually appears identical to any other unchecked task checkbox (no grey-out).
- [ ] Clicking the checkbox on a regular task row continues to toggle status as before.

---

## Issue 2 — vault.delete cascade

**Type**: AFK
**Blocked by**: None
**User stories covered**: 10, 11

Register a `vault.on('delete')` listener in the plugin. When a deleted file matches a project file path (tasks in the database carry that path), remove all those tasks from the database and remove the wikilink row from the original note's markdown using the existing `updateTasksInNote` mechanism. The wikilink row to remove is identified by the task whose `text` contains `[[<basename>]]` and whose `id` is the `projectParentId` for the deleted file's tasks.

### Acceptance criteria

- [ ] Deleting a project file removes all tasks with that file path from the database.
- [ ] The wikilink row (`- [ ] [[ProjectName]] ^tzN`) is removed from the original note's markdown after deletion.
- [ ] Deleting a non-project file does not trigger any cascade behaviour.
- [ ] No orphaned task rows remain in the database after cascade delete.

---

## Issue 3 — vault.rename path update

**Type**: AFK
**Blocked by**: None
**User stories covered**: 12

Register a `vault.on('rename')` listener in the plugin. When a renamed file matches a project file (tasks in the database carry the old path), update the `path` field of all those tasks to the new path. Obsidian automatically updates wikilinks in markdown; this issue only concerns the database.

### Acceptance criteria

- [ ] Renaming a project file updates `path` for all its tasks in the database to the new path.
- [ ] After rename, tasks continue to be associated with the correct project parent.
- [ ] Renaming a non-project file does not modify the database.
- [ ] No tasks are orphaned as a result of a rename.

---

## Issue 4 — Auto-migrate tasks nested under wikilink

**Type**: AFK
**Blocked by**: None
**User stories covered**: 2, 3, 4, 5

During `processTasksFromCacheUpdate`, when processing a note that contains a wikilink row resolving to a file-backed project, any tasks nested directly under that wikilink row are migrated to the project file instead of being stored as children in the current note. Migration appends those tasks (dedented to top level) at the end of the project file and removes them from the original note's markdown. This covers both pre-existing nested tasks and ones typed manually after the fact.

### Acceptance criteria

- [ ] On cache update of a note containing `- [ ] [[ProjectName]] ^tzN` with nested tasks beneath it, those nested tasks are appended to the project file and removed from the original note.
- [ ] The original note retains only the bare wikilink row with no children.
- [ ] Migrated tasks appear in the database with `path` set to the project file, not the original note.
- [ ] Migrated tasks are appended after the last existing task in the project file.
- [ ] Tasks already in the project file are not duplicated.
- [ ] Notes containing a non-file-backed wikilink are unaffected.

---

## Issue 5 — Route new tasks to project file and derive completion

**Type**: HITL
**Blocked by**: Issue 4 — Auto-migrate tasks nested under wikilink
**User stories covered**: 1, 2, 7, 8, 13, 14

Two related behaviours that close the loop on the canonical-location rule.

**Routing**: When the active task row is a file-backed project and the user presses `n`, the task input modal displays the target project file path (e.g. "Adding to Projects/ProjectName.md"). On submission the new task is appended to the project file, not the original note or the default note.

**Completion derivation**: After each cache update for a project file, check whether `activeDescendants` of the project's wikilink row is empty. If empty and the wikilink row is not already complete, mark it complete and write back to the original note. If active descendants exist and the row is marked complete, revert to incomplete. A project file with no tasks does not trigger auto-completion. This derived status is the only way the wikilink row's status changes — user clicks on the checkbox are suppressed (Issue 1).

### Acceptance criteria

- [ ] Pressing `n` on a file-backed project row opens the task input modal with a hint showing the project file path.
- [ ] Submitting the modal creates the task in the project file, not the original note.
- [ ] The new task appears as a child of the project in the task list after the next cache update.
- [ ] Pressing `n` on a non-project row continues to behave as before.
- [ ] When all tasks in a project file are completed, the wikilink row becomes `[x]` in the original note.
- [ ] When a new task is added to a previously-completed project file, the wikilink row reverts to `[ ]`.
- [ ] A project file with no tasks does not auto-complete the wikilink row.
- [ ] Completion derivation does not run for inline (non-file-backed) projects.
- [ ] Human tester confirms new task appears in the correct file in Obsidian after submission.
- [ ] Human tester confirms wikilink row completes and reverts correctly as tasks are toggled.
