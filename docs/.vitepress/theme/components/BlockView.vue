<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Block } from '../course/types'
import { inline } from '../course/inline'
import { highlight } from '../course/highlight'

const props = defineProps<{ blocks: Block[] }>()

const toneMeta: Record<string, { icon: string; label: string }> = {
  info: { icon: 'i', label: '说明' },
  tip: { icon: '★', label: '要点' },
  warn: { icon: '!', label: '注意' },
  danger: { icon: '×', label: '坑' },
}

const openQa = ref<Record<number, boolean>>({})
function toggleQa(i: number) {
  openQa.value[i] = !openQa.value[i]
}

const copied = ref<number | null>(null)
async function copy(code: string, i: number) {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = i
    setTimeout(() => (copied.value = null), 1500)
  } catch {
    /* 剪贴板不可用时静默失败 */
  }
}

const listKey = computed(() => props.blocks.length)
</script>

<template>
  <div class="blocks">
    <template v-for="(b, i) in blocks" :key="i">
      <p v-if="b.type === 'p'" class="blk-p" v-html="inline(b.text)" />

      <h4 v-else-if="b.type === 'h'" class="blk-h">{{ b.text }}</h4>

      <ul v-else-if="b.type === 'list' && !b.ordered" class="blk-list">
        <li v-for="(item, j) in b.items" :key="j" v-html="inline(item)" />
      </ul>
      <ol v-else-if="b.type === 'list' && b.ordered" class="blk-list blk-ol">
        <li v-for="(item, j) in b.items" :key="j" v-html="inline(item)" />
      </ol>

      <div v-else-if="b.type === 'code'" class="blk-code">
        <div class="blk-code-head">
          <span class="blk-code-lang">{{ b.lang }}</span>
          <span v-if="b.title" class="blk-code-title">{{ b.title }}</span>
          <button class="blk-copy" @click="copy(b.code, i)">
            {{ copied === i ? '已复制' : '复制' }}
          </button>
        </div>
        <pre class="blk-pre"><code v-html="highlight(b.code, b.lang)" /></pre>
        <p v-if="b.note" class="blk-code-note">{{ b.note }}</p>
      </div>

      <div v-else-if="b.type === 'table'" class="blk-table-wrap">
        <table class="blk-table">
          <thead>
            <tr><th v-for="(h, j) in b.head" :key="j">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, j) in b.rows" :key="j">
              <td v-for="(cell, k) in row" :key="k" v-html="inline(cell)" />
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="b.type === 'callout'" :class="['blk-callout', 'tone-' + b.tone]">
        <div class="blk-callout-head">
          <span class="blk-callout-icon">{{ toneMeta[b.tone].icon }}</span>
          <span>{{ b.title || toneMeta[b.tone].label }}</span>
        </div>
        <p class="blk-callout-body" v-html="inline(b.text)" />
      </div>

      <div v-else-if="b.type === 'analogy'" class="blk-analogy">
        <div class="blk-analogy-tag">前端经验类比</div>
        <div class="blk-analogy-title">{{ b.title }}</div>
        <p class="blk-analogy-body" v-html="inline(b.text)" />
      </div>

      <div v-else-if="b.type === 'flow'" class="blk-flow">
        <div v-if="b.title" class="blk-flow-title">{{ b.title }}</div>
        <pre class="blk-flow-pre">{{ b.ascii }}</pre>
      </div>

      <div v-else-if="b.type === 'qa'" class="blk-qa">
        <button class="blk-qa-q" @click="toggleQa(i)">
          <span class="blk-qa-mark">{{ openQa[i] ? '−' : '+' }}</span>
          <span>{{ b.q }}</span>
        </button>
        <p v-if="openQa[i]" class="blk-qa-a" v-html="inline(b.a)" />
      </div>
    </template>
    <slot v-if="listKey === 0" />
  </div>
</template>

<style scoped>
.blocks { font-size: 15.5px; line-height: 1.85; }

.blk-p { margin: 0 0 16px; color: var(--vp-c-text-1); }

.blk-h {
  margin: 28px 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  padding-left: 10px;
  border-left: 3px solid var(--vp-c-brand-1);
  line-height: 1.4;
}

.blk-list { margin: 0 0 16px; padding-left: 22px; }
.blk-list li { margin: 7px 0; color: var(--vp-c-text-1); }
.blk-ol { list-style: decimal; }

.blk-code {
  margin: 18px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-code-block-bg);
}
.blk-code-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 12px;
}
.blk-code-lang {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--vp-c-brand-1);
}
.blk-code-title { color: var(--vp-c-text-2); flex: 1; }
.blk-copy {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 5px;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  background: transparent;
  cursor: pointer;
}
.blk-copy:hover { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
.blk-pre {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.7;
  font-family: var(--vp-font-family-mono);
}
.blk-code-note {
  margin: 0;
  padding: 8px 14px;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-alt);
  border-top: 1px solid var(--vp-c-divider);
}

.blk-table-wrap { overflow-x: auto; margin: 18px 0; }
.blk-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  display: table;
}
.blk-table th,
.blk-table td {
  border: 1px solid var(--vp-c-divider);
  padding: 8px 11px;
  text-align: left;
  vertical-align: top;
}
.blk-table th {
  background: var(--vp-c-bg-alt);
  font-weight: 600;
  white-space: nowrap;
}

.blk-callout {
  margin: 18px 0;
  padding: 12px 15px;
  border-radius: 9px;
  border-left: 3px solid;
  font-size: 14.5px;
}
.blk-callout-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 13.5px;
  margin-bottom: 6px;
}
.blk-callout-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}
.blk-callout-body { margin: 0; line-height: 1.8; }

.tone-info { border-color: #3b82f6; background: rgba(59, 130, 246, 0.07); }
.tone-info .blk-callout-icon { background: #3b82f6; color: #fff; }
.tone-tip { border-color: #10b981; background: rgba(16, 185, 129, 0.08); }
.tone-tip .blk-callout-icon { background: #10b981; color: #fff; }
.tone-warn { border-color: #f59e0b; background: rgba(245, 158, 11, 0.09); }
.tone-warn .blk-callout-icon { background: #f59e0b; color: #fff; }
.tone-danger { border-color: #ef4444; background: rgba(239, 68, 68, 0.08); }
.tone-danger .blk-callout-icon { background: #ef4444; color: #fff; }

.blk-analogy {
  margin: 20px 0;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px dashed var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
}
.blk-analogy-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-2);
  border-radius: 4px;
  padding: 2px 6px;
  margin-bottom: 8px;
}
.blk-analogy-title { font-weight: 700; font-size: 14.5px; margin-bottom: 6px; }
.blk-analogy-body { margin: 0; font-size: 14.5px; line-height: 1.8; }

.blk-flow {
  margin: 20px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-alt);
}
.blk-flow-title {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-divider);
}
.blk-flow-pre {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--vp-c-text-1);
}

.blk-qa {
  margin: 18px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  overflow: hidden;
}
.blk-qa-q {
  display: flex;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 11px 14px;
  font-size: 14.5px;
  font-weight: 600;
  background: var(--vp-c-bg-alt);
  border: 0;
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.blk-qa-mark { color: var(--vp-c-brand-1); font-weight: 700; }
.blk-qa-a {
  margin: 0;
  padding: 12px 14px;
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--vp-c-text-2);
  border-top: 1px solid var(--vp-c-divider);
}

.blocks :deep(code) {
  font-family: var(--vp-font-family-mono);
  font-size: 0.88em;
  background: var(--vp-code-bg);
  color: var(--vp-code-color);
  padding: 2px 5px;
  border-radius: 4px;
}
.blocks :deep(.blk-pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: 13px;
}
.blk-pre :deep(.tk-com) { color: #8b949e; font-style: italic; }
.blk-pre :deep(.tk-str) { color: #0a7d3e; }
.blk-pre :deep(.tk-num) { color: #b45309; }
.blk-pre :deep(.tk-kw) { color: #cf222e; font-weight: 600; }
.blk-pre :deep(.tk-lit) { color: #0550ae; }
.blk-pre :deep(.tk-fn) { color: #8250df; }
.dark .blk-pre :deep(.tk-com) { color: #7d8590; }
.dark .blk-pre :deep(.tk-str) { color: #7ee787; }
.dark .blk-pre :deep(.tk-num) { color: #f0b72f; }
.dark .blk-pre :deep(.tk-kw) { color: #ff7b72; }
.dark .blk-pre :deep(.tk-lit) { color: #79c0ff; }
.dark .blk-pre :deep(.tk-fn) { color: #d2a8ff; }
</style>
