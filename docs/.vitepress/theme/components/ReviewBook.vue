<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { withBase } from 'vitepress'
import {
  loadProgress,
  state,
  dueWrong,
  resolveWrong,
  removeWrong,
  removeNote,
  resetAll,
  stats,
} from '../course/progress'
import { lessons } from '../course/curriculum'
import { inline } from '../course/inline'

const ready = ref(false)
onMounted(() => {
  loadProgress()
  ready.value = true
})

const confirmReset = ref(false)
function doReset() {
  if (!confirmReset.value) {
    confirmReset.value = true
    return
  }
  resetAll()
  confirmReset.value = false
}

const tab = ref<'wrong' | 'notes'>('wrong')

const wrongAll = computed(() => state.wrongBook)
const openWrong = computed(() => state.wrongBook.filter((w) => !w.resolved))
const notes = computed(() => state.notes)

const rounds = ['第 1 轮 · 1 天后', '第 2 轮 · 3 天后', '第 3 轮 · 7 天后', '第 4 轮 · 21 天后']

function lessonLink(lessonId: string) {
  return withBase(lessonId === 'L01' ? '/learn/01-http-lifecycle' : '/learn/')
}

function lessonTitle(lessonId: string) {
  return lessons[lessonId]?.title ?? lessonId
}

function daysLeft(due: string) {
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000)
  if (d <= 0) return '今天'
  return `${d} 天后`
}

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function answerText(a: unknown) {
  if (a == null) return '（未作答）'
  if (typeof a === 'string') return a
  if (Array.isArray(a)) return a.join(', ')
  if (typeof a === 'object') {
    const o = a as Record<string, unknown>
    if (o.code) return String(o.code).slice(0, 120) + '…'
    return Object.entries(o)
      .map(([k, v]) => `${k} = ${v}`)
      .join('；')
  }
  return String(a)
}
</script>

<template>
  <div class="rb">
    <div class="rb-tabs">
      <button class="rb-tab" :class="{ active: tab === 'wrong' }" @click="tab = 'wrong'">
        错题本 <span class="rb-n">{{ openWrong.length }}</span>
      </button>
      <button class="rb-tab" :class="{ active: tab === 'notes' }" @click="tab = 'notes'">
        学习笔记 <span class="rb-n">{{ notes.length }}</span>
      </button>
    </div>

    <!-- 错题本 -->
    <template v-if="tab === 'wrong'">
      <div class="rb-intro">
        <p>
          做错的练习会自动进这里，并按 <strong>1 → 3 → 7 → 21 天</strong> 的间隔重复排期。
          做对一次推进一轮，推满四轮判定为"已消化"。
        </p>
        <p class="rb-intro-dim">
          这不是花架子：间隔重复是目前证据最扎实的记忆方法。你不需要记算法，只需要在它提醒你的时候回来做一遍。
        </p>
      </div>

      <div v-if="ready && dueWrong.length" class="rb-due">
        今天有 <strong>{{ dueWrong.length }}</strong> 题到期，建议现在处理。
      </div>

      <p v-if="ready && !wrongAll.length" class="rb-empty">
        还没有错题。做错才会进来——所以如果这里一直是空的，可能说明你还没开始做练习。
      </p>

      <ul class="rb-list">
        <li v-for="w in wrongAll" :key="w.key" class="rb-item" :class="{ resolved: w.resolved }">
          <div class="rb-item-top">
            <span class="rb-title">{{ w.title }}</span>
            <span class="rb-state" :class="w.resolved ? 'ok' : 'warn'">
              {{ w.resolved ? '已消化' : rounds[w.round] }}
            </span>
          </div>
          <p class="rb-prompt" v-html="inline(w.prompt)" />
          <div class="rb-meta">
            <span>上次错于 {{ fmt(w.at) }}</span>
            <span v-if="!w.resolved">· 下次复习 {{ daysLeft(w.due) }}</span>
          </div>
          <div class="rb-answer">
            <span class="rb-answer-label">你当时的答案</span>
            <code>{{ w.lastAnswerText || answerText(w.lastAnswer) }}</code>
          </div>
          <div class="rb-tags">
            <span v-for="k in w.knowledge" :key="k" class="rb-k">{{ k }}</span>
          </div>
          <div class="rb-actions">
            <a :href="lessonLink(w.lessonId)" class="rb-go">回去重做这道题 →</a>
            <button v-if="!w.resolved" class="rb-ghost" @click="resolveWrong(w.key)">
              我确实会了
            </button>
            <button class="rb-ghost" @click="removeWrong(w.key)">移出错题本</button>
          </div>
        </li>
      </ul>
    </template>

    <!-- 笔记 -->
    <template v-else>
      <p v-if="ready && !notes.length" class="rb-empty">
        还没有笔记。在课程页面底部展开"学习笔记"就能记，笔记会挂到具体那一步上。
      </p>
      <ul class="rb-notes">
        <li v-for="n in notes" :key="n.id" class="rb-note">
          <div class="rb-note-head">
            <span class="rb-note-lesson">{{ lessonTitle(n.lessonId) }}</span>
            <span class="rb-note-step">{{ n.stepTitle }}</span>
            <span class="rb-note-time">{{ fmt(n.at) }}</span>
            <button class="rb-ghost small" @click="removeNote(n.id)">删除</button>
          </div>
          <p class="rb-note-text">{{ n.text }}</p>
        </li>
      </ul>
    </template>

    <div v-if="ready" class="rb-stats">
      <span>
        已掌握 {{ stats.mastered }} 课 · 练习 {{ stats.exercisesDone }} 次 · 正确率
        {{ stats.accuracy }}% · 累计 {{ stats.minutes }} 分钟
      </span>
      <button class="rb-reset" :class="{ danger: confirmReset }" @click="doReset">
        {{ confirmReset ? '再点一次确认清除（不可恢复）' : '清除本地学习进度' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.rb { max-width: 100%; }

.rb-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.rb-tab {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.rb-tab.active { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.rb-n {
  display: inline-block;
  margin-left: 5px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 9px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-3);
}

.rb-intro {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  margin-bottom: 18px;
}
.rb-intro p { margin: 0 0 8px; font-size: 14px; line-height: 1.8; }
.rb-intro p:last-child { margin-bottom: 0; }
.rb-intro-dim { color: var(--vp-c-text-2); font-size: 13.5px !important; }

.rb-due {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.1);
  border-left: 3px solid #f59e0b;
  font-size: 13.5px;
  margin-bottom: 16px;
}

.rb-empty {
  padding: 22px;
  text-align: center;
  font-size: 13.5px;
  color: var(--vp-c-text-3);
  border: 1px dashed var(--vp-c-divider);
  border-radius: 10px;
}

.rb-list { list-style: none; margin: 0; padding: 0; }
.rb-item {
  padding: 16px 18px;
  border-radius: 11px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  margin-bottom: 12px;
}
.rb-item.resolved { opacity: 0.62; }
.rb-item-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.rb-title { font-size: 14.5px; font-weight: 700; }
.rb-state { font-size: 11px; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.rb-state.warn { color: #b45309; background: rgba(245, 158, 11, 0.12); }
.dark .rb-state.warn { color: #fbbf24; }
.rb-state.ok { color: #10b981; background: rgba(16, 185, 129, 0.12); }

.rb-prompt { margin: 0 0 8px; font-size: 13.5px; line-height: 1.75; color: var(--vp-c-text-2); }
.rb-meta { font-size: 11.5px; color: var(--vp-c-text-3); margin-bottom: 8px; }
.rb-answer {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 8px 11px;
  border-radius: 7px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  margin-bottom: 9px;
  flex-wrap: wrap;
}
.rb-answer-label { font-size: 11px; color: var(--vp-c-text-3); white-space: nowrap; }
.rb-answer code {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: #ef4444;
  word-break: break-all;
}
.rb-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
.rb-k {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-3);
}
.rb-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.rb-go { font-size: 12.5px; font-weight: 600; }
.rb-ghost {
  padding: 4px 11px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 12px;
  cursor: pointer;
}
.rb-ghost:hover { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
.rb-ghost.small { font-size: 11px; padding: 2px 8px; }

.rb-notes { list-style: none; margin: 0; padding: 0; }
.rb-note {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  margin-bottom: 10px;
}
.rb-note-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.rb-note-lesson { font-size: 11.5px; font-weight: 600; color: var(--vp-c-brand-1); }
.rb-note-step { font-size: 11.5px; color: var(--vp-c-text-3); }
.rb-note-time { font-size: 11px; color: var(--vp-c-text-3); margin-left: auto; }
.rb-note-text { margin: 0; font-size: 13.5px; line-height: 1.8; }

.rb-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 26px;
  padding-top: 14px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.rb-reset {
  padding: 4px 11px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 11.5px;
  cursor: pointer;
}
.rb-reset:hover { color: #ef4444; border-color: #ef4444; }
.rb-reset.danger { color: #fff; background: #ef4444; border-color: #ef4444; }
</style>
