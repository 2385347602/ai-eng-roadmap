<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { withBase } from 'vitepress'
import type { Lesson } from '../course/types'
import { neighbors } from '../course/curriculum'
import BlockView from './BlockView.vue'
import ExerciseCard from './ExerciseCard.vue'
import MasteryTest from './MasteryTest.vue'
import NoteBox from './NoteBox.vue'
import AiTutor from './AiTutor.vue'
import {
  loadProgress,
  state,
  lessonState,
  markStepDone,
  addTime,
  exerciseStats,
  updateSettings,
} from '../course/progress'

const props = defineProps<{ lesson: Lesson }>()

const lesson = computed(() => props.lesson)
const idx = ref(0)
const step = computed(() => lesson.value.steps[idx.value])
const total = computed(() => lesson.value.steps.length)
const nav = computed(() => neighbors(props.lesson.id))
const prevLesson = computed(() => nav.value.prev)
const nextLesson = computed(() => nav.value.next)

const ready = ref(false)
onMounted(() => {
  loadProgress()
  ready.value = true
  // 回到上次读到的位置
  const ls = state.lessons[lesson.value.id]
  if (ls && ls.stepsDone.length && ls.stepsDone.length < total.value) {
    const lastDone = lesson.value.steps.findIndex(
      (s) => s.id === ls.stepsDone[ls.stepsDone.length - 1],
    )
    if (lastDone >= 0 && lastDone + 1 < total.value) idx.value = lastDone + 1
  }
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      addTime(lesson.value.id, 1000)
    }
  }, 1000)
})

let timer: number | undefined
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const ls = computed(() => (ready.value ? lessonState(lesson.value.id) : null))
const doneSteps = computed(() => ls.value?.stepsDone ?? [])
const progress = computed(() =>
  total.value ? Math.round((doneSteps.value.length / total.value) * 100) : 0,
)

function isDone(id: string) {
  return doneSteps.value.includes(id)
}

const allStepsDone = computed(() => doneSteps.value.length >= total.value)

function goto(i: number) {
  if (i < 0 || i >= total.value) return
  // 当前这一步读过了就记一笔
  markStepDone(lesson.value.id, step.value.id)
  idx.value = i
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function next() {
  markStepDone(lesson.value.id, step.value.id)
  if (idx.value < total.value - 1) {
    idx.value += 1
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    // 最后一步：滚到练习区
    document.getElementById('exercises')?.scrollIntoView({ behavior: 'smooth' })
  }
}

function prev() {
  if (idx.value > 0) {
    idx.value -= 1
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// —— 练习 ——
const solved = ref<Record<string, boolean>>({})
const exIds = computed(() => lesson.value.exercises.map((e) => e.id))
const exStat = computed(() =>
  ready.value ? exerciseStats(lesson.value.id, exIds.value) : { done: 0, correct: 0, total: 0 },
)
const allExercisesCorrect = computed(
  () => exStat.value.total > 0 && exStat.value.correct === exStat.value.total,
)

onMounted(() => {
  const st = state.lessons[lesson.value.id]
  if (st) {
    for (const [id, v] of Object.entries(st.exercises)) {
      if (v.correct) solved.value[id] = true
    }
  }
})

function onSolved(id: string) {
  solved.value[id] = true
}

const testPassed = computed(() => ls.value?.test?.passed ?? false)
const mastered = computed(() => ls.value?.mastered ?? false)

const showAll = computed({
  get: () => state.settings.showAllSteps,
  set: (v: boolean) => updateSettings({ showAllSteps: v }),
})

watch(showAll, (v) => {
  if (v) {
    // 展开全部时，把已读标记推进到当前
    markStepDone(lesson.value.id, step.value.id)
  }
})

function fmtMin(ms: number) {
  return Math.max(1, Math.round(ms / 60000))
}
</script>

<template>
  <div class="lp">
    <!-- 课程头 -->
    <header class="lp-head">
      <div class="lp-kicker">
        第 {{ lesson.order }} 课 · {{ lesson.level }} · 约 {{ lesson.minutes }} 分钟
        <span v-if="mastered" class="lp-mastered">已掌握</span>
      </div>
      <h1 class="lp-title">{{ lesson.title }}</h1>
      <p class="lp-sub">{{ lesson.subtitle }}</p>

      <div class="lp-progress">
        <div class="lp-bar"><div class="lp-bar-in" :style="{ width: progress + '%' }" /></div>
        <span class="lp-progress-txt">{{ doneSteps.length }}/{{ total }} 步 · {{ progress }}%</span>
      </div>

      <div class="lp-cards">
        <div class="lp-card">
          <div class="lp-card-label">学完你能</div>
          <p class="lp-outcome">{{ lesson.outcome }}</p>
        </div>
        <div class="lp-card">
          <div class="lp-card-label">前置知识</div>
          <ul class="lp-prereq">
            <li v-for="(p, i) in lesson.prereqs" :key="i">{{ p }}</li>
          </ul>
        </div>
      </div>

      <details class="lp-goals">
        <summary>本课 {{ lesson.goals.length }} 个学习目标</summary>
        <ol>
          <li v-for="(g, i) in lesson.goals" :key="i">{{ g }}</li>
        </ol>
      </details>
    </header>

    <div class="lp-body">
      <!-- 正文 -->
      <main class="lp-main">
        <div v-if="showAll" class="lp-all">
          <section v-for="(s, i) in lesson.steps" :key="s.id" class="lp-step-block">
            <div class="lp-step-no">第 {{ i + 1 }} 步</div>
            <h2 class="lp-step-title">{{ s.title }}</h2>
            <BlockView :blocks="s.blocks" />
            <div v-if="s.checkpoint" class="lp-checkpoint">
              <span class="lp-cp-label">停一下，先回答</span>
              <p>{{ s.checkpoint }}</p>
            </div>
          </section>
        </div>

        <template v-else>
          <div class="lp-step-no">第 {{ idx + 1 }} / {{ total }} 步</div>
          <h2 class="lp-step-title">{{ step.title }}</h2>
          <BlockView :blocks="step.blocks" />

          <div v-if="step.checkpoint" class="lp-checkpoint">
            <span class="lp-cp-label">停一下，先回答</span>
            <p>{{ step.checkpoint }}</p>
            <p class="lp-cp-hint">想不出来也没关系，下一段会讲。但先想 30 秒，效果差三倍。</p>
          </div>

          <div class="lp-nav">
            <button class="lp-ghost" :disabled="idx === 0" @click="prev">← 上一步</button>
            <button class="lp-primary" @click="next">
              {{ idx === total - 1 ? '读完了，去做练习 →' : '下一步 →' }}
            </button>
          </div>
        </template>

        <!-- 练习 -->
        <section id="exercises" class="lp-exercises">
          <div class="lp-sec-head">
            <h2>互动练习</h2>
            <span class="lp-sec-sub">
              {{ exStat.correct }} / {{ exStat.total }} 已通过 ·
              全部通过才解锁掌握测试
            </span>
          </div>

          <div v-if="!allStepsDone && !showAll" class="lp-gate">
            <p>正文还有 {{ total - doneSteps.length }} 步没读。建议先读完再做练习——练习里会用到后面的概念。</p>
            <button class="lp-ghost" @click="goto(idx + 1)">继续读下一步</button>
            <button class="lp-ghost" @click="showAll = true">我就要直接做练习</button>
          </div>

          <ExerciseCard
            v-for="(e, i) in lesson.exercises"
            :key="e.id"
            :exercise="e"
            :lesson-id="lesson.id"
            :index="i"
            :total="lesson.exercises.length"
            :already-correct="solved[e.id]"
            @solved="onSolved(e.id)"
          />
        </section>

        <!-- 掌握测试 -->
        <MasteryTest
          :test="lesson.test"
          :lesson-id="lesson.id"
          :unlocked="allExercisesCorrect"
          :exercise-total="exStat.total"
          :exercise-done="exStat.correct"
        />

        <!-- 阶段项目 -->
        <section v-if="lesson.project" class="lp-project">
          <div class="lp-proj-tag">阶段项目</div>
          <h3>{{ lesson.project.title }}</h3>
          <p class="lp-proj-contrib">{{ lesson.project.contributes }}</p>
          <div class="lp-proj-label">这一课要做的</div>
          <ol>
            <li v-for="(t, i) in lesson.project.tasks" :key="i">{{ t }}</li>
          </ol>
          <div class="lp-proj-done">
            <strong>完成标志：</strong>{{ lesson.project.done }}
          </div>
        </section>

        <!-- 笔记 -->
        <NoteBox
          v-if="ready"
          :lesson-id="lesson.id"
          :step-id="step.id"
          :step-title="step.title"
        />
      </main>

      <!-- 右侧目录 -->
      <aside class="lp-side">
        <div class="lp-side-sticky">
          <div class="lp-side-label">本课目录</div>
          <button
            v-for="(s, i) in lesson.steps"
            :key="s.id"
            class="lp-toc-item"
            :class="{ active: !showAll && i === idx, done: isDone(s.id) }"
            @click="showAll ? null : goto(i)"
          >
            <span class="lp-toc-mark">{{ isDone(s.id) ? '✓' : i + 1 }}</span>
            <span class="lp-toc-text">{{ s.title }}</span>
          </button>

          <div class="lp-side-label" style="margin-top: 18px">练习</div>
          <a
            v-for="(e, i) in lesson.exercises"
            :key="e.id"
            :href="'#ex-' + e.id"
            class="lp-toc-item sub"
            :class="{ done: solved[e.id] }"
          >
            <span class="lp-toc-mark">{{ solved[e.id] ? '✓' : '·' }}</span>
            <span class="lp-toc-text">{{ e.title }}</span>
          </a>

          <label class="lp-toggle">
            <input v-model="showAll" type="checkbox" />
            <span>一次性展开全文</span>
          </label>

          <div class="lp-meta">
            <div>已学 {{ fmtMin(ls?.timeMs ?? 0) }} 分钟</div>
            <div v-if="ls?.test">测试最好成绩 {{ ls.test.best }} 分</div>
            <div v-if="testPassed" class="lp-ok">掌握测试已通过</div>
          </div>
        </div>
      </aside>
    </div>

    <AiTutor :lesson-id="lesson.id" :step-title="step.title" :lesson-title="lesson.title" />

    <!-- 底部 -->
    <footer class="lp-foot">
      <div v-if="lesson.further?.length" class="lp-further">
        <div class="lp-side-label">延伸阅读</div>
        <ul>
          <li v-for="(f, i) in lesson.further" :key="i">
            <a v-if="f.link" :href="withBase(f.link)">{{ f.text }}</a>
            <span v-else>{{ f.text }}</span>
          </li>
        </ul>
      </div>

      <nav class="lp-nav">
        <a v-if="prevLesson" class="lp-nav-a prev" :href="withBase(prevLesson.path)">
          <span class="lp-nav-dir">← 上一课</span>
          <span class="lp-nav-title">第 {{ prevLesson.order }} 课 · {{ prevLesson.title }}</span>
        </a>
        <span v-else class="lp-nav-gap" />
        <a v-if="nextLesson" class="lp-nav-a next" :href="withBase(nextLesson.path)">
          <span class="lp-nav-dir">下一课 →</span>
          <span class="lp-nav-title">第 {{ nextLesson.order }} 课 · {{ nextLesson.title }}</span>
        </a>
        <a v-else class="lp-nav-a next" :href="withBase('/learn/')">
          <span class="lp-nav-dir">全部课程 →</span>
          <span class="lp-nav-title">回到学习中心，挑下一节</span>
        </a>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.lp { max-width: 100%; }

.lp-head { margin-bottom: 28px; }
.lp-kicker {
  font-size: 12.5px;
  color: var(--vp-c-text-3);
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.lp-mastered {
  font-size: 11px;
  font-weight: 700;
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.5);
  border-radius: 4px;
  padding: 1px 6px;
}
.lp-title {
  margin: 0 0 8px;
  font-size: 27px;
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.lp-sub {
  margin: 0 0 18px;
  font-size: 15px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}

.lp-progress { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.lp-bar {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--vp-c-divider);
  overflow: hidden;
}
.lp-bar-in {
  height: 100%;
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  transition: width 0.3s;
}
.lp-progress-txt { font-size: 12px; color: var(--vp-c-text-3); white-space: nowrap; }

.lp-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
@media (max-width: 720px) { .lp-cards { grid-template-columns: 1fr; } }
.lp-card {
  padding: 12px 15px;
  border-radius: 9px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
}
.lp-card-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  margin-bottom: 6px;
  text-transform: uppercase;
}
.lp-outcome { margin: 0; font-size: 14px; line-height: 1.75; }
.lp-prereq { margin: 0; padding-left: 17px; font-size: 13.5px; line-height: 1.75; color: var(--vp-c-text-2); }

.lp-goals {
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
}
.lp-goals summary { font-size: 13.5px; font-weight: 600; cursor: pointer; color: var(--vp-c-text-2); }
.lp-goals ol { margin: 10px 0 0; padding-left: 20px; font-size: 13.5px; line-height: 1.85; }

.lp-body { display: block; }

.lp-step-no {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--vp-c-brand-1);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.lp-step-title {
  margin: 0 0 18px;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.45;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.lp-step-block { margin-bottom: 44px; }

.lp-checkpoint {
  margin: 22px 0;
  padding: 13px 16px;
  border-radius: 9px;
  background: rgba(245, 158, 11, 0.08);
  border-left: 3px solid #f59e0b;
}
.lp-cp-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #b45309;
  text-transform: uppercase;
}
.dark .lp-cp-label { color: #fbbf24; }
.lp-checkpoint p { margin: 5px 0 0; font-size: 14.5px; line-height: 1.8; }
.lp-cp-hint { font-size: 12.5px !important; color: var(--vp-c-text-3); }

.lp-nav {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--vp-c-divider);
}
.lp-primary {
  padding: 10px 22px;
  border-radius: 8px;
  border: 0;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.lp-primary:hover { background: var(--vp-c-brand-2); }
.lp-ghost {
  padding: 9px 18px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 13.5px;
  cursor: pointer;
}
.lp-ghost:hover:not(:disabled) { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
.lp-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

.lp-exercises { margin-top: 50px; }
.lp-sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border-bottom: 2px solid var(--vp-c-divider);
  padding-bottom: 10px;
}
.lp-sec-head h2 { margin: 0; font-size: 21px; font-weight: 700; }
.lp-sec-sub { font-size: 12.5px; color: var(--vp-c-text-3); }

.lp-gate {
  margin: 16px 0 0;
  padding: 14px 16px;
  border-radius: 9px;
  border: 1px dashed var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.lp-gate p { margin: 0 0 10px; font-size: 14px; line-height: 1.75; color: var(--vp-c-text-2); }
.lp-gate button { margin-right: 8px; margin-top: 4px; }

.lp-project {
  margin: 44px 0 20px;
  padding: 20px 22px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
}
.lp-proj-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--vp-c-brand-1);
  color: #fff;
  margin-bottom: 10px;
}
.lp-project h3 { margin: 0 0 8px; font-size: 18px; }
.lp-proj-contrib { margin: 0 0 14px; font-size: 14px; line-height: 1.8; color: var(--vp-c-text-2); }
.lp-proj-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
}
.lp-project ol { margin: 0 0 14px; padding-left: 20px; font-size: 14px; line-height: 1.85; }
.lp-proj-done {
  padding: 10px 13px;
  border-radius: 7px;
  background: var(--vp-c-bg);
  font-size: 13.5px;
  line-height: 1.75;
}

.lp-side { display: none; }
@media (min-width: 1180px) {
  .lp-body { display: grid; grid-template-columns: minmax(0, 1fr) 236px; gap: 36px; }
  .lp-side { display: block; }
  .lp-side-sticky { position: sticky; top: 84px; }
}
.lp-side-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  margin-bottom: 8px;
}
.lp-toc-item {
  display: flex;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 12.5px;
  line-height: 1.5;
  cursor: pointer;
  text-decoration: none;
}
.lp-toc-item:hover { background: var(--vp-c-bg-alt); color: var(--vp-c-text-1); }
.lp-toc-item.active { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); font-weight: 600; }
.lp-toc-item.done .lp-toc-mark { color: #10b981; }
.lp-toc-item.sub { font-size: 12px; opacity: 0.85; }
.lp-toc-mark {
  flex-shrink: 0;
  width: 14px;
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-weight: 700;
}
.lp-toc-text { flex: 1; }

.lp-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 18px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
  cursor: pointer;
}
.lp-meta {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 11.5px;
  line-height: 1.9;
  color: var(--vp-c-text-3);
}
.lp-ok { color: #10b981; font-weight: 600; }

.lp-foot { margin-top: 40px; }
.lp-further ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.9; color: var(--vp-c-text-2); }

.lp-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 34px;
  padding-top: 22px;
  border-top: 1px solid var(--vp-c-divider);
}
@media (max-width: 720px) {
  .lp-nav { grid-template-columns: 1fr; }
}
.lp-nav-a {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 13px 16px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  text-decoration: none !important;
  transition: border-color 0.2s;
  min-width: 0;
}
.lp-nav-a:hover { border-color: var(--vp-c-brand-2); }
.lp-nav-a.next { text-align: right; }
.lp-nav-dir { font-size: 11.5px; color: var(--vp-c-text-3); }
.lp-nav-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--vp-c-text-1) !important;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.lp-nav-gap { display: block; }

.lp-all .lp-step-block { padding-bottom: 20px; border-bottom: 1px dashed var(--vp-c-divider); }
</style>
