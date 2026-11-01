import type { Lesson } from './types'

/**
 * 第十二课：部署与工程架构
 *
 * 核心立场：本地能跑和线上能跑之间，隔着流式缓冲、无状态、限流、降级、迁移五道坎。
 * 这一课讲的都是"只有部署后才会暴露"的问题。
 */
export const lesson12: Lesson = {
  id: 'L12',
  moduleId: 'deploy',
  order: 12,
  path: '/learn/12-deployment',
  title: '部署与工程架构：让服务在别人的机器上稳定跑三个月',
  subtitle: '流式输出在本地好好的，上线后变成"等 8 秒一次性蹦出来"——这是 nginx 的锅。',
  minutes: 75,
  level: '实战',
  outcome: '能独立把 LLM 应用部署上线，并处理流式、并发、限流、降级、迁移这五类只有线上才会出现的问题。',
  goals: [
    '画出自己系统的部署拓扑，说清哪些组件有状态、哪些不能随便扩',
    '解决流式响应在各层被缓冲的问题，让首字真的快',
    '把服务做成无状态，能水平扩展且不丢会话',
    '把长任务改成异步队列，并设计任务状态机与幂等',
    '用令牌桶做限流，区分"排队"和"拒绝"两种策略',
    '设计降级与回滚预案，让故障不至于变成事故',
  ],
  prereqs: [
    '学过第十课，有 trace 和成本数据',
    '能自己部署一个 Node 服务（会用 nginx / Docker 之一）',
    '跑通过一次真实的线上或准线上环境',
  ],

  steps: [
    {
      id: 's1',
      title: '先画清拓扑：哪些能动，哪些不能动',
      checkpoint: '为什么把 Node 服务从 2 个实例扩到 10 个，流式输出就出问题了？',
      blocks: [
        {
          type: 'p',
          text: 'LLM 应用的部署拓扑比普通 Web 应用复杂一点，因为多了一类"又慢又贵又有状态"的依赖。',
        },
        {
          type: 'flow',
          title: '典型拓扑与状态标注',
          ascii: `[浏览器]
    │ HTTPS
    ▼
[CDN / 静态资源]          ← 无状态，随便扩
    │
    ▼
[负载均衡 / nginx]        ← 无状态
    │
    ▼
[Node API 实例 ×N]        ← 必须无状态！
    ├──► [模型 API]        ← 外部依赖，有限流
    ├──► [Postgres+pgvector] ← 有状态，不能随便扩
    ├──► [Redis]           ← 有状态，缓存/限流/会话
    └──► [任务队列]        ← 有状态
              │
              ▼
        [Worker ×M]        ← 无状态，可独立扩缩`,
        },
        {
          type: 'table',
          head: ['组件', '有状态?', '能水平扩吗', '扩了会怎样'],
          rows: [
            ['Node API', '否（改造后）', '能', '无影响'],
            ['Worker', '否', '能', '要防重复消费'],
            ['Postgres', '是', '只读副本可以', '写冲突、连接数爆炸'],
            ['Redis', '是', '集群模式可以', 'key 分布变了，缓存击穿'],
            ['向量索引', '是（在 PG 里）', '随 PG', '重建索引期间查询变慢'],
            ['会话', '取决于你放哪', '放 Redis 就能扩', '放内存就锁死单实例'],
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '最常见的一号事故：会话存在进程内存里',
          text: '开发时 `const sessions = new Map()` 很爽。扩到 3 个实例后，用户在实例 A 建立会话，下一个请求被负载均衡打到实例 B，会话丢失，表现为"随机掉登录"。**更隐蔽的是流式场景**：流式响应的连接是长连接，如果中途重试打到另一个实例，那边的上下文根本不存在。',
        },
        {
          type: 'p',
          text: '还有一个 LLM 特有的点：**模型 API 是"又慢又会失败"的外部依赖**，它不是你的数据库。所以它必须被当作"可能随时不可用"的第三方来设计——超时、重试、降级、熔断，一样不能少。',
        },
      ],
    },

    {
      id: 's2',
      title: '流式输出：五层缓冲，每一层都能让你的首字延迟变成 8 秒',
      checkpoint: '本地 `curl` 能看到逐字输出，浏览器里却是"停顿 8 秒后一次全出来"。问题在哪？',
      blocks: [
        {
          type: 'p',
          text: '这是上线后最高频的问题，而且排查起来很折磨，因为**每一层都可能缓冲**。',
        },
        {
          type: 'table',
          head: ['层', '默认行为', '怎么关'],
          rows: [
            ['模型 SDK', '有的默认非流式', '显式 `stream: true`'],
            ['你的 Node 服务', '`res.write()` 后未 flush', '设 `Content-Type: text/event-stream`、`Cache-Control: no-cache`、`X-Accel-Buffering: no`，每次 write 后不强求 flush 但要禁用压缩'],
            ['nginx', '**默认 `proxy_buffering on`**', '`proxy_buffering off;` 或响应头 `X-Accel-Buffering: no`'],
            ['CDN / 云 LB', '常默认缓冲整个响应', '关闭缓冲，或对 SSE 路径绕开 CDN'],
            ['浏览器', 'fetch 的 body 要逐块读', '用 `res.body.getReader()`，不要 `await res.text()`'],
          ],
        },
        {
          type: 'code',
          lang: 'nginx',
          title: 'nginx 的 SSE 配置（少一行都不行）',
          code: `location /api/stream {
    proxy_pass http://api_upstream;

    # 关键：关闭缓冲，否则 nginx 会攒够 buffer 才发
    proxy_buffering off;
    proxy_cache off;

    # 关键：HTTP/1.1 + 不设 Connection: close，才能 chunked
    proxy_http_version 1.1;
    proxy_set_header Connection "";

    # 长连接：读超时要大于你的最长生成时间
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # 关掉压缩（压缩会引入缓冲）
    gzip off;

    # 兜底：即使后端没设，也让 nginx 不缓冲
    add_header X-Accel-Buffering no;
}`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: '服务端的正确写法',
          code: `app.get('/api/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',   // no-transform 阻止中间层改写
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',                   // 给 nginx 的信号
  })
  res.flushHeaders?.()

  // 心跳：防止中间层因为"长时间没数据"断开
  const heartbeat = setInterval(() => res.write(': ping\\n\\n'), 15_000)

  try {
    for await (const chunk of llmStream(messages)) {
      res.write(\`data: \${JSON.stringify({ delta: chunk })}\\n\\n\`)
    }
    res.write('data: [DONE]\\n\\n')
  } catch (e) {
    res.write(\`data: \${JSON.stringify({ error: '生成中断' })}\\n\\n\`)
  } finally {
    clearInterval(heartbeat)
    res.end()
  }
})`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'SSE 的三个必踩坑',
          text: '① **心跳**：中间层（LB、CDN）常有 30~60 秒空闲超时，没有心跳就会被断开，用户看到"回答到一半停了"；② **重连**：`EventSource` 会自动重连，但 POST + 自定义头用不了 `EventSource`，要用 fetch + 手写重连；③ **断开检测**：用户关页面后，你的循环还在跑、还在烧钱——监听 `req.on(\'close\')` 并 `abort` 掉上游请求。**第三条每年都在浪费大量预算。**',
        },
        {
          type: 'p',
          text: '如果前端需要 POST（带长 prompt），`EventSource` 用不了，标准做法是 `fetch` + `ReadableStream` 手工解析 SSE 帧：按 `\\n\\n` 切分、忽略 `:` 开头的心跳行、处理 `data:` 前缀。这部分代码不长，但要处理"一个 chunk 里包含半个事件"的情况——**必须缓冲不完整的数据**。',
        },
      ],
    },

    {
      id: 's3',
      title: '无状态：会话、文件、流，都不能留在进程里',
      checkpoint: '多实例部署后，用户上传的文件"有时能下载有时 404"，为什么？',
      blocks: [
        {
          type: 'p',
          text: '无状态的含义很具体：**任何一个请求打到任何一个实例，结果都一样。** 违反它的东西通常有三类：',
        },
        {
          type: 'table',
          head: ['状态', '错误做法', '正确做法'],
          rows: [
            ['会话', '进程内 Map', 'Redis（带 TTL）+ 签名 cookie 存 sessionId'],
            ['上传文件', '存本地 `./uploads`', '对象存储（S3/OSS），返回带签名的临时 URL'],
            ['生成中的流', '在实例内存里持有 buffer', '客户端直连 + 断线用 messageId 重放已生成部分'],
            ['定时任务', '每个实例都跑一遍', '单独的 worker + 分布式锁，或外部调度器'],
            ['限流计数', '进程内变量', 'Redis（INCR + EXPIRE，或用 Lua 保证原子）'],
            ['缓存', '进程内 LRU', 'Redis；进程内只做短 TTL 的二级缓存'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '分布式锁：让定时任务只跑一次',
          note: 'SET NX EX 是原子的，比"先 GET 再 SET"安全。token 用来保证"只有锁的持有者能释放"，防止超时后误删别人的锁。',
          code: `async function withLock(key: string, ttlSec: number, fn: () => Promise<void>) {
  const token = crypto.randomUUID()
  const ok = await redis.set(key, token, 'NX', 'EX', ttlSec)
  if (!ok) return                        // 别人在跑，直接跳过

  try {
    await fn()
  } finally {
    // 只删自己的锁
    await redis.eval(
      \`if redis.call("get", KEYS[1]) == ARGV[1] then
         return redis.call("del", KEYS[1])
       else return 0 end\`,
      1, key, token,
    )
  }
}

// 用法：每小时索引一次，10 个实例只有一个真的跑
await withLock('job:index', 300, async () => {
  await reindexAll()
})`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '流式 + 多实例的正确做法',
          text: '不要试图"把流迁移到另一个实例"。正确做法是：**生成结果边产生边落库**（`message_chunks` 表，带序号），客户端断线重连时用 `messageId + lastSeq` 拉取已生成的部分，然后继续。这样实例可以随便死、随便扩，用户感知只是"卡了一下"。',
        },
        {
          type: 'p',
          text: '另外提醒一个容易忽略的：**数据库连接数**。每个实例一个连接池，10 个实例 × 20 连接 = 200 连接，很容易打满 Postgres 的 `max_connections`。要么用 PgBouncer 做连接池，要么把单实例池调小。**扩实例之前先算这个数。**',
        },
      ],
    },

    {
      id: 's4',
      title: '长任务：超过 10 秒的事，不要占着 HTTP 连接',
      checkpoint: '一个"批量总结 200 份文档"的功能，HTTP 请求该等多久？',
      blocks: [
        {
          type: 'p',
          text: '不要等。**任何可能超过 10~30 秒的任务都应该异步化**：HTTP 只负责"接受任务"和"查询进度"，真正干活的是 worker。',
        },
        {
          type: 'flow',
          title: '异步任务的标准形态',
          ascii: `POST /api/jobs           → 202 { jobId }
   │
   ▼
[任务表] status=pending  ← 落库，这是唯一的事实来源
   │
   ▼
[队列] ──► [Worker] ──► status=running, progress=0..100
                │
                ├─ 成功 → status=succeeded, result
                ├─ 失败 → status=failed, error, retryCount++
                └─ 超时 → status=timeout（不是 failed，要区分）

GET /api/jobs/:id        → { status, progress, result?, error? }
GET /api/jobs/:id/events → SSE，推送进度`,
        },
        {
          type: 'table',
          head: ['设计点', '要点', '不做的后果'],
          rows: [
            ['任务落库', '先写库再入队，库是事实来源', '队列丢了任务就永远消失'],
            ['幂等', 'jobId 作为幂等键，重复执行结果一致', '重投导致重复扣费/重复发送'],
            ['状态机', 'pending → running → succeeded/failed/timeout/canceled', '状态混乱，无法判断该不该重试'],
            ['进度', '按"已完成子任务数/总数"算，不猜', '进度条乱跳，用户不信任'],
            ['超时', '任务级超时 + 子步骤超时', '一个卡死的任务占满 worker'],
            ['取消', '用户能取消，worker 要真的停', '取消按钮是假的，还在烧钱'],
            ['重试', '只重试可重试的失败，指数退避，上限 3 次', '无限重试打爆下游'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '任务状态机（用类型强制合法转移）',
          code: `type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'timeout' | 'canceled'

const ALLOWED: Record<JobStatus, JobStatus[]> = {
  pending: ['running', 'canceled'],
  running: ['succeeded', 'failed', 'timeout', 'canceled'],
  succeeded: [],
  failed: ['pending'],        // 允许人工重试
  timeout: ['pending'],
  canceled: [],
}

async function transition(jobId: string, to: JobStatus, patch: object = {}) {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('job not found')
  if (!ALLOWED[job.status].includes(to)) {
    throw new Error(\`非法状态转移：\${job.status} → \${to}\`)
  }
  // 带条件的更新，防止并发下两个 worker 同时推进
  const n = await db.job.updateMany({
    where: { id: jobId, status: job.status },
    data: { status: to, ...patch, updatedAt: new Date() },
  })
  if (n.count === 0) throw new Error('状态已被其他 worker 修改')
}`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '区分 failed 和 timeout',
          text: '两者处置不同：**failed** 可能是逻辑错误，重试也没用；**timeout** 通常是资源问题，重试常常能成功。混在一起你就没法做"只重试超时"这种精细策略，只能一刀切。',
        },
        {
          type: 'p',
          text: '队列选型不用纠结：**Redis 的 BullMQ / 云厂商的托管队列**都能满足 90% 的场景。关键是"任务表 + 队列"这个双写结构——**表是事实来源，队列只是通知机制**。这样即使队列丢消息，也能靠扫描 `pending` 超时的任务补回来。',
        },
      ],
    },

    {
      id: 's5',
      title: '限流：你要保护的是谁',
      checkpoint: '模型 API 给你 100 RPM 的配额，你的服务该怎么限流？',
      blocks: [
        {
          type: 'p',
          text: '限流不是为了"防止用户用太多"，而是为了保护三样东西：**你的钱包、你的下游（模型 API）、你的服务稳定性**。三者的限流维度不同。',
        },
        {
          type: 'table',
          head: ['要保护', '限流维度', '策略'],
          rows: [
            ['钱包', '按用户/租户的日/月 token 预算', '超额拒绝，并提示"今日额度已用完"'],
            ['下游 API', '全局并发数 + RPM', '令牌桶 + 并发信号量，超了排队'],
            ['服务稳定性', '按 IP / 会话的 QPS', '超了直接 429'],
            ['公平性', '按租户加权', '大客户高配额，小客户低配额'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '令牌桶（Redis 原子实现）',
          note: '令牌桶允许"短时突发"，比固定窗口更符合真实流量。用 Lua 保证读-算-写原子，否则并发下会超发。',
          code: `const LUA = \`
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])       -- 每秒补充多少
local now = tonumber(ARGV[3])        -- 毫秒
local want = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = math.max(0, now - ts) / 1000
tokens = math.min(capacity, tokens + elapsed * rate)

local allowed = 0
if tokens >= want then
  tokens = tokens - want
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', key, 3600)
return { allowed, math.floor(tokens) }
\`

export async function takeToken(key: string, want: number, cap: number, rate: number) {
  const [allowed, left] = (await redis.eval(LUA, 1, key, cap, rate, Date.now(), want)) as number[]
  return { allowed: allowed === 1, remaining: left }
}`,
        },
        {
          type: 'p',
          text: '限流的**响应方式**比算法更重要。三种处置：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**排队（等待）**：适合"用户愿意等"的场景。实现上要设最大等待时间，超过就转拒绝。注意：排队会占用连接，必须限制队列长度。',
            '**拒绝（429）**：必须带 `Retry-After` 头，告诉客户端多久后可以重试。不带的话客户端会立刻重试，火上浇油。',
            '**降级**：切小模型、缩短输出、跳过 rerank。用户得到"稍差但可用"的结果，比 429 体验好得多。',
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '并发数比 QPS 更关键',
          text: 'LLM 请求的特点是"单个请求占着连接几十秒"。所以**真正稀缺的资源是并发数，不是 QPS**。10 个并发 × 平均 20 秒 = 0.5 QPS 的吞吐。设计容量时先算"我能同时挂多少个请求"，再反推 QPS。**只限 QPS 不限并发，会在流量突增时把连接池打满。**',
        },
      ],
    },

    {
      id: 's6',
      title: '降级与容灾：让故障变成"体验变差"而不是"服务不可用"',
      checkpoint: '模型 API 大面积 503，你的产品还能提供什么价值？',
      blocks: [
        {
          type: 'p',
          text: '降级设计的第一步是问：**去掉 AI 之后，这个产品还剩什么？** 如果答案是"什么都没有"，那你的可用性上限就是模型供应商的可用性。',
        },
        {
          type: 'table',
          head: ['故障', '降级方案', '用户感知'],
          rows: [
            ['主模型 429/503', '切备用模型（降一档）', '回答质量略降'],
            ['所有模型都不可用', '返回缓存的相似问答 / 检索结果原文', '"暂时给你看相关文档"'],
            ['rerank 服务超时', '跳过重排，直接用 RRF 结果', '排序略差'],
            ['embedding 服务挂', '降级为纯关键词检索', '召回变差但能用'],
            ['向量库慢', '只查关键词 + 限 top-k', '延迟可控'],
            ['预算超限', '只服务付费用户 / 缩短回答', '免费用户看到提示'],
            ['数据库主库挂', '只读副本 + 禁止写操作', '能看不能改'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '模型路由 + 熔断',
          code: `type ModelCfg = { name: string; tier: 1 | 2 | 3; timeoutMs: number }

const CHAIN: ModelCfg[] = [
  { name: 'gpt-4o', tier: 1, timeoutMs: 30_000 },
  { name: 'gpt-4o-mini', tier: 2, timeoutMs: 20_000 },
  { name: 'qwen-plus', tier: 3, timeoutMs: 20_000 },
]

async function generate(messages: Msg[]) {
  for (const m of CHAIN) {
    if (await breaker.isOpen(m.name)) continue        // 熔断中，跳过
    try {
      const r = await withTimeout(callModel(m, messages), m.timeoutMs)
      await breaker.recordSuccess(m.name)
      return { ...r, tier: m.tier }
    } catch (e) {
      await breaker.recordFailure(m.name)
      logger.warn({ model: m.name, err: e }, 'model failed, falling back')
    }
  }
  // 全部失败 → 降级到"只给检索结果"
  return { fallback: await retrieveOnly(messages), tier: 0 }
}`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '降级必须可见',
          text: '降级不能悄悄发生。**要在响应里带 `degraded: true` 和原因，在日志里打点，在监控面板上显示降级率。** 否则你会看到"质量莫名下降"，查两周才发现系统已经降级运行了半个月。同时要给用户一个诚实的提示："当前使用了备用模型，回答可能不够精确。"',
        },
        {
          type: 'p',
          text: '熔断器的三个参数：**失败阈值**（连续 N 次失败或失败率超 X%）、**打开时长**（先关 30 秒）、**半开探测**（放一个请求试探，成功就恢复）。不要一失败就永久熔断，也不要一失败就疯狂重试——两者都会放大故障。',
        },
      ],
    },

    {
      id: 's7',
      title: '发布与回滚：想清楚"怎么退回去"再上线',
      checkpoint: '新版本要改数据库字段名。你怎么保证回滚时旧代码还能跑？',
      blocks: [
        {
          type: 'p',
          text: 'LLM 应用发布有三个和普通应用不同的地方：**prompt 也是代码**、**索引数据也会变**、**模型版本可能被供应商悄悄升级**。',
        },
        {
          type: 'table',
          head: ['变更', '风险', '发布方式'],
          rows: [
            ['代码', '常规', '镜像 + 滚动更新'],
            ['prompt', '效果可能退化', '**必须灰度**：5% → 25% → 100%，每步看指标'],
            ['数据库 schema', '回滚时旧代码不兼容', '**两阶段迁移**（见下）'],
            ['索引/向量', '重建期间查询变慢或结果为空', '双写 + 影子索引 + 切换'],
            ['模型版本', '供应商侧变更，你无法控制', '锁定具体版本号，不写 `latest`'],
          ],
        },
        {
          type: 'code',
          lang: 'sql',
          title: '两阶段迁移：先兼容，再清理',
          note: '核心原则：**任何一个版本，都必须能同时读旧格式和新格式。** 这样无论向前还是向后回滚，都不会崩。',
          code: `-- 阶段 1（本次发布）：加新列，双写，读旧列
ALTER TABLE documents ADD COLUMN title_new text;
-- 应用：写入时同时写 title 和 title_new，读取仍用 title

-- 阶段 2（确认稳定后，下一次发布）：切换读，停止写旧列
-- 应用：读取改用 title_new

-- 阶段 3（再下一次发布）：删旧列
ALTER TABLE documents DROP COLUMN title;

-- ❌ 反例：一次发布会直接改名
ALTER TABLE documents RENAME COLUMN title TO title_new;
-- 回滚时旧代码 SELECT title → 报错，服务起不来`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '不可逆的操作要单独排期',
          text: '删列、删表、改类型、清缓存、删索引——这些**没有回滚路径**。做法：单独一次发布，只做清理，且在业务低峰期，且提前备份。**绝不在功能发布里夹带不可逆操作。**',
        },
        {
          type: 'p',
          text: '发布检查清单（每次上线过一遍）：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '评测集跑过了吗？通过率和基线比是升是降？关键用例有没有退化？',
            '数据库迁移是向前兼容的吗？回滚后旧代码能跑吗？',
            '新 prompt 有版本号吗？灰度比例设了吗？观察指标是什么？',
            '降级开关能手动触发吗？试过吗？',
            '回滚命令写下来了吗？谁有权限执行？多久能生效？',
            '有没有不可逆操作？如果有，它是不是单独一次发布？',
          ],
        },
        {
          type: 'qa',
          q: '灰度期间该看哪些指标？',
          a: '四个：**点踩率**（最直接的质量信号）、**转人工率**（最强的负反馈）、**P95 延迟**（变慢说明新版本更啰嗦或检索更重）、**单次成本**（prompt 变长、输出变多都会涨）。四个指标里任何一个显著恶化就回滚，不要"再观察观察"——灰度窗口越长，受影响用户越多。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '流式为什么变成一次性',
      points: 10,
      prompt: '本地 `curl` 能看到逐字输出。部署到 nginx 后，浏览器里停顿 8 秒然后一次性显示全部。最可能的原因？',
      options: [
        { id: 'a', text: '模型 API 变慢了' },
        { id: 'b', text: 'nginx 默认 `proxy_buffering on`，把响应攒够了才转发' },
        { id: 'c', text: '浏览器不支持流式' },
        { id: 'd', text: 'Node 版本太旧' },
      ],
      answer: ['b'],
      hints: [
        '本地没有 nginx，所以差异一定在中间层。',
        'nginx 为了"提高效率"，默认会缓冲上游响应。对普通接口是优化，对 SSE 是灾难。',
        '`proxy_buffering off` 是必须的。另外还要 `proxy_http_version 1.1` + `proxy_set_header Connection ""`，否则可能退化成短连接。响应头加 `X-Accel-Buffering: no` 是双保险。',
      ],
      explanation: '正确答案是 b。SSE 被缓冲是上线后最常见的"本地好好的、线上不对"问题，五层里任何一层缓冲都会造成同样现象。',
      approach: [
        '逐层排查：模型 SDK → 你的服务 → nginx → CDN → 浏览器',
        '用 `curl -N` 直连后端确认后端是流式的',
        '再经过 nginx 测一次，定位到具体层',
        '关掉该层缓冲，并加心跳',
      ],
      knowledge: ['SSE', 'nginx proxy_buffering', '流式传输'],
      pitfalls: [
        '以为是模型慢，去优化模型',
        '只关了 nginx 缓冲，忘了 CDN 层',
        '没设 `Connection ""`，被降级成短连接',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '哪些状态必须外置',
      points: 15,
      prompt: '要把 Node 服务改成无状态、可水平扩展，哪些东西必须从进程内存里搬出去？（多选）',
      options: [
        { id: 'a', text: '用户会话（登录态）' },
        { id: 'b', text: '限流计数器' },
        { id: 'c', text: '上传的文件' },
        { id: 'd', text: '定时任务的执行权' },
        { id: 'e', text: '代码里的常量配置' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        '判断标准：这个东西"换个实例还对不对"。',
        '常量配置是代码的一部分，每个实例都一样，不算状态。',
        'a 放内存会导致随机掉登录；b 放内存会导致限流失效（每个实例各算各的）；c 放本地会导致"有时 404"；d 放内存会导致任务跑 N 遍。e 是代码，天然一致。',
      ],
      explanation: 'a、b、c、d 都是必须外置的状态。e 是代码常量，不构成状态。',
      approach: [
        '逐个问"换一个实例，这个值还对吗"',
        '会话 → Redis + 签名 cookie',
        '限流 → Redis + Lua 原子操作',
        '文件 → 对象存储 + 签名 URL',
        '定时任务 → 分布式锁或独立 worker',
      ],
      knowledge: ['无状态', '水平扩展', '分布式锁', '会话管理'],
      pitfalls: [
        '只搬会话，忘了限流计数（每个实例各限各的，等于没限）',
        '文件存本地，多实例下随机 404',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '算清并发与容量',
      points: 15,
      prompt: '模型 API 给你 100 RPM（每分钟请求数）。你的单次调用平均耗时 20 秒。要跑满这个配额，需要多少并发？如果每实例最多挂 50 个并发连接，至少要几个实例？',
      templateLang: 'text',
      template: `100 RPM = {{rps}} 请求/秒

每个请求占用 20 秒，所以稳态并发 = RPS × 平均耗时
                             = {{rps}} × 20
                             = {{conc}} 个并发

单实例上限 50 并发 → 至少需要 {{inst}} 个实例（向上取整）
（再留 30% 余量 → 建议 {{rec}} 个）`,
      blanks: [
        { id: 'rps', label: '每秒请求数', accept: ['1.67', '1.6667', '1.666', '5/3'], width: 80 },
        { id: 'conc', label: '需要的并发数', accept: ['33.3', '33.33', '33', '34'], width: 80 },
        { id: 'inst', label: '最少实例数', accept: ['1'], width: 50 },
        { id: 'rec', label: '留余量后的建议实例数', accept: ['2'], width: 50 },
      ],
      hints: [
        '利特尔法则：并发数 = 到达率 × 平均处理时间。',
        '先统一单位：RPM 转 RPS，秒。',
        '100/60 = 1.667 RPS。1.667 × 20 = 33.3 并发。单实例 50 并发足够，所以 1 个实例就够。留 30% 余量 → 33.3 × 1.3 = 43.3，仍小于 50，但考虑实例故障要 2 个。**注意：33 个并发就能打满 100 RPM，说明瓶颈是并发不是 QPS——这正是 LLM 应用的特点。**',
      ],
      explanation: '答案：1.67 RPS / 33.3 并发 / 1 个实例 / 建议 2 个。关键洞察是**配额 100 RPM 看起来很多，但因为单请求占 20 秒，33 个并发就打满了**。所以限流必须限并发，只限 QPS 会严重低估压力。',
      approach: [
        '把 RPM 换算成 RPS',
        '用利特尔法则算稳态并发：并发 = RPS × 平均耗时',
        '并发数 ÷ 单实例上限，向上取整',
        '再按故障冗余和峰值余量加实例',
      ],
      knowledge: ['利特尔法则', '并发计算', '容量规划'],
      pitfalls: [
        '只算 QPS 不算并发（LLM 请求耗时长，并发才是瓶颈）',
        '忘了留故障冗余（单实例挂了就全挂）',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现令牌桶',
      points: 20,
      prompt: '实现 `take(bucket, n, now)`，纯函数式令牌桶。`bucket` 形如 `{ tokens, last, capacity, rate }`（`last` 和 `now` 是毫秒时间戳，`rate` 是每秒补充的令牌数）。返回 `{ allowed, bucket }`，**不要修改传入的 bucket**。补充的令牌数不能超过 `capacity`。',
      starter: `function take(bucket, n, now) {
  // TODO
  return { allowed: true, bucket }
}

return take`,
      checks: [
        {
          name: '满桶可以取',
          expr: "result({ tokens: 10, last: 0, capacity: 10, rate: 1 }, 5, 0).allowed === true",
        },
        {
          name: '取完扣减正确',
          expr: "result({ tokens: 10, last: 0, capacity: 10, rate: 1 }, 5, 0).bucket.tokens === 5",
        },
        {
          name: '空桶拒绝',
          expr: "result({ tokens: 0, last: 0, capacity: 10, rate: 1 }, 1, 0).allowed === false",
        },
        {
          name: '按时间补充',
          expr: "result({ tokens: 0, last: 0, capacity: 10, rate: 1 }, 3, 3000).allowed === true",
        },
        {
          name: '补充不超过容量',
          expr: "result({ tokens: 0, last: 0, capacity: 10, rate: 1 }, 11, 100000).allowed === false",
        },
        {
          name: '不修改传入对象',
          expr: "(() => { const b = { tokens: 10, last: 0, capacity: 10, rate: 1 }; result(b, 5, 1000); return b.tokens === 10 && b.last === 0 })()",
        },
        {
          name: '取完刚好为 0 也算允许',
          expr: "(() => { const r = result({ tokens: 10, last: 0, capacity: 10, rate: 1 }, 10, 0); return r.allowed === true && r.bucket.tokens === 0 })()",
        },
      ],
      solution: `function take(bucket, n, now) {
  const elapsedSec = Math.max(0, (now - bucket.last) / 1000)
  const tokens = Math.min(bucket.capacity, bucket.tokens + elapsedSec * bucket.rate)

  if (tokens < n) {
    return { allowed: false, bucket: { ...bucket, tokens, last: now } }
  }

  return {
    allowed: true,
    bucket: { ...bucket, tokens: tokens - n, last: now },
  }
}`,
      hints: [
        '三步：按流逝时间补令牌 → 判断够不够 → 够就扣、不够就只更新状态。',
        '注意"拒绝"时也要更新 `tokens` 和 `last`，否则下次计算会重复补。',
        '完整实现：`elapsed = max(0, (now - last)/1000)`；`tokens = min(capacity, tokens + elapsed*rate)`；`tokens >= n` 则扣减并允许，否则拒绝但同样更新 tokens 和 last。全部用 `{...bucket}` 新建对象。',
      ],
      explanation: '纯函数版本的好处是可测试、可在任意存储上实现（内存、Redis、DB）。生产里把它翻译成 Lua 脚本放进 Redis 就是原子的分布式限流。',
      approach: [
        '先按流逝时间补充令牌，上限是 capacity',
        '判断补充后是否够 n 个',
        '够：扣减并返回 allowed',
        '不够：也更新 tokens 和 last（避免重复补充）',
        '全程返回新对象，不改原对象',
      ],
      knowledge: ['令牌桶', '限流算法', '纯函数', '利特尔法则'],
      pitfalls: [
        '拒绝时不更新 last，导致下次又补一遍',
        '补充不设上限，长时间空闲后瞬间放行巨量请求',
        '原地修改传入对象，污染调用方状态',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 15,
    questions: [
      {
        id: 'q1',
        stem: '多实例部署后"随机掉登录"，最可能的原因？',
        options: [
          { id: 'a', text: '数据库连接不够' },
          { id: 'b', text: '会话存在进程内存里，请求被负载均衡打到没有该会话的实例' },
          { id: 'c', text: 'cookie 太大' },
          { id: 'd', text: 'HTTPS 配置错误' },
        ],
        answer: 'b',
        why: '进程内存是"实例私有"的。会话必须外置到 Redis 或签名 cookie，才能让任意实例都认。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: 'SSE 为什么需要心跳？',
        options: [
          { id: 'a', text: '为了测量延迟' },
          { id: 'b', text: '中间层常有 30~60 秒空闲超时，长时间没数据会被断开' },
          { id: 'c', text: '为了让浏览器知道连接还活着' },
          { id: 'd', text: '为了压缩数据' },
        ],
        answer: 'b',
        why: '心跳（`:\n\n` 注释行）的主要作用是"让连接看起来一直在活动"，避免被 LB/CDN 判定为空闲连接而关闭。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '用户关闭页面后，你的流式生成循环会怎样？',
        options: [
          { id: 'a', text: '自动停止' },
          { id: 'b', text: '会继续跑直到生成结束，白烧 token，除非你监听连接关闭并 abort 上游' },
          { id: 'c', text: '立刻抛错' },
          { id: 'd', text: '被 GC 回收' },
        ],
        answer: 'b',
        why: 'HTTP 连接断开不会自动取消上游请求。必须监听 `req.on("close")` 并 abort，否则每天都在为"没人在看的回答"付钱。',
        stepId: 's2',
      },
      {
        id: 'q4',
        stem: '为什么长任务要异步化？',
        options: [
          { id: 'a', text: '因为异步更快' },
          { id: 'b', text: 'HTTP 连接和负载均衡都有超时；长任务占着连接会耗尽并发，且用户刷新就丢结果' },
          { id: 'c', text: '因为队列更省内存' },
          { id: 'd', text: '为了用上 worker' },
        ],
        answer: 'b',
        why: '异步化解决的是"连接不能等那么久"和"结果要能重放"两个问题。同时让任务可重试、可取消、可查进度。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '限流时"并发数"为什么比"QPS"更关键？',
        options: [
          { id: 'a', text: '并发数更容易算' },
          { id: 'b', text: 'LLM 单请求耗时几十秒，少量并发就能打满吞吐；只限 QPS 会在突增时打满连接池' },
          { id: 'c', text: 'QPS 无法测量' },
          { id: 'd', text: '并发数决定成本' },
        ],
        answer: 'b',
        why: '并发 = RPS × 平均耗时。耗时长的系统里，并发才是真正的稀缺资源。100 RPM 只要 33 个并发就打满了。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: '返回 429 时，正确的做法是？',
        options: [
          { id: 'a', text: '什么都不加，让客户端自己猜' },
          { id: 'b', text: '带 `Retry-After` 头，明确告诉客户端多久后重试' },
          { id: 'c', text: '返回 200 加错误信息' },
          { id: 'd', text: '直接断开连接' },
        ],
        answer: 'b',
        why: '不带 `Retry-After`，客户端会立刻重试，把限流变成"自我 DDoS"。明确告知退避时间才能让系统恢复。',
        stepId: 's5',
      },
      {
        id: 'q7',
        stem: '为什么降级必须在响应和监控里"可见"？',
        options: [
          { id: 'a', text: '为了合规' },
          { id: 'b', text: '否则系统悄悄降级运行几周，你只会看到"质量莫名下降"却找不到原因' },
          { id: 'c', text: '为了让用户知道我们很努力' },
          { id: 'd', text: '为了让日志更大' },
        ],
        answer: 'b',
        why: '不可见的降级等于"慢性失明"。要在响应里带 `degraded` 标记、在监控上看降级率、给用户诚实的提示。',
        stepId: 's6',
      },
      {
        id: 'q8',
        stem: '数据库字段改名，怎么发布才能保证能回滚？',
        options: [
          { id: 'a', text: '直接 RENAME COLUMN，一次发布完成' },
          { id: 'b', text: '加新列 + 双写 + 兼容读，确认稳定后再切换读，最后删旧列，分三次发布' },
          { id: 'c', text: '先备份，出问题恢复备份' },
          { id: 'd', text: '停机维护' },
        ],
        answer: 'b',
        why: '直接改名后，回滚时旧代码找不到旧列，服务起不来。两阶段迁移保证任何一个版本都能同时读写新旧格式。',
        stepId: 's7',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：上线',
    contributes:
      '这一课把项目真正部署出去。产出物是一套可水平扩展、流式正常、有限流和降级、能安全回滚的部署方案。',
    tasks: [
      '画出部署拓扑图，标注每个组件是否有状态、能不能水平扩、扩了要注意什么',
      '把会话、限流计数、上传文件、定时任务全部外置，验证 3 实例下无状态',
      '配 nginx：`proxy_buffering off` + HTTP/1.1 + 300s 超时 + gzip off，用 `curl -N` 和浏览器双重验证流式',
      '加 SSE 心跳（15s）和 `req.on("close")` 的 abort，验证关页面后上游请求确实被取消',
      '把"批量索引"改成异步任务：任务表 + 队列 + 状态机 + 进度 + 取消，验证 3 实例下同一任务只跑一次',
      '实现令牌桶限流（Redis + Lua），按用户日额度 + 全局并发双维度；429 带 Retry-After',
      '实现模型降级链：主模型 → 备用模型 → 纯检索结果，带 `degraded` 标记和监控打点',
      '写一份发布检查清单，做一次两阶段数据库迁移演练（加列 → 双写 → 切读 → 删列）',
      '演练一次回滚：把新版本发上去，再回滚到上一版，确认服务正常且数据没坏',
    ],
    done: '三个实例跑起来，用户随机刷新不掉登录；流式首字在 800ms 内出现；关掉浏览器标签后服务端日志显示上游请求被 abort；手动把模型 API 打成 503，系统自动切到备用模型并在面板上显示降级率；完成一次"发布 → 回滚"的完整演练。',
  },

  further: [
    { text: 'nginx 文档 · proxy_buffering 与 X-Accel-Buffering' },
    { text: 'MDN · Server-sent events（事件流格式与重连机制）' },
    { text: 'Google SRE Workbook · Canarying Releases' },
    { text: '知识地图 10 工程架构（/guide/10-architecture）' },
  ],
}
