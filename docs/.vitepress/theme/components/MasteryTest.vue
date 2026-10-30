<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MasteryTest } from '../course/types'
import { recordTest } from '../course/progress'
import { inline } from '../course/inline'

const props = defineProps<{
  test: MasteryTest
  lessonId: string
  /** 所有练习是否已完成 */
  unlocked: boolean
  exerciseTotal: number
  exerciseDone: number
}>()

const emit = defineEmits<{ (e: 'passed'): void }>()

const started = ref(false)
const answers = ref<Record<string, string>>({})
const submitted = ref(false)
const score = ref(0)
const passed = ref(false)
const reviewMode = ref(false)

const answeredCount = computed(
  () => props.test.questions.filter((q) => answers.value[q.id]).length,
)
const allAnswered = computed(() => answeredCount.value === props.test.questions.length)

function pick(qid: string, oid: string) {
  if (submitted.value) return
  answers.value[qid] = oid
}

function submit() {
  let right = 0
  for (const q of props.test.questions) {
    if (answers.value[q.id] === q.answer) right += 1
  }
  score.value = Math.round((right / props.test.questions.length) * 100)
  passed.value = score.value >= props.test.passScore
  submitted.value = true
  recordTest(props.lessonId, score.value, passed.value)
  if (passed.value) emit('passed')
}

function retry() {
  answers.value = {}
  submitted.value = false
  passed.value = false
  reviewMode.value = false
}

function isRight(qid: string) {
  const q = props.test.questions.find((x) => x.id === qid)
  return q && answers.value[qid] === q.answer
}
</script>

<template>
  <section class="mt" :class="{ locked: !unlocked, passed }">
    <header class="mt-head">
      <div>
        <h3 class="mt-title">掌握测试</h3>
        <p class="mt-sub">
          {{ test.questions.length }} 题 · 及格线 {{ test.passScore }} 分 · 建议 {{ test.minutes }} 分钟
        </p>
      </div>
      <span v-if="passed" class="mt-badge ok">已通过 {{ score }} 分</span>
      <span v-else-if="!unlocked" class="mt-badge lock">未解锁</span>
    </header>

    <div v-if="!unlocked" class="mt-lock">
      <p>
        完成全部 {{ exerciseTotal }} 个练习后才能参加掌握测试。当前已完成
        <strong>{{ exerciseDone }} / {{ exerciseTotal }}</strong>。
      </p>
      <p class="mt-lock-why">
        为什么要卡这一道？因为"读完了"和"会了"是两件事。测试是唯一能区分它们的信号——
        也是你以后面试时能说"我确实掌握"而不是"我看过"的依据。
      </p>
    </div>

    <template v-else>
      <div v-if="!started && !submitted" class="mt-start">
        <p>
          测试期间不会给出任何提示。答完后会逐题告诉你为什么对、为什么错，并给出可以回去重看的步骤。
        </p>
        <button class="mt-btn" @click="started = true">开始测试</button>
      </div>

      <template v-else>
        <div class="mt-progress">
          <div class="mt-bar"><div class="mt-bar-in" :style="{ width: (answeredCount / test.questions.length) * 100 + '%' }" /></div>
          <span>{{ answeredCount }} / {{ test.questions.length }}</span>
        </div>

        <ol class="mt-list">
          <li v-for="(q, i) in test.questions" :key="q.id" class="mt-q">
            <div class="mt-q-head">
              <span class="mt-q-no">{{ i + 1 }}</span>
              <span class="mt-q-stem" v-html="inline(q.stem)" />
              <span v-if="submitted" class="mt-q-mark" :class="isRight(q.id) ? 'ok' : 'bad'">
                {{ isRight(q.id) ? '✓' : '✗' }}
              </span>
            </div>
            <div class="mt-opts">
              <button
                v-for="o in q.options"
                :key="o.id"
                class="mt-opt"
                :class="{
                  picked: answers[q.id] === o.id,
                  right: submitted && o.id === q.answer,
                  wrong: submitted && answers[q.id] === o.id && o.id !== q.answer,
                }"
                @click="pick(q.id, o.id)"
              >
                <span class="mt-opt-mark">{{ answers[q.id] === o.id ? '●' : '○' }}</span>
                <span v-html="inline(o.text)" />
              </button>
            </div>
            <p v-if="submitted && !isRight(q.id)" class="mt-why">
              <strong>为什么：</strong><span v-html="inline(q.why)" />
            </p>
          </li>
        </ol>

        <div class="mt-actions">
          <button v-if="!submitted" class="mt-btn" :disabled="!allAnswered" @click="submit">
            {{ allAnswered ? '交卷并评分' : `还有 ${test.questions.length - answeredCount} 题未答` }}
          </button>
          <template v-else>
            <div class="mt-score" :class="passed ? 'ok' : 'bad'">
              {{ score }} 分 · {{ passed ? '通过' : `未通过（需 ${test.passScore} 分）` }}
            </div>
            <button class="mt-ghost" @click="retry">重考一次</button>
          </template>
        </div>

        <p v-if="submitted && !passed" class="mt-advice">
          没通过不代表白学。看上面标红题的"为什么"，回去重看对应步骤，然后重考。
          错题已经自动进入你的错题本，明天会再提醒你一次。
        </p>
        <p v-if="submitted && passed" class="mt-advice ok">
          这一课标记为"已掌握"。你的进度已保存到本地，刷新页面不会丢。
        </p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.mt {
  margin: 40px 0 20px;
  border: 2px solid var(--vp-c-divider);
  border-radius: 14px;
  padding: 22px 24px;
  background: var(--vp-c-bg-soft);
}
.mt.passed { border-color: rgba(16, 185, 129, 0.5); }
.mt.locked { border-style: dashed; }

.mt-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.mt-title { margin: 0 0 4px; font-size: 19px; font-weight: 700; }
.mt-sub { margin: 0; font-size: 12.5px; color: var(--vp-c-text-3); }
.mt-badge {
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}
.mt-badge.ok { color: #10b981; border: 1px solid rgba(16, 185, 129, 0.5); }
.mt-badge.lock { color: var(--vp-c-text-3); border: 1px solid var(--vp-c-divider); }

.mt-lock p { margin: 0 0 8px; font-size: 14.5px; line-height: 1.8; }
.mt-lock-why { color: var(--vp-c-text-2); font-size: 13.5px !important; }

.mt-start p { margin: 0 0 14px; font-size: 14.5px; line-height: 1.8; color: var(--vp-c-text-2); }

.mt-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.mt-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--vp-c-divider);
  overflow: hidden;
}
.mt-bar-in { height: 100%; background: var(--vp-c-brand-1); transition: width 0.25s; }

.mt-list { list-style: none; margin: 0; padding: 0; }
.mt-q { margin-bottom: 26px; }
.mt-q-head { display: flex; gap: 10px; align-items: baseline; margin-bottom: 10px; }
.mt-q-no {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 11.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.mt-q-stem { font-size: 15px; font-weight: 600; line-height: 1.7; flex: 1; }
.mt-q-mark { font-weight: 700; }
.mt-q-mark.ok { color: #10b981; }
.mt-q-mark.bad { color: #ef4444; }

.mt-opts { display: flex; flex-direction: column; gap: 7px; padding-left: 30px; }
.mt-opt {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  text-align: left;
  padding: 8px 12px;
  border-radius: 7px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  line-height: 1.65;
  cursor: pointer;
}
.mt-opt:hover { border-color: var(--vp-c-brand-2); }
.mt-opt.picked { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.mt-opt.right { border-color: #10b981; background: rgba(16, 185, 129, 0.1); }
.mt-opt.wrong { border-color: #ef4444; background: rgba(239, 68, 68, 0.09); }
.mt-opt-mark { color: var(--vp-c-brand-1); flex-shrink: 0; }

.mt-why {
  margin: 9px 0 0 30px;
  padding: 10px 13px;
  border-radius: 7px;
  background: rgba(239, 68, 68, 0.06);
  border-left: 3px solid #ef4444;
  font-size: 13.5px;
  line-height: 1.8;
}

.mt-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.mt-btn {
  padding: 10px 22px;
  border-radius: 8px;
  border: 0;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.mt-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.mt-ghost {
  padding: 9px 18px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 13.5px;
  cursor: pointer;
}
.mt-score { font-size: 17px; font-weight: 700; }
.mt-score.ok { color: #10b981; }
.mt-score.bad { color: #ef4444; }

.mt-advice {
  margin: 16px 0 0;
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--vp-c-text-2);
}
.mt-advice.ok { color: #10b981; }
.mt :deep(code) {
  font-family: var(--vp-font-family-mono);
  font-size: 0.88em;
  background: var(--vp-code-bg);
  color: var(--vp-code-color);
  padding: 2px 5px;
  border-radius: 4px;
}
</style>
