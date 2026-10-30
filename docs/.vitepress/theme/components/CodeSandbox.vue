<script setup lang="ts">
import { ref, computed } from 'vue'
import { runInSandbox, type RunResult } from '../course/sandbox'
import type { CodeCheck } from '../course/types'

const props = defineProps<{
  starter: string
  checks?: CodeCheck[]
  solution?: string
  lang?: string
  /** 由父组件决定何时锁定 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'result', payload: { ok: boolean; code: string }): void
}>()

const code = ref(props.starter)
const running = ref(false)
const result = ref<RunResult | null>(null)
const showSolution = ref(false)

const lineCount = computed(() => code.value.split('\n').length)

async function run() {
  if (running.value) return
  running.value = true
  result.value = null
  try {
    const res = await runInSandbox(code.value, { checks: props.checks, timeout: 5000 })
    result.value = res
    emit('result', { ok: res.ok, code: code.value })
  } finally {
    running.value = false
  }
}

function reset() {
  code.value = props.starter
  result.value = null
}

function onTab(e: KeyboardEvent) {
  const el = e.target as HTMLTextAreaElement
  e.preventDefault()
  const start = el.selectionStart
  const end = el.selectionEnd
  code.value = code.value.slice(0, start) + '  ' + code.value.slice(end)
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = start + 2
  })
}

defineExpose({ getCode: () => code.value, run })
</script>

<template>
  <div class="sandbox">
    <div class="sb-head">
      <span class="sb-dot" />
      <span class="sb-label">可运行沙箱 · 纯 JS</span>
      <span class="sb-lines">{{ lineCount }} 行</span>
    </div>

    <div class="sb-editor">
      <div class="sb-gutter" aria-hidden="true">
        <span v-for="n in lineCount" :key="n">{{ n }}</span>
      </div>
      <textarea
        v-model="code"
        class="sb-textarea"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        :disabled="disabled || running"
        @keydown.tab="onTab"
      />
    </div>

    <div class="sb-actions">
      <button class="sb-run" :disabled="running || disabled" @click="run">
        {{ running ? '执行中…' : '▶ 运行并检查' }}
      </button>
      <button class="sb-ghost" :disabled="running" @click="reset">重置代码</button>
      <button v-if="solution" class="sb-ghost" @click="showSolution = !showSolution">
        {{ showSolution ? '收起参考实现' : '查看参考实现' }}
      </button>
    </div>

    <div v-if="result" class="sb-out" :class="{ ok: result.ok, bad: !result.ok }">
      <div class="sb-out-head">
        <strong>{{ result.ok ? '全部检查通过' : '还有未通过的检查' }}</strong>
        <span class="sb-ms">{{ result.ms }}ms</span>
      </div>

      <ul v-if="result.checks?.length" class="sb-checks">
        <li v-for="(c, i) in result.checks" :key="i" :class="c.pass ? 'pass' : 'fail'">
          <span class="sb-check-mark">{{ c.pass ? '✓' : '✗' }}</span>
          <span>{{ c.name }}</span>
          <span v-if="c.error" class="sb-check-err">{{ c.error }}</span>
        </li>
      </ul>

      <div v-if="result.logs.length" class="sb-logs">
        <div class="sb-logs-label">console 输出</div>
        <pre>{{ result.logs.join('\n') }}</pre>
      </div>

      <div v-if="result.error" class="sb-err">
        <div class="sb-err-label">运行错误</div>
        <pre>{{ result.error }}</pre>
      </div>

      <p class="sb-note">
        沙箱是 <code>sandbox="allow-scripts"</code> 的独立 iframe，拿不到本页面的 DOM、cookie 和 localStorage，
        超时 5 秒自动终止。只能跑纯 JS —— 没有网络、没有 require/import。
      </p>
    </div>

    <div v-if="showSolution && solution" class="sb-solution">
      <div class="sb-solution-label">参考实现（先自己写完再看）</div>
      <pre>{{ solution }}</pre>
    </div>
  </div>
</template>

<style scoped>
.sandbox {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg);
}
.sb-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.sb-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
}
.sb-label { font-weight: 600; }
.sb-lines { margin-left: auto; }

.sb-editor {
  display: flex;
  background: var(--vp-code-block-bg);
  max-height: 420px;
  overflow: auto;
}
.sb-gutter {
  display: flex;
  flex-direction: column;
  padding: 12px 8px 12px 12px;
  text-align: right;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--vp-c-text-3);
  user-select: none;
  flex-shrink: 0;
}
.sb-textarea {
  flex: 1;
  min-height: 220px;
  padding: 12px 14px 12px 4px;
  border: 0;
  outline: none;
  resize: vertical;
  background: transparent;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
}

.sb-actions {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  flex-wrap: wrap;
}
.sb-run {
  padding: 6px 14px;
  border-radius: 6px;
  border: 0;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.sb-run:disabled { opacity: 0.55; cursor: not-allowed; }
.sb-ghost {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 13px;
  cursor: pointer;
}
.sb-ghost:hover { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }

.sb-out {
  padding: 12px 14px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13.5px;
}
.sb-out.ok { background: rgba(16, 185, 129, 0.07); }
.sb-out.bad { background: rgba(239, 68, 68, 0.06); }
.sb-out-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sb-ms { font-size: 11.5px; color: var(--vp-c-text-3); font-family: var(--vp-font-family-mono); }

.sb-checks { list-style: none; margin: 0 0 10px; padding: 0; }
.sb-checks li {
  display: flex;
  gap: 7px;
  align-items: baseline;
  padding: 3px 0;
  font-size: 13px;
}
.sb-check-mark { font-weight: 700; width: 12px; }
.sb-checks li.pass .sb-check-mark { color: #10b981; }
.sb-checks li.fail .sb-check-mark { color: #ef4444; }
.sb-checks li.fail { color: #ef4444; }
.sb-check-err {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.sb-logs, .sb-err { margin-top: 8px; }
.sb-logs-label, .sb-err-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--vp-c-text-2);
  margin-bottom: 4px;
}
.sb-logs pre, .sb-err pre {
  margin: 0;
  padding: 8px 10px;
  background: var(--vp-code-block-bg);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
}
.sb-err pre { color: #ef4444; }

.sb-note {
  margin: 10px 0 0;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--vp-c-text-3);
}

.sb-solution {
  padding: 12px 14px;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}
.sb-solution-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
}
.sb-solution :deep(pre) {
  margin: 0;
  padding: 10px;
  background: var(--vp-code-block-bg);
  border-radius: 6px;
  font-size: 12.5px;
  line-height: 1.65;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
}
</style>
