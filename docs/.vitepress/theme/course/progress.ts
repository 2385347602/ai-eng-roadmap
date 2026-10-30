/**
 * 学习进度存储
 *
 * 真实持久化：localStorage，带 schema 版本号，未来加字段可迁移。
 * 所有写入都带时间戳，复习队列（间隔重复）基于时间戳计算。
 *
 * SSR 安全：所有 window/localStorage 访问都在 typeof window 判断之后。
 */
import { reactive, computed } from 'vue'

const STORAGE_KEY = 'aieng.learn.v2'

export interface ExerciseState {
  attempts: number
  correct: boolean
  /** 用户最后一次提交的答案，用于错题本展示 */
  lastAnswer: unknown
  hintsUsed: number
  at: string
}

export interface TestState {
  best: number
  passed: boolean
  attempts: number
  at: string
}

export interface LessonState {
  stepsDone: string[]
  exercises: Record<string, ExerciseState>
  test: TestState | null
  mastered: boolean
  startedAt: string | null
  lastAt: string | null
  /** 累计学习时长（毫秒），由 LessonPlayer 上报 */
  timeMs: number
}

export interface WrongItem {
  /** lessonId::exerciseId */
  key: string
  lessonId: string
  exerciseId: string
  title: string
  prompt: string
  knowledge: string[]
  lastAnswer: unknown
  /** 人能读懂的作答（选项原文 / 填写内容），用于错题本展示 */
  lastAnswerText: string
  at: string
  /** 复习轮次，用于间隔重复 */
  round: number
  /** 下次复习时间 ISO */
  due: string
  resolved: boolean
}

export interface Note {
  id: string
  lessonId: string
  stepId: string
  stepTitle: string
  text: string
  at: string
}

export interface Settings {
  /** AI 导师后端地址，默认本地服务。这里只存地址，绝不存 key */
  tutorEndpoint: string
  /** 关闭"逐步解锁"，一次性展开全部内容 */
  showAllSteps: boolean
}

interface State {
  version: number
  lessons: Record<string, LessonState>
  wrongBook: WrongItem[]
  notes: Note[]
  settings: Settings
}

function emptyLesson(): LessonState {
  return {
    stepsDone: [],
    exercises: {},
    test: null,
    mastered: false,
    startedAt: null,
    lastAt: null,
    timeMs: 0,
  }
}

function defaultState(): State {
  return {
    version: 2,
    lessons: {},
    wrongBook: [],
    notes: [],
    settings: {
      tutorEndpoint: 'http://127.0.0.1:8787',
      showAllSteps: false,
    },
  }
}

export const state = reactive<State>(defaultState())

let loaded = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

export function loadProgress() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<State>
    if (parsed.version !== 2) {
      // 旧版本数据不丢弃，能迁移的字段照搬
      if (parsed.lessons) state.lessons = parsed.lessons as Record<string, LessonState>
      if (parsed.notes) state.notes = parsed.notes as Note[]
      if (parsed.wrongBook) state.wrongBook = parsed.wrongBook as WrongItem[]
      return
    }
    state.lessons = parsed.lessons || {}
    state.wrongBook = parsed.wrongBook || []
    state.notes = parsed.notes || []
    state.settings = { ...defaultState().settings, ...(parsed.settings || {}) }
  } catch (err) {
    console.warn('[learn] 进度读取失败，已重置为空状态', err)
  }
}

function persist() {
  if (typeof window === 'undefined') return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      console.warn('[learn] 进度写入失败（可能是隐私模式或空间不足）', err)
    }
  }, 120)
}

function now() {
  return new Date().toISOString()
}

export function lessonState(lessonId: string): LessonState {
  if (!state.lessons[lessonId]) {
    state.lessons[lessonId] = emptyLesson()
  }
  return state.lessons[lessonId]
}

export function markStepDone(lessonId: string, stepId: string) {
  const ls = lessonState(lessonId)
  if (!ls.stepsDone.includes(stepId)) {
    ls.stepsDone.push(stepId)
    ls.lastAt = now()
    if (!ls.startedAt) ls.startedAt = ls.lastAt
    persist()
  }
}

export function addTime(lessonId: string, ms: number) {
  const ls = lessonState(lessonId)
  ls.timeMs += ms
  ls.lastAt = now()
  if (!ls.startedAt) ls.startedAt = ls.lastAt
  persist()
}

/** 间隔重复：1 天 → 3 天 → 7 天 → 21 天 */
const ROUND_DAYS = [1, 3, 7, 21]

function nextDue(round: number) {
  const days = ROUND_DAYS[Math.min(round, ROUND_DAYS.length - 1)]
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function recordExercise(
  lessonId: string,
  ex: {
    id: string
    title: string
    prompt: string
    knowledge: string[]
  },
  payload: { correct: boolean; answer: unknown; answerText?: string; hintsUsed: number },
) {
  const ls = lessonState(lessonId)
  const prev = ls.exercises[ex.id]
  ls.exercises[ex.id] = {
    attempts: (prev?.attempts || 0) + 1,
    correct: payload.correct,
    lastAnswer: payload.answer,
    hintsUsed: Math.max(prev?.hintsUsed || 0, payload.hintsUsed),
    at: now(),
  }
  ls.lastAt = now()
  if (!ls.startedAt) ls.startedAt = ls.lastAt

  const key = `${lessonId}::${ex.id}`
  const idx = state.wrongBook.findIndex((w) => w.key === key)

  if (!payload.correct) {
    if (idx >= 0) {
      state.wrongBook[idx].lastAnswer = payload.answer
      state.wrongBook[idx].lastAnswerText = payload.answerText || ''
      state.wrongBook[idx].at = now()
      state.wrongBook[idx].resolved = false
      state.wrongBook[idx].due = nextDue(0)
    } else {
      state.wrongBook.unshift({
        key,
        lessonId,
        exerciseId: ex.id,
        title: ex.title,
        prompt: ex.prompt,
        knowledge: ex.knowledge,
        lastAnswer: payload.answer,
        lastAnswerText: payload.answerText || '',
        at: now(),
        round: 0,
        due: nextDue(0),
        resolved: false,
      })
    }
  } else if (idx >= 0) {
    // 做对了：推进复习轮次，超过 4 轮判定为已消化
    const w = state.wrongBook[idx]
    w.round += 1
    w.resolved = w.round >= 4
    w.due = nextDue(w.round)
    w.at = now()
  }
  persist()
}

export function recordTest(lessonId: string, score: number, passed: boolean) {
  const ls = lessonState(lessonId)
  const prev = ls.test
  ls.test = {
    best: Math.max(prev?.best || 0, score),
    passed: (prev?.passed || false) || passed,
    attempts: (prev?.attempts || 0) + 1,
    at: now(),
  }
  // 只有通过测试才能标记已掌握 —— 这是硬门槛
  if (passed) ls.mastered = true
  ls.lastAt = now()
  persist()
}

export function setMastered(lessonId: string, value: boolean) {
  const ls = lessonState(lessonId)
  ls.mastered = value
  ls.lastAt = now()
  persist()
}

export function saveNote(note: Omit<Note, 'id' | 'at'>) {
  const item: Note = { ...note, id: `n_${Date.now()}`, at: now() }
  state.notes.unshift(item)
  persist()
  return item
}

export function updateNote(id: string, text: string) {
  const n = state.notes.find((x) => x.id === id)
  if (n) {
    n.text = text
    n.at = now()
    persist()
  }
}

export function removeNote(id: string) {
  const i = state.notes.findIndex((x) => x.id === id)
  if (i >= 0) {
    state.notes.splice(i, 1)
    persist()
  }
}

export function resolveWrong(key: string) {
  const w = state.wrongBook.find((x) => x.key === key)
  if (w) {
    w.resolved = true
    persist()
  }
}

export function removeWrong(key: string) {
  const i = state.wrongBook.findIndex((x) => x.key === key)
  if (i >= 0) {
    state.wrongBook.splice(i, 1)
    persist()
  }
}

export function updateSettings(patch: Partial<Settings>) {
  state.settings = { ...state.settings, ...patch }
  persist()
}

export function resetAll() {
  const fresh = defaultState()
  state.lessons = fresh.lessons
  state.wrongBook = fresh.wrongBook
  state.notes = fresh.notes
  state.settings = fresh.settings
  persist()
}

// ——— 派生数据（供学习中心使用） ———

export const stats = computed(() => {
  const all = Object.values(state.lessons)
  const mastered = all.filter((l) => l.mastered).length
  let exTotal = 0
  let exCorrect = 0
  for (const l of all) {
    for (const e of Object.values(l.exercises)) {
      exTotal += 1
      if (e.correct) exCorrect += 1
    }
  }
  const timeMs = all.reduce((s, l) => s + l.timeMs, 0)
  return {
    mastered,
    lessonsStarted: all.filter((l) => l.stepsDone.length > 0).length,
    exercisesDone: exTotal,
    accuracy: exTotal ? Math.round((exCorrect / exTotal) * 100) : 0,
    wrongOpen: state.wrongBook.filter((w) => !w.resolved).length,
    notes: state.notes.length,
    minutes: Math.round(timeMs / 60000),
  }
})

/** 今日待复习 */
export const dueWrong = computed(() => {
  const t = Date.now()
  return state.wrongBook.filter((w) => !w.resolved && new Date(w.due).getTime() <= t)
})

export function lessonProgress(lessonId: string, totalSteps: number) {
  const ls = state.lessons[lessonId]
  if (!ls || !totalSteps) return 0
  return Math.min(100, Math.round((ls.stepsDone.length / totalSteps) * 100))
}

export function exerciseStats(lessonId: string, exerciseIds: string[]) {
  const ls = state.lessons[lessonId]
  if (!ls) return { done: 0, correct: 0, total: exerciseIds.length }
  let done = 0
  let correct = 0
  for (const id of exerciseIds) {
    const e = ls.exercises[id]
    if (e) {
      done += 1
      if (e.correct) correct += 1
    }
  }
  return { done, correct, total: exerciseIds.length }
}
