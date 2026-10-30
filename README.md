# AI 应用工程化 · 知识地图

给**前端转 AI 应用工程化**准备的一份完整知识清单，用 VitePress 搭成可检索的文档站。

14 个模块 / 479 个知识点 / 每条标注优先级（必须 / 重要 / 选学）。

## 为什么是这份清单

网上的"AI 学习路线"大多按技术栈罗列（prompt → RAG → Agent → 微调），学完会变成一个会调包的目录。这份清单按**交付物**组织，每个模块都回答一个问题：**要做到什么程度才算会**。

几个刻意的取舍：

- **评测（12%）和可观测（5%）权重不低** —— 这两块是 demo 和产品的唯一分界线，也是最没有技术光环、最容易被跳过的部分。
- **微调只给 5%** —— 九成需求用 RAG + prompt 就解决了，很多人在微调上白耗半年。
- **前端单列一章** —— 流式渲染、会话状态、交互设计恰好是 AI 产品最稀缺的能力，不是劣势。
- **所有数字都标了来源或标注为经验值** —— 没有依据的具体数字比没有数字更有害。

## 本地运行

```bash
npm install
npm run dev      # http://localhost:5178
```

构建与预览：

```bash
npm run build
npm run preview
```

## 目录结构

```text
.
├── docs/
│   ├── .vitepress/
│   │   ├── config.mts          # 导航、侧边栏、本地搜索
│   │   └── theme/
│   │       ├── index.ts
│   │       └── custom.css      # 优先级标签样式
│   ├── index.md                # 首页
│   └── guide/
│       ├── 00-orientation.md   # 定位与认知
│       ├── 01-llm-basics.md    # LLM 基础
│       ├── 02-prompt-context.md# Prompt 与上下文工程
│       ├── 03-rag.md           # RAG 检索增强
│       ├── 04-agent.md         # Agent 智能体
│       ├── 05-finetune.md      # 微调与对齐
│       ├── 06-inference.md     # 推理与部署
│       ├── 07-evals.md         # 评测
│       ├── 08-observability.md # 可观测与运维
│       ├── 09-security.md      # 安全与合规
│       ├── 10-architecture.md  # 工程架构
│       ├── 11-frontend.md      # 前端专有
│       ├── 12-product.md       # 产品与场景
│       └── 13-path.md          # 路径与项目
└── package.json
```

## 部署到 GitHub Pages

线上地址：**https://2385347602.github.io/ai-eng-roadmap/**

当前用的是 **gh-pages 分支**方式（不需要 workflow 权限）。`base` 由环境变量注入，本地开发仍是根路径。

### 更新内容后重新部署

```bash
./deploy.sh
```

脚本做三件事：构建到 `docs/.vitepress/site-build`、`BASE_PATH=/ai-eng-roadmap/`、强制推到 `gh-pages` 分支。推送后 GitHub 会在 1~2 分钟内重新发布。

### 想改成自动部署（推荐长期方案）

现在的缺点是每次更新要手动跑脚本。要改成 push 即自动发布，用 GitHub Actions：

1. 生成一个带 **`workflow`** 权限的 token（`repo` + `workflow` 两个 scope 都要）
2. 把 `.github/workflows/deploy.yml` 提交并推送
3. 仓库 Settings → Pages → Source 改成 **GitHub Actions**

workflow 文件已经准备好了（在仓库里，但未提交，因为 PAT 默认没有 workflow 权限）。改完之后 push 到 main 就会自动构建发布。

### 为什么现在不是 Actions

GitHub 有个硬限制：Personal Access Token 必须显式勾选 `workflow` scope 才能推送 `.github/workflows/` 下的文件。当时用的 token 只有 `repo`，所以走了 gh-pages 分支这条路。两种方式效果一样，只是后者要手动触发。


## 其他可选的文档框架

如果不想用 VitePress，这几个也能直接套：

| 项目 | 特点 | 适合 |
| --- | --- | --- |
| [VitePress](https://github.com/vuejs/vitepress) | Vue 生态、构建快、默认主题好 | 本项目用的，前端最顺手 |
| [Docusaurus](https://github.com/facebook/docusaurus) | React 生态、插件多、国际化成熟 | 需要版本化文档 |
| [docsify](https://github.com/docsifyjs/docsify) | 零构建，一个 HTML 就能跑 | 只想快速看，不想装 node |
| [Material for MkDocs](https://github.com/squidfunk/mkdocs-material) | Python 生态、主题精致 | 团队里有 Python 背景 |
| [Nextra](https://github.com/shuding/nextra) | Next.js 生态 | 想和站点其他部分合并 |

## 使用建议

别按顺序全做完。先走主干（阶段 0 → 1 → 2），遇到具体问题再回来查对应章节。真正决定能不能转成的，不是覆盖了多少条，而是有没有一个"能拿出数字"的项目。

## License

MIT
