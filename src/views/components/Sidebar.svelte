<script lang="ts">
  import { slide } from 'svelte/transition'
  import type { State } from '../view-types'
  import type { TaskScopes } from '../task-view'
  import type { Task } from '../../classes/task.svelte'
  import type TaskZeroPlugin from '../../main'

  interface Props {
    state: State;
    scopes: TaskScopes;
    activeTask: Task;
    plugin: TaskZeroPlugin;
  }

  let { state, scopes, activeTask, plugin }: Props = $props()

  $effect(() => {
    if (state.sidebar.open) {
      scopes.tasklist.disable()
      scopes.sidebar.enable()
    } else {
      scopes.sidebar.disable()
      // Only re-enable the tasklist scope if the view is still active.
      // Without this guard the effect can re-push the scope after
      // disableAllScopes() has already cleaned up on navigation away.
      if (state.viewIsActive) scopes.tasklist.enable()
    }
  })

  function handleLinks (event: MouseEvent) {
    const target = event.target as HTMLAnchorElement
    if (target.closest('a') && target.href.startsWith('app')) {
      plugin.app.workspace.openLinkText(event.target.innerText, 'test')
    }
  }
</script>

{#if state.sidebar.open && activeTask}
    <aside transition:slide={{ duration: 300, axis: 'x' }} class="task-zero-sidebar">
        {@html activeTask.renderedMarkdown}
        <div class="setting-item">
            <div class="setting-item-name">Task</div>
            <textarea bind:this={state.sidebar.fields.text} spellcheck="false"
                      bind:value={activeTask.text}
                      oninput={() => activeTask.update()}></textarea>
        </div>
        <div class="setting-item">
            <div class="setting-item-name">Scheduled</div>
            <input type="text" spellcheck="false"
                   placeholder="YYYY-MM-DD"
                   bind:value={activeTask.scheduled}
                   oninput={() => activeTask.update()}>
        </div>
    </aside>
{/if}
