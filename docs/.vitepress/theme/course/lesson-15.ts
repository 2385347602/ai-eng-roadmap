import type { Lesson } from './types'

/**
 * 第十五课：Workflow 编排
 *
 * 核心立场：能写成流程图的事，就别交给 Agent 自由发挥。
 * 编排的价值是把"不确定的模型"放进"确定的骨架"里。
 */
export const lesson15: Lesson = {
  id: 'L15',
  moduleId: 'workflow',
  order: 15,
  path: '/learn/15-workflow',
  title: 'Workflow 编排：把不确定的模型装进确定的骨架',
  subtitle: '五种编排模式，选错一种就会写出"能跑但不能维护"的流水线。',
  minutes: 65,
  level: '进阶',
  outcome: '能为一个多步骤 AI 任务画出正确的编排结构，并处理重试、补偿、人工介入、可观测。',
  goals: [
    '识别五种基本编排模式，并知道各自适合什么任务形态',
    '在状态机和 DAG 之间做出正确选择',
    '设计幂等的步骤，让重跑和重放是安全的',
    '在流程里正确放置人机协作节点',
    '用补偿事务处理"中间步骤失败但前面已经产生了副作用"',
    '把每个步骤变成可观测的 span，定位问题不用猜',
  ],
  prereqs: [
    '学过第八课，知道 Agent 和 Workflow 的区别',
    '学过第十二课，理解幂等和任务状态机',
    '手上有至少一个"三步以上"的 AI 流程',
  ],

  steps: [
    {
      id: 's1',
      title: '五种模式，覆盖 90% 的场景',
      checkpoint: '一个"先分类、再按类型走不同处理"的流程，属于哪种模式？',
      blocks: [
        {
          type: 'p',
          text: '编排模式不多，但选错了会很难受。先认全五种：',
        },
        {
          type: 'flow',
          title: '① 链式（Prompt Chaining）',
          ascii: `输入 → [步骤1] → [步骤2] → [步骤3] → 输出
        每步的输出是下一步的输入

适合：任务能明确拆成有序子任务
例子：提取要点 → 翻译 → 润色
优点：每步可单独测试、可缓存
缺点：一步错，后面全错（要加校验）`,
        },
        {
          type: 'flow',
          title: '② 路由（Routing）',
          ascii: `              ┌─► [简单问题 → 小模型]
输入 → [分类器] ┼─► [复杂问题 → 大模型]
              └─► [闲聊 → 固定回复]

适合：输入类型差异大，用一套处理必然浪费
例子：工单分类、模型分级路由
优点：成本能砍一半以上
缺点：分类错了，后面全错（分类要单独评测）`,
        },
        {
          type: 'flow',
          title: '③ 并行（Parallelization）',
          ascii: `        ┌─► [检查合规性] ─┐
输入 ───┼─► [检查准确性] ─┼─► [汇总]
        └─► [检查语气]   ─┘

两种用法：
- 分段：同一任务拆成独立子任务并行（总结 10 个文档）
- 投票：同一任务跑多次取共识（判断是否有害）

优点：延迟 = 最慢的那一路，不是总和
缺点：成本线性增长`,
        },
        {
          type: 'flow',
          title: '④ 编排者-工作者（Orchestrator-Workers）',
          ascii: `输入 → [编排者：拆解任务]
              │
              ├─► [工作者 A] ─┐
              ├─► [工作者 B] ─┼─► [编排者：汇总]
              └─► [工作者 C] ─┘

适合：子任务数量和内容取决于输入
例子：把一份需求拆成 N 个模块，每个模块单独实现
优点：能处理"事先不知道要拆几步"的任务
缺点：编排者的拆解质量决定上限`,
        },
        {
          type: 'flow',
          title: '⑤ 评估者-优化者（Evaluator-Optimizer）',
          ascii: `输入 → [生成] → [评估] ─┐
         ▲            │
         └── 不通过 ──┘
                      │
                      └─► 通过 → 输出

适合：有明确判定标准，且"一次写不好"
例子：代码生成 + 测试、文案生成 + 品牌规范检查
优点：质量显著提升
缺点：必须能判定"通过"，否则永远循环（要有次数上限）`,
        },
        {
          type: 'table',
          head: ['模式', '一句话判断', '典型误用'],
          rows: [
            ['链式', '步骤固定且有序', '把该并行的做成串行，延迟翻倍'],
            ['路由', '输入类型差异大', '分类器没评测，路由错得莫名其妙'],
            ['并行', '子任务互不依赖', '有副作用的步骤并行，造成重复写入'],
            ['编排者-工作者', '拆几步取决于输入', '子任务简单固定，白花编排成本'],
            ['评估者-优化者', '有客观判定标准', '没有明确标准，循环到次数上限'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '组合比单选更常见',
          text: '真实系统通常是"路由 + 链式 + 局部并行"。比如：先路由判断类型（路由）→ 按类型走固定步骤（链式）→ 其中"事实核查"和"合规检查"并行（并行）→ 最后评估是否通过（评估者-优化者）。**先画清骨架，再往节点里填模型。**',
        },
      ],
    },

    {
      id: 's2',
      title: '状态机 vs DAG：选哪个',
      checkpoint: '一个流程里，某一步可能回到上一步重做。这还能用 DAG 表达吗？',
      blocks: [
        {
          type: 'p',
          text: 'DAG（有向无环图）适合"一次性往前推进"，状态机适合"可能回退、可能重入"。两者都能表达顺序，但表达能力不同。',
        },
        {
          type: 'table',
          head: ['', 'DAG', '状态机'],
          rows: [
            ['能表达循环', '❌ 不能（无环）', '✅ 能（状态间可互相转移）'],
            ['能表达并行', '✅ 天然支持', '⚠️ 要靠并发状态或额外机制'],
            ['可恢复性', '记录"哪些节点完成"', '记录"当前在哪个状态"'],
            ['调试友好度', '高（图可视化）', '中（要看转移历史）'],
            ['适合', '批处理、ETL、固定流水线', '有重试/回退/人工介入的流程'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '状态机：把"能去哪"写进类型',
          note: '关键设计：状态转移表是数据，不是 if-else 堆。这样你能画出图、能校验、能加新状态而不改逻辑。',
          code: `type State =
  | 'draft'        // 收到输入
  | 'classified'   // 已分类
  | 'retrieving'   // 检索中
  | 'answering'    // 生成中
  | 'checking'     // 质量检查
  | 'needs_human'  // 待人工
  | 'done'
  | 'failed'

const TRANSITIONS: Record<State, State[]> = {
  draft: ['classified', 'failed'],
  classified: ['retrieving', 'failed'],
  retrieving: ['answering', 'failed', 'needs_human'],   // 检索为空 → 转人工
  answering: ['checking', 'failed'],
  checking: ['done', 'answering', 'needs_human'],        // 不合格 → 重新生成（有次数上限）
  needs_human: ['done', 'failed'],
  done: [],
  failed: ['draft'],                                     // 允许人工重试
}

async function advance(runId: string, to: State) {
  const run = await db.run.findUnique({ where: { id: runId } })
  if (!TRANSITIONS[run.state].includes(to)) {
    throw new Error(\`非法转移 \${run.state} → \${to}\`)
  }
  // 带条件更新，防并发双写
  const n = await db.run.updateMany({
    where: { id: runId, state: run.state },
    data: { state: to, updatedAt: new Date() },
  })
  if (n.count === 0) throw new Error('状态已被其他 worker 推进')
  await db.runEvent.create({ data: { runId, from: run.state, to, at: new Date() } })
}`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '有循环就必须有计数器',
          text: '`checking → answering` 这个回边是质量提升的关键，也是死循环的来源。**必须给每条回边加次数上限**（比如最多重生成 2 次），超了就转 `needs_human`。没有上限的循环，在线上一定会遇到那个让它永不收敛的输入。',
        },
        {
          type: 'p',
          text: '判断方法很简单：**画一遍流程图，如果有箭头往回指，就用状态机；如果全是单向，DAG 更省事。** 而"人工审批后可能打回重做"这个需求，几乎必然引入回边。',
        },
      ],
    },

    {
      id: 's3',
      title: '幂等：让重跑是安全的',
      checkpoint: '第 3 步超时了，你重跑整个流程，会发生什么？',
      blocks: [
        {
          type: 'p',
          text: '编排系统一定会重试——网络抖动、worker 挂掉、超时。如果步骤不幂等，重试就等于重复执行副作用：**发了两封邮件、扣了两次款、建了两个工单。**',
        },
        {
          type: 'table',
          head: ['步骤类型', '幂等做法'],
          rows: [
            ['纯计算（生成文本）', '天然幂等，重跑只是换个结果'],
            ['写数据库', '用业务唯一键 + `ON CONFLICT DO UPDATE`'],
            ['发消息/邮件', '先查"是否已发过"（用 stepRunId 做去重键），或让下游支持幂等键'],
            ['调第三方支付', '必须传幂等键（多数支付 API 支持），并在本地记录请求 id'],
            ['文件写入', '内容寻址（按内容哈希命名），重复写不产生新文件'],
            ['LLM 调用', '**不幂等**（结果会变），要么接受、要么缓存结果'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '步骤级幂等：记录每次执行',
          note: 'stepKey 由"runId + 步骤名 + 尝试序号"组成。重跑时先查这个 key 有没有成功记录，有就直接返回上次的结果（replay），没有才真正执行。',
          code: `async function runStep<T>(
  runId: string,
  name: string,
  fn: () => Promise<T>,
  opts: { replayable?: boolean } = {},
): Promise<T> {
  const stepKey = \`\${runId}:\${name}\`

  // 1. 已成功过？直接复用（replay）
  if (opts.replayable !== false) {
    const prev = await db.stepRun.findUnique({ where: { stepKey } })
    if (prev?.status === 'succeeded') return prev.output as T
  }

  // 2. 标记开始（用唯一键防并发重复执行）
  const existing = await db.stepRun.upsert({
    where: { stepKey },
    create: { stepKey, runId, name, status: 'running', startedAt: new Date() },
    update: { status: 'running', attempt: { increment: 1 }, startedAt: new Date() },
  })

  try {
    const out = await fn()
    await db.stepRun.update({
      where: { stepKey },
      data: { status: 'succeeded', output: out as any, finishedAt: new Date() },
    })
    return out
  } catch (e) {
    await db.stepRun.update({
      where: { stepKey },
      data: { status: 'failed', error: String(e), finishedAt: new Date() },
    })
    throw e
  }
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '有副作用的步骤不要 replay',
          text: '上面代码里 `replayable: false` 这个开关很重要。**LLM 生成可以 replay（省一次调用），但"发邮件"绝不能 replay**——重放会再发一次。有副作用的步骤要"先查下游状态"而不是"复用本地记录"。',
        },
        {
          type: 'p',
          text: '还有一个常被忽略的：**LLM 调用本身不幂等**。同一个 prompt 跑两次结果不同，所以"重跑"会得到不同答案。这在"评估者-优化者"循环里是好事（换个答案再试），但在"已经给用户看过答案"的场景里是坏事（用户刷新后答案变了）。做法：**把第一次的结果存下来，后续展示用存档**。',
        },
      ],
    },

    {
      id: 's4',
      title: '人机协作节点：把"审批"设计成流程的一等公民',
      checkpoint: '流程走到"要发一封对外邮件"这一步。该怎么让人介入？',
      blocks: [
        {
          type: 'p',
          text: '人工介入不是"出错了才找人"，而是**流程里预先设计好的一个节点**。它有两种形态：',
        },
        {
          type: 'table',
          head: ['形态', '触发方式', '适合'],
          rows: [
            ['强制审批', '流程走到这里必须等人', '对外发送、花钱、删除、权限变更'],
            ['条件审批', '满足条件才需要人（金额 > X、置信度 < Y）', '大部分能自动过，少数需要看'],
            ['事后抽检', '先执行，按比例抽样给人看', '低风险高频操作'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '审批节点的实现要点',
          code: `type Approval = {
  id: string
  runId: string
  step: string
  /** 给人看的"将要发生什么"，不是"Agent 想做什么" */
  preview: {
    title: string
    body: string
    targets: string[]
    irreversible: boolean
    amount?: number
  }
  /** 可编辑：人改完的内容要能回写到流程 */
  editable: boolean
  editedBody?: string
  expiresAt: Date
  decision: 'pending' | 'approved' | 'rejected'
  decidedBy?: string
  decidedAt?: Date
}

// 流程侧：挂起，等人
const approval = await requestApproval(runId, 'send_email', {
  title: '向客户发送退款确认邮件',
  body: draftEmail,                       // 完整正文，不是摘要
  targets: [customer.email],
  irreversible: true,
  amount: refundAmount,
})
if (approval.decision !== 'approved') {
  await advance(runId, 'failed')          // 拒绝 → 流程终止，不是重试
  return
}
const finalBody = approval.editedBody ?? draftEmail   // 人改过就用改后的`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '审批界面的三条铁律',
          text: '① **展示完整内容，不是摘要**——人要看的是"这封邮件发出去长什么样"，不是"Agent 打算发邮件"；② **展示不可逆性**——明确写"此操作无法撤销"；③ **必须能改**——只给"通过/拒绝"两个按钮，人只能全盘接受或全盘推翻，实际使用中会大量出现"勉强通过然后手工补救"。',
        },
        {
          type: 'p',
          text: '还有两个运营细节：**审批要有超时**（比如 24 小时未处理自动取消，否则流程永远挂在那里占资源），**审批人要能看到上下文**（这条工单之前发生了什么、为什么需要发这封邮件）。**让人在信息不足的情况下点"通过"，等于把风险转移给了他，而他会一律点通过。**',
        },
      ],
    },

    {
      id: 's5',
      title: '补偿：前面已经做了，后面失败了怎么办',
      checkpoint: '流程是"建工单 → 扣库存 → 发通知"，第 3 步失败了。前两步怎么办？',
      blocks: [
        {
          type: 'p',
          text: 'DAG 和状态机只能保证"流程状态正确"，保证不了"业务数据一致"。这就需要补偿事务（Saga）：**每一步都配一个反向操作，失败时逆序执行。**',
        },
        {
          type: 'table',
          head: ['正向步骤', '补偿操作', '注意'],
          rows: [
            ['建工单', '关闭工单（不是删除）', '保留记录供审计'],
            ['扣库存', '回补库存', '要幂等，防止重复回补'],
            ['发通知', '**无法补偿**', '所以放到最后一步'],
            ['写审计日志', '不补偿', '日志本来就该留'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '逆序补偿',
          code: `type Step = { name: string; run: () => Promise<void>; compensate?: () => Promise<void> }

async function runSaga(steps: Step[]) {
  const done: Step[] = []
  try {
    for (const s of steps) {
      await s.run()
      done.push(s)
    }
  } catch (e) {
    logger.error({ err: e, completed: done.map((s) => s.name) }, 'saga failed, compensating')
    // 逆序补偿：最后做的先撤销
    for (const s of [...done].reverse()) {
      if (!s.compensate) {
        logger.warn({ step: s.name }, 'no compensation available')
        continue
      }
      try {
        await s.compensate()
      } catch (ce) {
        // 补偿失败要告警，因为它会导致数据不一致
        alert('compensation_failed', { step: s.name, err: ce })
      }
    }
    throw e
  }
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '把不可补偿的步骤放最后',
          text: '排序原则：**可补偿的在前，不可补偿的在后**。"发通知""调支付""发消息"这些一旦发生就收不回来的，必须排在所有可回滚步骤之后。**顺序错了，补偿逻辑再完美也没用。**',
        },
        {
          type: 'p',
          text: '如果连"逆序补偿"都做不到（比如跨系统、跨公司），那就退一步：**不做分布式事务，改成"最终一致 + 对账"**。定期跑一个对账任务，找出"工单建了但库存没扣"这类不一致，生成待修复清单。**这比假装有事务要诚实得多，也更可靠。**',
        },
      ],
    },

    {
      id: 's6',
      title: '可观测与选型：别自己造轮子，也别乱用轮子',
      checkpoint: '一个 6 步的流程跑完要 40 秒，用户说"卡住了"。你怎么知道卡在哪一步？',
      blocks: [
        {
          type: 'p',
          text: '编排系统最大的运维价值就是"每一步都可见"。做法在第十课讲过（span），这里只强调编排特有的三点：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**每个步骤一个 span，带输入输出摘要**。不要只记"步骤完成"，要记"输入是什么、输出是什么、耗时多少"。',
            '**记录状态转移历史**，不只是当前状态。这样能看到"重试了 3 次才成功"，而不是"成功了"。',
            '**流程级指标**：完成率、平均步数、重试率、人工介入率、各步 P95 耗时。**重试率突然上升通常是下游退化的最早信号。**',
          ],
        },
        {
          type: 'table',
          head: ['方案', '适合', '不适合'],
          rows: [
            ['自己写状态机 + 任务表', '步骤 < 10、团队小、逻辑特殊', '需要复杂并行、可视化编排'],
            ['图编排库（LangGraph 等）', '需要条件分支、循环、人工介入', '简单线性流程（杀鸡用牛刀）'],
            ['工作流引擎（Temporal 等）', '长流程、强一致、需要重放', '简单任务（学习成本高）'],
            ['可视化编排（Dify/Coze 类）', '业务人员自己搭、快速试错', '需要深度定制、复杂错误处理'],
            ['消息队列 + 消费者', '纯异步、事件驱动', '需要同步等待结果'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '选型的第一原则',
          text: '**先用最笨的方式跑通，再抽象。** 一个 6 步流程，用 6 个函数 + 一张状态表就能跑，200 行代码。等你有 5 个流程、每个都要改的时候，再考虑引入框架——那时你才知道自己真正需要框架的哪部分能力。**先上框架的团队，通常在调试框架本身而不是业务。**',
        },
        {
          type: 'qa',
          q: '编排和 Agent 的边界到底在哪？',
          a: '一句话：**谁决定下一步**。编排是"代码决定下一步"（写死的转移表），Agent 是"模型决定下一步"。混合架构是主流：外层编排保证可审计可重试，某个节点内部用一次 LLM 调用或一个小 Agent 来做"语义判断"。判断标准：如果下一步能用 `if` 写出来，就写 `if`；写不出来，才在那个节点放模型。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '选编排模式',
      points: 10,
      prompt: '需求：用户上传一份需求文档，系统要拆成 N 个开发任务，每个任务单独生成实现方案，最后汇总成一份技术方案。N 事先不知道。该用哪种模式？',
      options: [
        { id: 'a', text: '链式：拆解 → 生成 → 汇总，三步串行' },
        { id: 'b', text: '编排者-工作者：编排者拆解出 N 个子任务，分派给工作者并行处理，再汇总' },
        { id: 'c', text: '路由：按文档类型分流' },
        { id: 'd', text: 'Agent：给它工具让它自己决定' },
      ],
      answer: ['b'],
      hints: [
        '关键线索是"N 事先不知道"和"每个任务独立处理"。',
        '链式表达不了"数量可变的并行子任务"。',
        'b 正是为这种形态设计的：编排者产出子任务列表，工作者逐个/并行处理，编排者汇总。a 没法表达可变数量的子任务；c 是输入分类，不是任务分解；d 把确定性骨架交给了模型，可审计性差。',
      ],
      explanation: '正确答案是 b。编排者-工作者的核心价值就是"子任务数量和内容在运行时才确定"。',
      approach: [
        '看子任务数量是否事先可知',
        '不可知 + 需要分解 → 编排者-工作者',
        '可知且固定 → 链式或并行',
        '只是输入类型不同 → 路由',
      ],
      knowledge: ['编排模式', '编排者-工作者', '任务分解'],
      pitfalls: [
        '用链式硬套可变数量的子任务',
        '直接上 Agent，失去可审计性',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '幂等设计',
      points: 15,
      prompt: '一个流程包含"生成摘要 → 写数据库 → 发通知邮件"。哪些步骤需要幂等保护，怎么做？（多选）',
      options: [
        { id: 'a', text: '写数据库：用业务唯一键 + ON CONFLICT DO UPDATE' },
        { id: 'b', text: '发邮件：先查"这一步是否已成功执行过"，或让邮件服务支持幂等键' },
        { id: 'c', text: '生成摘要：可以缓存结果，重跑时复用，避免重复调用' },
        { id: 'd', text: '所有步骤都用同一个幂等键，简单省事' },
        { id: 'e', text: '有副作用的步骤重跑时应该"先查下游状态"，而不是"复用本地记录"' },
      ],
      answer: ['a', 'b', 'c', 'e'],
      hints: [
        '分两类：纯计算和有副作用，两者的幂等做法不同。',
        'd 的问题在于"所有步骤共用一个键"——某一步失败重跑时，其他步骤会被误判为"已完成"。',
        'a 是数据库的标准做法；b 是副作用步骤的正确姿势；c 纯计算可以缓存；e 是 b 的更一般表述（下游状态才是真相）。d 会导致"部分完成"被误判为"全部完成"。',
      ],
      explanation: 'a、b、c、e 正确。幂等键必须**按步骤**区分，不能全局共用一个。',
      approach: [
        '区分纯计算和有副作用的步骤',
        '纯计算：缓存结果，replay 安全',
        '数据库：业务唯一键 + upsert',
        '副作用：查下游状态，或传幂等键给下游',
        '幂等键粒度到"步骤"，不是"流程"',
      ],
      knowledge: ['幂等', '副作用', 'replay', '幂等键粒度'],
      pitfalls: [
        '全局共用一个幂等键',
        '副作用步骤用 replay 复用本地记录（会重复执行）',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '设计补偿顺序',
      points: 15,
      prompt: '流程有四步：① 建工单 ② 扣库存 ③ 写审计日志 ④ 给客户发确认邮件。设计执行顺序和补偿策略。',
      templateLang: 'text',
      template: `执行顺序（把不可补偿的放最后）：
① → ② → {{o1}} → {{o2}}

补偿映射：
- 建工单 → {{c1}}（不是删除）
- 扣库存 → {{c2}}
- 写审计日志 → {{c3}}
- 发确认邮件 → {{c4}}

失败时按 {{c5}} 顺序执行补偿`,
      blanks: [
        { id: 'o1', label: '第 3 步', accept: ['③', '3', '写审计日志'], width: 90 },
        { id: 'o2', label: '第 4 步', accept: ['④', '4', '发确认邮件', '给客户发确认邮件'], width: 110 },
        { id: 'c1', label: '建工单的补偿', accept: ['关闭工单', '关单', '标记关闭'], width: 100 },
        { id: 'c2', label: '扣库存的补偿', accept: ['回补库存', '返还库存', '加回库存'], width: 100 },
        { id: 'c3', label: '审计日志的补偿', accept: ['不补偿', '无需补偿', '保留', '不回滚'], width: 90 },
        { id: 'c4', label: '发邮件的补偿', accept: ['无法补偿', '不可补偿', '不能补偿', '无'], width: 100 },
        { id: 'c5', label: '补偿执行顺序', accept: ['逆序', '倒序', '反向'], width: 80 },
      ],
      hints: [
        '排序原则：可补偿的在前，收不回来的在后。',
        '审计日志本来就该留，不需要撤销。',
        '顺序是 建工单 → 扣库存 → 写审计日志 → 发邮件（邮件不可撤销，放最后）。补偿：关单、回补库存、不补偿、无法补偿。失败时**逆序**补偿——最后做的先撤销。',
      ],
      explanation: '核心是两条原则：**不可补偿的排最后**、**补偿逆序执行**。顺序错了，补偿逻辑再完美也救不回来。',
      approach: [
        '给每步标注"能否补偿"',
        '能补偿的排前面，不能的排最后',
        '为每步写补偿操作（不可补偿的明确标注）',
        '失败时逆序执行补偿',
      ],
      knowledge: ['Saga', '补偿事务', '步骤排序'],
      pitfalls: [
        '把发通知排在中间（失败时无法撤销）',
        '补偿按正序执行（顺序错了会冲突）',
        '用"删除"作为补偿（丢失审计痕迹）',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现拓扑排序',
      points: 20,
      prompt: '实现 `topoSort(nodes)`：`nodes` 是 `[{ id, deps: string[] }]`，返回一个执行顺序数组（依赖在前）。如果有环，返回 `null`。同级节点按 id 字典序排列，保证结果稳定。',
      starter: `function topoSort(nodes) {
  // TODO
  return []
}

return topoSort`,
      checks: [
        { name: '单节点', expr: "JSON.stringify(result([{ id: 'a', deps: [] }])) === JSON.stringify(['a'])" },
        { name: '线性依赖', expr: "JSON.stringify(result([{ id: 'b', deps: ['a'] }, { id: 'a', deps: [] }])) === JSON.stringify(['a','b'])" },
        { name: '菱形依赖', expr: "(() => { const r = result([{id:'d',deps:['b','c']},{id:'b',deps:['a']},{id:'c',deps:['a']},{id:'a',deps:[]}]); return r.indexOf('a') < r.indexOf('b') && r.indexOf('a') < r.indexOf('c') && r.indexOf('b') < r.indexOf('d') && r.indexOf('c') < r.indexOf('d') })()" },
        { name: '同级按 id 排序', expr: "JSON.stringify(result([{id:'c',deps:[]},{id:'a',deps:[]},{id:'b',deps:[]}])) === JSON.stringify(['a','b','c'])" },
        { name: '有环返回 null', expr: "result([{id:'a',deps:['b']},{id:'b',deps:['a']}]) === null" },
        { name: '自依赖视为环', expr: "result([{id:'a',deps:['a']}]) === null" },
      ],
      solution: `function topoSort(nodes) {
  const ids = nodes.map((n) => n.id).sort()
  const deps = new Map(nodes.map((n) => [n.id, new Set(n.deps || [])]))
  const out = []
  const done = new Set()

  while (out.length < ids.length) {
    const ready = ids.filter(
      (id) => !done.has(id) && [...(deps.get(id) || [])].every((d) => done.has(d)),
    )
    if (ready.length === 0) return null      // 有环
    const pick = ready[0]
    out.push(pick)
    done.add(pick)
  }

  return out
}`,
      hints: [
        '每次从"所有依赖都已完成"的节点里挑一个，挑完标记完成，重复。',
        '如果某一轮挑不出来（还有未完成的节点，但都不满足条件），说明有环。',
        '完整实现：`ids` 先排序保证稳定；循环里筛出"未完成且依赖全部完成"的节点，取第一个（字典序最小）；如果筛不出任何节点但还有剩余，返回 `null`。这个写法比 DFS 版更好懂，复杂度对几十个节点完全够用。',
      ],
      explanation: '拓扑排序是 DAG 执行器的核心。稳定排序（同级按 id）很重要——否则同一份流程定义每次跑出来的顺序可能不同，无法复现问题。',
      approach: [
        '把所有 id 排序，保证稳定性',
        '每轮找出"依赖全部已完成"的节点',
        '取字典序最小的一个加入结果',
        '一轮都找不到但还有剩余 → 有环，返回 null',
      ],
      knowledge: ['拓扑排序', 'DAG', '环检测', '稳定排序'],
      pitfalls: [
        '不排序，导致结果不稳定',
        '用 DFS 实现但忘记三色标记，环检测失效',
        '忘记处理自依赖',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '什么情况下必须用状态机而不是 DAG？',
        options: [
          { id: 'a', text: '步骤超过 10 个' },
          { id: 'b', text: '流程里有回边（可能回到之前的状态，比如不合格重新生成）' },
          { id: 'c', text: '需要并行' },
          { id: 'd', text: '有多个 LLM 调用' },
        ],
        answer: 'b',
        why: 'DAG 是无环的，表达不了回退和重做。有"不合格就回去重来"的需求，就必须用状态机。',
        stepId: 's2',
      },
      {
        id: 'q2',
        stem: '"检查不通过 → 重新生成"这个回边，最大的风险是什么？',
        options: [
          { id: 'a', text: '成本上升' },
          { id: 'b', text: '没有次数上限时会死循环，永远不收敛' },
          { id: 'c', text: '延迟变高' },
          { id: 'd', text: '没有风险' },
        ],
        answer: 'b',
        why: '线上一定会遇到那个"怎么改都过不了"的输入。每条回边都必须有计数器，超了转人工。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '为什么"发通知邮件"这类步骤要排在流程最后？',
        options: [
          { id: 'a', text: '因为邮件服务慢' },
          { id: 'b', text: '因为它不可补偿，一旦发出就收不回来；排在最后能让前面失败时不需要撤销它' },
          { id: 'c', text: '因为用户想最后收到' },
          { id: 'd', text: '为了省成本' },
        ],
        answer: 'b',
        why: 'Saga 的排序原则：可补偿的在前，不可补偿的在后。顺序错了，补偿逻辑再完美也没用。',
        stepId: 's5',
      },
      {
        id: 'q4',
        stem: '幂等键的粒度应该是？',
        options: [
          { id: 'a', text: '整个流程一个' },
          { id: 'b', text: '每个步骤一个（runId + 步骤名）' },
          { id: 'c', text: '每个用户一个' },
          { id: 'd', text: '不需要' },
        ],
        answer: 'b',
        why: '流程级幂等键会导致"某一步失败重跑时，其他步骤被误判为已完成"。必须按步骤区分。',
        stepId: 's3',
      },
      {
        id: 'q5',
        stem: '审批界面最重要的一条设计是？',
        options: [
          { id: 'a', text: '展示完整内容而不是摘要，并明确标注不可逆' },
          { id: 'b', text: '只给"通过/拒绝"两个按钮' },
          { id: 'c', text: '越简洁越好' },
          { id: 'd', text: '自动通过以节省时间' },
        ],
        answer: 'a',
        why: '审批人必须在信息充分的情况下决策。只给两个按钮会导致"勉强通过后手工补救"，反而增加风险。',
        stepId: 's4',
      },
      {
        id: 'q6',
        stem: '关于编排框架选型，最务实的原则是？',
        options: [
          { id: 'a', text: '一开始就用最成熟的框架' },
          { id: 'b', text: '先用最笨的方式（函数 + 状态表）跑通，等有多个流程且反复改动时再抽象' },
          { id: 'c', text: '永远不用框架' },
          { id: 'd', text: '看哪个 star 多' },
        ],
        answer: 'b',
        why: '先上框架的团队常在调试框架本身。等你真正知道需要什么能力时，再选型才准。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：编排层',
    contributes:
      '这一课把项目的问答链路从"一串 await"改造成可恢复、可观测、可人工介入的流程，并支持"批量处理"这种长任务。',
    tasks: [
      '把问答链路改造成状态机：draft → classified → retrieving → answering → checking → done，每个转移落 runEvent',
      '给"checking → answering"回边加计数器（最多 2 次），超了转 needs_human',
      '实现 runStep 包装：stepKey = runId + 步骤名，纯计算步骤可 replay，有副作用的不可 replay',
      '把"批量索引文档"改造成 DAG：先拓扑排序，无依赖的文档并行处理，失败的单独重试',
      '加人工审批节点：涉及"发送给外部用户"的回答必须人工确认，展示完整正文，支持编辑后回写',
      '给"建工单 → 扣额度 → 发通知"这条链路实现逆序补偿',
      '每个步骤打 span，做一张流程看板：完成率、平均步数、重试率、人工介入率、各步 P95',
    ],
    done: '一条流程跑到第 3 步失败，重跑时前两步直接 replay 不重复执行；批量索引 100 份文档，中途杀掉进程重启，能从断点继续而不是从头开始；看板上能看到"重试率从 2% 涨到 15%"并定位到是哪个下游变慢。',
  },

  further: [
    { text: 'Anthropic · Building Effective Agents（五种工作流模式的原始出处）' },
    { text: 'Temporal 文档 · Saga 模式与补偿' },
    { text: '知识地图 04 Agent · 编排模式（/guide/04-agent）' },
  ],
}
