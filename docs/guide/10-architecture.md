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
- **Nginx 会缓冲 SSE** <span class="prio prio-must">必须</span> — 默认 `proxy_buffering on` 会把流攒起来，用户看到的是"卡很久然后一次性蹦出来"。**必须关掉**：

  ```nginx
  location /api/chat {
    proxy_pass http://app;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    gzip off;                 # gzip 也会缓冲
    chunked_transfer_encoding on;
    proxy_read_timeout 600s;  # 长回答别被默认 60s 切断
    add_header X-Accel-Buffering no;
  }
  ```

  **`X-Accel-Buffering: no` 由应用返回更可靠**——这样换 CDN 或换反代都不用重新配。
- **半截 JSON 问题** <span class="prio prio-must">必须</span> — 流式传结构化数据时，前端可能收到不完整的 JSON。解法：**每行一个完整 JSON（JSONL / SSE data）**，不要拼一个大数组。
- **取消传播** <span class="prio prio-must">必须</span> — 用户关页面 → 前端 abort → 服务端感知断开 → 取消上游模型请求。**不做这条，用户点了十次"重新生成"你就付了十次钱**。

## 模型接入层

这是"能换模型"和"被厂商绑架"的分界线。**面试问"你们怎么做到随时换模型"，答不上来说明架构耦合了。**

- **Provider Adapter（供应商适配层）** <span class="prio prio-must">必须</span> — 所有模型调用走统一接口，业务代码不出现厂商 SDK。换模型 = 改配置。
- **统一消息格式** <span class="prio prio-must">必须</span> — 内部用一套 message 结构，适配层负责翻译成各家格式。**难点在工具调用和多模态的字段差异**。
- **Model Registry（模型注册表）** <span class="prio prio-must">必须</span> — 一个表记录：模型 ID、厂商、版本、上下文长度、价格、能力标签、是否可用。**这是路由和计费的依据**。
- **Capability Matrix（能力矩阵）** <span class="prio prio-imp">重要</span> — 每个模型支持什么：工具调用 / 结构化输出 / 视觉 / 流式 / 前缀缓存 / 推理预算。**没有这张表，路由逻辑只能靠 if-else 硬编码**。
- **三类 API 形态** <span class="prio prio-must">必须</span> — **Chat Completions**（OpenAI 系，事实标准，兼容最广）/ **Messages**（Anthropic，工具与多模态语义更清晰）/ **Responses**（OpenAI 新版，原生支持有状态多轮和内置工具）。**新项目优先 Responses 或 Messages，Chat Completions 作为兼容兜底**。
- **Batch API** <span class="prio prio-must">必须</span> — 离线批处理（打标、评测、文档向量化）用批接口，**通常五折价格、24 小时内返回**。省钱最直接的手段，很多人不知道。
- **模型降级的层次** <span class="prio prio-must">必须</span> — 同厂商换小模型 → 换厂商同档 → 换厂商降档 → 返回缓存 → 明确报错。**每一层都要有触发条件和用户可见提示**。
- **成本归因** <span class="prio prio-must">必须</span> — 每次调用记录：租户、用户、功能、模型、输入/输出 token、金额。**没有归因就没法做配额、没法做定价、没法定位烧钱的模块**。

## 可用性工程

- **SLI / SLO** <span class="prio prio-must">必须</span> — SLI 是测量值（成功率、P95 延迟），SLO 是目标（"99% 请求 3 秒内首字"）。**没有 SLO 就没有"是否该发版"的判断依据**。
- **错误预算** <span class="prio prio-imp">重要</span> — 一个月允许的失败额度。额度用完就停止发新功能，专心修稳定性。这是和业务方谈判的工具。
- **Bulkhead（舱壁隔离）** <span class="prio prio-must">必须</span> — 不同租户/功能用独立线程池或连接池。**一个租户打爆不能拖垮所有人**。多租户 SaaS 必备。
- **熔断（Circuit Breaker）** <span class="prio prio-must">必须</span> — 上游连续失败就快速失败，别再等超时。**半开状态**试探恢复。
- **限流的多维度** <span class="prio prio-must">必须</span> — 按 IP、按用户、按租户、按模型分别限。**只按 IP 限流挡不住登录用户刷**。
- **队列与背压** <span class="prio prio-imp">重要</span> — 请求堆积时要么排队要么拒绝，**不能让内存无限涨**。
- **Incident Response（故障响应）** <span class="prio prio-must">必须</span> — 分级（P0/P1/P2）、值班、通报模板、复盘（blameless）。**面试问"线上出过什么事故"，答得清楚流程比答得清楚技术更加分**。
- **Backup / DR（备份与容灾）** <span class="prio prio-must">必须</span> — RPO（能丢多少数据）/ RTO（多久恢复）。**向量索引能重建，原始文档和对话记录不能丢**——这个优先级要分清。
- **降级预案** <span class="prio prio-must">必须</span> — 模型全挂时产品还能干什么？只读历史、只做关键词检索、明确提示"服务繁忙"。**没有降级预案等于没有兜底**。

## 私有化交付

ToB 大客户经常要求"部署到我们内网"。这一块**做没做过差别很大**，面试时说出来是明显加分项。

- **离线安装包** <span class="prio prio-must">必须</span> — 客户内网无外网。要打包：镜像（`docker save`）、模型权重、依赖 wheel、初始化脚本。**体积经常几十 GB，要分卷**。
- **模型权重的分发** <span class="prio prio-must">必须</span> — 权重文件大，要校验完整性（sha256），要支持断点续传。
- **许可证（License）** <span class="prio prio-must">必须</span> — 绑定机器码 / 到期时间 / 并发数。**要有离线激活流程**（客户内网没法回调你的服务器）。
- **依赖锁定** <span class="prio prio-imp">重要</span> — 客户环境不能 `npm install`。所有依赖打进镜像，版本完全锁定。
- **配置外置** <span class="prio prio-must">必须</span> — 端口、路径、模型地址、密钥全部走配置文件或环境变量，**不能硬编码**。
- **升级与回滚** <span class="prio prio-must">必须</span> — 客户现场升级失败是灾难。要有版本检查、数据迁移脚本、一键回滚。
- **可观测的私有化** <span class="prio prio-imp">重要</span> — 客户不让数据出网，你的 SaaS 监控用不了。要内置本地 Prometheus + Grafana，或提供"导出诊断包"功能。
- **交付文档** <span class="prio prio-imp">重要</span> — 部署手册、验收清单、常见故障排查。**文档质量直接决定交付周期**。

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
