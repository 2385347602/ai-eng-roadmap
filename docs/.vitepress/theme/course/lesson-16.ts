import type { Lesson } from './types'

/**
 * 第十六课：MCP 与工具协议
 *
 * 核心立场：MCP 不是"新框架"，是把 N×M 的适配问题变成 N+M 的协议。
 * 写一个能被信任的 server，比写一个能跑的 server 难得多。
 */
export const lesson16: Lesson = {
  id: 'L16',
  moduleId: 'mcp',
  order: 16,
  path: '/learn/16-mcp',
  title: 'MCP 与工具协议：写出别人愿意装、敢装的 Server',
  subtitle: 'MCP 解决的从来不是"怎么调函数"，是"谁来为这次调用负责"。',
  minutes: 60,
  level: '进阶',
  outcome: '能独立设计并实现一个生产可用的 MCP Server，包括鉴权、审计、错误处理和版本演进。',
  goals: [
    '说清 MCP 相比裸 function calling 到底多解决了什么',
    '掌握 Tools / Resources / Prompts 三个原语的语义差异和使用场景',
    '正确选择 stdio 与 Streamable HTTP 传输，并配上对应鉴权',
    '按"模型能正确调用"的标准设计工具签名与返回值',
    '设计权限最小化、审计留痕、注入防护三件套',
    '判断一个能力该做成 MCP Server，还是根本不该暴露',
  ],
  prereqs: [
    '学过第八课，写过至少一个带工具的 Agent',
    '了解 JSON-RPC 2.0 的基本形态',
    '用过至少一个现成的 MCP 客户端（Claude Desktop / IDE 插件 / 自研）',
  ],

  steps: [
    {
      id: 's1',
      title: 'MCP 解决的真正问题：责任归属',
      checkpoint: '你已经有 HTTP API 了，为什么还要包一层 MCP？',
      blocks: [
        {
          type: 'p',
          text: '表面上 MCP 解决的是 N×M 适配问题：N 个 AI 客户端、M 个工具，裸接入要写 N×M 份胶水代码，有了协议就变成 N+M。这是官方说法，也对，但它不是最重要的那部分。',
        },
        {
          type: 'p',
          text: '**真正重要的是"责任边界"**。裸 function calling 里，工具是**宿主应用的一部分**——它的权限就是宿主应用的权限，它能读什么、能写什么，取决于宿主怎么实现。而 MCP Server 是**独立进程/独立服务**，它有：',
        },
        {
          type: 'list',
          items: [
            '**自己的身份**：谁在调用我，我能验证。',
            '**自己的权限**：它能访问什么资源，由它自己决定，不继承宿主的全部权限。',
            '**自己的日志**：每次调用可独立审计，不依赖宿主记录。',
            '**自己的生命周期**：可以单独升级、单独下线、单独限流。',
          ],
        },
        {
          type: 'table',
          head: ['', '裸 function calling', 'MCP Server'],
          rows: [
            ['边界', '同一进程，共享全部权限', '独立进程/服务，权限隔离'],
            ['复用', '每个宿主重写一遍', '一次实现，所有客户端可用'],
            ['审计', '靠宿主打点', '服务端自己留完整日志'],
            ['升级', '跟宿主一起发版', '独立发版'],
            ['风险', '工具漏洞 = 宿主漏洞', '工具漏洞被进程边界限制'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '反过来说：MCP 也放大了风险',
          text: '一个恶意或有漏洞的 MCP Server，能读你的对话、能调它声明的一切工具、能把数据发到任意地方。**装一个 MCP Server 的信任成本，约等于装一个浏览器插件。** 这也是为什么"官方 MCP 市场"审核严格，以及为什么你自己写 server 时要格外注意最小权限。',
        },
        {
          type: 'analogy',
          title: '和浏览器插件对照',
          text: '插件要声明权限（读所有网站 / 访问剪贴板），用户安装时能看到。MCP Server 也应该这样——**它声明要什么能力，用户在安装时能看到并能拒绝**。没有这层"声明-确认"，MCP 就只是个更方便的后门。',
        },
      ],
    },

    {
      id: 's2',
      title: '三个原语：谁控制，决定它是什么',
      checkpoint: '一份文档，是该做成 Resource 还是 Tool？',
      blocks: [
        {
          type: 'p',
          text: 'MCP 只有三个原语，区分它们的唯一标准是**控制权在谁手里**。',
        },
        {
          type: 'table',
          head: ['原语', '谁决定用它', '语义', '典型例子'],
          rows: [
            ['Tools', '**模型**决定调用', '有副作用的动作，或需要参数的计算', '查数据库、发消息、执行查询'],
            ['Resources', '**客户端/用户**选择', '可读取的数据，URI 寻址，只读', '一份文件、一张表、一条配置'],
            ['Prompts', '**用户**主动触发', '预置的提示模板，可带参数', '斜杠命令、固定工作流'],
          ],
        },
        {
          type: 'p',
          text: '这个区分不是学术洁癖，它直接影响安全模型：',
        },
        {
          type: 'list',
          items: [
            '**Tools 会被模型自主调用**，所以必须假设"模型可能被注入诱导去调它"，每个工具都要自己鉴权。',
            '**Resources 由用户选择**，所以它可以承载"用户主动想给模型看的东西"，不需要防注入到同样程度（但仍然要防越权读）。',
            '**Prompts 由用户触发**，是最安全的原语，适合放"固定套路"。',
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '三个原语的最小示例',
          code: `import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const server = new McpServer({ name: 'kb', version: '1.2.0' })

// —— Tool：模型决定调用，有副作用或需要参数计算
server.tool(
  'search_docs',
  '在知识库中检索。当用户询问产品功能、政策、流程时使用。' +
    '返回标题、摘要和 docId。如果用户给了具体文档名，用 read_doc 而不是这个。',
  {
    query: z.string().min(1).describe('检索关键词，中英文均可'),
    limit: z.number().int().min(1).max(20).default(5).describe('返回条数'),
  },
  async ({ query, limit }, extra) => {
    const rows = await search(query, limit, userIdOf(extra))
    return { content: rows.map((r) => ({ type: 'text', text: format(r) })) }
  },
)

// —— Resource：用户/客户端选择读取，只读、URI 寻址
server.resource(
  'doc',
  new ResourceTemplate('kb://doc/{docId}', { list: undefined }),
  async (uri, { docId }) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await readDoc(String(docId)) }],
  }),
)

// —— Prompt：用户主动触发，可带参数
server.prompt(
  'summarize_doc',
  '把一份文档总结成三条要点',
  { docId: z.string() },
  ({ docId }) => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: \`请阅读 kb://doc/\${docId} 并总结成三条要点，每条不超过 40 字。\` },
    }],
  }),
)`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '判断口诀',
          text: '**"要不要参数、有没有副作用、该不该由模型自己决定"** —— 三个都是"是"就是 Tool。**"是一份能被 URI 指向的只读数据"** 就是 Resource。**"是一段固定的提示，用户想一键触发"** 就是 Prompt。拿不准时优先做成 Tool（最通用），但别忘了它需要鉴权。',
        },
      ],
    },

    {
      id: 's3',
      title: '传输与鉴权：stdio 的安全是免费的，HTTP 的不是',
      checkpoint: '把 stdio 的 server 改成 HTTP 端口，多出了哪些风险？',
      blocks: [
        {
          type: 'p',
          text: '传输方式的选择不是"哪个新用哪个"，而是"安全边界在哪里"。',
        },
        {
          type: 'table',
          head: ['', 'stdio', 'Streamable HTTP'],
          rows: [
            ['通信方式', '标准输入输出，父子进程', 'HTTP POST + 可选 SSE'],
            ['谁能连', '**只有启动它的那个进程**', '任何能访问该端口的人'],
            ['鉴权', '不需要（进程边界就是鉴权）', '**必须自己做**'],
            ['部署', '本机，随客户端启动', '可远程，多客户端共享'],
            ['适合', '本地工具、文件访问、个人使用', '团队共享、SaaS 集成、远程服务'],
          ],
        },
        {
          type: 'p',
          text: 'stdio 的安全性来自"进程边界"——你的 server 是客户端 fork 出来的子进程，能连上它的只有父进程。**一旦改成网络端口，这层隔离完全消失**，你必须补上：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'HTTP 传输必须做的四件事',
          code: `// 1. 鉴权：每个请求验证 token，解析出调用者身份
app.use('/mcp', async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const claims = await verifyJwt(token)      // 签名 + 过期 + 受众
  if (!claims) return res.status(401).json({ error: 'unauthorized' })
  req.mcp = { userId: claims.sub, tenantId: claims.tid, scopes: claims.scope }
  next()
})

// 2. 授权：scope 决定能调哪些工具
function requireScope(scope: string) {
  return (req, res, next) => {
    if (!req.mcp.scopes.includes(scope)) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}

// 3. 限流：按调用者，不是按 IP（IP 会被 NAT 合并）
app.use('/mcp', rateLimit({ keyGenerator: (req) => req.mcp.userId, max: 60, windowMs: 60_000 }))

// 4. 审计：谁、什么时候、调了什么、参数是什么、结果多大
app.use('/mcp', (req, res, next) => {
  const started = Date.now()
  res.on('finish', () => {
    audit.log({
      userId: req.mcp.userId,
      method: req.body?.method,
      tool: req.body?.params?.name,
      status: res.statusCode,
      ms: Date.now() - started,
    })
  })
  next()
})`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '三个致命错误',
          text: '① **监听 0.0.0.0 且不鉴权**——等于把内网工具暴露给整个互联网，扫描器几小时就能找到；② **用 API Key 但不校验受众**——A 租户的 key 能调 B 租户的数据；③ **把 token 放在 URL query 里**——会进访问日志、进 Referer、进浏览器历史。**token 只放 Authorization 头。**',
        },
        {
          type: 'p',
          text: '还有一个细节：**stdio server 的日志绝不能写 stdout**。stdout 是协议通道，写一行日志就会破坏 JSON-RPC 帧，客户端直接报解析错误。**日志一律写 stderr 或文件。** 这个坑每个写 stdio server 的人都会踩一次。',
        },
      ],
    },

    {
      id: 's4',
      title: '工具设计：MCP 版本和裸工具有什么不同',
      checkpoint: '同样的工具，为什么在 MCP 里描述要写得更啰嗦？',
      blocks: [
        {
          type: 'p',
          text: '第八课讲过的原则（名字即意图、参数收敛、错误可指导）在 MCP 里全部适用，但**还要加三条**——因为你的 server 会被多个客户端、多种模型使用，你无法针对某一个模型调优。',
        },
        {
          type: 'table',
          head: ['额外要求', '为什么', '怎么做'],
          rows: [
            ['描述要自解释', '你无法预知哪个模型会读它', '写清"何时用""返回什么""和相邻工具的区别"'],
            ['返回值要极小', '不同客户端的上下文预算不同', '只返回决策必需字段，长文本截断并标注'],
            ['错误要机器可读', '客户端可能要做自动重试', '用 `isError` + 结构化 error code，不要只给一句话'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '结构化错误返回',
          note: 'MCP 的工具结果支持 isError 标记。把"业务失败"和"协议失败"分开：业务失败返回 isError 的结果（模型能看到并修正），协议失败抛异常。',
          code: `server.tool(
  'get_order',
  '查询当前用户自己的订单详情。用户给出订单号时使用。' +
    '不返回他人订单；订单不存在和无权访问返回相同的错误。',
  { orderNo: z.string().regex(/^[A-Z]\\d{4}$/).describe('订单号，格式如 A1024') },
  async ({ orderNo }, extra) => {
    const userId = userIdOf(extra)     // 身份来自传输层，不是参数

    const order = await db.order.findUnique({ where: { orderNo } })
    if (!order || order.userId !== userId) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ code: 'NOT_FOUND', message: '未找到该订单' }),
        }],
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          orderNo: order.orderNo,
          status: order.status,
          paidAt: order.paidAt,
          // 只返回决策需要的字段，不要整个 order 对象
        }),
      }],
    }
  },
)`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '不要在描述里承诺你做不到的事',
          text: '写"支持模糊匹配订单号"但实际只做精确匹配，模型会传模糊值然后失败，然后重试，然后放弃。**工具描述是契约**，写进去的每个能力都必须真的实现。不确定的能力宁可不写。',
        },
        {
          type: 'p',
          text: '版本演进也要提前想：**工具名一旦发布就不要改**（客户端可能缓存了工具列表）。要改语义就加新工具 `search_docs_v2`，旧的标记 deprecated 并在描述里引导。这比"直接改行为"安全得多——**直接改行为会让所有已安装的客户端在不知情的情况下改变行为**。',
        },
      ],
    },

    {
      id: 's5',
      title: '安全：MCP Server 是被信任的代码',
      checkpoint: '你的 server 有个"读文件"工具，参数是路径。最危险的输入是什么？',
      blocks: [
        {
          type: 'p',
          text: 'MCP Server 的风险等级和浏览器插件同级。四类风险必须逐个堵：',
        },
        {
          type: 'table',
          head: ['风险', '场景', '防御'],
          rows: [
            ['路径穿越', '`read_file({path: "../../etc/passwd"})`', '`path.resolve` 后校验前缀；只允许白名单目录'],
            ['越权访问', '参数里带 userId / tenantId', '身份只从传输层取，参数里不接受身份'],
            ['注入传导', '工具返回的网页内容里藏了指令', '返回值标记来源，客户端/模型侧做隔离'],
            ['供应链', '依赖了恶意 npm 包', '锁版本、审依赖、最小依赖集'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '路径安全的正确写法',
          code: `import path from 'node:path'
import { realpath } from 'node:fs/promises'

const ROOT = await realpath('/srv/kb')

async function safePath(input: string) {
  // 1. resolve 会消掉 ../ 和多余的 /
  const target = await realpath(path.resolve(ROOT, input)).catch(() => null)
  if (!target) throw new Error('路径不存在')

  // 2. 必须做"带分隔符"的前缀校验，否则 /srv/kb-evil 会被误判为在 /srv/kb 下
  const rel = path.relative(ROOT, target)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('路径越界')
  }
  return target
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '`startsWith(ROOT)` 是个经典 bug',
          text: '`"/srv/kb-evil/x".startsWith("/srv/kb")` 返回 `true`。必须用 `path.relative` 判断，或者拼上分隔符再比（`ROOT + path.sep`）。这类 bug 在安全审计里反复出现，因为它在正常输入下完全看不出问题。',
        },
        {
          type: 'p',
          text: '审计留痕是另一条硬要求。每次工具调用至少要记：**谁调的（userId/tenantId）、调了什么（工具名）、参数摘要（脱敏后）、结果规模（不是内容）、耗时、成功与否**。出事时这是唯一的追溯依据。**不要记完整参数和返回值**——它们可能含 PII，而且量大。',
        },
        {
          type: 'p',
          text: '最后一个容易忽略的：**MCP Server 不该能"主动说话"**。它只能在被调用时返回内容。如果你的 server 设计成"定期推送消息给客户端"，那它就成了一个能主动注入内容的通道——这是设计层面的注入风险。**保持"请求-响应"模型，不要发明推送。**',
        },
      ],
    },

    {
      id: 's6',
      title: '调试与发布',
      checkpoint: '客户端说"工具没被调用"，你怎么排查？',
      blocks: [
        {
          type: 'p',
          text: 'MCP 的调试比普通 HTTP 麻烦，因为你不知道是"模型没选它""客户端没转发"还是"server 报错了"。标准排查顺序：',
        },
        {
          type: 'flow',
          title: '五步排查',
          ascii: `① 客户端能看到工具列表吗？
   → 看不到：server 没启动 / initialize 失败 / stdout 被日志污染
   → 用官方 Inspector 直连 server 验证

② 能看到，但模型不调？
   → 描述没写"何时用" / 名字太泛 / 和别的工具重名

③ 调了但参数错？
   → schema 太宽（缺 enum / min / max）/ 描述没说格式

④ 参数对但 server 报错？
   → 看 stderr 日志；stdio 模式下这是唯一能看到错误的地方

⑤ 都正常但结果不对？
   → 返回值太大被截断 / 模型没读懂返回格式 / 字段名不直观`,
        },
        {
          type: 'code',
          lang: 'bash',
          title: '用 Inspector 独立验证 server',
          code: `# 不依赖任何客户端，直接连 server 看它到底暴露了什么
npx @modelcontextprotocol/inspector node ./dist/server.js

# 或者手工发一条 JSON-RPC（stdio 模式）
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node ./dist/server.js

# 检查 stdout 有没有被污染（这是最常见的问题）
node ./dist/server.js < /dev/null | head -c 200`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '先跑 Inspector，再怪客户端',
          text: '90% 的"MCP 不工作"是 server 自己的问题：初始化失败、工具列表返回格式不对、stdout 被日志污染。**用 Inspector 直连能立刻区分"server 的问题"和"客户端/模型的问题"**，省下大量来回猜测的时间。',
        },
        {
          type: 'table',
          head: ['发布前检查', '要点'],
          rows: [
            ['版本号', '语义化版本；工具名不变，行为变更要发大版本'],
            ['能力声明', '`initialize` 时如实声明支持哪些原语，不要声明了却返回空'],
            ['错误处理', '任何异常都不能让进程崩；未捕获异常会直接断开连接'],
            ['日志', 'stdio 模式一律写 stderr；生产环境结构化日志'],
            ['文档', 'README 写清"需要什么权限""会访问什么数据""怎么撤销授权"'],
            ['卸载', '提供"清理数据"的说明——用户卸载后数据还在，是合规问题'],
          ],
        },
      ],
    },

    {
      id: 's7',
      title: '什么时候不该写 MCP Server',
      checkpoint: '一个只有你自己用、只调一次的内部脚本，值得做成 MCP 吗？',
      blocks: [
        {
          type: 'p',
          text: 'MCP 有明确的成本：进程管理、协议实现、鉴权、审计、版本维护、文档。以下情况**不值得**：',
        },
        {
          type: 'list',
          items: [
            '**只有一个客户端会用**：直接在那个应用里写个函数就行，MCP 的复用价值为零。',
            '**逻辑极简**：一个"返回当前时间"的 server，不如内置。',
            '**需要极低延迟**：多一层进程/网络通信，对毫秒级场景不划算。',
            '**数据极度敏感且无法隔离**：如果你的 server 必须拿到主库全权限才能工作，那它不该存在——应该改造数据访问方式。',
            '**只是想把内部 API 暴露给 AI**：先问"这个 API 该不该给 AI 用"，而不是"怎么包装它"。',
          ],
        },
        {
          type: 'p',
          text: '该做的信号也很明确：',
        },
        {
          type: 'table',
          head: ['信号', '说明'],
          rows: [
            ['多个客户端要复用同一能力', 'N+M 的价值成立'],
            ['需要独立审计和限流', '进程/服务边界带来这个能力'],
            ['权限需要和宿主隔离', 'server 只能拿到它该拿的权限'],
            ['能力需要独立演进', '不用等宿主发版'],
            ['要给别人用（生态）', '协议是分发的前提'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '最重要的一条：不要为了"看起来现代"而做',
          text: 'MCP 是 2024 年之后才流行起来的协议，很多团队做它是因为"别人都在做"。**先问：包一层 MCP 之后，谁受益？** 如果答案是"没有具体的人"，那就不该做。技术选型的标准永远是"解决了谁的什么问题"，不是"是否时髦"。',
        },
        {
          type: 'qa',
          q: '那如果我要给公司内部做一个统一的 AI 工具层呢？',
          a: '那 MCP 是合理选择，但要注意三件事：① **先做工具治理，再做协议**——哪些数据能暴露、谁能调、要不要审批，这些想清楚了再写代码；② **不要做一个"万能 server"**，按领域拆（知识库 / 工单 / 数据查询），每个独立鉴权和限流，一个出问题不影响其他；③ **从只读开始**，跑三个月没问题再考虑写操作，写操作一律要 HITL。**先证明它不会被滥用，再给它更大的权限。**',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '选原语',
      points: 10,
      prompt: '你要让 AI 能读取公司 wiki 上的任意一篇文章。应该做成什么？',
      options: [
        { id: 'a', text: 'Tool：`read_wiki_page({ pageId })`' },
        { id: 'b', text: 'Resource：`wiki://page/{pageId}`，只读、URI 寻址、由用户/客户端选择' },
        { id: 'c', text: 'Prompt：`read_page` 模板' },
        { id: 'd', text: '不需要 MCP，直接让模型联网' },
      ],
      answer: ['b'],
      hints: [
        '问三个问题：要不要参数？有没有副作用？该不该由模型自己决定读哪篇？',
        '"读取一篇文章"是只读的、能被 URI 指向的、通常由用户指定要读哪篇。',
        'b 符合 Resource 的定义：只读、URI 寻址、用户/客户端选择。做成 Tool 也可以工作，但语义上它是"数据"而不是"动作"，而且 Tool 会被模型自主调用（有越权读风险）。',
      ],
      explanation: '正确答案是 b。Resource 的语义就是"可被 URI 指向的只读数据"，由用户选择而不是模型自主决定。',
      approach: [
        '判断是不是只读数据 → 是，倾向 Resource',
        '判断能不能用 URI 寻址 → 能，Resource 更合适',
        '判断该由谁决定读哪个 → 用户指定，Resource',
        '如果还需要"搜索"能力，那个做成 Tool',
      ],
      knowledge: ['MCP 原语', 'Resource', 'URI 寻址'],
      pitfalls: [
        '把所有能力都做成 Tool',
        '把只读数据做成 Tool，增加越权风险',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: 'HTTP 传输必须补什么',
      points: 15,
      prompt: '把一个 stdio 的 MCP Server 改成监听端口的 Streamable HTTP 服务，必须补上哪些？（多选）',
      options: [
        { id: 'a', text: '鉴权：每个请求验证 token，解析出调用者身份' },
        { id: 'b', text: '授权：按 scope 限制能调哪些工具' },
        { id: 'c', text: '限流：按调用者（不是按 IP）' },
        { id: 'd', text: '审计日志：谁调了什么、什么时候、结果如何' },
        { id: 'e', text: '什么都不用加，协议自带安全' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        'stdio 的安全性来自进程边界，改成端口后这层隔离消失了。',
        '想想"任何能访问这个端口的人"能做什么。',
        'a 是身份，b 是权限，c 是防滥用，d 是事后追溯——四件事缺一不可。e 完全错误，MCP 协议本身不提供传输层安全。',
      ],
      explanation: 'a、b、c、d 全部必须。stdio 的免费安全在改成网络端口后全部消失。',
      approach: [
        '鉴权：Bearer token + 签名/过期/受众校验',
        '授权：scope 到工具粒度',
        '限流：按 userId 而不是 IP（NAT 会合并）',
        '审计：调用者、工具、参数摘要、耗时、结果规模',
        '绝不监听 0.0.0.0 且无鉴权',
      ],
      knowledge: ['MCP 传输', '鉴权', '授权', '审计'],
      pitfalls: [
        '以为 MCP 协议自带安全',
        '按 IP 限流（NAT 后大量用户共享 IP）',
        'token 放 URL query',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '路径安全',
      points: 15,
      prompt: '补全路径校验逻辑。要求：解析 `../`、拒绝越界、正确处理 `/srv/kb-evil` 这种前缀相同的目录。',
      templateLang: 'ts',
      template: `const ROOT = await realpath('/srv/kb')

async function safePath(input: string) {
  const target = await realpath(path.{{f1}}(ROOT, input))
  const rel = path.{{f2}}(ROOT, target)

  // 越界判断：必须用相对路径，不能用字符串 startsWith
  if (rel.startsWith('{{f3}}') || path.isAbsolute(rel)) {
    throw new Error('路径越界')
  }
  return target
}

// 为什么不能用 target.startsWith(ROOT)？
// 因为 '/srv/kb-{{f4}}/x'.startsWith('/srv/kb') 会返回 true`,
      blanks: [
        { id: 'f1', label: '拼接并归一化路径的方法', accept: ['resolve'], width: 90 },
        { id: 'f2', label: '算相对路径的方法', accept: ['relative'], width: 90 },
        { id: 'f3', label: '越界的标志', accept: ['..', '../'], width: 60 },
        { id: 'f4', label: '举例的同前缀目录后缀', accept: ['evil', 'backup', 'old', 'tmp'], width: 80 },
      ],
      hints: [
        '`path.resolve` 会消掉 `../` 和多余的分隔符，`path.relative` 会算出相对路径。',
        '越界时相对路径以 `..` 开头。',
        '① `path.resolve` ② `path.relative` ③ `..` ④ 任意后缀（如 `evil`）。核心：**不能用 `startsWith` 判断前缀**，`/srv/kb-evil` 会误判为在 `/srv/kb` 下。必须用 `path.relative` 看是否以 `..` 开头。',
      ],
      explanation: '路径穿越是最常见的 MCP 工具漏洞。`realpath` + `resolve` + `relative` 三步是标准做法，还要注意符号链接（`realpath` 会解开）。',
      approach: [
        '用 `realpath` 解析符号链接，得到真实路径',
        '用 `path.resolve` 归一化 `../`',
        '用 `path.relative` 算相对路径',
        '相对路径以 `..` 开头或为绝对路径 → 拒绝',
      ],
      knowledge: ['路径穿越', 'path.relative', '符号链接'],
      pitfalls: [
        '用 `startsWith(ROOT)` 判断（同前缀目录会绕过）',
        '不调 realpath，符号链接可以指向目录外',
        '只在字符串层面替换 `../`（编码变形会绕过）',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现 JSON-RPC 分发',
      points: 20,
      prompt: '实现 `handleRpc(msg, handlers)`。`msg` 是 JSON-RPC 2.0 请求对象，`handlers` 是 `{ [method]: (params) => result }`。返回响应对象：成功 `{jsonrpc:"2.0", id, result}`；方法不存在返回错误码 `-32601`；handler 抛错返回 `-32603` 且 message 为 `"Internal error"`（不泄露原始错误）；`id` 缺失时按通知处理，返回 `null`。',
      starter: `function handleRpc(msg, handlers) {
  // TODO
  return null
}

return handleRpc`,
      checks: [
        { name: '正常调用返回结果', expr: "(() => { const r = result({jsonrpc:'2.0',id:1,method:'add',params:{a:2,b:3}}, {add: (p) => p.a + p.b}); return r.jsonrpc === '2.0' && r.id === 1 && r.result === 5 })()" },
        { name: '未知方法返回 -32601', expr: "result({jsonrpc:'2.0',id:2,method:'nope'}, {}).error.code === -32601" },
        { name: 'handler 抛错返回 -32603', expr: "result({jsonrpc:'2.0',id:3,method:'boom'}, {boom: () => { throw new Error('secret detail') }}).error.code === -32603" },
        { name: '不泄露原始错误信息', expr: "result({jsonrpc:'2.0',id:4,method:'boom'}, {boom: () => { throw new Error('secret detail') }}).error.message === 'Internal error'" },
        { name: '通知（无 id）返回 null', expr: "result({jsonrpc:'2.0',method:'add',params:{a:1,b:1}}, {add: (p) => p.a + p.b}) === null" },
        { name: '无 params 时不炸', expr: "result({jsonrpc:'2.0',id:5,method:'ping'}, {ping: () => 'pong'}).result === 'pong'" },
      ],
      solution: `function handleRpc(msg, handlers) {
  const isNotification = msg.id === undefined || msg.id === null

  const reply = (body) => {
    if (isNotification) return null
    return { jsonrpc: '2.0', id: msg.id, ...body }
  }

  const fn = handlers[msg.method]
  if (typeof fn !== 'function') {
    return reply({ error: { code: -32601, message: 'Method not found: ' + msg.method } })
  }

  try {
    return reply({ result: fn(msg.params ?? {}) })
  } catch (e) {
    return reply({ error: { code: -32603, message: 'Internal error' } })
  }
}`,
      hints: [
        '三段：判断是不是通知 → 找 handler → 执行并包错误。',
        '通知（没有 id）不需要返回响应，返回 null。',
        '完整实现：先算 `isNotification`；写一个 `reply` 辅助函数统一加 `jsonrpc` 和 `id`，通知时返回 null；找不到 handler 返回 -32601；执行包 try/catch，catch 里返回固定 `Internal error`（原始信息只写日志，不回给客户端）。',
      ],
      explanation: 'JSON-RPC 的两个细节最容易被忽略：**通知（无 id）不返回响应**，以及**错误信息不能泄露内部细节**。后者在 MCP 场景里尤其重要，因为错误会进模型上下文。',
      approach: [
        '判断 id 是否存在，决定要不要回复',
        '查 handlers，不存在返回 -32601',
        '执行 handler，params 缺省用 {}',
        'catch 里返回固定的 -32603 + "Internal error"',
        '原始错误只写日志',
      ],
      knowledge: ['JSON-RPC', '错误码', '通知语义', '信息泄露'],
      pitfalls: [
        '给通知也返回响应（协议违规）',
        '把 `e.message` 直接回给客户端',
        'params 为 undefined 时直接访问属性导致报错',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: 'MCP 相比裸 function calling，最重要的额外价值是？',
        options: [
          { id: 'a', text: '调用更快' },
          { id: 'b', text: '独立进程/服务带来的责任边界：自己的身份、权限、日志、生命周期' },
          { id: 'c', text: '支持更多模型' },
          { id: 'd', text: '代码更短' },
        ],
        answer: 'b',
        why: 'N+M 复用是表面收益，真正重要的是"工具不再共享宿主的全部权限"，这让安全边界成为可能。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: 'Tools / Resources / Prompts 的区分标准是？',
        options: [
          { id: 'a', text: '数据大小' },
          { id: 'b', text: '控制权在谁手里：模型决定 / 客户端用户选择 / 用户主动触发' },
          { id: 'c', text: '是否需要鉴权' },
          { id: 'd', text: '返回格式' },
        ],
        answer: 'b',
        why: '控制权决定了安全模型。Tools 会被模型自主调用，所以必须自己鉴权；Resources 由用户选择；Prompts 由用户触发。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: 'stdio 模式的 server 把日志写到 stdout 会怎样？',
        options: [
          { id: 'a', text: '没问题' },
          { id: 'b', text: '会破坏 JSON-RPC 帧，客户端解析失败，连接直接断掉' },
          { id: 'c', text: '日志会丢失' },
          { id: 'd', text: '会变慢' },
        ],
        answer: 'b',
        why: 'stdout 是协议通道，不是日志通道。日志必须写 stderr。这是写 stdio server 最常见的一个坑。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '`target.startsWith(ROOT)` 用来判断路径是否在目录内，有什么问题？',
        options: [
          { id: 'a', text: '性能差' },
          { id: 'b', text: '`/srv/kb-evil/x` 会被误判为在 `/srv/kb` 下，造成路径穿越' },
          { id: 'c', text: '不支持 Windows' },
          { id: 'd', text: '没问题' },
        ],
        answer: 'b',
        why: '字符串前缀不等于路径前缀。必须用 `path.relative` 判断结果是否以 `..` 开头，或拼上分隔符再比。',
        stepId: 's5',
      },
      {
        id: 'q5',
        stem: 'MCP Server 的工具返回错误时，正确做法是？',
        options: [
          { id: 'a', text: '直接 throw，让客户端看到堆栈' },
          { id: 'b', text: '返回 `isError: true` + 结构化 error code，让模型能理解并修正' },
          { id: 'c', text: '返回空数组' },
          { id: 'd', text: '静默失败' },
        ],
        answer: 'b',
        why: '结构化错误能让模型自我修正。直接 throw 会丢失上下文；静默失败会让模型以为成功了。',
        stepId: 's4',
      },
      {
        id: 'q6',
        stem: '什么情况下不该做成 MCP Server？',
        options: [
          { id: 'a', text: '工具超过 10 个' },
          { id: 'b', text: '只有一个客户端会用、逻辑极简、或只是想把内部 API 原样暴露' },
          { id: 'c', text: '需要鉴权' },
          { id: 'd', text: '用 TypeScript 写' },
        ],
        answer: 'b',
        why: 'MCP 有进程管理、协议实现、鉴权、审计、版本维护的成本。没有复用需求或没有治理设计时，包一层只是增加复杂度。',
        stepId: 's7',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：对外暴露 MCP Server',
    contributes:
      '这一课把项目的检索能力包成一个 MCP Server，让别的 AI 客户端也能用你的知识库——同时把鉴权、审计、限流三件套补齐。',
    tasks: [
      '实现 stdio 版本的 MCP Server，暴露 3 个工具（search_docs / read_doc / list_recent）+ 1 个 Resource（kb://doc/{id}）',
      '用 Inspector 验证：工具列表正确、参数校验生效、错误返回结构化',
      '改成 Streamable HTTP 传输，加 Bearer token 鉴权（签名 + 过期 + 受众校验）',
      '按 scope 授权：只读 scope 不能调写工具；按 userId 限流（60 次/分钟）',
      '实现审计日志：调用者、工具名、参数摘要（脱敏）、结果规模、耗时、状态',
      '实现路径安全：realpath + resolve + relative 三重校验，用 10 个恶意路径测试',
      '写 README：声明需要什么权限、访问什么数据、如何撤销授权、卸载后如何清理数据',
    ],
    done: '别的客户端（如 IDE 插件）能装上你的 server 并成功检索；用过期 token 调用返回 401；用低权限 token 调写工具返回 403；`../../etc/passwd` 被拒绝；审计日志里能查到每一次调用的完整记录。',
  },

  further: [
    { text: 'Model Context Protocol 官方规范 · 生命周期 / 传输 / 原语' },
    { text: 'MCP Inspector · 独立调试 server 的官方工具' },
    { text: '知识地图 04 Agent · MCP（/guide/04-agent）' },
  ],
}
