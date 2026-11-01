/**
 * 课程结构化数据模型
 *
 * 设计原则：
 * 1. 内容与渲染分离 —— 课程是数据，组件只负责呈现。新增课程 = 新增一个 ts 文件。
 * 2. 每一步都有稳定 id —— 进度、错题、笔记全部挂在 id 上，改文案不会丢进度。
 * 3. 练习自带评分标准 —— 判分逻辑写进数据，而不是散落在组件里。
 */

/** 内容块：课程正文由有序的内容块拼成 */
export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string; id?: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'code'; lang: string; title?: string; code: string; note?: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'info' | 'warn' | 'tip' | 'danger'; title?: string; text: string }
  /** 前端经验类比：把新知识挂到 Vue / TS 的旧知识上 */
  | { type: 'analogy'; title: string; text: string }
  /** 数据流图，用等宽字符画 */
  | { type: 'flow'; title?: string; ascii: string }
  /** 自问自答，默认折叠 —— 逼读者先想再看 */
  | { type: 'qa'; q: string; a: string }

/** 一个学习步骤 = 一个知识点 */
export interface Step {
  id: string
  title: string
  /** 这一步讲完，读者应该能回答的问题 */
  checkpoint?: string
  blocks: Block[]
}

export type ExerciseType = 'choice' | 'multi' | 'fill' | 'debug' | 'code'

export interface FillBlank {
  id: string
  label: string
  /** 可接受的答案，全部小写后比较，去空格 */
  accept: string[]
  placeholder?: string
  width?: number
}

export interface CodeCheck {
  name: string
  /** 一段 JS 表达式，result 是用户函数返回值，返回 true 视为通过 */
  expr: string
}

export interface Exercise {
  id: string
  type: ExerciseType
  title: string
  /** 题干，支持简单 markdown 行内代码（用反引号） */
  prompt: string
  points: number

  // choice / multi
  options?: { id: string; text: string }[]
  /** 正确选项 id 列表 */
  answer?: string[]

  // fill
  blanks?: FillBlank[]
  /** 代码填空题的模板，用 {{blankId}} 占位 */
  template?: string
  templateLang?: string

  // debug
  /** 有 bug 的代码 */
  buggyCode?: string
  buggyLang?: string
  /** 错误定位选择题，复用 options/answer */

  // code
  starter?: string
  checks?: CodeCheck[]
  /** 参考实现，练习通过后可展开 */
  solution?: string

  // 所有类型共用
  /** 逐级提示：第 1 层给思路，第 2 层给关键线索，第 3 层给完整讲解 */
  hints: string[]
  /** 判分反馈：为什么对 / 为什么错 */
  explanation: string
  /** 正确思路，一步一步 */
  approach: string[]
  /** 关联知识点，用于错题本回溯 */
  knowledge: string[]
  /** 常见错误 */
  pitfalls?: string[]
}

export interface TestQuestion {
  id: string
  stem: string
  options: { id: string; text: string }[]
  answer: string
  /** 答错时的解释 */
  why: string
  /** 关联步骤 id，方便回去重看 */
  stepId?: string
}

export interface MasteryTest {
  passScore: number
  minutes: number
  questions: TestQuestion[]
}

export interface ProjectBrief {
  title: string
  /** 本课贡献了项目里的哪一块 */
  contributes: string
  tasks: string[]
  /** 完成标志 */
  done: string
}

export interface Lesson {
  id: string
  /** 所属模块 id，对应 curriculum.ts */
  moduleId: string
  order: number
  /** 站点路径，不带 base。用于上一课/下一课、错题本回跳 */
  path: string
  title: string
  subtitle: string
  minutes: number
  level: '入门' | '进阶' | '实战'
  goals: string[]
  prereqs: string[]
  /** 学完能做什么，一句话 */
  outcome: string
  steps: Step[]
  exercises: Exercise[]
  test: MasteryTest
  project?: ProjectBrief
  /** 延伸阅读 */
  further?: { text: string; link?: string }[]
}

export interface Module {
  id: string
  name: string
  group: string
  /** 这一模块要解决什么问题 */
  goal: string
  /** 关联的知识地图章节（已有内容） */
  refs: { text: string; link: string }[]
  /** 交互课程的 lesson id，没有就是还没做 */
  lessons: string[]
  status: 'ready' | 'planned'
}
