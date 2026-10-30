# 10 · 工程架构

> **投入权重：5%** · 框架选型的真相：大多数生产系统最终都退回到"薄封装 + 裸调 SDK"。
> 但你要知道每个框架解决什么问题，才判断得出该不该用。

## 先说一个判断

新手最爱问"学哪个框架"，老手最爱说"别用框架"。两边都对了一半。

框架的价值在于：它把常见模式（检索、链式调用、工具编排）沉淀成了可复用的抽象，让你在验证阶段跑得快。框架的代价是：出问题时你要穿透两层抽象才能看到真正发给模型的 prompt，而 AI 应用恰恰是"必须看到原始输入输出"的领域。

所以合理的路径是：**先用框架快速验证，理解模式后逐步下沉到裸调**。别一开始就裸调（会重复造轮子），也别一直留在框架里（会被抽象绑架）。

## 框架选型

- **LangChain** <span class="prio prio-imp">重要</span> — 生态最全、抽象最重。适合快速验证，生产常被诟病"黑盒难调"。
- **LlamaIndex** <span class="prio prio-must">必须</span> — 数据接入与检索做得最细，RAG 场景优先考虑。
- **LangGraph** <span class="prio prio-must">必须</span> — 图/状态机式编排，可控性强，Agent 生产首选。
- **DSPy** <span class="prio prio-opt">选学</span> — 用"编译"思路优化 prompt，理念先进但学习曲线陡。
- **Haystack / Semantic Kernel** <span class="prio prio-opt">选学</span> — 企业级方案，微软 / Deepset 生态。
- **裸调 SDK 的理由** <span class="prio prio-must">必须</span> — 可控、可调试、无版本地狱。复杂系统最终多半走这条。

## 后端

- **Python 生态** <span class="prio prio-must">必须</span> — AI 库的事实标准。FastAPI 是主流 Web 框架。
- **Node / TypeScript** <span class="prio prio-must">必须</span> — 前端转岗最省力的路径，Vercel AI SDK 生态成熟。
- **Go** <span class="prio prio-opt">选学</span> — 高并发网关与代理层，性能好但 AI 库少。
- **异步与并发模型** <span class="prio prio-must">必须</span> — LLM 调用是 IO 密集，必须异步。同步阻塞会直接打死服务。
- **超时与熔断** <span class="prio prio-must">必须</span> — 上游模型慢会拖垮整个服务，必须有超时和熔断。

## 流式

- **SSE** <span class="prio prio-must">必须</span> — 主流流式方案，简单、单向、自动重连。
- **WebSocket** <span class="prio prio-imp">重要</span> — 双向场景（语音、协同）才需要。
- **流式协议设计** <span class="prio prio-must">必须</span> — 自定义事件类型：text-delta / tool-call / reasoning / done / error。设计好才能扩展。
- **断线重连与续传** <span class="prio prio-imp">重要</span> — 长回答断网要能恢复，否则体验极差。
- **首字延迟优化** <span class="prio prio-must">必须</span> — 先返回"正在思考"占位，比空白等待体验好得多。

## 状态与存储

- **会话状态管理** <span class="prio prio-must">必须</span> — 会话 ID、消息列表、上下文裁剪策略。
- **多轮上下文裁剪** <span class="prio prio-must">必须</span> — 超长对话必须摘要或滑窗，否则成本爆炸。
- **会话持久化** <span class="prio prio-must">必须</span> — 消息表设计、附件关联、软删除。
- **长任务队列** <span class="prio prio-must">必须</span> — 超过 30 秒的任务必须异步化 + 轮询/推送。
- **任务取消与幂等** <span class="prio prio-must">必须</span> — 用户关页面要能取消，重试不能重复扣费。
- **缓存分层** <span class="prio prio-imp">重要</span> — 精确缓存 / 语义缓存 / 检索结果缓存。
- **数据模型设计** <span class="prio prio-imp">重要</span> — 会话、消息、附件、检索记录、反馈，五张表基本够用。

## 部署

- **容器化与 K8s** <span class="prio prio-imp">重要</span> — 标准做法，注意 GPU 调度与模型预热。
- **Serverless 的冷启动** <span class="prio prio-imp">重要</span> — 模型加载慢，冷启动可能几十秒。要预热或保底实例。
- **多环境管理** <span class="prio prio-must">必须</span> — dev / staging / prod 的模型与 prompt 配置隔离。
- **特性开关** <span class="prio prio-must">必须</span> — 新 prompt、新模型按用户灰度，出问题秒切回。
- **压测与容量规划** <span class="prio prio-imp">重要</span> — 按并发数倒推显存与实例数。
- **成本护栏** <span class="prio prio-must">必须</span> — 按用户/租户设日额度，超了降级。否则一个 bug 就能烧掉一个月预算。

## 一个最小可用的架构参考

```text
浏览器（流式渲染 / 会话状态）
   │  SSE
   ▼
API 网关（鉴权 / 限流 / 配额 / 计费）
   │
   ▼
应用服务（会话管理 / 上下文组装 / 编排）
   ├── 模型网关（多模型路由 / 降级 / 缓存）
   ├── 检索服务（向量库 / 重排 / 权限过滤）
   ├── 工具服务（MCP Server / 沙箱执行）
   └── 异步队列（长任务 / 索引重建 / 批处理）
   │
   ▼
可观测（Trace / 成本 / 反馈 / 评测回流）
```

这个图的价值不在于"标准答案"，而在于它标出了四个容易被漏掉的横切面：鉴权限流、模型降级、权限过滤、可观测。少任何一个，上线都会出问题。
