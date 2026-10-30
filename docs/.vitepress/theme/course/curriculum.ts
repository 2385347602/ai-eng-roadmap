import type { Module, Lesson } from './types'
import { lesson01 } from './lesson-01'

/**
 * 24 个学习模块
 *
 * 注意：这里只登记"真正做好了交互课程"的模块为 ready。
 * 其余模块 status 为 planned —— 它们指向已有的知识地图章节（那是参考资料，不是课程），
 * 绝不拿空壳课程充数。
 */
export const modules: Module[] = [
  // ——— A 工程底座 ———
  {
    id: 'ts',
    name: 'TypeScript 工程化',
    group: 'A · 工程底座',
    goal: '让类型系统成为你的第一道测试，而不是负担。',
    refs: [{ text: '17 TypeScript 深入', link: '/guide/17-typescript' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'node',
    name: 'Node.js 后端',
    group: 'A · 工程底座',
    goal: '从"会写接口"到"知道接口为什么这么设计"。',
    refs: [{ text: '18 Node.js 后端工程', link: '/guide/18-node-backend' }],
    lessons: ['L01'],
    status: 'ready',
  },
  {
    id: 'nest',
    name: 'NestJS 与分层架构',
    group: 'A · 工程底座',
    goal: '把 90 行的脚本拆成能被三个人同时维护的结构。',
    refs: [{ text: '18 Node.js 后端工程', link: '/guide/18-node-backend' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'db',
    name: '数据库与数据建模',
    group: 'A · 工程底座',
    goal: '设计出三个月后自己还看得懂、且不用改的表结构。',
    refs: [{ text: '19 数据库与数据建模', link: '/guide/19-database' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'python',
    name: 'Python 与 AI 生态',
    group: 'A · 工程底座',
    goal: '能读懂并改造 RAGAS、vLLM、LLaMA-Factory 这类 Python 项目。',
    refs: [{ text: '21 Python 与 AI 生态', link: '/guide/21-python' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'net',
    name: '网络、系统与分布式',
    group: 'A · 工程底座',
    goal: '线上出问题时，能按层定位而不是靠猜。',
    refs: [{ text: '20 网络、系统与分布式', link: '/guide/20-network-system' }],
    lessons: [],
    status: 'planned',
  },

  // ——— B 模型基础 ———
  {
    id: 'llm',
    name: '模型基础',
    group: 'B · 模型基础',
    goal: '知道模型能做什么、不能做什么、为什么不能。',
    refs: [{ text: '01 LLM 基础', link: '/guide/01-llm-basics' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'prompt',
    name: 'Prompt 与上下文工程',
    group: 'B · 模型基础',
    goal: '把"碰运气调 prompt"变成可复现的工程。',
    refs: [{ text: '02 Prompt 与上下文工程', link: '/guide/02-prompt-context' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'infer',
    name: '推理与部署',
    group: 'B · 模型基础',
    goal: '算清一个模型的成本、延迟和并发上限。',
    refs: [{ text: '06 推理与部署', link: '/guide/06-inference' }],
    lessons: [],
    status: 'planned',
  },

  // ——— C 核心能力 ———
  {
    id: 'rag',
    name: 'RAG 检索增强',
    group: 'C · 核心能力',
    goal: '做一个召回率能测、能调、能上线的检索系统。',
    refs: [{ text: '03 RAG 检索增强', link: '/guide/03-rag' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'agent',
    name: 'Agent 智能体',
    group: 'C · 核心能力',
    goal: '让模型能可靠地调用工具、完成任务、失败可恢复。',
    refs: [{ text: '04 Agent 智能体', link: '/guide/04-agent' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'mcp',
    name: 'MCP 与工具协议',
    group: 'C · 核心能力',
    goal: '写出别人愿意装的 MCP Server，而不是只能自己用的脚本。',
    refs: [{ text: '04 Agent · MCP', link: '/guide/04-agent' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'workflow',
    name: 'Workflow 编排',
    group: 'C · 核心能力',
    goal: '判断一个任务该用工作流还是该用 Agent。',
    refs: [{ text: '04 Agent · 编排模式', link: '/guide/04-agent' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'memory',
    name: '记忆系统',
    group: 'C · 核心能力',
    goal: '让 AI 记得住，且记得对、忘得掉。',
    refs: [{ text: '22 记忆系统与状态管理', link: '/guide/22-memory' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'multimodal',
    name: '多模态',
    group: 'C · 核心能力',
    goal: '处理图片、音频、视频、PDF，而不只是文本。',
    refs: [{ text: '23 多模态 AI 应用', link: '/guide/23-multimodal' }],
    lessons: [],
    status: 'planned',
  },

  // ——— D 生产化 ———
  {
    id: 'eval',
    name: '评测与测试',
    group: 'D · 生产化',
    goal: '用数字证明你的改动是变好了还是变坏了。',
    refs: [{ text: '07 评测', link: '/guide/07-evals' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'security',
    name: '安全与合规',
    group: 'D · 生产化',
    goal: '知道攻击者会从哪里进来，以及怎么堵住。',
    refs: [{ text: '09 安全与合规', link: '/guide/09-security' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'deploy',
    name: '部署与运维',
    group: 'D · 生产化',
    goal: '让服务在别人的机器上也能稳定跑三个月。',
    refs: [{ text: '10 工程架构', link: '/guide/10-architecture' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'cost',
    name: '成本工程',
    group: 'D · 生产化',
    goal: '把每次调用的成本算清楚，并砍掉一半。',
    refs: [{ text: '06 推理与部署', link: '/guide/06-inference' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'observe',
    name: '可观测性',
    group: 'D · 生产化',
    goal: '线上出问题时，五分钟内定位到具体那次调用。',
    refs: [{ text: '08 可观测与运维', link: '/guide/08-observability' }],
    lessons: [],
    status: 'planned',
  },

  // ——— E 前沿与交付 ———
  {
    id: 'aicoding',
    name: 'AI Coding',
    group: 'E · 前沿与交付',
    goal: '从"让 AI 写代码"升级到"让 AI 按工程规范交付"。',
    refs: [{ text: '24 AI 辅助研发工程', link: '/guide/24-ai-assisted-dev' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'harness',
    name: 'Harness 与 Loop',
    group: 'E · 前沿与交付',
    goal: '理解 Codex / Claude Code 这类系统背后的运行机制。',
    refs: [{ text: '25 Agent Harness 与 Loop', link: '/guide/25-harness-loop' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'enterprise',
    name: '企业架构',
    group: 'E · 前沿与交付',
    goal: '在真实企业环境里交付，而不是在 demo 里。',
    refs: [{ text: '10 工程架构', link: '/guide/10-architecture' }],
    lessons: [],
    status: 'planned',
  },
  {
    id: 'governance',
    name: 'AI 内容治理',
    group: 'E · 前沿与交付',
    goal: '把内容审核做成可运营、可申诉、可审计的产品能力。',
    refs: [{ text: '26 内容安全与数据治理', link: '/guide/26-content-governance' }],
    lessons: [],
    status: 'planned',
  },
]

export const lessons: Record<string, Lesson> = {
  L01: lesson01,
}

export const readyLessons = Object.values(lessons).sort((a, b) => a.order - b.order)

export function getLesson(id: string): Lesson | undefined {
  return lessons[id]
}

export function moduleOf(lessonId: string): Module | undefined {
  const l = lessons[lessonId]
  if (!l) return undefined
  return modules.find((m) => m.id === l.moduleId)
}

/** 顺序：用于上一课 / 下一课 */
export function neighbors(lessonId: string) {
  const idx = readyLessons.findIndex((l) => l.id === lessonId)
  return {
    prev: idx > 0 ? readyLessons[idx - 1] : null,
    next: idx >= 0 && idx < readyLessons.length - 1 ? readyLessons[idx + 1] : null,
  }
}
