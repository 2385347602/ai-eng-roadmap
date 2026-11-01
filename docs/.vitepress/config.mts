import { defineConfig } from 'vitepress'

// 部署到 GitHub Pages 时，把 base 改成 '/<仓库名>/'
// 例如仓库叫 ai-eng-roadmap，就写 base: '/ai-eng-roadmap/'
export default defineConfig({
  // 部署到 GitHub Pages 时由 CI 注入 BASE_PATH=/<仓库名>/
  base: process.env.BASE_PATH || '/',
  // 本地临时构建可指定 OUT_DIR，避免清理旧产物
  outDir: process.env.OUT_DIR || './.vitepress/dist',
  lang: 'zh-CN',
  title: 'AI 应用工程化',
  description: '前端转 AI 应用工程化 · 完整知识地图（27 章 / 1256 个知识点）',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  markdown: {
    lineNumbers: true,
  },

  // 本地开发时把 /api 代理到导师服务，避免跨域
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  },

  themeConfig: {
    nav: [
      { text: '学习中心', link: '/learn/' },
      { text: '错题本', link: '/learn/review' },
      { text: '知识地图', link: '/guide/00-orientation' },
      { text: '学习路径', link: '/guide/13-path' },
      { text: 'GitHub', link: 'https://github.com/2385347602/ai-eng-roadmap' },
    ],

    sidebar: [
      {
        text: '学习平台',
        collapsed: false,
        items: [
          { text: '学习中心', link: '/learn/' },
          { text: '错题本与笔记', link: '/learn/review' },
        ],
      },
      {
        text: '课程 A · 工程底座',
        collapsed: false,
        items: [
          { text: '01 HTTP 请求生命周期', link: '/learn/01-http-lifecycle' },
          { text: '02 分层与依赖注入', link: '/learn/02-layered-architecture' },
          { text: '03 数据库与数据建模', link: '/learn/03-database' },
          { text: '04 TypeScript 类型工程', link: '/learn/04-type-engineering' },
          { text: '19 Python 与 AI 生态', link: '/learn/19-python' },
          { text: '20 网络、系统与分布式', link: '/learn/20-network-distributed' },
        ],
      },
      {
        text: '课程 B · 模型基础',
        collapsed: true,
        items: [
          { text: '05 LLM 基础', link: '/learn/05-llm-basics' },
          { text: '06 Prompt 与上下文工程', link: '/learn/06-prompt-engineering' },
          { text: '17 推理与部署', link: '/learn/17-inference' },
        ],
      },
      {
        text: '课程 C · 核心能力',
        collapsed: true,
        items: [
          { text: '07 RAG 检索增强', link: '/learn/07-rag' },
          { text: '08 Agent 智能体', link: '/learn/08-agent' },
          { text: '15 Workflow 编排', link: '/learn/15-workflow' },
          { text: '16 MCP 与工具协议', link: '/learn/16-mcp' },
          { text: '13 记忆系统', link: '/learn/13-memory' },
          { text: '14 多模态', link: '/learn/14-multimodal' },
        ],
      },
      {
        text: '课程 D · 生产化',
        collapsed: true,
        items: [
          { text: '09 评测与测试', link: '/learn/09-evals' },
          { text: '10 可观测性', link: '/learn/10-observability' },
          { text: '11 安全与合规', link: '/learn/11-security' },
          { text: '12 部署与工程架构', link: '/learn/12-deployment' },
          { text: '18 成本工程', link: '/learn/18-cost' },
        ],
      },
      {
        text: '课程 E · 前沿与交付',
        collapsed: true,
        items: [
          { text: '21 AI Coding', link: '/learn/21-ai-coding' },
          { text: '22 Harness 与 Loop', link: '/learn/22-harness-loop' },
          { text: '23 企业架构', link: '/learn/23-enterprise' },
          { text: '24 AI 内容治理', link: '/learn/24-governance' },
        ],
      },
      {
        text: '第 0 层 · 工程底座',
        collapsed: false,
        items: [
          { text: '17 TypeScript 深入', link: '/guide/17-typescript' },
          { text: '18 Node.js 后端工程', link: '/guide/18-node-backend' },
          { text: '19 数据库与数据建模', link: '/guide/19-database' },
          { text: '20 网络、系统与分布式', link: '/guide/20-network-system' },
          { text: '21 Python 与 AI 生态', link: '/guide/21-python' },
          { text: '24 AI 辅助研发工程', link: '/guide/24-ai-assisted-dev' },
        ],
      },
      {
        text: '第 1 层 · 定位',
        collapsed: false,
        items: [
          { text: '00 定位与认知', link: '/guide/00-orientation' },
        ],
      },
      {
        text: '第 2 层 · 模型基础',
        collapsed: false,
        items: [
          { text: '01 LLM 基础', link: '/guide/01-llm-basics' },
          { text: '02 Prompt 与上下文工程', link: '/guide/02-prompt-context' },
        ],
      },
      {
        text: '第 3 层 · 核心能力',
        collapsed: false,
        items: [
          { text: '03 RAG 检索增强', link: '/guide/03-rag' },
          { text: '04 Agent 智能体', link: '/guide/04-agent' },
          { text: '22 记忆系统与状态管理', link: '/guide/22-memory' },
          { text: '23 多模态 AI 应用', link: '/guide/23-multimodal' },
          { text: '25 Agent Harness 与 Loop', link: '/guide/25-harness-loop' },
        ],
      },
      {
        text: '第 4 层 · 模型适配',
        collapsed: false,
        items: [
          { text: '05 微调与对齐', link: '/guide/05-finetune' },
          { text: '06 推理与部署', link: '/guide/06-inference' },
        ],
      },
      {
        text: '第 5 层 · 工程化',
        collapsed: false,
        items: [
          { text: '07 评测 Evals', link: '/guide/07-evals' },
          { text: '08 可观测与运维', link: '/guide/08-observability' },
          { text: '09 安全与合规', link: '/guide/09-security' },
          { text: '26 内容安全与数据治理', link: '/guide/26-content-governance' },
          { text: '10 工程架构', link: '/guide/10-architecture' },
        ],
      },
      {
        text: '第 6 层 · 你的优势',
        collapsed: false,
        items: [
          { text: '11 前端专有', link: '/guide/11-frontend' },
          { text: '12 产品与场景', link: '/guide/12-product' },
        ],
      },
      {
        text: '上岗准备',
        collapsed: false,
        items: [
          { text: '13 路径与项目', link: '/guide/13-path' },
          { text: '14 岗位与能力矩阵', link: '/guide/14-jobs' },
          { text: '15 面试题库（160+）', link: '/guide/15-interview' },
          { text: '16 项目实战手册', link: '/guide/16-projects' },
        ],
      },
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索知识点', buttonAriaLabel: '搜索知识点' },
          modal: {
            noResultsText: '没有找到相关知识点',
            resetButtonTitle: '清空',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    lastUpdated: { text: '最后更新于' },
    externalLinkIcon: true,
  },
})
