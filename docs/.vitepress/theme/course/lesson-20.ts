import type { Lesson } from './types'

/**
 * 第二十课：网络、系统与分布式
 *
 * 核心立场：线上问题不是"玄学"，是"某一层坏了"。
 * 会分层排查的人，10 分钟定位；不会的人，猜两天。
 */
export const lesson20: Lesson = {
  id: 'L20',
  moduleId: 'net',
  order: 20,
  path: '/learn/20-network-distributed',
  title: '网络、系统与分布式：按层排查，而不是靠猜',
  subtitle: '"时好时坏"不是玄学，是你还没找到那一层。',
  minutes: 65,
  level: '进阶',
  outcome: '遇到"连不上/很慢/偶尔失败"，能按层定位到具体环节，并说清每层该怎么修。',
  goals: [
    '按 DNS → TCP → TLS → HTTP → 应用 的顺序排查，而不是盲试',
    '设计分层超时，避免"总超时"掩盖真实瓶颈',
    '正确实现重试：指数退避 + 抖动 + 可重试判定',
    '理解 at-least-once 的真相，用幂等消化重复',
    '识别分布式环境下的四类一致性陷阱',
    '掌握一套可复用的排查清单和命令',
  ],
  prereqs: [
    '学过第十二课，理解部署与限流',
    '用过 curl / nslookup / tcpdump 中的至少一个',
    '被"偶发失败"折磨过（没有也没关系，早晚会）',
  ],

  steps: [
    {
      id: 's1',
      title: '分层：一次请求要过五道关',
      checkpoint: '`curl` 返回 `000` 且 exit code 7，是哪一层的问题？',
      blocks: [
        {
          type: 'flow',
          title: '一次 HTTPS 请求的完整路径',
          ascii: `① DNS 解析        域名 → IP          失败：Unknown host / 解析超时
      │
② TCP 握手        SYN → SYN-ACK      失败：Connection refused / timeout
      │
③ TLS 握手        证书 + 密钥交换     失败：certificate verify failed
      │
④ HTTP 请求/响应  状态码 + body       失败：4xx / 5xx / 空响应
      │
⑤ 应用处理        你的代码            失败：业务错误、超时、OOM`,
        },
        {
          type: 'table',
          head: ['症状', '最可能层', '第一个该跑的命令'],
          rows: [
            ['`Unknown host`', 'DNS', '`nslookup 域名` / `dig 域名`'],
            ['`Connection refused`', 'TCP（端口没监听/被拒）', '`telnet host port` / `nc -vz host port`'],
            ['`Connection timed out`', 'TCP（防火墙/路由/安全组）', '`traceroute host`'],
            ['`certificate verify failed`', 'TLS', '`openssl s_client -connect host:443`'],
            ['`000` + exit 7', 'TCP（连不上）', '看端口是否监听、安全组是否放行'],
            ['`502 / 504`', '网关到后端', '看后端是否活着、超时配置'],
            ['200 但内容不对', '应用', '看日志和 trace'],
          ],
        },
        {
          type: 'code',
          lang: 'bash',
          title: '一套按层排查的命令',
          code: `# ① DNS
nslookup api.example.com
dig +short api.example.com @8.8.8.8     # 换 DNS 服务器对比，判断是不是本地 DNS 的问题

# ② TCP
nc -vz api.example.com 443              # 只测能不能建连
curl -v --connect-timeout 5 https://api.example.com   # 看卡在哪一步

# ③ TLS
openssl s_client -connect api.example.com:443 -servername api.example.com </dev/null

# ④ HTTP
curl -sS -o /dev/null -w 'dns=%{time_namelookup} tcp=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\\n' https://api.example.com

# ⑤ 应用
# 看服务端日志 + trace，按 trace_id 串起来`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '`curl -w` 那一行是神器',
          text: '它把一次请求拆成四段耗时：DNS、TCP 连接、TLS 握手、首字节。**哪一段异常大，问题就在哪一层。** 比如 `dns=3.2s` 说明 DNS 慢（换 DNS 或加缓存）；`tcp=5.0s` 说明网络不通或安全组问题；`tls=1.8s` 说明握手慢（可能是证书链太长或线路差）；`ttfb` 大而前面都小，才是服务端处理慢。',
        },
        {
          type: 'p',
          text: '回到 checkpoint：`000` + exit 7 表示 **curl 连 TCP 都没建立起来**。所以问题在 DNS 之后、TLS 之前——检查端口是否监听、安全组/防火墙是否放行、地址是否可达。**不要去看应用日志，那里什么都没有。**',
        },
      ],
    },

    {
      id: 's2',
      title: '超时：一层一个，不能只有一个',
      checkpoint: '你的 fetch 设了 30 秒超时。为什么用户还是等了 30 秒才知道失败？',
      blocks: [
        {
          type: 'p',
          text: '因为"总超时"只告诉你"失败了"，不告诉你"卡在哪"。而且它会让上游等得比必要的更久。正确做法是**分层设超时，且内层必须小于外层**。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '分层超时',
          code: `// 每一层都比它的下游稍长一点，留出"下游超时后我还来得及处理"的余量
const TIMEOUTS = {
  client: 35_000,      // 浏览器/客户端
  gateway: 30_000,     // 网关 / nginx
  handler: 25_000,     // 你的接口处理
  llm: 20_000,         // 单次模型调用
  retrieve: 3_000,     // 检索
  db: 2_000,           // 数据库查询
}

// 关键：用 AbortSignal 把超时串起来，一处超时全部取消
async function handle(req: Request) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('handler timeout')), TIMEOUTS.handler)
  // 客户端断开也要取消，避免白跑（第十二课）
  req.signal.addEventListener('abort', () => ctrl.abort())

  try {
    const chunks = await withTimeout(
      retrieve(req.query, { signal: ctrl.signal }),
      TIMEOUTS.retrieve,
    )
    const answer = await withTimeout(
      callModel(chunks, { signal: ctrl.signal }),
      TIMEOUTS.llm,
    )
    return answer
  } finally {
    clearTimeout(timer)
  }
}`,
        },
        {
          type: 'table',
          head: ['超时类型', '不设会怎样', '该设多少'],
          rows: [
            ['连接超时', 'SYN 无响应时挂很久（默认可能 2 分钟）', '3~5 秒'],
            ['读超时', '对端接受连接但不返回，一直等', '按业务定，通常 10~30 秒'],
            ['总超时', '多个步骤叠加，总时长失控', '小于上游的超时'],
            ['空闲超时（连接池）', '连接被对端关了但你以为还在', '小于对端的 keepalive'],
            ['DNS 超时', 'DNS 卡住时整个请求卡住', '2~5 秒，并配缓存'],
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '超时设太长 = 没有超时',
          text: '默认的 30 秒、60 秒在网络故障时是灾难：**连接池被占满，所有请求排队，服务整体雪崩**。正确做法是"快速失败 + 重试/降级"，而不是"死等"。**宁可快速返回一个降级结果，也不要让用户盯着转圈两分钟。**',
        },
        {
          type: 'p',
          text: '还有一个 LLM 特有的：**流式请求的超时要看"首字节"和"总时长"两个**。TTFT 超过 10 秒基本可以判定卡住了（正常 0.5~3 秒）；总时长则按最大输出估算（比如 4000 token × 20ms = 80 秒）。**只设总超时，会在"模型卡住不吐字"时白等 80 秒。**',
        },
      ],
    },

    {
      id: 's3',
      title: '重试：三个参数缺一不可',
      checkpoint: '重试不加抖动，会发生什么？',
      blocks: [
        {
          type: 'p',
          text: '重试是"用时间换成功率"，但做错了会让故障放大。三个参数：**退避、抖动、可重试判定**。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '正确的重试',
          code: `type RetryOpts = {
  maxAttempts: number       // 总尝试次数（含首次）
  baseDelayMs: number       // 基础延迟
  maxDelayMs: number        // 延迟上限
  retryable: (e: unknown) => boolean
  random?: () => number     // 注入，便于测试
}

const DEFAULT: RetryOpts = {
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 5_000,
  retryable: (e) => isTransient(e),
}

async function withRetry<T>(fn: () => Promise<T>, opts: Partial<RetryOpts> = {}): Promise<T> {
  const o = { ...DEFAULT, ...opts }
  const rand = o.random ?? Math.random
  let lastErr: unknown

  for (let attempt = 1; attempt <= o.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (attempt === o.maxAttempts || !o.retryable(e)) throw e

      // 指数退避：300 → 600 → 1200 ...
      const exp = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** (attempt - 1))
      // 全抖动（full jitter）：在 [0, exp] 之间随机
      const delay = rand() * exp
      await sleep(delay)
    }
  }
  throw lastErr
}

// 哪些错误可以重试
function isTransient(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e)
  if (/timeout|ETIMEDOUT|ECONNRESET|EPIPE/i.test(msg)) return true
  if (/\\b(429|500|502|503|504)\\b/.test(msg)) return true
  if (/rate limit|overloaded/i.test(msg)) return true
  return false
}`,
        },
        {
          type: 'table',
          head: ['参数', '不设的后果'],
          rows: [
            ['退避（backoff）', '立刻重试，把已经过载的下游打死'],
            ['抖动（jitter）', '**所有客户端同时重试，形成"重试风暴"**'],
            ['可重试判定', '对 400/401 也重试，纯浪费；对"已经扣款"重试，造成重复扣款'],
            ['最大次数', '无限重试，请求永远不返回'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '没有抖动的重试 = 自我 DDoS',
          text: '假设 1000 个客户端在 12:00:00 同时失败，退避都是 1 秒——它们会在 12:00:01 **同时**重试。下游刚恢复又被 1000 个请求打垮。**加了抖动后，重试会均匀分散在 1 秒内**，下游能逐步恢复。这是分布式系统的常识，也是最常被忽略的一条。',
        },
        {
          type: 'p',
          text: '重试的另一个关键是"重试什么"。**只在"重试可能成功"时重试**：超时、连接重置、429、5xx 可以；400（参数错）、401（认证失败）、403（无权限）、404（不存在）不行——它们重试一百次也一样。**对有副作用的操作（支付、发消息）绝对不重试，除非下游支持幂等键。**',
        },
      ],
    },

    {
      id: 's4',
      title: '一致性的四个陷阱',
      checkpoint: '数据库写入成功了，但缓存还是旧值。这算不算 bug？',
      blocks: [
        {
          type: 'table',
          head: ['陷阱', '场景', '后果', '解法'],
          rows: [
            ['缓存与主库不一致', '写库成功、删缓存失败', '用户看到旧数据', '先删缓存再写库；或写库后延迟双删'],
            ['读己之写失败', '写主库，读从库（有延迟）', '刚改完就刷新，看到旧值', '关键读走主库；或用会话粘滞'],
            ['重复消费', '队列 at-least-once', '同一条消息处理两次', '幂等键 + 唯一约束'],
            ['并发覆盖', '两个请求同时改同一条', '后写的覆盖先写的', '乐观锁（版本号）/ 悲观锁'],
          ],
        },
        {
          type: 'code',
          lang: 'sql',
          title: '乐观锁：用版本号防覆盖',
          code: `-- 读的时候带出版本
SELECT id, title, version FROM docs WHERE id = $1;
-- version = 7

-- 写的时候校验版本，不匹配就说明被人改过了
UPDATE docs
   SET title = $2, version = version + 1
 WHERE id = $1 AND version = 7;

-- 影响行数为 0 → 冲突，让用户重新加载
-- 应用层判断：if (result.rowCount === 0) throw new ConflictError()`,
        },
        {
          type: 'callout',
          tone: 'info',
          title: '先问"这个场景能不能接受不一致"',
          text: '不是所有场景都需要强一致。**展示类的"阅读数""点赞数"延迟几秒完全没问题**；**余额、库存、权限必须强一致**。花力气解决不需要解决的问题，是另一种浪费。判断标准：**不一致的这段时间里，会不会有人做出错误决策或造成损失？**',
        },
        {
          type: 'p',
          text: '回到 checkpoint：**严格说算 bug，但通常可接受**——前提是"不一致的窗口足够短"（毫秒到秒级），并且你显式设计了这个窗口（比如 TTL 1 秒）。**危险的是"没有意识到不一致存在"**，而不是"选择接受不一致"。',
        },
      ],
    },

    {
      id: 's5',
      title: '队列语义：at-least-once 是唯一的现实',
      checkpoint: '"exactly-once" 是真的吗？',
      blocks: [
        {
          type: 'p',
          text: '不是。**所有号称 exactly-once 的系统，本质都是"at-least-once 投递 + 消费端幂等"**。因为"确认"这个动作本身可能失败——消费者处理完了但 ACK 丢了，消息会被重投。',
        },
        {
          type: 'table',
          head: ['语义', '含义', '代价'],
          rows: [
            ['at-most-once', '最多一次，可能丢', '不重试，ACK 早于处理'],
            ['at-least-once', '至少一次，可能重复', '**默认选择，必须配幂等消费**'],
            ['exactly-once（宣称）', '不丢不重', '靠事务/去重表实现，成本高、有边界'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '幂等消费：唯一约束 + 状态检查',
          code: `async function consume(msg: Message) {
  // 1. 幂等键：业务上唯一标识"这件事"
  const key = msg.idempotencyKey   // 例如 'job:123:step:embed'

  // 2. 尝试占位（唯一约束防并发重复）
  try {
    await db.insert('processed', { key, at: new Date() })
  } catch (e) {
    if (isUniqueViolation(e)) {
      logger.info({ key }, 'already processed, skip')
      return   // 重复消息，直接跳过
    }
    throw e
  }

  // 3. 真正处理（这里失败要能重试）
  await doWork(msg)

  // 4. 标记完成（可选，用于审计）
  await db.update('processed', { key }, { status: 'done' })
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: 'ACK 顺序错了会丢消息',
          text: '**先 ACK 再处理**：处理失败消息已经没了，永久丢失。**先处理再 ACK**：处理成功但 ACK 丢失，消息重投，可能重复处理。**正确顺序是"先处理 + 幂等，再 ACK"**——宁可重复（幂等能消化），不可丢失（无法恢复）。',
        },
        {
          type: 'p',
          text: '还有一个 LLM 场景特有的坑：**长任务的心跳**。消息队列通常有"可见性超时"（visibility timeout），如果任务跑得比它长，消息会被认为"消费失败"而重投，导致**两个 worker 同时处理同一个任务**。做法：长任务定期续期（extend visibility），或者干脆用第十二课的任务表 + 轮询，不用队列的自动重投。',
        },
      ],
    },

    {
      id: 's6',
      title: '排查方法论：一份能直接用的清单',
      checkpoint: '"偶尔失败，复现不了"，第一步该做什么？',
      blocks: [
        {
          type: 'p',
          text: '偶发问题最忌讳"猜"。正确的第一步是**量化**：多偶发？什么条件下偶发？',
        },
        {
          type: 'flow',
          title: '偶发问题排查五步',
          ascii: `① 量化：失败率多少？集中在什么时段/用户/接口？
   → 查日志聚合，按分钟/接口/用户维度分组

② 找相关性：和 QPS、内存、连接数、部署时间有关吗？
   → 画在同一张时间轴上对比

③ 分层定位：看失败发生在哪一层（DNS/TCP/TLS/HTTP/应用）
   → 抓一次失败请求的完整耗时拆分

④ 找边界：是不是特定输入/特定长度/特定并发才触发？
   → 构造最小复现条件

⑤ 修 + 加监控：修完后加一个能提前发现它的指标`,
        },
        {
          type: 'table',
          head: ['症状', '常见根因', '验证方法'],
          rows: [
            ['偶发超时', '连接池耗尽 / GC 停顿 / 下游抖动', '看连接池使用率、GC 日志'],
            ['偶发 502', '后端实例重启 / 健康检查误判', '看实例重启记录'],
            ['偶发数据不一致', '并发覆盖 / 缓存旧值', '看是否有版本号冲突'],
            ['偶发内存暴涨', '大对象未释放 / 缓存无上限', '看 heap snapshot'],
            ['高并发下变慢', '锁竞争 / 连接数不够', '压测看 P95 随并发的变化'],
            ['只在某地区失败', 'DNS 解析差异 / CDN 节点问题', '多地 ping / dig 对比'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '给每个请求打上"可排查"的标记',
          code: `// 一个请求进来就生成 requestId，贯穿所有日志和下游调用
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] ?? crypto.randomUUID()
  res.setHeader('x-request-id', req.id)
  // 下游调用时带上，方便跨服务串联
  next()
})

// 日志一律结构化，且带 requestId
logger.info({
  requestId: req.id,
  userId: req.user?.id,
  route: req.route?.path,
  durationMs: Date.now() - started,
  status: res.statusCode,
}, 'request done')

// 出问题时：一条命令拉出这个请求的所有日志
// grep '"requestId":"abc-123"' app.log | jq -s 'sort_by(.ts)'`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '排查的本质是"缩小范围"',
          text: '每次操作都应该能排除一半可能性：**是这一层还是那一层？是这个用户还是所有用户？是这个时段还是全天？是这次部署之后还是一直有？** 猜十次不如做一次能二分的实验。**"我先改改看"是最差的方法**——改完问题消失了，你也不知道是不是它修的。',
        },
        {
          type: 'qa',
          q: '线上出问题，先止损还是先找原因？',
          a: '**先止损，再找原因。** 顺序是：① 止血（回滚、切流、限流、降级）；② 确认影响面（多少用户、多久、涉及什么数据）；③ 找根因；④ 修 + 加监控 + 写复盘。**很多人卡在"不搞清楚原因不敢回滚"**，结果故障时间被拉长十倍。回滚是安全的默认动作——如果回滚后问题消失，你至少知道是新版本引入的，范围一下就缩小了。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '分层定位',
      points: 10,
      prompt: '`curl -w` 显示 `dns=0.02 tcp=0.03 tls=0.04 ttfb=8.9 total=9.0`（单位秒）。问题在哪一层？',
      options: [
        { id: 'a', text: 'DNS 慢' },
        { id: 'b', text: '网络不通' },
        { id: 'c', text: '服务端处理慢（首字节等了 8.9 秒）' },
        { id: 'd', text: 'TLS 握手慢' },
      ],
      answer: ['c'],
      hints: [
        '看四段的相对大小：前三个都是几十毫秒，最后一段是 8.9 秒。',
        'ttfb 是"发出请求到收到第一个字节"的时间，包含服务端处理时间。',
        'c 是对的：DNS、TCP、TLS 都正常（几十毫秒），说明网络链路没问题。ttfb 8.9 秒说明服务端处理慢——可能是模型调用慢、数据库慢、或者有锁等待。**接下来该看服务端 trace，而不是查网络。**',
      ],
      explanation: '正确答案是 c。`curl -w` 的四个时间把"网络问题"和"服务端问题"直接分开了，这是最高效的第一次定位。',
      approach: [
        '看 dns/tcp/tls 三段：都小说明链路正常',
        '看 ttfb：大说明服务端处理慢',
        '看 total - ttfb：大说明响应体传输慢（大文件/带宽）',
        '据此决定查网络还是查服务端',
      ],
      knowledge: ['curl -w', 'TTFB', '分层排查'],
      pitfalls: [
        '看到慢就怀疑网络',
        '不看分段耗时，直接猜',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '重试的正确做法',
      points: 15,
      prompt: '实现一个可靠的 HTTP 重试，必须包含哪些要素？（多选）',
      options: [
        { id: 'a', text: '指数退避（每次延迟翻倍）' },
        { id: 'b', text: '抖动（在延迟区间内随机，避免同步重试）' },
        { id: 'c', text: '可重试判定（只重试超时/5xx/429，不重试 4xx）' },
        { id: 'd', text: '最大重试次数上限' },
        { id: 'e', text: '对所有错误一视同仁地重试' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        '想三个问题：会不会打死下游、会不会重试风暴、会不会白重试。',
        'e 会导致对 401/400 也重试，纯浪费且可能触发风控。',
        'a 防止立刻重试压垮下游；b 防止所有客户端同时重试；c 避免对不可恢复的错误做无用功；d 防止无限循环。e 是反模式——400/401/403/404 重试一百次也一样。',
      ],
      explanation: 'a、b、c、d 四个缺一不可。特别是 b（抖动），没有它，重试本身就是一次 DDoS。',
      approach: [
        '指数退避：base × 2^(n-1)，设上限',
        '全抖动：在 [0, 退避时长] 内随机',
        '错误分类：只重试暂时性错误',
        '次数上限：通常 3 次',
        '有副作用的操作额外要求幂等键',
      ],
      knowledge: ['重试', '指数退避', '抖动', '错误分类'],
      pitfalls: [
        '不加重试抖动',
        '对 4xx 也重试',
        '对支付类操作无脑重试',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '幂等消费',
      points: 15,
      prompt: '队列是 at-least-once，补全幂等消费逻辑。',
      templateLang: 'ts',
      template: `async function consume(msg) {
  const key = msg.{{k1}}          // 业务唯一标识

  try {
    await db.insert('processed', { key })   // 靠 {{k2}} 约束防重复
  } catch (e) {
    if (isUniqueViolation(e)) {
      return                                  // 重复消息，{{k3}}
    }
    throw e
  }

  await doWork(msg)
  await {{k4}}(msg)                           // 处理完才确认
}

// 顺序不能反：先 {{k5}} 再 ACK，
// 因为宁可重复（幂等能消化），不可丢失（无法恢复）`,
      blanks: [
        { id: 'k1', label: '幂等键字段', accept: ['idempotencyKey', 'idempotency_key', 'id', 'msgId'], width: 140 },
        { id: 'k2', label: '靠什么约束防重复', accept: ['唯一', 'unique', '唯一约束', '主键'], width: 100 },
        { id: 'k3', label: '重复消息怎么处理', accept: ['跳过', '直接跳过', '忽略', 'skip'], width: 90 },
        { id: 'k4', label: '处理完做什么', accept: ['ack', '确认', 'acknowledge'], width: 90 },
        { id: 'k5', label: '先做什么再 ACK', accept: ['处理', '处理成功', '处理完', 'doWork', '处理消息'], width: 110 },
      ],
      hints: [
        '核心思路：先用唯一键占位，占不到说明处理过了。',
        '最后一句是 at-least-once 的核心取舍。',
        '① 幂等键（idempotencyKey）② 唯一约束 ③ 直接跳过 ④ ACK ⑤ 处理。**先处理再 ACK**：ACK 丢了最多重复一次（幂等能消化），先 ACK 再处理如果失败就永久丢失。',
      ],
      explanation: '这个模式是所有 at-least-once 消费的标准写法：唯一键占位 → 处理 → ACK。三步顺序错了就会丢数据或重复执行。',
      approach: [
        '用业务唯一标识做幂等键',
        '先插入占位记录，靠唯一约束防并发重复',
        '重复就跳过，不报错',
        '处理业务逻辑',
        '最后 ACK',
      ],
      knowledge: ['幂等消费', 'at-least-once', '唯一约束', 'ACK 顺序'],
      pitfalls: [
        '先 ACK 再处理（失败就永久丢）',
        '不用唯一约束，靠"先查再插"（并发下会重复）',
        '幂等键用消息 id（重投时 id 可能变）',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现带抖动的重试',
      points: 20,
      prompt: '实现 `withRetry(fn, opts)`。`opts` 含 `maxAttempts`（默认 3）、`baseDelayMs`（默认 100）、`maxDelayMs`（默认 2000）、`random`（注入的随机函数，默认 `Math.random`）。退避用指数增长，延迟取 `random() * 指数退避值`（全抖动），且不超过 `maxDelayMs`。返回 `{ value, attempts, delays }`。**不要真的 sleep**（测试环境），只把延迟记进 `delays`。',
      starter: `async function withRetry(fn, opts = {}) {
  // TODO
  return { value: undefined, attempts: 0, delays: [] }
}

return withRetry`,
      checks: [
        {
          name: '首次成功不重试',
          expr: "(async () => { const r = await result(async () => 42); return r.value === 42 && r.attempts === 1 && r.delays.length === 0 })()",
        },
        {
          name: '第二次成功，attempts 为 2',
          expr: "(async () => { let n = 0; const r = await result(async () => { if (++n === 1) throw new Error('x'); return 'ok' }); return r.attempts === 2 && r.value === 'ok' })()",
        },
        {
          name: '全失败时抛出最后的错误',
          expr: "(async () => { try { await result(async () => { throw new Error('boom') }, { maxAttempts: 3, random: () => 0 }); return false } catch (e) { return e.message === 'boom' } })()",
        },
        {
          name: '延迟按指数增长',
          expr: "(async () => { try { await result(async () => { throw new Error('x') }, { maxAttempts: 4, baseDelayMs: 100, random: () => 1, maxDelayMs: 10000 }) } catch (e) { return JSON.stringify(e.delays) === JSON.stringify([100, 200, 400]) } })()",
        },
        {
          name: '延迟不超过 maxDelayMs',
          expr: "(async () => { try { await result(async () => { throw new Error('x') }, { maxAttempts: 5, baseDelayMs: 1000, random: () => 1, maxDelayMs: 1500 }) } catch (e) { return Array.isArray(e.delays) && e.delays.length === 4 && e.delays.every((d) => d <= 1500) } })()",
        },
        {
          name: 'random 为 0 时延迟为 0',
          expr: "(async () => { try { await result(async () => { throw new Error('x') }, { maxAttempts: 3, random: () => 0 }) } catch (e) { return Array.isArray(e.delays) && e.delays.every((d) => d === 0) } })()",
        },
      ],
      solution: `async function withRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3
  const baseDelayMs = opts.baseDelayMs ?? 100
  const maxDelayMs = opts.maxDelayMs ?? 2000
  const random = opts.random ?? Math.random

  const delays = []
  let lastErr

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await fn(attempt)
      return { value, attempts: attempt, delays }
    } catch (e) {
      lastErr = e
      if (attempt === maxAttempts) break
      const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1))
      delays.push(random() * exp)
    }
  }

  const err = lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  err.attempts = maxAttempts
  err.delays = delays
  throw err
}`,
      hints: [
        '注意题面要求"不要真的 sleep"，只记录延迟——这让函数可以在沙箱里同步跑完。',
        '错误对象上挂 `delays` 和 `attempts`，测试才能检查。',
        '完整实现：循环 attempt 从 1 到 maxAttempts；成功就返回 `{value, attempts, delays}`；失败时如果不是最后一次，算 `exp = min(maxDelayMs, base * 2^(attempt-1))`，push `random() * exp`；全失败后把 delays/attempts 挂到错误对象上再 throw。',
      ],
      explanation: '全抖动（full jitter）是实践中最稳的策略：`random() * exp`。它把重试均匀分散在时间窗内，避免同步重试风暴，同时保留了"越失败等越久"的退让特性。',
      approach: [
        '循环尝试，成功即返回',
        '失败且还有次数时，算指数退避值',
        '用 `random() * 退避值` 做全抖动，并限制上限',
        '把延迟记录下来（测试环境不真 sleep）',
        '全失败时把信息挂到错误上再抛出',
      ],
      knowledge: ['重试', '指数退避', '全抖动', '可测试性'],
      pitfalls: [
        '忘记上限，退避时间指数爆炸',
        '不用 random，导致所有客户端同步重试',
        '真实 sleep 导致测试跑几分钟',
        '全失败时抛出的错误丢失了原始信息',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '`curl` 返回 `000` 且 exit code 7，问题在哪一层？',
        options: [
          { id: 'a', text: 'DNS' },
          { id: 'b', text: 'TCP 连接建立失败' },
          { id: 'c', text: 'TLS 握手' },
          { id: 'd', text: '应用逻辑' },
        ],
        answer: 'b',
        why: 'exit 7 是 "Failed to connect"。说明 DNS 解析成功了，但 TCP 建连失败——查端口监听、安全组、防火墙。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '为什么超时要分层设置，且内层小于外层？',
        options: [
          { id: 'a', text: '为了好看' },
          { id: 'b', text: '让上游在下游超时后还有时间做降级/重试，同时避免"总超时"掩盖真实瓶颈' },
          { id: 'c', text: '协议要求' },
          { id: 'd', text: '没必要' },
        ],
        answer: 'b',
        why: '如果内外层超时一样，下游一超时上游也立刻超时，没有余量做任何补救。分层才能知道卡在哪一层。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '重试不加抖动会发生什么？',
        options: [
          { id: 'a', text: '重试变慢' },
          { id: 'b', text: '所有客户端在同一时刻重试，形成重试风暴，把刚恢复的下游再次打垮' },
          { id: 'c', text: '重试次数变多' },
          { id: 'd', text: '没有影响' },
        ],
        answer: 'b',
        why: '同步重试是自我 DDoS。全抖动（random × 退避）把重试均匀分散到时间窗内。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '哪些错误不该重试？',
        options: [
          { id: 'a', text: '超时、429、503' },
          { id: 'b', text: '400 参数错误、401 认证失败、403 无权限、404 不存在' },
          { id: 'c', text: '连接重置' },
          { id: 'd', text: '所有错误都该重试' },
        ],
        answer: 'b',
        why: '这些是"确定性失败"——参数错、没权限、资源不存在，重试一百次结果一样。重试它们只是浪费时间和配额。',
        stepId: 's3',
      },
      {
        id: 'q5',
        stem: '队列消费时，为什么必须"先处理再 ACK"？',
        options: [
          { id: 'a', text: '为了更快' },
          { id: 'b', text: '先 ACK 再处理，如果处理失败消息已消失，永久丢失；反过来最多重复（幂等能消化）' },
          { id: 'c', text: '协议要求' },
          { id: 'd', text: '顺序无所谓' },
        ],
        answer: 'b',
        why: 'at-least-once 的核心取舍：宁可重复，不可丢失。重复可以靠幂等消化，丢失无法恢复。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: '线上故障时，第一步该做什么？',
        options: [
          { id: 'a', text: '先找根因，搞清楚再动手' },
          { id: 'b', text: '先止损（回滚/切流/限流/降级），再确认影响面，然后找根因' },
          { id: 'c', text: '先写故障报告' },
          { id: 'd', text: '先通知所有人' },
        ],
        answer: 'b',
        why: '卡在"不搞清楚不敢回滚"会让故障时间拉长十倍。回滚是安全的默认动作，而且能直接缩小排查范围。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：链路加固',
    contributes:
      '这一课把项目里所有"外部依赖"（模型 API、Python 侧车、数据库、队列）都按分布式系统的标准加固一遍。',
    tasks: [
      '用 `curl -w` 对每个外部依赖做一次分段耗时基线（DNS/TCP/TLS/TTFB），记录下来',
      '给每个依赖设分层超时：连接 3s、读 20s、总 25s，且内层小于外层',
      '实现 withRetry：指数退避 + 全抖动 + 错误分类，配单元测试（注入 random 验证延迟序列）',
      '把所有对外部依赖的调用改成"超时 + 重试 + 熔断 + 降级"四件套',
      '给队列消费加幂等：唯一键占位 → 处理 → ACK，验证重复投递不会重复执行',
      '给"改文档标题"加乐观锁（版本号），验证并发修改时正确返回 409',
      '所有日志加 requestId 并贯穿下游调用，写一个"输入 requestId 拉出完整链路"的命令',
      '写一份排查手册：六种常见症状 → 对应的第一个命令 → 常见根因',
    ],
    done: '人为把一个下游打成"只接受连接不返回"，验证 25 秒内正确降级而不是卡死；同一条消息投递 3 次，业务只执行 1 次；两个用户同时改同一文档，后提交的收到 409 而不是静默覆盖；拿到一个 requestId 能在 30 秒内还原整个请求链路。',
  },

  further: [
    { text: 'Google SRE Book · 第 21 章 Handling Overload（重试与降级的原始讨论）' },
    { text: 'AWS Architecture Blog · Exponential Backoff And Jitter' },
    { text: '知识地图 20 网络、系统与分布式（/guide/20-network-system）' },
  ],
}
