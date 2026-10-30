# AI 应用工程化 · 交互式学习平台

给**前端转 AI 应用工程化**做的一套东西，两部分：

1. **学习平台**（`/learn`）—— 能真的在里面上课：分步正文、可运行沙箱、逐级提示、判分、掌握测试、错题本、笔记、真实持久化进度。
2. **知识地图**（`/guide`）—— 27 章 / 1256 个知识点 / 160 道面试题，当参考手册查。

技术栈：VitePress 1.6（Vue 3 + Vite）+ TypeScript。没有引入额外的 UI 框架，因为阅读型页面塞一个组件库只会让首屏更重。

## 现在能做什么

打开 `/learn` → 点「开始学习第一课」：

| 能力 | 实现方式 |
| --- | --- |
| 12 步分步正文 | 每步一个知识点，末尾有「停一下，先回答」的问题；读完一步才推进进度 |
| 5 个练习 | 单选 / 多选 / 填空 / 找错 / 编程，判分后给「为什么对、为什么错」+ 正确思路 + 常见错误 + 知识点 |
| 三级提示 | 思路 → 关键线索 → 完整讲解。**直接看第三层等于没做**，这是设计上故意的 |
| 可运行沙箱 | `sandbox="allow-scripts"` 的独立 iframe，`new Function` 在 iframe 内执行，7 项检查全过才算对，5 秒超时 |
| 掌握测试 | 10 题，80 分及格。**全部练习通过才解锁**，通过才标记「已掌握」 |
| 进度持久化 | localStorage（`aieng.learn.v2`），含每步完成、每次作答、提示次数、学习时长 |
| 错题本 | 做错自动进入，按 1 → 3 → 7 → 21 天间隔重复排期，做对一次推进一轮 |
| 学习笔记 | 挂在具体步骤上，和错题一起在 `/learn/review` 查看 |
| AI 导师 | 可选。需要自己跑 `server/tutor.mjs`，Key 只在服务端环境变量里。**没配置就明确显示"未配置"，不编造回答** |

## 本地运行

```bash
npm install
npm run dev        # http://localhost:5178 → 自动进学习中心
```

构建与预览：

```bash
npm run build
npm run preview
```

### 启动 AI 导师（可选，不启动不影响学习）

```bash
# 用 OpenAI
OPENAI_API_KEY=sk-xxx node server/tutor.mjs

# 或用任何 OpenAI 兼容接口
OPENAI_API_KEY=xxx OPENAI_BASE_URL=https://api.deepseek.com/v1 MODEL=deepseek-chat node server/tutor.mjs
```

服务默认监听 `127.0.0.1:8787`，提供两个接口：

- `GET /api/health` → `{ configured: boolean, model }`，前端用它判断要不要显示"未配置"
- `POST /api/tutor` → 流式返回纯文本

**为什么必须走后端**：API Key 放前端等于公开。这个代理只做一件事——把 Key 留在服务端，把流式响应转给浏览器。

## 目录结构

```text
.
├── docs/
│   ├── .vitepress/
│   │   ├── config.mts              # 导航、侧边栏、本地搜索、/api 开发代理
│   │   └── theme/
│   │       ├── index.ts            # 注册课程组件
│   │       ├── custom.css          # 知识地图的优先级标签
│   │       ├── learn.css           # 学习平台页面级样式
│   │       ├── course/             # ← 课程引擎（数据与逻辑）
│   │       │   ├── types.ts        # Lesson / Step / Exercise / Block 类型定义
│   │       │   ├── curriculum.ts   # 24 个模块 + 课程注册表
│   │       │   ├── lesson-01.ts    # 第一课全部内容（结构化数据）
│   │       │   ├── progress.ts     # 进度 / 错题 / 笔记 / 间隔重复
│   │       │   ├── sandbox.ts      # iframe 沙箱执行器
│   │       │   ├── highlight.ts    # 轻量代码高亮
│   │       │   └── inline.ts       # 行内 **粗体** 与 `代码`
│   │       └── components/
│   │           ├── LessonPlayer.vue    # 课程播放器（步骤、进度、解锁）
│   │           ├── BlockView.vue       # 内容块渲染
│   │           ├── ExerciseCard.vue    # 五种题型 + 三级提示 + 判分
│   │           ├── MasteryTest.vue     # 掌握测试（门禁）
│   │           ├── CodeSandbox.vue     # 编辑器 + 运行结果 + 检查项
│   │           ├── LearnDashboard.vue  # 学习中心
│   │           ├── LearnHero.vue
│   │           ├── ReviewBook.vue      # 错题本 / 笔记
│   │           ├── NoteBox.vue         # 步骤级笔记
│   │           └── AiTutor.vue         # AI 导师（含未配置提示）
│   ├── learn/
│   │   ├── index.md                # 学习中心
│   │   ├── 01-http-lifecycle.md    # 第一课入口（挂 LessonPlayer）
│   │   └── review.md               # 错题本与笔记
│   ├── guide/                      # 27 章知识地图
│   └── index.md
├── server/
│   └── tutor.mjs                   # 零依赖 AI 导师代理
├── deploy.sh
└── package.json
```

## 怎么加一节课

课程是**数据**，不是页面。三步：

1. 在 `theme/course/` 新建 `lesson-02.ts`，导出 `Lesson` 对象（照 `lesson-01.ts` 的结构写）。
2. 在 `curriculum.ts` 的 `lessons` 里注册：`L02: lesson02`，并把它加到对应 `Module.lessons` 数组，`status` 改成 `'ready'`。
3. 新建 `docs/learn/02-xxx.md`：

```md
---
layout: doc
pageClass: learn-page
title: 课程标题
aside: false
---

<script setup>
import { lesson02 } from '../.vitepress/theme/course/lesson-02'
</script>

<LessonPlayer :lesson="lesson02" />
```

然后在 `config.mts` 的「学习平台」分组加一条侧边栏。学习中心会自动读进度。

## 课程内容标准

后续课程按同一标准写，不达标的不合入：

- 每个知识点回答四件事：**是什么 / 为什么需要 / 怎么实现 / 什么时候不该用**
- 新概念先挂到 Vue / TS 的旧知识上（`analogy` 块），再往深处走
- 代码是真能跑的完整片段，不是伪代码
- 每步留一个 checkpoint 问题，逼读者先想
- 每个练习都有三级提示、判分解释、正确思路、常见错误、知识点标签
- 不给"只有标题和几行占位文字"的课。**24 个模块只登记真做完的，其余指向知识地图章节**

## 部署到 GitHub Pages

线上地址：**https://2385347602.github.io/ai-eng-roadmap/**

用 **gh-pages 分支**方式（不需要 workflow 权限）。`base` 由环境变量注入，本地开发仍是根路径。

```bash
./deploy.sh
```

脚本做三件事：`BASE_PATH=/ai-eng-roadmap/` 构建、`touch .nojekyll`、强制推到 `gh-pages`。

> 注意：构建产物目录每次要换新名（`docs/.vitepress/build-vN`）。本机有 safe-delete 保护，复用同名目录会失败。

想改成 push 即自动发布，需要换一个带 **`workflow`** scope 的 token，然后把 `.github/workflows/deploy.yml` 提交上去，仓库 Settings → Pages → Source 改成 GitHub Actions。

## 已知边界

- **沙箱只能跑纯 JS**。Node 的 `http` / `fs` / `net` 跑不了，相关练习走「本地运行说明 + 代码审查」，不会假装它跑起来了。
- **进度只在本地**。换设备、清缓存会丢。跨设备同步需要加后端，目前没做。
- **AI 导师默认不可用**。要么自己配 Key，要么不用——不配也完整可学。
- **只有第一课是完整交互课程**。其余 23 个模块给的是知识地图参考章节。用空壳课填满 24 个模块看起来完整，实际是骗人。

## License

MIT
