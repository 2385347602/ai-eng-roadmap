<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import type { Exercise } from '../course/types'
import { recordExercise } from '../course/progress'
import { inline } from '../course/inline'
import CodeSandbox from './CodeSandbox.vue'

const props = defineProps<{
  exercise: Exercise
  lessonId: string
  index: number
  total: number
  /** 已答对过（从 store 恢复） */
  alreadyCorrect?: boolean
}>()

const emit = defineEmits<{ (e: 'solved'): void }>()

const ex = computed(() => props.exercise)

// —— 作答状态 ——
const picked = ref<string[]>([])
const filled = reactive<Record<string, string>>({})
const codeResult = ref<{ ok: boolean; code: string } | null>(null)

// —— 判分状态 ——
const submitted = ref(false)
const correct = ref(false)
const hintsShown = ref(0)
const showAnswer = ref(false)

const typeLabel: Record<string, string> = {
  choice: '单选题',
  multi: '多选题',
  fill: '填空题',
  debug: '错误排查',
  code: '编程挑战',
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isPicked(id: string) {
  return picked.value.includes(id)
}

function togglePick(id: string, multi: boolean) {
  if (submitted.value && correct.value) return
  if (multi) {
    picked.value = isPicked(id)
      ? picked.value.filter((x) => x !== id)
      : [...picked.value, id]
  } else {
    picked.value = [id]
  }
}

/** 把 template 拆成 文本 / 空位 交替的片段 */
const fillParts = computed(() => {
  const tpl = ex.value.template || ''
  const parts: { kind: 'text' | 'blank'; value: string }[] = []
  const re = /\{\{(\w+)\}\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(tpl))) {
    if (m.index > last) parts.push({ kind: 'text', value: tpl.slice(last, m.index) })
    parts.push({ kind: 'blank', value: m[1] })
    last = m.index + m[0].length
  }
  if (last < tpl.length) parts.push({ kind: 'text', value: tpl.slice(last) })
  return parts
})

function judge(): boolean {
  const e = ex.value
  if (e.type === 'choice' || e.type === 'multi' || e.type === 'debug') {
    const ans = [...(e.answer || [])].sort()
    const got = [...picked.value].sort()
    return ans.length === got.length && ans.every((a, i) => a === got[i])
  }
  if (e.type === 'fill') {
    return (e.blanks || []).every((b) =>
      b.accept.some((a) => norm(a) === norm(filled[b.id] || '')),
    )
  }
  if (e.type === 'code') {
    return !!codeResult.value?.ok
  }
  return false
}

/** 把作答转成人能读懂的文字，用于错题本 */
function answerText(): string {
  const e = ex.value
  if (e.type === 'choice' || e.type === 'multi' || e.type === 'debug') {
    const texts = picked.value.map((id) => {
      const o = e.options?.find((x) => x.id === id)
      return o ? `${id.toUpperCase()}. ${o.text}` : id
    })
    return texts.join(' / ') || '（未选择）'
  }
  if (e.type === 'fill') {
    return (e.blanks || [])
      .map((b) => `${b.label}：${filled[b.id] || '（空）'}`)
      .join('；')
  }
  if (e.type === 'code') return '（代码见原题）'
  return ''
}

function submit() {
  if (ex.value.type === 'code' && !codeResult.value) {
    // 还没运行过，提示先运行
    return
  }
  const ok = judge()
  submitted.value = true
  correct.value = ok
  recordExercise(
    props.lessonId,
    {
      id: ex.value.id,
      title: ex.value.title,
      prompt: ex.value.prompt,
      knowledge: ex.value.knowledge,
    },
    {
      correct: ok,
      answer:
        ex.value.type === 'fill'
          ? { ...filled }
          : ex.value.type === 'code'
            ? { code: codeResult.value?.code }
            : [...picked.value],
      answerText: answerText(),
      hintsUsed: hintsShown.value,
    },
  )
  if (ok) emit('solved')
}

function retry() {
  submitted.value = false
  correct.value = false
  showAnswer.value = false
}

function nextHint() {
  if (hintsShown.value < ex.value.hints.length) hintsShown.value += 1
}

function onCodeResult(r: { ok: boolean; code: string }) {
  codeResult.value = r
  // 通过即自动判分，不用再点提交
  if (r.ok && !correct.value) {
    submitted.value = true
    correct.value = true
    recordExercise(
      props.lessonId,
      { id: ex.value.id, title: ex.value.title, prompt: ex.value.prompt, knowledge: ex.value.knowledge },
      {
        correct: true,
        answer: { code: r.code },
        answerText: '（代码题：已通过全部检查项）',
        hintsUsed: hintsShown.value,
      },
    )
    emit('solved')
  }
}

const canSubmit = computed(() => {
  const e = ex.value
  if (e.type === 'choice' || e.type === 'multi' || e.type === 'debug') return picked.value.length > 0
  if (e.type === 'fill') return (e.blanks || []).some((b) => (filled[b.id] || '').trim())
  if (e.type === 'code') return !!codeResult.value
  return false
})
</script>

<template>
  <section :id="'ex-' + ex.id" class="ex" :class="{ solved: correct || alreadyCorrect }">
    <header class="ex-head">
      <div class="ex-meta">
        <span class="ex-badge">{{ typeLabel[ex.type] }}</span>
        <span class="ex-points">{{ ex.points }} 分</span>
        <span class="ex-index">练习 {{ index + 1 }} / {{ total }}</span>
      </div>
      <span v-if="correct || alreadyCorrect" class="ex-done">已通过</span>
    </header>

    <h4 class="ex-title">{{ ex.title }}</h4>
    <p class="ex-prompt" v-html="inline(ex.prompt)" />

    <!-- 选择题 / 多选 / 找错 -->
    <div v-if="['choice', 'multi', 'debug'].includes(ex.type)" class="ex-options">
      <pre v-if="ex.type === 'debug' && ex.buggyCode" class="ex-buggy">{{ ex.buggyCode }}</pre>
      <button
        v-for="o in ex.options"
        :key="o.id"
        class="ex-option"
        :class="{
          picked: isPicked(o.id),
          right: (submitted || alreadyCorrect) && ex.answer?.includes(o.id),
          wrong: submitted && isPicked(o.id) && !ex.answer?.includes(o.id),
        }"
        @click="togglePick(o.id, ex.type !== 'choice')"
      >
        <span class="ex-mark">{{ isPicked(o.id) ? '●' : '○' }}</span>
        <span v-html="inline(o.text)" />
      </button>
      <p v-if="ex.type !== 'choice'" class="ex-tip-multi">可多选</p>
    </div>

    <!-- 填空题 -->
    <div v-else-if="ex.type === 'fill'" class="ex-fill">
      <div class="ex-fill-body">
        <template v-for="(p, i) in fillParts" :key="i">
          <span v-if="p.kind === 'text'" class="ex-fill-text">{{ p.value }}</span>
          <input
            v-else
            v-model="filled[p.value]"
            class="ex-blank"
            :style="{ width: (ex.blanks?.find((b) => b.id === p.value)?.width || 18) + 'ch' }"
            :placeholder="ex.blanks?.find((b) => b.id === p.value)?.placeholder || '…'"
            :disabled="correct || alreadyCorrect"
            spellcheck="false"
          />
        </template>
      </div>
      <ul class="ex-blank-labels">
        <li v-for="b in ex.blanks" :key="b.id" v-html="inline(b.label)" />
      </ul>
    </div>

    <!-- 编程题 -->
    <div v-else-if="ex.type === 'code'" class="ex-code">
      <CodeSandbox
        :starter="ex.starter || ''"
        :checks="ex.checks"
        :solution="ex.solution"
        @result="onCodeResult"
      />
    </div>

    <!-- 操作区 -->
    <div class="ex-actions">
      <button
        v-if="!correct && !alreadyCorrect"
        class="ex-submit"
        :disabled="!canSubmit"
        @click="submit"
      >
        提交答案
      </button>
      <button v-if="submitted && !correct" class="ex-ghost" @click="retry">重新作答</button>
      <button
        v-if="hintsShown < ex.hints.length && !correct && !alreadyCorrect"
        class="ex-hint-btn"
        @click="nextHint"
      >
        需要提示？（{{ hintsShown }}/{{ ex.hints.length }}）
      </button>
      <button
        v-if="(submitted && !correct) || alreadyCorrect"
        class="ex-ghost"
        @click="showAnswer = !showAnswer"
      >
        {{ showAnswer ? '收起讲解' : '看完整讲解' }}
      </button>
    </div>

    <!-- 逐级提示 -->
    <div v-if="hintsShown > 0" class="ex-hints">
      <div v-for="(h, i) in ex.hints.slice(0, hintsShown)" :key="i" class="ex-hint">
        <span class="ex-hint-level">提示 {{ i + 1 }} · {{ ['思路', '关键线索', '完整讲解'][i] || '补充' }}</span>
        <p v-html="inline(h)" />
      </div>
    </div>

    <!-- 判分反馈 -->
    <div v-if="submitted" class="ex-feedback" :class="correct ? 'ok' : 'bad'">
      <div class="ex-fb-head">
        {{ correct ? '✓ 答对了' : '✗ 不对，再看看' }}
      </div>
      <p class="ex-fb-text" v-html="inline(ex.explanation)" />
    </div>

    <!-- 完整讲解 -->
    <div v-if="showAnswer" class="ex-answer">
      <div class="ex-answer-block">
        <div class="ex-answer-label">正确思路</div>
        <ol>
          <li v-for="(a, i) in ex.approach" :key="i" v-html="inline(a)" />
        </ol>
      </div>
      <div v-if="ex.pitfalls?.length" class="ex-answer-block">
        <div class="ex-answer-label">常见错误</div>
        <ul>
          <li v-for="(p, i) in ex.pitfalls" :key="i" v-html="inline(p)" />
        </ul>
      </div>
      <div class="ex-answer-block">
        <div class="ex-answer-label">对应知识点</div>
        <div class="ex-knowledge">
          <span v-for="k in ex.knowledge" :key="k" class="ex-k">{{ k }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ex {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 18px 20px;
  margin: 22px 0;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s;
}
.ex.solved { border-color: rgba(16, 185, 129, 0.45); }

.ex-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
}
.ex-meta { display: flex; align-items: center; gap: 10px; }
.ex-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 5px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.ex-points { font-size: 12px; color: var(--vp-c-text-3); }
.ex-index { font-size: 12px; color: var(--vp-c-text-3); }
.ex-done {
  font-size: 11.5px;
  font-weight: 700;
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.5);
  border-radius: 5px;
  padding: 2px 8px;
}

.ex-title { margin: 0 0 8px; font-size: 16px; font-weight: 700; }
.ex-prompt {
  margin: 0 0 14px;
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--vp-c-text-2);
}

.ex-options { display: flex; flex-direction: column; gap: 8px; }
.ex-option {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  text-align: left;
  padding: 10px 13px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  line-height: 1.65;
  cursor: pointer;
  transition: all 0.15s;
}
.ex-option:hover { border-color: var(--vp-c-brand-2); }
.ex-option.picked { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.ex-option.right { border-color: #10b981; background: rgba(16, 185, 129, 0.1); }
.ex-option.wrong { border-color: #ef4444; background: rgba(239, 68, 68, 0.09); }
.ex-mark { color: var(--vp-c-brand-1); flex-shrink: 0; line-height: 1.65; }
.ex-tip-multi { margin: 4px 0 0; font-size: 11.5px; color: var(--vp-c-text-3); }

.ex-buggy {
  margin: 0 0 10px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--vp-code-block-bg);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.7;
  overflow-x: auto;
  color: var(--vp-c-text-1);
}

.ex-fill { margin-bottom: 8px; }
.ex-fill-body {
  padding: 14px 16px;
  border-radius: 8px;
  background: var(--vp-code-block-bg);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 2.2;
  white-space: pre-wrap;
  color: var(--vp-c-text-1);
  overflow-x: auto;
}
.ex-fill-text { white-space: pre-wrap; }
.ex-blank {
  display: inline-block;
  margin: 0 2px;
  padding: 2px 6px;
  border: 0;
  border-bottom: 2px solid var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  outline: none;
  border-radius: 3px 3px 0 0;
}
.ex-blank:focus { border-bottom-color: var(--vp-c-brand-1); background: var(--vp-c-bg); }
.ex-blank-labels {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  line-height: 1.8;
}

.ex-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
  flex-wrap: wrap;
}
.ex-submit {
  padding: 8px 18px;
  border-radius: 7px;
  border: 0;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
.ex-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.ex-ghost, .ex-hint-btn {
  padding: 7px 14px;
  border-radius: 7px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 13px;
  cursor: pointer;
}
.ex-hint-btn { border-style: dashed; }
.ex-ghost:hover, .ex-hint-btn:hover { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }

.ex-hints { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }
.ex-hint {
  padding: 11px 14px;
  border-radius: 8px;
  border-left: 3px solid var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
}
.ex-hint-level {
  display: block;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  margin-bottom: 4px;
}
.ex-hint p { margin: 0; font-size: 14px; line-height: 1.8; color: var(--vp-c-text-1); }

.ex-feedback {
  margin-top: 14px;
  padding: 12px 15px;
  border-radius: 8px;
  border-left: 3px solid;
}
.ex-feedback.ok { border-color: #10b981; background: rgba(16, 185, 129, 0.08); }
.ex-feedback.bad { border-color: #ef4444; background: rgba(239, 68, 68, 0.07); }
.ex-fb-head { font-weight: 700; font-size: 13.5px; margin-bottom: 5px; }
.ex-feedback.ok .ex-fb-head { color: #10b981; }
.ex-feedback.bad .ex-fb-head { color: #ef4444; }
.ex-fb-text { margin: 0; font-size: 14px; line-height: 1.8; color: var(--vp-c-text-1); }

.ex-answer {
  margin-top: 14px;
  padding: 15px 17px;
  border-radius: 9px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}
.ex-answer-block { margin-bottom: 14px; }
.ex-answer-block:last-child { margin-bottom: 0; }
.ex-answer-label {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
  text-transform: uppercase;
}
.ex-answer ol, .ex-answer ul {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--vp-c-text-1);
}
.ex-knowledge { display: flex; flex-wrap: wrap; gap: 6px; }.ex-k {
  font-size: 11.5px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
}
.ex :deep(code) {
  font-family: var(--vp-font-family-mono);
  font-size: 0.88em;
  background: var(--vp-code-bg);
  color: var(--vp-code-color);
  padding: 2px 5px;
  border-radius: 4px;
}
.ex :deep(strong) { font-weight: 700; color: var(--vp-c-text-1); }
</style>
