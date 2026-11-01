import type { Lesson } from './types'

/**
 * 第二十二课：Harness 与 Loop
 *
 * 核心立场：Codex / Claude Code 这类工具，强的不只是模型，是外面那层"脚手架"。
 * 理解 harness，你才能判断"我的场景该自建还是买"。
 */
export const lesson22: Lesson = {
  id: 'L22',
  moduleId: 'harness',
  order: 22,
  path: '/learn/22-harness-loop',
  title: 'Harness 与 Loop：AI 编码工具背后到底在跑什么',
  subtitle: '同一个模型，套不同的脚手架，效果能差一倍。模型不是全部。',
  minutes: 65,
  level: '实战',
  outcome: '能说清一个编码 Agent 的完整运行机制，并判断自己的场景该用现成工具还是自建。',
  goals: [
    '理解 harness 的五个组成部分，以及各自对效果的影响',
    '读懂主循环：读 → 想 → 做 → 验，以及它的终止条件',
    '设计一套最小但够用的工具集（读/写/搜/跑）',
    '处理上下文膨胀：压缩、子代理、外部记忆',
    '划清安全边界：审批、沙箱、审计',
    '判断自建 harness 的成本与收益',
  ],
  prereqs: [
    '学过第八课，理解 Agent 循环和熔断',
    '用过至少一个 AI 编码工具（Cursor / Claude Code / Copilot）',
    '学过第二十一课，知道 AI 编码的验证闭环',
  ],

  steps: [
    {
      id: 's1',
      title: 'Harness 是什么：模型之外的一切',
      checkpoint: '同一个模型，为什么在 IDE 里和在 CLI 里表现差很多？',
      blocks: [
        {
          type: 'p',
          text: 'Harness（脚手架）指模型之外、让模型能"真的干活"的那一整套东西。它包含五部分：',
        },
        {
          type: 'table',
          head: ['组成', '作用', '对效果的影响'],
          rows: [
            ['工具集', '读文件、写文件、搜索、执行命令', '**决定能力上限**（不能跑测试就不知道对不对）'],
            ['上下文管理', '哪些文件进上下文、怎么压缩、怎么检索', '**决定它在长任务里会不会跑偏**'],
            ['循环控制', '什么时候继续、什么时候停、什么时候问人', '决定它会不会死循环或过早放弃'],
            ['验证回路', '跑测试、跑类型检查、读报错', '**决定它能不能自我修正**'],
            ['安全边界', '审批、沙箱、审计', '决定你敢不敢让它跑'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '最关键的一条',
          text: '**有没有"验证回路"，是编码 Agent 的分水岭。** 能跑测试的 Agent，会自己发现错误并修正；不能跑测试的 Agent，只能"看起来写完了"。这也是为什么命令行工具（能执行命令）普遍比纯对话（只能生成文本）效果好得多——**不是因为模型强，是因为它能拿到反馈**。',
        },
        {
          type: 'p',
          text: '回答 checkpoint：IDE 里通常有更强的上下文（打开的文件、语言服务的类型信息、项目索引），CLI 里通常有更强的执行能力（能跑测试、能装依赖）。**两边各缺一半**，所以现在的趋势是融合——IDE 里加终端，CLI 里加语言服务。',
        },
        {
          type: 'analogy',
          title: '和 Vue 的运行时对照',
          text: '模型像"组件的 render 函数"——它只负责算出结果。harness 像"Vue 的运行时"——负责调度、依赖追踪、更新、错误处理。**没有运行时的 render 函数只是一段纯函数，什么都干不了。** 同理，没有 harness 的模型只是一个文本生成器。',
        },
      ],
    },

    {
      id: 's2',
      title: '主循环：四步，但每一步都有讲究',
      checkpoint: 'Agent 说"我已经完成了"，你怎么知道它真的完成了？',
      blocks: [
        {
          type: 'flow',
          title: '编码 Agent 的主循环',
          ascii: `while (not done) {
  ① 读   收集信息：相关文件、报错、目录结构
          ← 关键：读什么由"当前任务"决定，不是全读

  ② 想   决定下一步做什么
          ← 这里才是 LLM 调用

  ③ 做   调用工具：改文件、跑命令
          ← 必须有沙箱和审批

  ④ 验   跑测试 / 类型检查 / lint
          ← 没有这一步，Agent 就是"闭眼写代码"

  判断：验通过了吗？任务完成了吗？预算还剩吗？
   → 都没问题才退出
}`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: '终止条件：三选一，缺一不可',
          note: '注意"完成"不能由模型自己声明——必须由验证结果判定。这是编码 Agent 和聊天机器人的本质区别。',
          code: `type LoopState = {
  steps: number
  tokens: number
  startedAt: number
  lastVerify: { ok: boolean; output: string } | null
  consecutiveNoChange: number
}

function shouldStop(s: LoopState, limits: Limits): StopReason | null {
  // ① 验证通过 —— 唯一"成功"的终止条件
  if (s.lastVerify?.ok) return 'verified'

  // ② 预算耗尽 —— 防止死循环
  if (s.steps >= limits.maxSteps) return 'step_limit'
  if (s.tokens >= limits.maxTokens) return 'token_limit'
  if (Date.now() - s.startedAt >= limits.maxWallMs) return 'time_limit'

  // ③ 连续多轮没有任何文件变更 —— 它在"空转"
  if (s.consecutiveNoChange >= 3) return 'no_progress'

  return null
}`,
        },
        {
          type: 'table',
          head: ['终止原因', '含义', '该怎么处理'],
          rows: [
            ['verified', '测试通过', '交付，但要 review 改动'],
            ['step_limit', '步数用完了', '看轨迹找卡点，缩小任务'],
            ['token_limit', '上下文爆了', '拆任务，或用子代理隔离'],
            ['time_limit', '超时', '可能卡在某个命令上'],
            ['no_progress', '**连续几轮没改任何文件**', '它在反复"思考"而不动手，要打断'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '"no_progress" 是最容易被忽略的终止条件',
          text: 'Agent 有时会陷入"读文件 → 说我要改 → 又读另一个文件 → 又说我要改"的循环，一步都没落地。步数和 token 上限最终会拦住它，但那时候已经烧了不少钱。**检测"连续 N 轮没有任何写操作"能提前 80% 止损。**',
        },
      ],
    },

    {
      id: 's3',
      title: '工具集：四个就够，多了反而乱',
      checkpoint: '为什么给 Agent 20 个工具，它反而更容易出错？',
      blocks: [
        {
          type: 'p',
          text: '因为工具越多，模型选错的概率越高，而且工具描述会占掉大量上下文。**编码 Agent 的核心工具只需要四个**：',
        },
        {
          type: 'table',
          head: ['工具', '作用', '设计要点'],
          rows: [
            ['read', '读文件（支持行范围）', '**必须支持 offset/limit**，否则大文件一次读爆上下文'],
            ['write', '写文件（整文件或 patch）', '整文件覆盖比 patch 简单可靠；大文件用 patch'],
            ['search', '按内容/文件名搜索', '返回"文件:行号:内容"，不返回整个文件'],
            ['run', '执行命令（测试、构建、lint）', '**必须限制命令白名单 + 超时 + 输出截断**'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '工具设计里最容易被忽略的三个细节',
          code: `// ① read 必须支持行范围
{
  name: 'read_file',
  description: '读取文件内容。大文件必须指定 offset/limit，默认只读前 200 行。',
  params: { path: 'string', offset: 'number?', limit: 'number?' },
  // 返回时带上总行数，让模型知道还有多少没读
  run: async ({ path, offset = 0, limit = 200 }) => {
    const lines = (await fs.readFile(path, 'utf8')).split('\\n')
    return {
      content: lines.slice(offset, offset + limit).join('\\n'),
      totalLines: lines.length,
      truncated: offset + limit < lines.length,
    }
  },
}

// ② search 返回位置而不是内容
{
  name: 'search',
  description: '在代码库中搜索。返回匹配位置，不返回完整文件。',
  // 输出形如：src/http/notes.ts:42: export async function createNote
  // 模型会自己决定读哪个文件
}

// ③ run 必须有白名单和超时
{
  name: 'run_command',
  description: '执行项目命令。只允许测试、构建、lint、类型检查。',
  params: { command: 'string' },
  run: async ({ command }) => {
    if (!/^(npm (run )?(test|build|lint|typecheck)|node --test|tsc)\\b/.test(command)) {
      return { isError: true, content: '命令不在白名单内' }
    }
    const out = await exec(command, { timeout: 60_000, maxBuffer: 100_000 })
    return { content: truncate(out, 8000) }   // 输出必须截断
  },
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '`run` 工具是最大的风险点',
          text: '它等于"让模型在你的机器上执行任意命令"。三道防线：**① 命令白名单**（只允许测试/构建/lint，不允许 `curl`、`rm`、`git push`）；**② 沙箱**（容器、无网络、只读挂载除工作目录外的一切）；**③ 审批**（危险命令必须人确认）。**只做白名单不做沙箱是不够的**——白名单能被参数注入绕过。',
        },
        {
          type: 'p',
          text: '还有一个反直觉的建议：**不要给"删除文件"工具**。要删就让模型改内容为空、或者标记为废弃，由人来删。**删除是唯一真正不可逆的操作**，为它多设一道人工确认，成本远低于误删的代价。',
        },
      ],
    },

    {
      id: 's4',
      title: '上下文：长任务真正的瓶颈',
      checkpoint: '一个跑了 40 轮的任务，上下文里堆满了什么？',
      blocks: [
        {
          type: 'p',
          text: '堆满了：每次读文件的完整内容、每次跑测试的完整输出、每次改动的 diff。**一个 40 轮的任务，上下文能到 20 万 token，而其中 90% 是已经过时的信息。**',
        },
        {
          type: 'table',
          head: ['手段', '做法', '效果'],
          rows: [
            ['读取裁剪', 'read 只读相关行范围，不读整文件', '最有效，源头控制'],
            ['输出截断', '测试输出只保留失败部分 + 前后 10 行', '省 80% 输出 token'],
            ['旧轮次压缩', '把前 N 轮压成"已做了什么"的摘要', '省 60% 历史 token'],
            ['文件变更摘要', '不保留完整 diff，只保留"改了哪个文件的哪个函数"', '省 50%'],
            ['子代理隔离', '让子代理去搜/读，只把结论返回主循环', '**省 90%，最强大**'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '子代理：把"探索"隔离出去',
          note: '关键洞察：探索过程（读了 20 个文件）对主循环毫无价值，只有"结论"有价值。子代理的价值就是"在独立的上下文里探索，只带回结论"。',
          code: `// 主循环不要自己去读 20 个文件，派一个子代理去
async function explore(question: string): Promise<string> {
  // 子代理有独立的上下文，读多少都不影响主循环
  const sub = new Agent({ tools: ['read', 'search'], maxSteps: 15 })
  const result = await sub.run(\`
调查这个代码库，回答问题：\${question}
只返回结论，包含：
- 涉及的文件路径和关键行号
- 关键函数的签名
- 需要注意的约定
不要返回文件全文。
\`)
  return result.text
}

// 主循环里
const ctx = await explore('笔记的创建流程经过哪几层？权限在哪一层校验？')
// ctx 可能只有 300 字，但背后读了 20 个文件`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '子代理是 harness 设计里最重要的一招',
          text: '它同时解决三个问题：**上下文膨胀**（探索不污染主线）、**成本**（子代理可以用小模型）、**专注度**（主循环只看结论，不会被 20 个文件的内容干扰）。Claude Code 的 "Task" 工具、各家 IDE 的 "codebase 索引" 本质上都是这个思路的不同实现。',
        },
        {
          type: 'p',
          text: '还有一个实践：**把"项目约定"放在固定的位置**（AGENTS.md），每轮都注入但内容不变——这样能吃到 prefix cache，成本几乎为零。**而"当前任务状态"要放在最后**，因为它每次都变。**稳定的靠前，易变的靠后**，这条规则在第十八课讲过，这里同样适用。',
        },
      ],
    },

    {
      id: 's5',
      title: '安全边界：你敢让它跑什么',
      checkpoint: '一个能跑命令、能改文件的 Agent，最坏能造成什么后果？',
      blocks: [
        {
          type: 'p',
          text: '最坏情况不是"写出烂代码"，是**数据丢失和凭证泄露**。所以边界要按"后果严重性"分级：',
        },
        {
          type: 'table',
          head: ['操作', '风险', '控制'],
          rows: [
            ['读文件', '低（但可能读到密钥）', '排除 `.env`、`~/.ssh`、凭证文件'],
            ['写工作区文件', '中（可能覆盖重要代码）', 'git 保护 + 改动可 review + 可回滚'],
            ['执行测试/构建', '中（可能跑恶意脚本）', '沙箱 + 超时 + 输出截断'],
            ['装依赖', '高（可能引入恶意包）', '**必须审批**，且锁定版本'],
            ['删文件 / `git reset --hard`', '**极高**', '**禁止，或必须人工确认**'],
            ['`git push` / 部署', '**极高**', '**禁止，人工执行**'],
            ['访问网络', '高（数据外泄）', '默认禁止，白名单放行'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '审批分级的实现',
          code: `type Risk = 'safe' | 'confirm' | 'forbidden'

function classify(action: Action): Risk {
  // 只读操作：直接放行
  if (action.kind === 'read' || action.kind === 'search') return 'safe'

  // 写工作区内的文件：放行，但要能回滚（git）
  if (action.kind === 'write' && isInsideWorkspace(action.path)) return 'safe'

  // 跑白名单命令：放行（沙箱内）
  if (action.kind === 'run' && isWhitelisted(action.command)) return 'safe'

  // 装依赖、跑非白名单命令：要确认
  if (action.kind === 'run' || action.kind === 'install') return 'confirm'

  // 删除、git 破坏性操作、推送到远端、访问网络：禁止
  return 'forbidden'
}

// 审计：每次操作都记，出问题能追溯
audit.log({
  sessionId, step, action: action.kind,
  target: action.path ?? action.command,
  risk: classify(action),
  approvedBy: approval?.userId,
})`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '一个必须做的默认设置',
          text: '**默认禁止网络访问。** 编码 Agent 不需要联网就能完成任务（依赖装好之后），而联网是数据外泄和 SSRF 的唯一通道。需要联网时（比如查文档），单独开一个受限的、有白名单的通道。**"默认关，按需开"永远比"默认开，出事再关"安全。**',
        },
        {
          type: 'p',
          text: '还有一条容易被忽略：**排除敏感文件**。Agent 读文件时应该自动跳过 `.env`、`.git/config`、`~/.ssh/*`、`*.pem`、`credentials.json`。**否则一个"帮我看看配置"的请求，就可能把 API Key 送进模型上下文，进而进日志。**',
        },
      ],
    },

    {
      id: 's6',
      title: '自建还是用现成：算清这笔账',
      checkpoint: '什么情况下值得自己写一个编码 Agent？',
      blocks: [
        {
          type: 'table',
          head: ['', '用现成（Claude Code / Cursor / Copilot）', '自建 harness'],
          rows: [
            ['上手成本', '几分钟', '数周到数月'],
            ['效果', '很好（人家调了很久）', '初期通常更差'],
            ['定制空间', '有限（配置、MCP、规则文件）', '完全自由'],
            ['数据边界', '代码要出网（或私有部署）', '完全内网'],
            ['集成深度', '通用', '可深度对接内部系统'],
            ['维护成本', '零', '持续投入（模型更新、工具演进）'],
          ],
        },
        {
          type: 'p',
          text: '**绝大多数情况应该用现成工具 + 配置**，而不是自建。自建只在三种情况下合理：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**数据绝对不能出内网**，且现成工具没有可用的私有部署方案。',
            '**需要深度对接内部系统**（内部代码检索、发布平台、工单系统、专有构建链），现成工具接不进去。',
            '**要做产品**（比如你在做一个面向特定行业的编码助手），harness 是你的核心竞争力。',
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '自建最容易低估的三件事',
          text: '① **工具设计的细节**——read 要不要支持行范围、search 返回什么格式、run 怎么截断输出，每个细节都影响效果，要反复调；② **上下文策略**——什么时候压缩、什么时候派子代理，没有通用答案，要针对你的代码库调；③ **模型迭代**——模型每几个月更新一次，你的 prompt 和工具描述都要跟着调。**这三件事加起来，是一个持续投入的工程，不是一个一次性的项目。**',
        },
        {
          type: 'qa',
          q: '那"理解 harness"对我有什么用，如果我不自建？',
          a: '三个直接用处：**① 用得更对**——知道它的瓶颈在"验证回路"，你就会主动让它跑测试，而不是只让它写代码；知道上下文会膨胀，你就会把任务拆小。**② 排查更准**——它跑偏时你能判断是"工具不够""上下文脏了"还是"验证没做"，而不是笼统地说"AI 不行"。**③ 判断更稳**——有人跟你说"我们自己做一个比 Cursor 强的"，你能算出真实成本。**理解机制的价值不在于造轮子，在于不被忽悠。**',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: 'harness 的分水岭',
      points: 10,
      prompt: '同一个模型，为什么"能跑测试的编码 Agent"比"只能生成代码的对话"效果好得多？',
      options: [
        { id: 'a', text: '因为跑测试更快' },
        { id: 'b', text: '因为有了验证回路，Agent 能自己发现错误并修正，而不是"看起来写完了"' },
        { id: 'c', text: '因为测试能提升模型能力' },
        { id: 'd', text: '因为对话模式更耗 token' },
      ],
      answer: ['b'],
      hints: [
        '想"闭眼写代码"和"写一段跑一下"的区别。',
        '反馈回路是自我修正的前提。',
        'b 是对的：能跑测试意味着 Agent 每次改动后都能拿到客观反馈，错了就改。没有验证回路，它只能"生成看起来对的代码"，错在哪自己也不知道。**这是编码 Agent 效果差异的最大来源，不是模型本身。**',
      ],
      explanation: '正确答案是 b。验证回路是编码 Agent 的分水岭——它把"生成"变成了"迭代到正确"。',
      approach: [
        '判断工具有没有"执行并观察结果"的能力',
        '有反馈 → 能自我修正 → 效果好',
        '没反馈 → 只能靠"看起来对" → 效果差',
        '自己搭 harness 时，优先把验证回路做出来',
      ],
      knowledge: ['harness', '验证回路', '自我修正'],
      pitfalls: [
        '以为效果差异全来自模型',
        '只给生成能力不给验证能力',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '上下文管理手段',
      points: 15,
      prompt: '一个跑了 40 轮的长任务，上下文快爆了。哪些手段有效？（多选）',
      options: [
        { id: 'a', text: 'read 工具只读相关行范围，不读整个文件' },
        { id: 'b', text: '测试输出只保留失败部分，截断到前后 10 行' },
        { id: 'c', text: '派子代理去探索，只把结论带回主循环' },
        { id: 'd', text: '把前 N 轮压成"已做了什么"的摘要' },
        { id: 'e', text: '把所有历史原样保留，让模型自己判断哪些有用' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        '想"源头控制"和"事后压缩"两类手段。',
        'e 会让上下文更快爆掉，而且模型在超长上下文里判断力会下降。',
        'a 从源头减少（最有效）；b 省 80% 输出 token；c 最强大（探索隔离，省 90%）；d 压缩历史。e 是反模式——原样保留只会加速爆炸，而且"lost in the middle"会让它忽略中间内容。',
      ],
      explanation: 'a、b、c、d 都有效，其中 c（子代理隔离）收益最大。e 是反模式。',
      approach: [
        '源头控制：read 带行范围、search 返回位置',
        '输出控制：截断、只留失败部分',
        '历史压缩：摘要化已完成的工作',
        '探索隔离：子代理带回结论',
      ],
      knowledge: ['上下文管理', '子代理', '输出截断'],
      pitfalls: [
        '把完整文件内容塞进上下文',
        '保留完整的测试输出',
        '不压缩历史，越跑越慢越贵',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '终止条件',
      points: 15,
      prompt: '补全编码 Agent 的终止判断。要求：只有验证通过才算成功；预算耗尽要中止；连续多轮没改文件也要中止。',
      templateLang: 'ts',
      template: `function shouldStop(s, limits) {
  // 唯一"成功"的终止条件
  if (s.lastVerify?.{{t1}}) return 'verified'

  // 预算
  if (s.steps >= limits.maxSteps) return '{{t2}}'
  if (s.tokens >= limits.maxTokens) return 'token_limit'
  if (Date.now() - s.startedAt >= limits.maxWallMs) return '{{t3}}'

  // 空转检测
  if (s.consecutiveNoChange >= {{t4}}) return '{{t5}}'

  return null
}`,
      blanks: [
        { id: 't1', label: '验证通过的标志字段', accept: ['ok'], width: 60 },
        { id: 't2', label: '步数用尽的终止原因', accept: ['step_limit'], width: 100 },
        { id: 't3', label: '超时的终止原因', accept: ['time_limit'], width: 100 },
        { id: 't4', label: '连续几轮没改文件算空转', accept: ['3'], width: 50 },
        { id: 't5', label: '空转的终止原因', accept: ['no_progress'], width: 110 },
      ],
      hints: [
        '三个预算维度 + 一个行为检测。',
        '空转检测阈值一般设 2~3 轮。',
        '① `ok`（lastVerify.ok 为 true 表示测试通过）② `step_limit` ③ `time_limit` ④ 3 轮 ⑤ `no_progress`。**注意顺序**：验证通过要最先判断，否则"刚好在上限那一步通过了"会被误判为超限。',
      ],
      explanation: '终止条件的设计要点：成功条件优先判断（避免"差一步就成功却被中止"），预算是硬边界，空转检测是提前止损。',
      approach: [
        '成功条件放最前（验证通过）',
        '三个预算维度依次判断',
        '加"连续 N 轮无写操作"的行为检测',
        '中止时返回原因，便于定位',
      ],
      knowledge: ['终止条件', '熔断', '空转检测'],
      pitfalls: [
        '把预算判断放在成功判断前面',
        '只靠步数上限，让空转白白烧钱',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现操作风险分级',
      points: 20,
      prompt: '实现 `classify(action, workspace)`。`action` 形如 `{ kind, path?, command? }`，`kind` 为 `read`/`search`/`write`/`run`/`delete`/`push`。返回 `safe` / `confirm` / `forbidden`。规则：read/search → `safe`；write 且路径在工作区内 → `safe`，否则 `forbidden`；run 且命令在白名单（`npm test`、`npm run build`、`npm run lint`、`tsc`）内 → `safe`，其他 run → `confirm`；delete/push → `forbidden`。',
      starter: `function classify(action, workspace) {
  // TODO
  return 'forbidden'
}

return classify`,
      checks: [
        {
          name: '读操作放行',
          expr: "result({kind:'read', path:'a.ts'}, '/work') === 'safe'",
        },
        {
          name: '搜索放行',
          expr: "result({kind:'search'}, '/work') === 'safe'",
        },
        {
          name: '工作区内写入放行',
          expr: "result({kind:'write', path:'/work/src/a.ts'}, '/work') === 'safe'",
        },
        {
          name: '工作区外写入禁止',
          expr: "result({kind:'write', path:'/etc/passwd'}, '/work') === 'forbidden'",
        },
        {
          name: '白名单命令放行',
          expr: "result({kind:'run', command:'npm test'}, '/work') === 'safe'",
        },
        {
          name: '非白名单命令要确认',
          expr: "result({kind:'run', command:'curl http://x'}, '/work') === 'confirm'",
        },
        {
          name: '删除和推送禁止',
          expr: "result({kind:'delete', path:'/work/a.ts'}, '/work') === 'forbidden' && result({kind:'push'}, '/work') === 'forbidden'",
        },
      ],
      solution: `function classify(action, workspace) {
  const WHITELIST = ['npm test', 'npm run build', 'npm run lint', 'tsc']

  if (action.kind === 'read' || action.kind === 'search') return 'safe'

  if (action.kind === 'write') {
    const p = String(action.path ?? '')
    const ws = String(workspace ?? '')
    const inWorkspace = ws && (p === ws || p.startsWith(ws.replace(/\\/$/, '') + '/'))
    return inWorkspace ? 'safe' : 'forbidden'
  }

  if (action.kind === 'run') {
    const cmd = String(action.command ?? '').trim()
    return WHITELIST.includes(cmd) ? 'safe' : 'confirm'
  }

  return 'forbidden'
}`,
      hints: [
        '按 kind 分支，每一支返回一个风险级别。',
        '工作区判断要注意 `/work` 和 `/work-evil` 的区别（和第十六课的路径校验是同一个坑）。',
        '完整实现：read/search 直接 safe；write 判断 `p === ws` 或 `p.startsWith(ws + "/")`（先去掉 ws 尾部斜杠），在就 safe 否则 forbidden；run 检查命令是否严格等于白名单项（用 `includes`，不要用正则模糊匹配），是则 safe 否则 confirm；其余（delete/push）一律 forbidden。',
      ],
      explanation: '分级的关键是"默认拒绝"：没明确允许的都归到 forbidden。宁可多问一句，也不要有一次不可逆的误操作。',
      approach: [
        '按 kind 分四支：只读 / 写 / 执行 / 其他',
        '只读直接放行',
        '写操作校验路径在工作区内',
        '执行校验命令严格命中白名单',
        '其余一律 forbidden',
      ],
      knowledge: ['风险分级', '路径校验', '命令白名单', '默认拒绝'],
      pitfalls: [
        '用 `startsWith(ws)` 判断工作区（`/work-evil` 会绕过）',
        '用正则模糊匹配命令白名单（`npm test; rm -rf /` 会通过）',
        '把未知 kind 默认成 safe',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: 'harness 里对效果影响最大的是？',
        options: [
          { id: 'a', text: '工具数量' },
          { id: 'b', text: '有没有验证回路（能跑测试、看报错、自我修正）' },
          { id: 'c', text: 'prompt 长度' },
          { id: 'd', text: 'UI 好不好看' },
        ],
        answer: 'b',
        why: '有验证回路的 Agent 能迭代到正确；没有的只能"看起来写完了"。这是编码 Agent 的分水岭。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '为什么"完成"不能由模型自己声明？',
        options: [
          { id: 'a', text: '模型会撒谎' },
          { id: 'b', text: '它无法客观判断代码是否正确，必须由验证结果（测试/类型检查）判定' },
          { id: 'c', text: '声明太慢' },
          { id: 'd', text: '可以自己声明' },
        ],
        answer: 'b',
        why: '模型对自己输出的正确性判断很差。终止条件必须是可执行的验证，不是自然语言的"我完成了"。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: 'read 工具为什么必须支持行范围？',
        options: [
          { id: 'a', text: '为了更快' },
          { id: 'b', text: '大文件一次读全会撑爆上下文，而且大部分内容与当前任务无关' },
          { id: 'c', text: '协议要求' },
          { id: 'd', text: '没必要' },
        ],
        answer: 'b',
        why: '一个 3000 行的文件全读进来，可能只用到 20 行。支持 offset/limit 是上下文管理的第一道闸。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '子代理（sub-agent）在 harness 里的核心价值是？',
        options: [
          { id: 'a', text: '跑得更快' },
          { id: 'b', text: '在独立上下文里探索（读 20 个文件），只把结论带回主循环，避免主线被污染' },
          { id: 'c', text: '省钱' },
          { id: 'd', text: '可以并行' },
        ],
        answer: 'b',
        why: '探索过程对主循环没有价值，只有结论有价值。子代理同时解决了上下文膨胀、成本和专注度三个问题。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '编码 Agent 的网络访问应该怎么配？',
        options: [
          { id: 'a', text: '默认开放，方便查文档' },
          { id: 'b', text: '默认禁止，需要时开受限通道（白名单）' },
          { id: 'c', text: '完全不限制' },
          { id: 'd', text: '只允许 HTTP' },
        ],
        answer: 'b',
        why: '联网是数据外泄和 SSRF 的唯一通道。编码任务在依赖装好后不需要网络。"默认关、按需开"永远更安全。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: '什么情况下值得自建 harness？',
        options: [
          { id: 'a', text: '想省钱' },
          { id: 'b', text: '数据不能出内网且无私有部署方案、需深度对接内部系统、或要做产品' },
          { id: 'c', text: '觉得现成工具太慢' },
          { id: 'd', text: '任何时候都值得' },
        ],
        answer: 'b',
        why: '自建是持续投入的工程（工具调优、上下文策略、跟随模型迭代），不是一次性项目。绝大多数情况用现成 + 配置更好。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：迷你 Harness',
    contributes:
      '这一课做一个 200 行的迷你编码 Agent，只服务于"给这个项目加功能"——它会成为你后面开发所有课程项目的加速器。',
    tasks: [
      '实现四个工具：read_file（带 offset/limit 和总行数）、write_file（工作区内）、search（返回位置）、run_command（白名单 + 超时 + 输出截断）',
      '实现主循环：读→想→做→验，验证步骤跑 `npm run check`，输出只保留失败部分',
      '实现终止条件：verified / step_limit / token_limit / time_limit / no_progress',
      '实现风险分级：read/search 放行，write 限工作区，run 限白名单，delete/push 禁止',
      '实现子代理：一个只带 read+search 的 explore 代理，返回结论而非文件内容',
      '实现审计日志：每次操作记录 sessionId、step、kind、target、risk',
      '用这个 Agent 完成一个真实小需求（比如给项目加一个 health 端点），记录步数、token、耗时、人工介入次数',
    ],
    done: '给 Agent 一个"加 /health 端点并写测试"的任务，它能自己读文件、改代码、跑测试、看到失败、修正、再跑通过；故意让它删一个文件，被拒绝并记录到审计日志；对比"手动做"和"用 Agent 做"的实际耗时。',
  },

  further: [
    { text: 'Anthropic · Building Effective Agents（循环与工具设计的基础）' },
    { text: '论文 · ReAct（reasoning + acting 的原始形式）' },
    { text: '知识地图 25 Agent Harness 与 Loop（/guide/25-harness-loop）' },
  ],
}
