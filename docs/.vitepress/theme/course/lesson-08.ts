import type { Lesson } from './types'

/**
 * 第八课：Agent 智能体
 *
 * 核心立场：Agent 不是一个更聪明的模型，是一个带工具和循环的普通程序。
 * 可靠性来自边界（步数、成本、权限），不来自 prompt 里写"请谨慎"。
 */
export const lesson08: Lesson = {
  id: 'L08',
  moduleId: 'agent',
  order: 8,
  path: '/learn/08-agent',
  title: 'Agent 智能体：让模型调用工具，且失败时能收场',
  subtitle: 'Agent 的能力上限由工具决定，可靠性上限由熔断和权限决定。',
  minutes: 85,
  level: '进阶',
  outcome: '能写出一个有明确边界、工具设计合理、失败可恢复的 Agent，并判断某个需求根本不该用 Agent。',
  goals: [
    '说清 Agent 和 Workflow 的本质区别，以及什么时候必须用后者',
    '把工具设计成"模型能正确调用"的形状，而不是"人类觉得合理"的形状',
    '理解 ReAct 循环每一步在做什么，以及上下文为什么会膨胀',
    '给 Agent 装上步数、成本、时间三重熔断',
    '设计人类确认点（HITL），让危险操作必须过人手',
    '用 MCP 把工具暴露给别的客户端，并知道该暴露什么、不该暴露什么',
  ],
  prereqs: [
    '学过第六课，能写出结构化的 prompt',
    '学过第七课，理解检索是 Agent 的一种工具',
    '调过 function calling / tool use 接口',
  ],

  steps: [
    {
      id: 's1',
      title: 'Agent 不是"会思考的 AI"，是一个 while 循环',
      checkpoint: '同样一件事，什么情况下用 Agent，什么情况下老老实实写死流程？',
      blocks: [
        {
          type: 'p',
          text: '把 Agent 神秘化是理解它的最大障碍。去掉包装，一个 Agent 就是：',
        },
        {
          type: 'flow',
          title: 'Agent 的全部机制',
          ascii: `messages = [system, user]

while (true) {
  reply = llm(messages, tools)          ← 唯一的"智能"来源

  if (reply 没有工具调用) break          ← 终止条件

  for (call of reply.toolCalls) {
    result = execute(call)               ← 普通函数，没有智能
    messages.push(call, result)          ← 结果回灌，进入下一轮
  }
}

return reply.content`,
        },
        {
          type: 'p',
          text: '**所有"智能"都在那一次 `llm()` 里，循环本身是笨的。** 这个认知很重要，因为它告诉你优化的方向：要么改模型看到的东西（prompt、工具列表、历史裁剪），要么改工具的能力，**改循环结构基本没用**。',
        },
        {
          type: 'table',
          head: ['', 'Workflow（工作流）', 'Agent（智能体）'],
          rows: [
            ['路径', '预先写死，A→B→C', '运行时决定，走几步、走哪条未知'],
            ['可预测性', '高，每步都能画出来', '低，同样输入可能走不同路径'],
            ['调试', '看日志就知道卡在哪', '要看完整对话轨迹才能复现'],
            ['成本', '稳定，可估算', '波动大，可能 3 步也可能 30 步'],
            ['适合', '步骤明确、需要审计、高频调用', '开放问题、需要探索、低频复杂任务'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '最常见的架构错误',
          text: '**把明确流程做成 Agent。** "读工单 → 分类 → 查知识库 → 回复"这四步是固定的，写成 workflow 一百行代码、延迟 2 秒、成本可估。做成 Agent 之后：延迟 8 秒、成本 5 倍、偶尔跳步、出错难复现，而且没有任何收益——因为路径本来就是确定的。',
        },
        {
          type: 'analogy',
          title: '和 Vue Router 对照',
          text: 'Workflow 像**静态路由表**：路径写死，`/user/:id` 一定进 UserDetail。Agent 像**运行时 `router.push(动态计算的目标)`**：灵活，但你没法在构建时知道会去哪。**能用静态路由解决的问题，不要用动态跳转。**',
        },
      ],
    },

    {
      id: 's2',
      title: '工具设计：你在给模型写 API，不是给人写',
      checkpoint: '同一个能力，为什么"一个万能工具"比"五个专用工具"更容易失败？',
      blocks: [
        {
          type: 'p',
          text: '工具描述是**prompt 的一部分**，而且是被很多人忽略的那部分。模型选不选这个工具、参数填得对不对，几乎完全由 `name` + `description` + `parameters` 决定。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '❌ 坏工具：模型不知道什么时候该用、参数该怎么填',
          code: `{
  name: "query",
  description: "查询数据",
  parameters: {
    type: "object",
    properties: {
      sql: { type: "string" },
      options: { type: "object" }
    }
  }
}

// 问题：
// 1. "query" 太泛 —— 模型不知道它和 search_docs 的区别
// 2. 让模型写 SQL —— 等于把数据库权限交给它，且必然写出错误 SQL
// 3. options 是个自由 object —— 模型会瞎编字段
// 4. 没有说明返回什么 —— 模型不知道结果能不能回答用户`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: '✅ 好工具：意图明确、参数受限、错误可指导',
          code: `{
  name: "search_orders",
  description:
    "按条件查询订单列表。当用户询问'我的订单''某笔订单状态''退款进度'时使用。" +
    "只返回当前登录用户自己的订单。最多返回 20 条，按创建时间倒序。" +
    "如果用户给的是订单号，用 get_order_detail 而不是这个工具。",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["pending", "paid", "shipped", "refunding", "closed"],
        description: "订单状态。用户没说就不要传，不要猜。"
      },
      created_after: {
        type: "string",
        description: "ISO 8601 日期，如 2026-03-01。用于'最近''上个月'这类表达。"
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "返回条数，默认 5"
      }
    },
    required: []
  }
}`,
        },
        {
          type: 'table',
          head: ['原则', '做法', '为什么'],
          rows: [
            ['名字即意图', '`search_orders` 而不是 `query`', '模型靠名字做初筛'],
            ['描述写"何时用"', '列出触发场景，并指出和相邻工具的区别', '模型最常犯的错是选错工具'],
            ['参数能少则少', '必需的才 required，其余给默认值', '每多一个参数就多一个填错的机会'],
            ['用 enum 收敛', '状态、类型这类有限取值一律 enum', '自由字符串会被编造成 `已完成` 这种值'],
            ['不要传身份', '用户 id 从服务端上下文取，绝不做参数', '模型可以被诱导传别人的 id'],
            ['返回要精简', '只返回模型决策需要的字段', '返回 200 行 JSON 会挤爆上下文'],
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '绝不能让模型传的两个东西',
          text: '① **身份**（user_id、tenant_id）——必须从服务端会话取，否则一句"帮我查用户 1002 的订单"就能越权；② **原始查询语句**（SQL、shell 命令、URL）——等于把执行权限交给模型。要暴露的是"能力"（按状态查订单），不是"通道"（执行任意 SQL）。',
        },
        {
          type: 'p',
          text: '还有一点常被忽略：**错误信息要写给模型看**。工具失败时返回 `{ ok: false, error: "status 必须是 pending|paid|shipped|refunding|closed 之一，你传的是『已完成』" }`，模型下一轮就能自己修正。返回 `{ error: "500" }` 它就只会重试同样的错误。**错误信息是给模型的自愈指令。**',
        },
      ],
    },

    {
      id: 's3',
      title: 'ReAct 循环：思考、行动、观察',
      checkpoint: '为什么跑了几轮之后 Agent 会"忘记"最初的任务？',
      blocks: [
        {
          type: 'p',
          text: 'ReAct = Reasoning + Acting。每一轮，模型输出"我要做什么"（thought）和"调用哪个工具"（action），系统执行后把结果（observation）塞回消息列表，进入下一轮。',
        },
        {
          type: 'code',
          lang: 'text',
          title: '一次真实的三轮轨迹',
          code: `[user]  帮我看看订单 A1024 为什么还没发货

[assistant] thought: 先查订单详情，确认状态和预计发货时间
            action: get_order_detail({ orderNo: "A1024" })

[tool]      { status: "paid", paidAt: "2026-03-18", items: [...],
              warehouse: "WH-03", promisedShipAt: "2026-03-20" }

[assistant] thought: 已付款但未发货，且已过承诺时间。查一下仓库 WH-03 有没有异常
            action: get_warehouse_status({ code: "WH-03" })

[tool]      { status: "maintenance", note: "分拣线检修，预计 3-21 恢复" }

[assistant] thought: 原因找到了，不需要再调工具
            answer: 订单已付款，但所在仓库 WH-03 因分拣线检修暂停出货，
                    预计 3 月 21 日恢复，你的订单会在恢复后 24 小时内发出。`,
        },
        {
          type: 'p',
          text: '注意每轮的工具结果都**永久留在 messages 里**。这是上下文膨胀的根源，也是"忘记任务"的原因：',
        },
        {
          type: 'table',
          head: ['轮次', 'messages 里新增', '累积 token（估）'],
          rows: [
            ['第 1 轮', 'system + user', '约 800'],
            ['第 2 轮', 'assistant thought + tool call + 订单 JSON', '约 2,500'],
            ['第 3 轮', 'thought + call + 仓库状态', '约 3,400'],
            ['第 8 轮', '又 5 次工具结果，其中一次返回了 60 条记录', '约 18,000'],
            ['第 12 轮', '上下文塞满，最前面的用户原话被挤到"中间偏前"', '约 32,000'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '"忘记任务"不是模型变笨了',
          text: '是原始任务在上下文里的**相对权重**被稀释了。30K token 里，用户那句话只占 20 token，模型注意力被十几条工具结果分散，就容易跑偏——去研究某个无关字段，或者重复已经做过的查询。解法不是"提醒它认真点"，而是**裁剪历史**：保留 system + 原始任务 + 最近 3 轮完整结果，更早的压缩成一行摘要。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '历史裁剪：保住任务，压缩过程',
          code: `function trimHistory(messages: Msg[], budget = 24_000): Msg[] {
  const keepHead = messages.slice(0, 2)          // system + 原始任务，永不裁剪
  const tail = messages.slice(2)

  // 从最近往前累加，超预算就停
  const kept: Msg[] = []
  let used = estimateTokens(keepHead)
  for (let i = tail.length - 1; i >= 0; i--) {
    const t = estimateTokens([tail[i]])
    if (used + t > budget) break
    kept.unshift(tail[i])
    used += t
  }

  // 被丢掉的中间部分压成一条摘要，而不是直接删除
  const dropped = tail.slice(0, tail.length - kept.length)
  if (dropped.length > 0) {
    const summary = dropped
      .filter((m) => m.role === 'tool')
      .map((m) => \`- 已调用工具，结果摘要：\${summarize(m.content)}\`)
      .join('\\n')
    return [
      ...keepHead,
      { role: 'system', content: \`[此前的操作记录，已压缩]\\n\${summary}\` },
      ...kept,
    ]
  }
  return messages
}`,
        },
        {
          type: 'p',
          text: '另外两个细节：**工具结果要在源头就截断**（`limit: 20` 而不是返回全表，长文本截到 2000 字符），**重复调用要检测**（同一个工具 + 同样参数出现第二次，直接返回"你已经调用过，结果是……，请换一种方式或直接回答"）。这两条能挡掉一大半死循环。',
        },
      ],
    },

    {
      id: 's4',
      title: '工具调用的可靠性：校验、超时、重试的分寸',
      checkpoint: '工具报错时，什么情况该重试，什么情况重试只会让事情更糟？',
      blocks: [
        {
          type: 'p',
          text: '模型给的参数**一定会错**，这不是概率问题，是必然。所以每个工具入口都必须有运行时校验，而且要区分两类失败：',
        },
        {
          type: 'table',
          head: ['失败类型', '例子', '怎么处理'],
          rows: [
            ['参数不合法', 'status 传了"已完成"，limit 传了 -1', '不执行，返回带正确取值范围的错误，让模型改'],
            ['资源不存在', '订单号查不到', '不重试，返回"未找到"，让模型告诉用户或换条件'],
            ['暂时性故障', '数据库连接超时、下游 503', '可重试 1~2 次，带指数退避'],
            ['权限不足', '用户查别人的订单', '不重试，不暴露"存在但无权"（这本身就是信息泄露）'],
            ['副作用已生效', '支付已扣款、邮件已发出', '**绝不重试**，先查状态再决定'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '带校验和错误归一化的工具执行器',
          note: '关键在 retryable 这个字段——它把"该不该重试"的判断从模型手里拿走，交给代码。模型没有能力判断下游是不是 503。',
          code: `type ToolResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; retryable: boolean }

async function executeTool(
  tool: Tool,
  rawArgs: unknown,
  ctx: { userId: string; signal: AbortSignal },
): Promise<ToolResult> {
  // 1. 参数校验 —— 失败信息要具体到"哪个字段、该填什么"
  const parsed = tool.schema.safeParse(rawArgs)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => \`\${i.path.join('.')}: \${i.message}\`)
      .join('; ')
    return { ok: false, error: \`参数不合法：\${detail}\`, retryable: true }
  }

  // 2. 执行，带超时
  try {
    const value = await withTimeout(
      tool.run(parsed.data, ctx),
      tool.timeoutMs ?? 8000,
    )
    return { ok: true, value: truncate(value, tool.maxResultChars ?? 4000) }
  } catch (e) {
    if (e instanceof NotFoundError) {
      return { ok: false, error: \`未找到：\${e.message}\`, retryable: false }
    }
    if (e instanceof ForbiddenError) {
      // 注意措辞：不确认资源是否存在
      return { ok: false, error: '无权访问该资源', retryable: false }
    }
    if (e instanceof UpstreamError) {
      return { ok: false, error: \`下游服务暂时不可用，请稍后重试\`, retryable: true }
    }
    // 未知错误：不把堆栈给模型（可能含内部信息）
    logger.error({ err: e, tool: tool.name }, 'tool failed')
    return { ok: false, error: '工具执行失败', retryable: false }
  }
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '未知错误不要原样回给模型',
          text: '数据库错误里常带表名、字段名、甚至 SQL 片段；堆栈里带文件路径和内部服务地址。这些东西一旦进了模型上下文，就可能出现在给用户的回答里。**对外一句话，对内完整日志。**',
        },
        {
          type: 'p',
          text: '还有个好用的小技巧：**并行工具调用**。如果模型一轮里请求了三个互不依赖的查询（查订单、查物流、查工单），用 `Promise.allSettled` 一起跑，延迟从 3×T 变成 1×T。判断"互不依赖"很简单：都是只读工具，且没有共享参数。**有副作用的工具一律串行。**',
        },
      ],
    },

    {
      id: 's5',
      title: '执行边界：沙箱、最小权限、人类确认',
      checkpoint: 'Agent 要"帮用户清理临时文件"，你敢直接给它 `fs.rm` 吗？',
      blocks: [
        {
          type: 'p',
          text: '一旦 Agent 能执行代码或操作真实系统，威胁模型就变了：**攻击者不再需要攻破你的服务器，只需要在你的输入里藏一句话。** 三条边界必须同时存在。',
        },
        {
          type: 'h',
          text: '边界一：最小权限',
        },
        {
          type: 'list',
          items: [
            '数据库账号：只给 `SELECT`，不给 `DROP`；不同工具用不同账号。',
            '文件系统：只能读写一个专用目录，路径要做 `path.resolve` 后的前缀校验（防 `../`）。',
            '网络：出站走白名单，禁止访问内网段和云元数据地址 `169.254.169.254`。',
            '凭证：工具用服务端凭证，**绝不把 API Key 放进 prompt 或工具参数**。',
          ],
        },
        {
          type: 'h',
          text: '边界二：沙箱',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '代码执行的隔离层次（从弱到强）',
          code: `// ❌ 最差：eval / new Function 在主进程
eval(userCode)   // 能拿到 process、require、你的环境变量

// ⚠️ 稍好：child_process + 超时（仍共享文件系统和网络）
const child = spawn('node', ['-e', userCode], { timeout: 5000 })

// ✅ 生产：容器 / microVM，无网络、只读根文件系统、非 root、内存与 CPU 限额
// docker run --rm --network=none --read-only --memory=256m \\
//   --user 65534 --pids-limit 64 sandbox-image node /work/main.js

// ✅ 浏览器里跑纯 JS：sandbox="allow-scripts" 的 iframe
// 注意：不能加 allow-same-origin，否则等于没隔离`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '超时不是可选项',
          text: '`while(true){}` 一行代码就能让进程卡死。任何执行用户代码的地方都必须是"可以被强杀"的独立进程，并设 CPU 时间、内存、输出大小三重上限。**在主线程里跑不可信代码，等于把整个服务交出去。**',
        },
        {
          type: 'h',
          text: '边界三：人类确认（HITL）',
        },
        {
          type: 'table',
          head: ['操作', '是否需要确认', '确认时展示什么'],
          rows: [
            ['只读查询', '不需要', '—'],
            ['写数据库（改状态、加备注）', '建议要', '改哪条、改成什么、影响几行'],
            ['对外发送（邮件、消息、发帖）', '必须', '完整正文 + 收件人'],
            ['花钱（下单、退款、充值）', '必须', '金额、对象、不可撤销提示'],
            ['删除', '必须', '删什么、能不能恢复'],
            ['权限变更', '必须', '谁获得什么权限'],
          ],
        },
        {
          type: 'p',
          text: 'HITL 的设计要点：**确认界面要展示"将要发生的具体动作"，而不是"Agent 想做什么"**。给用户看"Agent 想调用 send_email"，他没法判断；给用户看完整的邮件正文和收件人，他才能判断。**这是产品设计问题，不是技术问题。**',
        },
      ],
    },

    {
      id: 's6',
      title: '熔断：三重上限，缺一不可',
      checkpoint: 'Agent 陷入死循环时，最贵的那一维是步数、时间还是钱？',
      blocks: [
        {
          type: 'p',
          text: '没有熔断的 Agent 是一颗定时炸弹。它会在某个下午因为一条奇怪的输入，把当月预算跑完。三重上限必须同时设：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '熔断器',
          code: `type Limits = {
  maxSteps: number      // 步数上限：防止逻辑死循环
  maxTokens: number     // token 上限：防止成本失控
  maxWallMs: number     // 时间上限：防止用户等待过久
}

const DEFAULT_LIMITS: Limits = {
  maxSteps: 12,
  maxTokens: 60_000,
  maxWallMs: 90_000,
}

async function runAgent(task: string, limits = DEFAULT_LIMITS) {
  const startedAt = Date.now()
  let steps = 0
  let tokens = 0
  const messages: Msg[] = [{ role: 'user', content: task }]

  while (true) {
    if (steps >= limits.maxSteps) {
      return { status: 'aborted', reason: 'step_limit', messages,
               hint: '已尝试 ' + steps + ' 步仍未完成，请缩小问题范围' }
    }
    if (tokens >= limits.maxTokens) {
      return { status: 'aborted', reason: 'token_limit', messages }
    }
    if (Date.now() - startedAt >= limits.maxWallMs) {
      return { status: 'aborted', reason: 'time_limit', messages }
    }

    const reply = await llm(messages, { tools })
    steps++
    tokens += reply.usage.totalTokens

    if (!reply.toolCalls?.length) {
      return { status: 'ok', answer: reply.content, steps, tokens, messages }
    }

    const results = await Promise.allSettled(
      reply.toolCalls.map((c) => executeTool(c.name, c.args, ctx)),
    )
    messages.push({ role: 'assistant', toolCalls: reply.toolCalls })
    results.forEach((r, i) => {
      messages.push({ role: 'tool', toolCallId: reply.toolCalls[i].id,
                      content: JSON.stringify(r) })
    })
  }
}`,
        },
        {
          type: 'table',
          head: ['死循环形态', '症状', '靠哪个上限拦住'],
          rows: [
            ['重复调用', '同样工具同样参数反复调', '步数上限 + 重复检测'],
            ['越查越多', '每轮返回大量数据，上下文暴涨', 'token 上限'],
            ['下游卡住', '某个工具超时但一直在重试', '时间上限 + 工具级超时'],
            ['任务本身无解', '用户问的问题工具根本答不了', '步数上限（要在提示里说清能力边界）'],
            ['模型反复犹豫', '只输出 thought 不调工具也不回答', '步数上限'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '熔断后要给人一个能继续的出口',
          text: '不要只返回"执行失败"。返回**已完成的部分 + 卡在哪 + 建议怎么缩小范围**："我已经查到订单 A1024 已付款、仓库检修中，但无法确认具体补发时间（查询工具不支持）。你可以提供运单号，或者我帮你转人工。" 用户拿到这个，任务还有救；拿到"失败"，只能重来。',
        },
        {
          type: 'p',
          text: '生产环境还要加两个东西：**幂等键**（同一任务重跑不重复执行副作用，用 `taskId + step` 做键）和**断点续跑**（把 messages 落库，超时后可以从上次的位置继续，而不是从头再来）。这两条在长任务上是必需的。',
        },
      ],
    },

    {
      id: 's7',
      title: 'MCP：把工具变成别人能装的东西',
      checkpoint: '你已经有 HTTP 接口了，为什么还要包一层 MCP？',
      blocks: [
        {
          type: 'p',
          text: 'MCP（Model Context Protocol）解决的是一个很具体的工程问题：**N 个客户端 × M 个工具 = N×M 次适配**。每个 AI 客户端都要为每个工具写一遍接入代码。MCP 把它变成 N+M：工具方实现一次 server，客户端实现一次 client。',
        },
        {
          type: 'table',
          head: ['原语', '是什么', '谁控制', '典型用法'],
          rows: [
            ['Tools', '模型可以调用的函数', '模型决定调用', '查数据库、发消息、执行命令'],
            ['Resources', '可读取的数据（类似文件）', '客户端/用户选择', '把一份文档、一张表作为上下文'],
            ['Prompts', '预置的提示模板', '用户主动触发', '斜杠命令、固定工作流'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '一个最小但可用的 MCP Server（stdio 传输）',
          code: `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'notes', version: '1.0.0' })

server.tool(
  'search_notes',
  '在当前用户的笔记中按关键词搜索。返回标题、摘要和 id。' +
    '用于回答"我之前记过关于 X 的东西吗"这类问题。',
  {
    query: z.string().min(1).describe('搜索关键词，中文英文都支持'),
    limit: z.number().int().min(1).max(20).default(5).describe('返回条数'),
  },
  async ({ query, limit }) => {
    const rows = await db.searchNotes(currentUserId(), query, limit)
    return {
      content: [
        {
          type: 'text',
          text: rows.length
            ? rows.map((r) => \`- [\${r.id}] \${r.title}\\n  \${r.excerpt}\`).join('\\n')
            : '没有找到相关笔记',
        },
      ],
    }
  },
)

await server.connect(new StdioServerTransport())`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '写 MCP Server 时最容易犯的错',
          text: '① **把整个数据库暴露成一个 `run_sql` 工具**——这不是 MCP server，这是后门；② **返回原始 API 响应**（几百行 JSON）——上下文会被瞬间吃掉；③ **不做鉴权就监听公网端口**——stdio 传输天然安全（只给启动它的进程用），HTTP 传输必须自己做认证；④ **工具描述写"查询数据"**——模型无法区分它和别的工具。',
        },
        {
          type: 'p',
          text: '传输方式的选择很简单：**本机给单个客户端用 → stdio；要给多个客户端或远程用 → Streamable HTTP，并自己做 token 鉴权**。stdio 的安全性来自"进程边界"，一旦改成网络端口，所有隔离都消失了，必须补认证、限流、审计。',
        },
      ],
    },

    {
      id: 's8',
      title: '什么时候不该用 Agent',
      checkpoint: '你的需求是"每天 9 点把昨天的工单汇总发到群里"。这该用 Agent 吗？',
      blocks: [
        {
          type: 'p',
          text: '本课最后一步，也是最重要的一步：**学会说"这个不该用 Agent"**。Agent 的每一步都在花时间和钱，而它买到的东西只有一样——**运行时决策能力**。如果你的路径是确定的，这个钱就是白花。',
        },
        {
          type: 'table',
          head: ['判断维度', '偏 Workflow', '偏 Agent'],
          rows: [
            ['步骤是否固定', '固定，能画流程图', '取决于中间结果'],
            ['是否需要审计', '需要，每一步都要留痕可解释', '结果导向，过程可宽松'],
            ['调用频次', '高频（每秒几次）', '低频（每人每天几次）'],
            ['失败代价', '高（涉及钱、权限）', '低（只是没查到）'],
            ['输入形态', '结构化、字段固定', '自然语言、意图模糊'],
            ['延迟要求', '严格（<2s）', '宽松（可以等 10s）'],
          ],
        },
        {
          type: 'p',
          text: '更实用的做法是**混合架构**：外层是固定的 workflow（保证可审计、可重试），只在某个需要"灵活判断"的节点内部套一个小 Agent。',
        },
        {
          type: 'flow',
          title: '混合架构：骨架固定，关节灵活',
          ascii: `[收到工单]  ← workflow，固定
      │
      ▼
[规则分类：关键词 + 字段]   ← 能用 if 就用 if
      │
      ├─ 命中明确类别 ──────────────► [套模板回复]
      │
      └─ 无法归类（约 15%）
              │
              ▼
        [小 Agent：查历史工单 + 查知识库 + 决定归属]   ← 只在这里灵活
              │
              ▼
        [人工确认后发送]                              ← HITL
      │
      ▼
[记录 + 打标]  ← workflow，固定`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一句话判断法',
          text: '**"如果我能把这件事的每一步写成一个 if-else，就别用 Agent。"** 写不出来（因为分支取决于语义判断），才用 Agent。而且要问第二个问题：**"这个语义判断，能不能用一个分类模型或一次 LLM 调用解决？"** 如果一次调用就能判断，那就只是 workflow 里的一个智能节点，不需要 Agent 循环。',
        },
        {
          type: 'qa',
          q: '那 Agent 到底什么时候是必需的？',
          a: '当"下一步做什么取决于上一步的结果，且步数不确定"时。典型例子：调试代码（报错决定下一步查哪里）、开放式研究（查到的东西决定下一个搜索词）、多跳问答（第一跳的答案决定第二跳问什么）。这三个场景的共同点是：**你无法预先枚举路径**。除此之外，八成需求都能用 workflow + 单次 LLM 调用解决，而且更便宜、更可靠、更好调试。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '该不该用 Agent',
      points: 10,
      prompt: '需求：每天 9:00 把昨天新增的工单按类别汇总，生成一段 200 字的日报发到部门群。应该怎么实现？',
      options: [
        { id: 'a', text: '做一个 Agent，给它查工单、分类、写日报、发消息四个工具，让它自己决定' },
        { id: 'b', text: '写一个定时 workflow：查昨天的工单 → 单次 LLM 调用生成日报 → 调群机器人发送，失败重试' },
        { id: 'c', text: '让 Agent 每 5 分钟轮询一次，有新工单就处理' },
        { id: 'd', text: '训练一个专门的模型' },
      ],
      answer: ['b'],
      hints: [
        '先问：这件事的步骤是固定的还是取决于中间结果？',
        '查工单 → 生成 → 发送，三步永远一样，没有任何一步需要"看情况决定下一步"。',
        'b 是对的：路径固定用 workflow，只在"生成文字"这一步用一次 LLM。a 引入了不必要的循环（可能跳步、可能重复发送、成本不可估）；c 是浪费（轮询 + Agent 双重开销）；d 成本高得离谱且没必要。',
      ],
      explanation: '正确答案是 b。步骤固定、高频、需要可审计的任务，用 workflow。Agent 买到的是"运行时决策"，这里不需要。',
      approach: [
        '画一下这件事的流程图，看有没有分支',
        '没有分支 → workflow',
        '有分支但能用 if 判断 → workflow + 规则',
        '分支取决于语义 → 在那个节点用一次 LLM 调用',
        '只有"步数都不确定"才上 Agent 循环',
      ],
      knowledge: ['Workflow vs Agent', '混合架构', '成本判断'],
      pitfalls: [
        '看到"AI"两个字就想上 Agent',
        '用 Agent 做定时任务（定时任务本身就是固定流程）',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '好工具设计的特征',
      points: 15,
      prompt: '下面哪些是"模型能正确调用"的工具设计特征？（多选）',
      options: [
        { id: 'a', text: '名字和描述明确说明"什么时候该用这个工具"，并指出和相邻工具的区别' },
        { id: 'b', text: '把 user_id 作为参数，让模型根据对话内容填写' },
        { id: 'c', text: '有限取值用 enum 收敛，不要留自由字符串' },
        { id: 'd', text: '失败时返回具体的、能指导修正的错误信息' },
        { id: 'e', text: '返回完整的原始 API 响应，信息越全越好' },
      ],
      answer: ['a', 'c', 'd'],
      hints: [
        '想两个角度：模型怎么选对工具、怎么填对参数。',
        '还有一个安全角度：哪些参数绝对不能由模型决定。',
        'a 帮模型选对工具（最常见的错误是选错工具）；c 帮模型填对参数；d 让模型能自我修正。b 是严重安全问题——身份必须从服务端会话取；e 会挤爆上下文，应该只返回决策需要的字段。',
      ],
      explanation: 'a、c、d 正确。b 是越权漏洞（模型可以被诱导传别人的 id），e 是上下文污染。',
      approach: [
        '工具描述要回答"何时用"，不只是"是什么"',
        '参数用 enum / min / max 收窄，减少自由发挥空间',
        '身份类参数一律从服务端上下文注入，不进 schema',
        '返回值只保留模型决策需要的字段，并做长度截断',
        '错误信息写成"哪里错、该填什么"',
      ],
      knowledge: ['工具设计', 'enum 收敛', '身份注入', '错误信息'],
      pitfalls: [
        '把 user_id / tenant_id 做成参数',
        '返回原始 API 响应',
        '错误只返回状态码，模型无法修正',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '给 Agent 装熔断',
      points: 15,
      prompt: '补全熔断逻辑。三重上限分别是步数、token 和时间，任何一个超了都要中止并返回已完成的部分。',
      templateLang: 'ts',
      template: `const limits = { maxSteps: 12, maxTokens: 60000, maxWallMs: 90000 }

while (true) {
  if ({{c1}} >= limits.maxSteps) return abort('step_limit')
  if ({{c2}} >= limits.maxTokens) return abort('token_limit')
  if (Date.now() - {{c3}} >= limits.maxWallMs) return abort('time_limit')

  const reply = await llm(messages, { tools })
  steps++
  tokens += reply.usage.{{c4}}

  if (!reply.toolCalls?.length) return { status: 'ok', answer: reply.{{c5}} }
  // ... 执行工具并回灌 messages
}`,
      blanks: [
        { id: 'c1', label: '步数变量', accept: ['steps'], width: 70 },
        { id: 'c2', label: 'token 变量', accept: ['tokens'], width: 70 },
        { id: 'c3', label: '起始时间变量', accept: ['startedat', 'start', 'starttime', 't0'], width: 100 },
        { id: 'c4', label: 'usage 里的总 token 字段', accept: ['totaltokens', 'total_tokens'], width: 120 },
        { id: 'c5', label: '模型的文本输出字段', accept: ['content', 'text', 'answer'], width: 80 },
      ],
      hints: [
        '这三个上限对应三个不同的死循环形态。',
        '时间上限要用"当前时间 - 起始时间"，所以需要一个在循环外记录的起点。',
        '依次是：`steps`（逻辑死循环）、`tokens`（上下文暴涨）、`startedAt`（下游卡住）、`totalTokens`（usage 里的字段名，不同 SDK 可能是 `total_tokens`）、`content`（模型的回答文本）。',
      ],
      explanation: '三个上限各拦一类故障：步数拦逻辑循环，token 拦上下文暴涨，时间拦下游卡顿。缺任何一个都会留下一种能把预算跑完的路径。',
      approach: [
        '循环外记录起点时间和计数器',
        '每轮开头先检查三个上限，超了立即返回',
        '每轮结束累加步数和 token',
        '中止时返回已完成的部分 + 卡在哪 + 建议，而不是只返回"失败"',
      ],
      knowledge: ['熔断器', '步数上限', 'token 预算', '超时控制'],
      pitfalls: [
        '只在循环结束检查（永远等不到结束）',
        '用 `<=` 导致多跑一轮（无害但说明边界没想清）',
        '中止时不返回中间结果，用户只能重来',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现带校验的工具分发器',
      points: 20,
      prompt: '实现 `dispatch(registry, name, args)`。`registry` 是 `{ [name]: { run, schema } }`，其中 `schema` 是一个有 `safeParse` 方法的校验器（zod 风格）。返回 `{ ok: true, value }` 或 `{ ok: false, error, retryable }`。规则：未知工具 → `retryable: false`；参数校验失败 → `retryable: true` 且 error 里包含字段名；`run` 抛错 → `retryable: false`，error 固定为 `"工具执行失败"`（不要把异常信息透出去）。',
      starter: `function dispatch(registry, name, args) {
  // TODO
  return { ok: false, error: '未实现', retryable: false }
}

return dispatch`,
      checks: [
        {
          name: '未知工具返回不可重试',
          expr: "(() => { const r = result({}, 'nope', {}); return r.ok === false && r.retryable === false && r.error.includes('nope') })()",
        },
        {
          name: '校验失败可重试且带字段名',
          expr: "(() => { const reg = { t: { schema: { safeParse: () => ({ success: false, error: { issues: [{ path: ['status'], message: '必须是枚举值' }] } }) }, run: () => 1 } }; const r = result(reg, 't', {}); return r.ok === false && r.retryable === true && r.error.includes('status') && r.error.includes('必须是枚举值') })()",
        },
        {
          name: '校验通过返回 run 的结果',
          expr: "(() => { const reg = { t: { schema: { safeParse: (a) => ({ success: true, data: a }) }, run: (a) => a.x * 2 } }; const r = result(reg, 't', { x: 21 }); return r.ok === true && r.value === 42 })()",
        },
        {
          name: 'run 抛错时不泄露异常信息',
          expr: "(() => { const reg = { t: { schema: { safeParse: (a) => ({ success: true, data: a }) }, run: () => { throw new Error('password=hunter2') } } }; const r = result(reg, 't', {}); return r.ok === false && r.retryable === false && !r.error.includes('hunter2') })()",
        },
        {
          name: '传的是校验后的数据，不是原始参数',
          expr: "(() => { const reg = { t: { schema: { safeParse: () => ({ success: true, data: { clean: true } }) }, run: (a) => Object.keys(a).join(',') } }; const r = result(reg, 't', { dirty: 1 }); return r.value === 'clean' })()",
        },
      ],
      solution: `function dispatch(registry, name, args) {
  const tool = registry[name]
  if (!tool) {
    return { ok: false, error: '未知工具：' + name, retryable: false }
  }

  const parsed = tool.schema.safeParse(args)
  if (!parsed.success) {
    const detail = (parsed.error?.issues ?? [])
      .map((i) => (i.path || []).join('.') + ': ' + i.message)
      .join('; ')
    return { ok: false, error: '参数不合法：' + detail, retryable: true }
  }

  try {
    return { ok: true, value: tool.run(parsed.data) }
  } catch (e) {
    return { ok: false, error: '工具执行失败', retryable: false }
  }
}`,
      hints: [
        '三段结构：查工具 → 校验参数 → 执行。每一段失败都有不同的 retryable。',
        '注意第三段要用 `parsed.data` 而不是原始 `args`——校验器可能做了类型转换或补默认值。',
        '完整实现：`registry[name]` 不存在就返回未知工具；`safeParse` 失败时把 `issues` 里的 `path` 和 `message` 拼起来；`run` 包在 try/catch 里，catch 里返回固定的错误文案（不要把 `e.message` 透出去，可能含敏感信息）。',
      ],
      explanation: '这个函数是 Agent 可靠性的第一道闸门。三个返回值分支对应三种处置：未知工具（模型幻觉出来的名字）、参数错误（模型填错，让它改）、执行失败（记日志，不要重试副作用类工具）。',
      approach: [
        '先查 registry，不存在直接返回不可重试',
        '用 schema.safeParse 校验，失败时把每个 issue 的 path 和 message 拼成可读文案',
        '用校验后的 data 调 run，包 try/catch',
        'catch 里返回固定文案，完整异常只写日志',
      ],
      knowledge: ['工具分发', '参数校验', '错误归一化', '信息泄露'],
      pitfalls: [
        '用 `run(args)` 而不是 `run(parsed.data)`，跳过了默认值和类型转换',
        '把 `e.message` 直接返回给模型（可能含表名、SQL、内部地址）',
        '参数错误也标成不可重试，模型就失去了自我修正的机会',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 15,
    questions: [
      {
        id: 'q1',
        stem: 'Agent 的"智能"实际来自哪里？',
        options: [
          { id: 'a', text: '循环结构本身' },
          { id: 'b', text: '每一轮的那次 LLM 调用' },
          { id: 'c', text: '工具的实现' },
          { id: 'd', text: 'prompt 里的"请谨慎思考"' },
        ],
        answer: 'b',
        why: '循环是笨的，它只负责"调用模型 → 执行工具 → 回灌结果"。所有判断都在那次 LLM 调用里。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '工具参数里绝对不能让模型填的是什么？',
        options: [
          { id: 'a', text: '搜索关键词' },
          { id: 'b', text: 'user_id / tenant_id 这类身份标识' },
          { id: 'c', text: '返回条数 limit' },
          { id: 'd', text: '日期范围' },
        ],
        answer: 'b',
        why: '身份必须从服务端会话注入。一旦成为参数，用户就能通过对话诱导模型传别人的 id，造成越权。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: 'Agent 跑到第 10 轮开始"跑偏"，最可能的原因是什么？',
        options: [
          { id: 'a', text: '模型上下文里累积了太多工具结果，原始任务被稀释' },
          { id: 'b', text: '模型算力不够' },
          { id: 'c', text: '工具写错了' },
          { id: 'd', text: '需要更多步数上限' },
        ],
        answer: 'a',
        why: '这是上下文膨胀的典型症状。解法是裁剪历史：保留 system + 原始任务 + 最近几轮，更早的压缩成摘要。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '工具返回"下游 503"和"参数不合法"，哪个该重试？',
        options: [
          { id: 'a', text: '都该重试' },
          { id: 'b', text: '都不该重试' },
          { id: 'c', text: '503 可重试（暂时性故障），参数不合法不该重试同样参数（要让模型改参数）' },
          { id: 'd', text: '参数不合法该重试，503 不该' },
        ],
        answer: 'c',
        why: '重试的前提是"重试可能成功"。暂时性故障会恢复，参数错误不会自己变对。而且"重试"和"让模型修正"是两回事。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '哪一类操作重试最危险？',
        options: [
          { id: 'a', text: '只读查询' },
          { id: 'b', text: '已经有副作用的操作（支付、发邮件、删除）' },
          { id: 'c', text: '参数校验' },
          { id: 'd', text: '日志写入' },
        ],
        answer: 'b',
        why: '副作用重试会造成重复扣款、重复发送、重复删除。正确做法是先查状态，或引入幂等键。',
        stepId: 's4',
      },
      {
        id: 'q6',
        stem: '在 Node 主进程里用 `eval(userCode)` 执行模型生成的代码，最大的问题是什么？',
        options: [
          { id: 'a', text: '性能差' },
          { id: 'b', text: '代码能访问 process、require、环境变量和文件系统，等于把整个服务交出去' },
          { id: 'c', text: '语法错误难调试' },
          { id: 'd', text: '不支持 async' },
        ],
        answer: 'b',
        why: 'eval 与宿主进程完全同权。隔离必须靠独立进程/容器，加上无网络、只读文件系统、资源限额。',
        stepId: 's5',
      },
      {
        id: 'q7',
        stem: 'MCP 的 Tools 和 Resources 有什么区别？',
        options: [
          { id: 'a', text: '没区别，只是命名不同' },
          { id: 'b', text: 'Tools 由模型决定调用（有副作用），Resources 是被读取的数据（由客户端/用户选择）' },
          { id: 'c', text: 'Resources 更快' },
          { id: 'd', text: 'Tools 只能本地用' },
        ],
        answer: 'b',
        why: '控制权不同是本质区别。Tools 是"模型能主动做的事"，Resources 是"能被放进上下文的材料"。',
        stepId: 's7',
      },
      {
        id: 'q8',
        stem: '什么情况下必须用 Agent 而不是 Workflow？',
        options: [
          { id: 'a', text: '任务涉及 AI 的时候' },
          { id: 'b', text: '任务步骤多的时候' },
          { id: 'c', text: '下一步做什么取决于上一步结果，且无法预先枚举路径的时候' },
          { id: 'd', text: '需要调用外部 API 的时候' },
        ],
        answer: 'c',
        why: '这是唯一站得住的理由。步骤多、涉及 AI、调外部 API 都能用 workflow 解决，而且更可靠。',
        stepId: 's8',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：Agent 层',
    contributes:
      '这一课给项目加一个可选的 Agent 层：在检索问答之外，支持"需要多步查询"的问题（比如先查订单再查知识库）。同时把工具、熔断、HITL 的规范定下来。',
    tasks: [
      '定义 5 个工具：search_docs（复用第七课检索）、get_doc_detail、list_recent_queries、create_ticket、send_reply_draft',
      '每个工具写清"何时用"的描述，参数用 zod 收敛，身份从服务端会话注入',
      '实现 dispatch：参数校验 + 错误归一化 + retryable 判定 + 返回值截断',
      '实现 runAgent：三重熔断（步数 12 / 60K token / 90s）+ 历史裁剪 + 重复调用检测',
      '给 create_ticket 和 send_reply_draft 加 HITL：生成草稿，人工确认后才真正执行',
      '写一个 20 条的轨迹测试集，断言"该调哪个工具""不该调哪个工具""超时后是否正确中止"',
      '做一个对比实验：同一批问题，纯 RAG 一次调用 vs Agent 多步，比较准确率和平均成本',
    ],
    done: '能拿出对比数据说明 Agent 层在哪些问题上真的赢了（多步查询类），在哪些问题上白花钱（单跳问答类）；故意构造一个会让 Agent 死循环的输入，确认它在第 12 步或 90 秒时干净地中止并返回已完成的部分。',
  },

  further: [
    { text: 'Model Context Protocol 官方规范 · Tools / Resources / Prompts' },
    { text: '论文 · ReAct: Synergizing Reasoning and Acting in Language Models' },
    { text: 'OWASP LLM Top 10 · LLM08: Excessive Agency' },
    { text: '知识地图 04 Agent 智能体（/guide/04-agent）' },
  ],
}
