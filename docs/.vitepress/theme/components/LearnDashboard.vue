<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { withBase } from 'vitepress'
import { modules, readyLessons } from '../course/curriculum'
import {
  loadProgress,
  state,
  stats,
  dueWrong,
  lessonState,
  exerciseStats,
  lessonProgress,
} from '../course/progress'

const ready = ref(false)
onMounted(() => {
  loadProgress()
  ready.value = true
})

const groups = computed(() => {
  const map = new Map<string, typeof modules>()
  for (const m of modules) {
    if (!map.has(m.group)) map.set(m.group, [])
    map.get(m.group)!.push(m)
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }))
})

const first = readyLessons[0]

const firstState = computed(() => (ready.value && first ? lessonState(first.id) : null))
const firstProgress = computed(() =>
  ready.value && first ? lessonProgress(first.id, first.steps.length) : 0,
)
const firstEx = computed(() =>
  ready.value && first
    ? exerciseStats(first.id, first.exercises.map((e) => e.id))
    : { done: 0, correct: 0, total: 0 },
)
const started = computed(() => (firstState.value?.stepsDone.length ?? 0) > 0)
const mastered = computed(() => firstState.value?.mastered ?? false)

const readyCount = computed(() => modules.filter((m) => m.status === 'ready').length)

function fmtTime(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="dash">
    <!-- 继续学习 -->
    <section v-if="first" class="dash-hero">
      <div class="dash-hero-left">
        <div class="dash-tag">{{ started ? (mastered ? '已掌握，可重做' : '继续学习') : '从这里开始' }}</div>
        <h2 class="dash-hero-title">{{ first.title }}</h2>
        <p class="dash-hero-sub">{{ first.subtitle }}</p>
        <div class="dash-hero-meta">
          第 {{ first.order }} 课 · {{ first.level }} · 约 {{ first.minutes }} 分钟 ·
          {{ first.steps.length }} 步 · {{ first.exercises.length }} 个练习 ·
          {{ first.test.questions.length }} 题测试
        </div>
        <div class="dash-hero-bar">
          <div class="dash-hero-bar-in" :style="{ width: firstProgress + '%' }" />
        </div>
        <div class="dash-hero-status">
          正文 {{ firstState?.stepsDone.length ?? 0 }}/{{ first.steps.length }} 步 ·
          练习 {{ firstEx.correct }}/{{ firstEx.total }} 通过
          <span v-if="firstState?.lastAt"> · 上次学习 {{ fmtTime(firstState.lastAt) }}</span>
        </div>
        <a class="dash-cta" :href="withBase('/learn/01-http-lifecycle')">
          {{ started ? (mastered ? '重新打开这一课' : '继续学习 →') : '开始学习 →' }}
        </a>
      </div>
      <div class="dash-hero-right">
        <div class="dash-metric">
          <span class="dash-metric-num">{{ stats.mastered }}</span>
          <span class="dash-metric-label">已掌握课程</span>
        </div>
        <div class="dash-metric">
          <span class="dash-metric-num">{{ stats.accuracy }}<small>%</small></span>
          <span class="dash-metric-label">练习正确率</span>
        </div>
        <div class="dash-metric">
          <span class="dash-metric-num">{{ stats.wrongOpen }}</span>
          <span class="dash-metric-label">错题待消化</span>
        </div>
        <div class="dash-metric">
          <span class="dash-metric-num">{{ stats.minutes }}</span>
          <span class="dash-metric-label">累计分钟</span>
        </div>
      </div>
    </section>

    <!-- 待复习 -->
    <section v-if="ready && dueWrong.length" class="dash-review">
      <div class="dash-sec-head">
        <h3>今天该复习的 {{ dueWrong.length }} 题</h3>
        <a :href="withBase('/learn/review')">去错题本 →</a>
      </div>
      <ul class="dash-review-list">
        <li v-for="w in dueWrong.slice(0, 4)" :key="w.key">
          <span class="dash-review-title">{{ w.title }}</span>
          <span class="dash-review-tags">{{ w.knowledge.slice(0, 2).join(' · ') }}</span>
        </li>
      </ul>
    </section>

    <!-- 模块列表 -->
    <section class="dash-mods">
      <div class="dash-sec-head">
        <h3>24 个模块</h3>
        <span class="dash-sec-note">
          已有交互课程 {{ readyCount }} 个 · 其余模块先给知识地图章节，不拿空壳课充数
        </span>
      </div>

      <div v-for="g in groups" :key="g.name" class="dash-group">
        <div class="dash-group-name">{{ g.name }}</div>
        <div class="dash-mod-grid">
          <div
            v-for="m in g.items"
            :key="m.id"
            class="dash-mod"
            :class="{ isReady: m.status === 'ready' }"
          >
            <div class="dash-mod-top">
              <span class="dash-mod-name">{{ m.name }}</span>
              <span v-if="m.status === 'ready'" class="dash-mod-badge ok">可学</span>
              <span v-else class="dash-mod-badge">待开课</span>
            </div>
            <p class="dash-mod-goal">{{ m.goal }}</p>
            <div class="dash-mod-links">
              <a v-for="l in m.lessons" :key="l" :href="withBase('/learn/01-http-lifecycle')" class="dash-mod-lesson">
                进入课程 →
              </a>
              <a v-for="(r, i) in m.refs" :key="i" :href="withBase(r.link)" class="dash-mod-ref">
                {{ r.text }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <p class="dash-foot">
      进度存在浏览器 localStorage 里（key: <code>aieng.learn.v2</code>），刷新、关标签页都不会丢。
      换设备或清缓存会丢——需要跨设备同步就得加后端，那是后面的事。
    </p>
  </div>
</template>

<style scoped>
.dash { max-width: 100%; }

.dash-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 28px;
  padding: 26px 28px;
  border-radius: 16px;
  border: 1px solid var(--vp-c-brand-2);
  background: linear-gradient(135deg, var(--vp-c-brand-soft), transparent 70%);
  margin-bottom: 30px;
}
@media (max-width: 860px) {
  .dash-hero { grid-template-columns: 1fr; }
}
.dash-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 3px 9px;
  border-radius: 5px;
  background: var(--vp-c-brand-1);
  color: #fff;
  margin-bottom: 12px;
}
.dash-hero-title {
  margin: 0 0 8px;
  font-size: 23px;
  line-height: 1.4;
  font-weight: 700;
}
.dash-hero-sub {
  margin: 0 0 12px;
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}
.dash-hero-meta { font-size: 12px; color: var(--vp-c-text-3); margin-bottom: 14px; }
.dash-hero-bar {
  height: 5px;
  border-radius: 3px;
  background: var(--vp-c-divider);
  overflow: hidden;
  margin-bottom: 8px;
}
.dash-hero-bar-in {
  height: 100%;
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  transition: width 0.3s;
}
.dash-hero-status { font-size: 11.5px; color: var(--vp-c-text-3); margin-bottom: 16px; }
.dash-cta {
  display: inline-block;
  padding: 10px 22px;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff !important;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.dash-cta:hover { background: var(--vp-c-brand-2); }

.dash-hero-right {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-content: center;
}
.dash-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 9px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}
.dash-metric-num { font-size: 21px; font-weight: 700; line-height: 1.2; }
.dash-metric-num small { font-size: 12px; font-weight: 600; }
.dash-metric-label { font-size: 11px; color: var(--vp-c-text-3); }

.dash-sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.dash-sec-head h3 { margin: 0; font-size: 16px; font-weight: 700; }
.dash-sec-head a { font-size: 12.5px; }
.dash-sec-note { font-size: 11.5px; color: var(--vp-c-text-3); }

.dash-review {
  padding: 16px 18px;
  border-radius: 11px;
  border: 1px solid rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.06);
  margin-bottom: 30px;
}
.dash-review-list { list-style: none; margin: 0; padding: 0; }
.dash-review-list li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 5px 0;
  font-size: 13.5px;
}
.dash-review-title { font-weight: 600; }
.dash-review-tags { font-size: 11.5px; color: var(--vp-c-text-3); }

.dash-mods { margin-top: 8px; }
.dash-group { margin-bottom: 22px; }
.dash-group-name {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  margin-bottom: 9px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.dash-mod-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
  gap: 12px;
}
.dash-mod {
  padding: 13px 15px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.dash-mod.isReady { border-color: var(--vp-c-brand-2); }
.dash-mod-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.dash-mod-name { font-size: 14px; font-weight: 700; }
.dash-mod-badge {
  font-size: 10.5px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-3);
  white-space: nowrap;
}
.dash-mod-badge.ok { color: #10b981; border-color: rgba(16, 185, 129, 0.5); }
.dash-mod-goal { margin: 0 0 9px; font-size: 12.5px; line-height: 1.7; color: var(--vp-c-text-2); }
.dash-mod-links { display: flex; flex-wrap: wrap; gap: 10px; }
.dash-mod-lesson { font-size: 12px; font-weight: 600; }
.dash-mod-ref { font-size: 11.5px; color: var(--vp-c-text-3) !important; }

.dash-foot {
  margin: 26px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--vp-c-text-3);
}
.dash-foot code {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  background: var(--vp-code-bg);
  padding: 2px 5px;
  border-radius: 4px;
}
</style>
