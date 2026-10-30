# 18 · Node.js 后端工程

> **投入权重：10%** · 补的一章。原来只有 5 条，严重不足。
>
> 原因：API Key、权限校验、工具执行、数据访问必须在可信后端。**只会写前端的人做 AI 应用，天花板会很低**——因为你没法处理流式、限流、队列、幂等这些真正难的部分。

## 先说框架选型（这里我和常见建议不同）

网上普遍推荐 NestJS 主修。**对个人项目，我建议反过来**：先用 Fastify 或 Hono 把服务写出来，理解 HTTP、中间件、流式、错误处理，再决定要不要上 NestJS。

理由：

- NestJS 的 DI、Module、Guard、Interceptor 是一套完整的架构约定，**学习成本约等于再学一门框架**，而它解决的问题（大型团队协作、模块边界）在个人项目里并不存在。
- 它的抽象层很厚，出问题时你要穿透三层才知道请求怎么走的。AI 应用恰恰是"必须看到原始输入输出"的领域。
- 面试时问的是"你怎么处理流式、怎么做幂等、怎么限流"，不是"你会不会写 Module"。

**建议路径**：Fastify（或 Hono）写两个服务 → 理解透了 → 如果进的公司用 NestJS，两周能上手，因为概念是通的。

如果你就是要投 NestJS 岗，那就直接学，别绕。

## Node 运行时基础

- **Event Loop 与阶段** <span class="prio prio-must">必须</span> — timers / pending / poll / check / close 五个阶段，微任务在每个阶段之间清空。**理解这个才知道为什么 `await` 会插队。**
- **非阻塞 I/O 与 libuv 线程池** <span class="prio prio-must">必须</span> — 文件、DNS、加密走线程池（默认 4 个线程），CPU 密集任务会堵住它。
- **CPU 密集 vs I/O 密集** <span class="prio prio-must">必须</span> — LLM 调用是 I/O 密集（适合 Node），文档解析、向量计算是 CPU 密集（要 Worker 或换 Python）。
- **Stream 与背压** <span class="prio prio-must">必须</span> — 流式响应必须处理背压，否则客户端慢的时候内存会涨。
- **Buffer 与编码** <span class="prio prio-imp">重要</span> — 处理上传文件、二进制响应时用。
- **AbortController 与取消传播** <span class="prio prio-must">必须</span> — 用户点停止，要能从 HTTP 层一路取消到模型 API。**这是 AI 应用的必答题。**
- **Worker Threads** <span class="prio prio-imp">重要</span> — 真需要 CPU 计算时用，别阻塞主线程。
- **Graceful Shutdown** <span class="prio prio-must">必须</span> — 收到 SIGTERM 后停止接新请求、等在途请求完成、关闭连接池。不做这个，每次发布都会掉请求。
- **进程管理与退出码** <span class="prio prio-imp">重要</span> — 未捕获异常要记录后退出，不要带病运行。

## 框架与结构

- **Fastify** <span class="prio prio-must">必须</span> — 性能好、schema 驱动、插件机制清晰。个人项目首选。
- **Hono** <span class="prio prio-imp">重要</span> — 极轻、跨运行时（Node / Bun / Edge），适合 BFF 和小服务。
- **NestJS** <span class="prio prio-imp">重要</span> — 企业级约定完整，投大厂/外包团队时值钱。
- **Express** <span class="prio prio-opt">选学</span> — 生态最老，新项目不必选。
- **分层：路由 / 服务 / 仓储** <span class="prio prio-must">必须</span> — 不要把业务逻辑写在路由里。AI 调用要单独一层（provider），方便换模型和 mock。
- **依赖注入的作用与代价** <span class="prio prio-imp">重要</span> — 好处是可测试，代价是间接。小项目手动传参更清楚。
- **配置管理** <span class="prio prio-must">必须</span> — 环境变量 + 启动时校验（用 zod）。缺 key 要在启动时炸，不要等到第一次调用。

## API 设计

- **REST 语义与状态码** <span class="prio prio-must">必须</span> — 200/201/204/400/401/403/404/409/422/429/500 的边界要清楚。**401 和 403 别混**。
- **统一错误结构** <span class="prio prio-must">必须</span> — `{ code, message, detail, requestId }`。前端能按 code 分支，不用解析文案。
- **参数校验在边界** <span class="prio prio-must">必须</span> — 进服务前用 zod 校验，内部函数信任类型。
- **幂等性设计** <span class="prio prio-must">必须</span> — 写操作带 Idempotency-Key，服务端去重。**AI 场景尤其重要**，因为重试很常见。
- **分页、过滤、排序** <span class="prio prio-imp">重要</span> — 用游标分页（cursor）而不是 offset，会话消息多了 offset 会漂。
- **API 版本管理** <span class="prio prio-imp">重要</span> — URL 版本或 header 版本，选一个。
- **OpenAPI 文档** <span class="prio prio-imp">重要</span> — 从 schema 生成，不要手写。
- **请求 ID 与链路追踪** <span class="prio prio-must">必须</span> — 每个请求生成 ID，透传到日志和模型调用。排查问题时靠它串起来。

## 流式响应（AI 场景核心）

- **SSE 协议细节** <span class="prio prio-must">必须</span> — `data: xxx\n\n` 格式、`event:` 类型、`id:` 用于重连、`retry:` 控制重连间隔。
- **响应头设置** <span class="prio prio-must">必须</span> — `Content-Type: text/event-stream`、`Cache-Control: no-cache`、`Connection: keep-alive`、`X-Accel-Buffering: no`（**Nginx 不加这个会缓冲，流式变批量**）。
- **心跳** <span class="prio prio-must">必须</span> — 每 15~30 秒发一个注释行 `: ping`，防止中间代理断连。
- **背压与写入控制** <span class="prio prio-must">必须</span> — `res.write()` 返回 false 时要等 drain。
- **取消传播** <span class="prio prio-must">必须</span> — 客户端断开（`req.on('close')`）要中止上游模型调用，否则白烧钱。
- **半截 JSON 处理** <span class="prio prio-must">必须</span> — 流式结构化输出时，用增量解析器，不能等收完。
- **断线重连与续传** <span class="prio prio-imp">重要</span> — 用 `Last-Event-ID` 让客户端从断点继续。
- **WebSocket 什么时候用** <span class="prio prio-imp">重要</span> — 双向（语音、协同编辑）才需要。单向推送 SSE 更简单。

## 认证与授权

- **Session vs JWT 的取舍** <span class="prio prio-must">必须</span> — Session 可撤销、JWT 无状态但难撤销。**AI 应用建议 Session 或短 JWT + Refresh Token**，因为要能立刻踢人。
- **JWT 的坑** <span class="prio prio-must">必须</span> — 不要放敏感信息（payload 是 base64 不是加密）；必须校验 alg（防 alg:none 攻击）；必须校验 exp。
- **Refresh Token 轮换** <span class="prio prio-imp">重要</span> — 一次性使用 + 检测重放。
- **RBAC** <span class="prio prio-must">必须</span> — 角色 → 权限 → 资源。**权限判断必须在服务端，不能靠前端隐藏按钮。**
- **资源级权限** <span class="prio prio-must">必须</span> — "能访问这个 API" ≠ "能访问这条数据"。AI 场景里这是数据泄露的主要路径。
- **多租户鉴权** <span class="prio prio-must">必须</span> — tenantId 从 token 里取，**绝不能从请求参数取**（否则用户能改）。
- **大模型不是权限系统** <span class="prio prio-must">必须</span> — 在 system prompt 里写"禁止查询其他用户"没有任何约束力。权限必须由确定性代码控制。

## 异步任务

- **什么时候必须异步** <span class="prio prio-must">必须</span> — 超过 30 秒的任务（文档解析、批量索引、长 Agent 任务）。HTTP 请求撑不住。
- **BullMQ 基本用法** <span class="prio prio-must">必须</span> — 队列、worker、并发度、重试、延时任务。
- **任务状态机** <span class="prio prio-must">必须</span> — pending / running / succeeded / failed / cancelled。状态要持久化。
- **失败重试与死信队列** <span class="prio prio-must">必须</span> — 重试要有上限和退避，超过上限进死信，不要无限重试。
- **任务取消** <span class="prio prio-imp">重要</span> — 用户取消要能真正中止，不能只是标记。
- **幂等与去重** <span class="prio prio-must">必须</span> — 同一个文档重复提交不能重复索引。
- **并发上限** <span class="prio prio-imp">重要</span> — embedding API 有 QPS 限制，worker 并发要匹配。

## 日志与可观测

- **结构化日志** <span class="prio prio-must">必须</span> — JSON 格式，字段固定（level、time、requestId、userId、event、duration）。
- **日志分级** <span class="prio prio-imp">重要</span> — error 要带堆栈和上下文，info 记录关键业务节点，debug 只在开发开。
- **脱敏** <span class="prio prio-must">必须</span> — prompt 和响应入库前脱敏 PII。这是合规硬要求。
- **慢查询与慢调用** <span class="prio prio-imp">重要</span> — 超过阈值的 DB 查询和模型调用要单独记录。

## 验收标准

能独立写出这样一个服务，就算过关：

> 用户登录 → 创建会话 → 发消息 → SSE 流式返回 → 支持中断 → 消息持久化 → 限流 → 用量统计 → 优雅关闭

**具体检查点**：客户端断开时上游调用被取消（看日志确认）、Nginx 后面流式不缓冲、发布时无请求丢失、重试不产生重复消息。
