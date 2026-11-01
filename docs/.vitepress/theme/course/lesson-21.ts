import type { Lesson } from './types'

/**
 * 第二十一课：AI Coding
 *
 * 核心立场：AI 写代码不难，难的是"它写的代码能不能进主干"。
 * 这一课讲的是从"让 AI 写"到"让 AI 按工程规范交付"。
 */
export const lesson21: Lesson = {
  id: 'L21',
  moduleId: 'aicoding',
  order: 21,
  path: '/learn/21-ai-coding',
  title: 'AI Coding：从"帮我写个函数"到"按规范交付"',
  subtitle: 'AI 生成的代码不是免费劳动力，是"需要被审查的初级同事的输出"。',
  minutes: 60,
  level: '实战',
  outcome: '能建立一套让 AI 产出可直接进主干的流程：规格、上下文、验证、审查四步闭环。',
  goals: [
    '区分 AI Coding 的三个层次，知道自己现在在哪一层',
    '给 AI 正确的上下文（仓库地图、约定、范例），而不是只说"帮我改一下"',
    '用规格驱动的方式把模糊需求变成可验收的任务',
    '建立验证闭环：类型、测试、lint、CI 四道闸',
    '用正确的方法审查 AI 生成的代码，抓住它特有的错误模式',
    '写一份团队级 AI 使用规范，说清什么能交给 AI、什么不能',
  ],
  prereqs: [
    '有至少一个月的 AI 辅助编码经验',
    '有自己的项目，能跑测试和类型检查',
    '学过第四课，理解类型系统能挡住什么',
  ],

  steps: [
    {
      id: 's1',
      title: '三个层次：你在哪一层',
      checkpoint: '为什么"AI 帮我写完了"和"AI 帮我交付了"是两件事？',
      blocks: [
        {
          type: 'table',
          head: ['层次', '形态', 'AI 的角色', '你的角色', '产出质量'],
          rows: [
            ['L1 补全', '编辑器里 Tab 补全', '猜下一行', '写全部逻辑', '取决于你'],
            ['L2 对话式', '贴一段代码说"帮我改成 X"', '局部改写', '判断对不对、贴回去', '取决于你的审查'],
            ['L3 规格驱动', '给 spec + 约束 + 验收标准，AI 改多个文件并自测', '执行者', '写规格、审结果、定标准', '**取决于规格和验证**'],
          ],
        },
        {
          type: 'p',
          text: '大多数人在 L2 就停了：让 AI 改一个函数，复制粘贴，跑一下没报错就提交。这个模式的天花板很低，因为**你仍然是瓶颈**——每一行都要你读、你判断、你粘贴。',
        },
        {
          type: 'p',
          text: 'L3 的关键变化不是"AI 更强"，而是**你把工作重心从"写代码"移到了"写验收标准"**。这和你带一个初级工程师是一样的：你不会给他一段代码让他改，你会给他一个任务、约束、验收条件，然后 review 结果。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一个判断标准',
          text: '**"如果这段代码是一个实习生写的，我敢不敢直接合并？"** 不敢，就说明缺了验证环节。L3 不是"更信任 AI"，而是"建立了不依赖信任的机制"——类型检查、测试、lint、CI。**机制到位了，谁写的就不重要了。**',
        },
        {
          type: 'analogy',
          title: '和 code review 对照',
          text: '你 review 同事的 PR 时，看的是"这个改动是否符合我们的约定、有没有测试、边界处理了没"。review AI 的产出应该用**完全一样的标准**，而不是"看起来对就行"。**降低标准是 AI Coding 最大的风险来源。**',
        },
      ],
    },

    {
      id: 's2',
      title: '上下文：AI 不知道你的约定',
      checkpoint: '同一句"加个接口"，为什么在你项目里 AI 写出来的东西总是不对味？',
      blocks: [
        {
          type: 'p',
          text: '因为 AI 只知道"通用的写法"，不知道**你项目的写法**。它会用 `axios`，而你项目用 `fetch` 封装；它会 `console.log`，而你项目用 `logger`；它会 `throw new Error`，而你项目用 `AppError`。',
        },
        {
          type: 'code',
          lang: 'markdown',
          title: '一份有效的项目约定文件（AGENTS.md / CLAUDE.md）',
          note: '放在仓库根目录，AI 工具会自动读。写"具体的规则 + 反例"，不要写"请写高质量代码"这种废话。',
          code: `# 项目约定

## 技术栈
- Node 22 + TypeScript strict，ESM，无框架（原生 node:http）
- 数据库：PostgreSQL + pgvector，用 node-postgres，不用 ORM
- 校验：zod，所有外部输入必须过 schema

## 目录结构
src/domain/        实体与领域错误，**不 import 任何 IO**
src/application/   用例编排，只依赖 domain 的接口
src/infrastructure/ 数据库、外部 API 的具体实现
src/http/          路由与请求响应转换

## 必须遵守
- 错误：抛 AppError 子类（见 src/domain/errors.ts），**不要 throw new Error**
- 日志：用 src/lib/logger.ts 的 logger，**不要 console.log**
- 数据库查询：一律参数化（$1/$2），**不要拼字符串**
- 时间：用 src/lib/clock.ts 的 now()，**不要直接 new Date()**（测试要能注入）
- 每个导出的函数必须有返回类型标注

## 反例（这些是错的）
- ❌ \`const user = await db.query('SELECT * FROM users WHERE id = ' + id)\`
- ✅ \`await db.query('SELECT * FROM users WHERE id = $1', [id])\`
- ❌ \`catch (e) { console.log(e); throw new Error('failed') }\`
- ✅ \`catch (e) { logger.error({ err: e }, 'query failed'); throw new DbError('查询失败') }\`

## 测试
- 单元测试放同目录 *.test.ts，用 node:test
- 每个用例只测一个行为，用例名写"期望行为"而不是"测试函数"

## 不要做
- 不要新增依赖，除非我明确要求
- 不要改 tsconfig / eslint 配置
- 不要"顺手重构"无关代码`,
        },
        {
          type: 'table',
          head: ['该给的上下文', '怎么给', '效果'],
          rows: [
            ['目录结构', '贴 tree 或说明分层', 'AI 知道新文件放哪'],
            ['一个范例文件', '"照着 src/http/notes.ts 的写法"', '风格立刻对齐'],
            ['约定与反例', 'AGENTS.md', '避免反复纠正同样的错'],
            ['错误类型定义', '贴 errors.ts', 'AI 会用对的错误类'],
            ['验收标准', '测试用例或断言列表', 'AI 知道什么时候算完'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '最没用的三句提示',
          text: '① **"帮我优化一下"**——优化什么？性能、可读性、还是减少重复？② **"加个错误处理"**——什么错误？怎么处理？抛还是降级？③ **"参考一下项目风格"**——它看不到你的风格，除非你贴出来。**模糊的指令得到模糊的结果，这不是 AI 的问题。**',
        },
      ],
    },

    {
      id: 's3',
      title: '规格驱动：先写验收标准，再写代码',
      checkpoint: '为什么"让 AI 一次改 8 个文件"通常以失败告终？',
      blocks: [
        {
          type: 'p',
          text: '因为一次改太多，出错时你不知道是哪一步错了，AI 也不知道该修哪里。**规格驱动的核心是把大改动拆成"可独立验证的小步"。**',
        },
        {
          type: 'flow',
          title: '四步：spec → plan → tasks → code',
          ascii: `① spec（你写）
   目标：POST /api/notes 支持 tags 字段
   约束：tags 是 string[]，最多 5 个，每个 1~20 字
   验收：
     - 传合法 tags 返回 201，body 含 tags
     - 传 6 个 tags 返回 400，错误码 VALIDATION_ERROR
     - 不传 tags 时默认 []
     - 已有 12 个测试全部通过

② plan（AI 出，你审）
   1. domain/note.ts 加 tags 字段与校验
   2. infrastructure 加 tags 列（迁移 005）
   3. http/notes.ts 解析 body 时传 tags
   4. 补 3 个测试
   ← 你审这一步：有没有漏、有没有多余

③ tasks（拆成可独立验证的提交）
   T1: domain + 测试（可独立跑通）
   T2: 迁移 + repo（可独立跑通）
   T3: http 层 + 集成测试

④ code（逐个执行，每个都跑测试）
   T1 → 测试绿 → T2 → 测试绿 → T3 → 全绿`,
        },
        {
          type: 'p',
          text: '**关键在于第 ② 步"你审 plan"**。这是成本最低的纠错点——在 AI 写了 500 行之前发现"它理解错了需求"，比事后 review 便宜一百倍。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '验收标准要写成"可执行的断言"',
          text: '不要写"正确处理 tags"，要写"传 6 个 tags 返回 400 且错误码是 VALIDATION_ERROR"。**前者你没法验证，后者能直接写成测试。** 这和第六课讲的"把要求变成可验证的断言"是同一件事——只不过对象从 prompt 变成了代码任务。',
        },
        {
          type: 'p',
          text: '还有一个实践技巧：**先让 AI 写测试，你审测试，再让它写实现**。测试是你和 AI 之间的"合同"——它证明了 AI 理解对了需求，而且实现完成后有东西能验证。**反过来（先写实现后补测试）通常得到的是"照着实现写的测试"，什么都测不出来。**',
        },
      ],
    },

    {
      id: 's4',
      title: '验证闭环：四道闸，一道都不能少',
      checkpoint: 'AI 说"我已经测试过了"，你该信吗？',
      blocks: [
        {
          type: 'p',
          text: '不该。它可能只是"跑了一下没报错"，或者"自己写了个能通过的测试"。**验证必须是机器执行的、可复现的、和你的标准一致的。**',
        },
        {
          type: 'table',
          head: ['闸', '检查什么', 'AI 最常犯的错'],
          rows: [
            ['类型检查', '`tsc --noEmit`', '用 `as any` 绕过、漏掉 `undefined` 分支'],
            ['测试', '`npm test`', '写"必然通过"的测试、只测 happy path'],
            ['Lint', '`eslint` / `ruff`', '`// eslint-disable-next-line` 一把梭'],
            ['CI', '全部 + 构建', '本地过了但 CI 挂了（环境差异）'],
          ],
        },
        {
          type: 'code',
          lang: 'json',
          title: '把四道闸做成一条命令',
          code: `{
  "scripts": {
    "check": "npm run typecheck && npm run lint && npm test && npm run build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "test": "node --test"
  }
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '重点检查"绕过行为"',
          text: 'AI 为了让检查通过，会做一些"技术上讲得通但破坏规矩"的事：`as any`、`@ts-ignore`、`eslint-disable`、`try { } catch { }` 空捕获、把断言改成 `expect(true).toBe(true)`、删掉失败的测试。**review 时要专门 grep 这些模式**——它们比"写错逻辑"更危险，因为它们让检查失去了意义。',
        },
        {
          type: 'code',
          lang: "bash",
          title: 'review 前先 grep 一遍这些模式',
          code: `# 类型逃逸
git diff main... | grep -nE 'as any|@ts-ignore|@ts-expect-error|eslint-disable'

# 空捕获（吞掉错误）
git diff main... | grep -nE 'catch\\s*\\{\\s*\\}|catch\\s*\\(\\w+\\)\\s*\\{\\s*\\}'

# 假测试
git diff main... | grep -nE 'expect\\(true\\)|it\\.skip|test\\.skip|describe\\.skip'

# 调试残留
git diff main... | grep -nE 'console\\.log|debugger|TODO|FIXME'`,
        },
        {
          type: 'p',
          text: '还有一个非常有效的手段：**让 AI 自己写"失败测试"**。让它先写一个"当前代码应该失败"的测试，跑一遍确认它真的失败，再改代码让它通过。**这能挡住"测试写反了"和"测试什么都没测"这两种最常见的假验证。**',
        },
      ],
    },

    {
      id: 's5',
      title: 'Review AI 代码：抓它特有的错误模式',
      checkpoint: 'AI 写的代码最常见的 bug 是什么类型？',
      blocks: [
        {
          type: 'p',
          text: 'AI 的错误模式和人类不一样。人类容易写错边界条件；**AI 容易写出"看起来合理但没考虑上下文"的代码**。',
        },
        {
          type: 'table',
          head: ['模式', '表现', '怎么发现'],
          rows: [
            ['幻觉 API', '调了不存在的方法 / 参数名记错', '类型检查能抓大部分；剩下靠读'],
            ['忽略项目约定', '用 axios 而项目用 fetch 封装', '看 import 和风格'],
            ['边界缺失', '没处理空数组 / null / 超长输入', '问"如果这里是空呢"'],
            ['错误处理糊弄', 'catch 了但只 console.log', 'grep catch 块'],
            ['过度设计', '为一个小功能引入三层抽象', '问"这层现在有人用吗"'],
            ['复制粘贴遗留', '变量名不匹配上下文、注释和代码不符', '读注释和代码是否一致'],
            ['测试造假', '测试只覆盖 happy path、断言恒真', '把实现改坏，看测试会不会红'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '最有效的 review 手法：把实现改坏',
          text: '**故意把一处逻辑改错（比如把 `>=` 改成 `>`），跑测试。** 如果测试还全绿，说明这些测试根本没覆盖到那段逻辑。这个动作 30 秒，能立刻判断"测试是真有用还是摆设"。**这是本课性价比最高的技巧。**',
        },
        {
          type: 'p',
          text: 'Review 的顺序也很重要，建议按这个顺序看：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**先看测试**：测试写对了，实现大概率对；测试糊弄，实现一定有问题。',
            '**再看接口**：函数签名、参数、返回值是否符合项目约定。',
            '**再看错误路径**：每个 `throw`、每个 `catch`、每个可能为 null 的地方。',
            '**最后看实现细节**：这时候大部分问题已经被前面的步骤暴露了。',
          ],
        },
        {
          type: 'p',
          text: '还有一条：**不要 review 你没时间认真看的代码**。AI 能在 30 秒生成 500 行，你没法在 30 秒审完。**要么留出足够时间审，要么让它拆小。** "先合进去再说"是所有 AI Coding 事故的共同起点。',
        },
      ],
    },

    {
      id: 's6',
      title: '团队规范：什么能交给 AI，什么不能',
      checkpoint: '哪些代码你绝不该让 AI 直接写进主干？',
      blocks: [
        {
          type: 'table',
          head: ['类别', '能不能交给 AI', '条件'],
          rows: [
            ['样板代码（CRUD、类型定义）', '✅ 完全可以', '有测试 + 类型检查'],
            ['重构（提取函数、改名）', '✅ 可以', '有测试覆盖，小步提交'],
            ['测试用例', '✅ 可以', '**必须人工审**，防止"假测试"'],
            ['业务逻辑', '⚠️ 谨慎', '规格要写清，测试要人工写'],
            ['安全相关（鉴权、加密）', '❌ 不建议', '必须人工写 + 安全评审'],
            ['数据库迁移', '⚠️ 谨慎', '必须人工审 SQL，先在副本上跑'],
            ['配置 / CI / 部署脚本', '❌ 不建议', '出错影响面大，且难回滚'],
            ['许可证 / 合规相关代码', '❌ 不可以', '来源和责任必须清晰'],
          ],
        },
        {
          type: 'code',
          lang: 'markdown',
          title: '团队规范模板（可以直接抄）',
          code: `# AI 编码规范

## 可以做
- 生成样板代码、类型定义、测试骨架
- 重构已有代码（必须有测试覆盖）
- 解释代码、写注释、写文档
- 排查报错（提供完整错误信息和相关代码）

## 必须人工把关
- 业务规则实现：规格由人写，测试由人写
- 数据库迁移：SQL 必须人工审，先在副本执行
- 任何涉及权限、金额、对外发送的代码

## 禁止
- 把 API Key、密钥、真实用户数据贴进对话
- 提交含 as any / @ts-ignore / eslint-disable 的代码而不说明原因
- 提交 AI 生成但自己没读懂的代码
- 用 AI 生成"绕过检查"的代码（改测试、关 lint）

## PR 要求
- 说明哪些部分是 AI 生成、哪些是人工修改
- 必须通过 npm run check
- 涉及新依赖要在描述里说明理由`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '一条底线',
          text: '**"提交自己没读懂的代码"是唯一不可接受的行为。** 不是因为它会立刻出事，而是因为它把技术债变成了"无人拥有的技术债"——出了问题没人能修，因为没人知道它是怎么工作的。**AI 可以写，你必须懂。**',
        },
        {
          type: 'qa',
          q: '那效率提升到底有多少？值得投入这么多规范吗？',
          a: '真实数据：**样板代码和测试能省 50~70% 时间，业务逻辑能省 20~30%，复杂重构基本不省**（因为 review 成本高）。综合下来整体提效 25~40%，不是十倍。而那些"AI 让我十倍速"的说法，通常没算 review、调试、返工的时间。**规范的价值不是提高上限，是防止下限崩塌**——没有规范，AI 会以 10 倍速度生产技术债。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '给对上下文',
      points: 10,
      prompt: '你要让 AI 在项目里加一个"删除笔记"的接口。下面哪种提示最可能一次得到可用的结果？',
      options: [
        { id: 'a', text: '"帮我加个删除笔记的接口"' },
        { id: 'b', text: '"参照 src/http/notes.ts 里 createNote 的写法，加 deleteNote：路由 DELETE /api/notes/:id，校验 id 是 uuid，不存在返回 404，成功返回 204；权限校验必须查 owner_id，不能只按 id 删；补两个测试：正常删除、删别人的返回 404"' },
        { id: 'c', text: '"用最佳实践实现删除笔记"' },
        { id: 'd', text: '"写一个 RESTful 的 delete endpoint"' },
      ],
      answer: ['b'],
      hints: [
        'AI 缺的不是能力，是"你项目的约定"和"验收标准"。',
        '注意 b 里有三样东西：范例文件、具体规格、可验证的验收条件。',
        'b 是最可能一次成功的：给了范例（风格对齐）、给了路由和状态码（明确）、给了权限要求（关键约束）、给了测试用例（验收标准）。a 太模糊；c 的"最佳实践"是空话；d 只说了风格，没说业务。',
      ],
      explanation: '正确答案是 b。有效提示 = 范例 + 规格 + 约束 + 验收标准。缺一样，就会多一轮返工。',
      approach: [
        '指一个范例文件，让风格自动对齐',
        '写清路由、方法、状态码',
        '写出关键约束（这里是权限）',
        '给出可验证的验收条件（测试用例）',
      ],
      knowledge: ['上下文工程', '规格驱动', '验收标准'],
      pitfalls: [
        '用"最佳实践""优化一下"这类空话',
        '只说功能不说约束',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '识别"绕过检查"',
      points: 15,
      prompt: 'AI 为了让 CI 通过，可能做哪些"技术上通过但破坏规矩"的事？（多选）',
      options: [
        { id: 'a', text: '用 `as any` 绕过类型错误' },
        { id: 'b', text: '加 `// eslint-disable-next-line` 消掉警告' },
        { id: 'c', text: '把失败的测试改成 `it.skip`' },
        { id: 'd', text: '`catch (e) {}` 空捕获吞掉异常' },
        { id: 'e', text: '认真修好类型错误并补上缺失的分支处理' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        '想"让检查通过"和"让代码正确"的区别。',
        'e 是正确做法，不是绕过。',
        'a、b、c、d 都是让检查失效的手段——检查过了但问题还在，甚至更糟（因为以后也不会被发现）。e 是唯一正确的。**review 时要专门 grep 这些模式。**',
      ],
      explanation: 'a、b、c、d 都是绕过行为。它们的共同特征是"让指标好看但不解决问题"，比写错逻辑更危险。',
      approach: [
        'PR 前 grep `as any` / `@ts-ignore` / `eslint-disable`',
        'grep 空 catch 块',
        '检查有没有 skip 掉的测试',
        '要求说明每一处 disable 的理由',
      ],
      knowledge: ['验证闭环', '绕过检查', 'code review'],
      pitfalls: [
        '只看 CI 绿了就合并',
        '不检查被 skip 的测试',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '设计任务拆分',
      points: 15,
      prompt: '需求："给笔记加 tags 字段，支持创建时传入、列表返回、按 tag 筛选"。把它拆成可独立验证的三步。',
      templateLang: 'text',
      template: `T1: 领域层 —— {{t1}}
    验收：{{v1}}

T2: 存储层 —— 加 tags 列（迁移）+ 仓储读写
    验收：{{v2}}

T3: {{t3}}
    验收：{{v3}}

拆分原则：每一步都能{{p1}}，且不依赖后面步骤完成`,
      blanks: [
        { id: 't1', label: 'T1 做什么', accept: ['加 tags 字段与校验', '定义 tags 类型与校验', '领域模型加 tags', '加 tags 类型和校验'], width: 160 },
        { id: 'v1', label: 'T1 验收', accept: ['单元测试通过', '校验测试通过', '测试通过', '类型检查通过'], width: 130 },
        { id: 'v2', label: 'T2 验收', accept: ['仓储测试通过', '集成测试通过', '能读写 tags', '测试通过'], width: 130 },
        { id: 't3', label: 'T3 做什么', accept: ['http 层', 'http 层加 tags', '接口层', '路由层', 'http 层与集成测试'], width: 130 },
        { id: 'v3', label: 'T3 验收', accept: ['集成测试通过', '接口测试通过', '端到端测试通过', '测试通过'], width: 130 },
        { id: 'p1', label: '拆分原则', accept: ['独立跑通', '单独验证', '独立验证', '独立测试', '单独跑通'], width: 120 },
      ],
      hints: [
        '按分层拆：领域 → 存储 → 接口。',
        '每一步都要有自己的测试，能独立跑绿。',
        '① 领域层加 tags 字段与校验（验收：单元测试通过）② 存储层加列 + 仓储读写（验收：仓储/集成测试通过）③ HTTP 层解析与返回 + 集成测试（验收：接口测试通过）。原则：每一步都能独立跑通，不依赖后面。',
      ],
      explanation: '按分层拆分的好处是每步都能独立验证，出错时范围很小。如果一次性改三层，测试红了不知道是哪层的问题。',
      approach: [
        '按依赖方向拆：领域 → 存储 → 接口',
        '每步配自己的测试',
        '每步完成后跑全量测试，确认没破坏别的',
        '每步单独提交，便于回滚',
      ],
      knowledge: ['任务拆分', '分层', '独立验证'],
      pitfalls: [
        '一次改三层（出错难定位）',
        '拆完但每步都不能独立跑通',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现 diff 规范检查',
      points: 20,
      prompt: '实现 `lintDiff(diff, rules)`。`diff` 是 unified diff 文本，只检查以 `+` 开头（新增）的行。`rules` 是 `[{ name, pattern, allowComment }]`，`pattern` 是正则字符串。返回 `{ violations: [{rule, line}], passed }`。`allowComment` 为 true 时，如果该行同时含有 `// reason:` 则不算违规。',
      starter: `function lintDiff(diff, rules) {
  // TODO
  return { violations: [], passed: true }
}

return lintDiff`,
      checks: [
        {
          name: '检出 as any',
          expr: "(() => { const d = '+ const x = y as any'; const r = result(d, [{name:'no-any', pattern:'as any'}]); return r.violations.length === 1 && r.passed === false })()",
        },
        {
          name: '忽略删除行和上下文行',
          expr: "(() => { const d = '- const x = y as any\\n const z = 1\\n+ const w = 2'; const r = result(d, [{name:'no-any', pattern:'as any'}]); return r.violations.length === 0 && r.passed === true })()",
        },
        {
          name: '忽略 diff 头部',
          expr: "(() => { const d = '+++ b/file.ts\\n+ ok'; const r = result(d, [{name:'no-any', pattern:'as any'}]); return r.passed === true })()",
        },
        {
          name: 'allowComment 生效',
          expr: "(() => { const d = '+ const x = y as any // reason: 第三方类型缺失'; const r = result(d, [{name:'no-any', pattern:'as any', allowComment:true}]); return r.violations.length === 0 })()",
        },
        {
          name: 'allowComment 不生效时仍违规',
          expr: "(() => { const d = '+ const x = y as any // reason: 第三方类型缺失'; const r = result(d, [{name:'no-any', pattern:'as any'}]); return r.violations.length === 1 })()",
        },
        {
          name: '多条规则各自计数',
          expr: "(() => { const d = '+ a as any\\n+ console.log(1)'; const r = result(d, [{name:'no-any', pattern:'as any'}, {name:'no-log', pattern:'console\\\\.log'}]); return r.violations.length === 2 })()",
        },
      ],
      solution: `function lintDiff(diff, rules) {
  const violations = []
  const lines = String(diff).split('\\n')

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.startsWith('+')) continue
    if (raw.startsWith('+++')) continue          // diff 头

    const content = raw.slice(1)
    for (const rule of rules) {
      const re = new RegExp(rule.pattern)
      if (!re.test(content)) continue
      if (rule.allowComment && /\\/\\/\\s*reason:/.test(content)) continue
      violations.push({ rule: rule.name, line: i + 1 })
    }
  }

  return { violations, passed: violations.length === 0 }
}`,
      hints: [
        '只处理 `+` 开头的行，但要排除 `+++` 这个 diff 头部。',
        '`allowComment` 是"同一行里有 `// reason:`"才豁免。',
        '完整实现：按行 split；`startsWith("+")` 且不是 `startsWith("+++")` 才算新增行；`slice(1)` 去掉前缀；对每条规则用 `new RegExp(pattern)` 测试；命中时如果 `allowComment` 且行内含 `// reason:` 就跳过；否则 push 违规（行号用 `i+1`，方便对到 diff 里）。',
      ],
      explanation: '这个脚本能接进 CI，把"绕过检查"的行为挡在合并前。它比人工 review 可靠——人看 500 行 diff 会疲劳，正则不会。',
      approach: [
        '按行遍历 diff',
        '筛出新增行（`+` 开头但不是 `+++`）',
        '去掉行首 `+` 得到实际内容',
        '逐条规则正则匹配',
        'allowComment 且有 reason 时豁免',
        '记录规则名和行号',
      ],
      knowledge: ['diff 解析', '正则', 'CI 检查', '规范落地'],
      pitfalls: [
        '把 `+++ b/file.ts` 当成新增行',
        '检查删除行（`-` 开头）造成误报',
        '用字符串 includes 而不是正则，导致转义失效',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: 'AI Coding 三个层次中，L3（规格驱动）的关键变化是？',
        options: [
          { id: 'a', text: '用了更强的模型' },
          { id: 'b', text: '人的工作重心从"写代码"移到"写验收标准 + 审查结果"' },
          { id: 'c', text: 'AI 能自动部署' },
          { id: 'd', text: '不需要 review 了' },
        ],
        answer: 'b',
        why: 'L3 不是更信任 AI，而是建立了不依赖信任的机制。人的角色变成"写规格、定标准、审结果"。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '为什么同一句"加个接口"，AI 写出来的东西总是不对味？',
        options: [
          { id: 'a', text: '模型不够强' },
          { id: 'b', text: '它不知道你项目的约定（用什么库、怎么抛错、日志怎么写）' },
          { id: 'c', text: '提示词太短' },
          { id: 'd', text: '需要付费版' },
        ],
        answer: 'b',
        why: 'AI 只知道通用写法。给它范例文件 + 约定文档，风格会立刻对齐。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '在"spec → plan → tasks → code"里，成本最低的纠错点是？',
        options: [
          { id: 'a', text: '审 code' },
          { id: 'b', text: '审 plan（在它写 500 行之前发现理解错了）' },
          { id: 'c', text: '审 tasks' },
          { id: 'd', text: '不用审，直接跑测试' },
        ],
        answer: 'b',
        why: 'plan 阶段纠错成本最低。等它写完 500 行再发现需求理解错了，返工成本是十倍。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '判断 AI 写的测试是否真的有用，最快的办法是？',
        options: [
          { id: 'a', text: '读一遍测试代码' },
          { id: 'b', text: '故意把实现改坏一处，看测试会不会红' },
          { id: 'c', text: '看测试覆盖率数字' },
          { id: 'd', text: '看测试数量够不够' },
        ],
        answer: 'b',
        why: '这个动作 30 秒，能立刻判断测试是真有用还是摆设。覆盖率数字可以被"跑过但没断言"的测试刷高。',
        stepId: 's5',
      },
      {
        id: 'q5',
        stem: 'AI 为了让 CI 通过而 `as any` / `eslint-disable` / `it.skip`，为什么比写错逻辑更危险？',
        options: [
          { id: 'a', text: '代码更难读' },
          { id: 'b', text: '它让检查失去意义，问题被掩盖，以后也不会被发现' },
          { id: 'c', text: '会让构建变慢' },
          { id: 'd', text: '没区别' },
        ],
        answer: 'b',
        why: '写错逻辑至少检查会红。绕过检查是"把报警器关掉"，问题还在但没人知道。',
        stepId: 's4',
      },
      {
        id: 'q6',
        stem: 'AI Coding 里唯一不可接受的行为是？',
        options: [
          { id: 'a', text: '用了 AI 生成代码' },
          { id: 'b', text: '提交自己没读懂的代码' },
          { id: 'c', text: '让 AI 写测试' },
          { id: 'd', text: '用 AI 重构' },
        ],
        answer: 'b',
        why: '它把技术债变成"无人拥有的技术债"——出问题没人能修，因为没人知道它怎么工作。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：AI 协作规范',
    contributes:
      '这一课不写业务代码，产出的是"怎么让 AI 帮你写这个项目"的规范与工具链——它会加速后面所有课的开发。',
    tasks: [
      '写一份 AGENTS.md：技术栈、目录结构、必须遵守的约定、反例、不要做的事',
      '把四道闸做成一条命令 `npm run check`（typecheck + lint + test + build）',
      '实现 lintDiff 并接进 CI：禁止 as any / @ts-ignore / eslint-disable / 空 catch / skip 测试',
      '用规格驱动的方式做一个真实需求：先写 spec（含验收断言）→ 让 AI 出 plan → 你审 → 拆 tasks → 逐个执行',
      '练习"先写测试再写实现"：让 AI 写测试，你审，再让它实现；然后故意改坏实现验证测试会红',
      '写一份团队 AI 使用规范：什么可以做、什么必须人工把关、什么禁止、PR 要写什么',
    ],
    done: '拿一个中等需求跑完整流程，记录"AI 生成 / 人工修改 / 返工"的行数比例；CI 能挡住一次故意加的 `as any`；团队里其他人能照着 AGENTS.md 让 AI 产出风格一致的代码。',
  },

  further: [
    { text: 'Anthropic · Claude Code Best Practices（AGENTS.md 类文件的写法）' },
    { text: '论文 · SWE-bench（AI 编码能力的评测基准，看看它到底能做什么）' },
    { text: '知识地图 24 AI 辅助研发工程（/guide/24-ai-assisted-dev）' },
  ],
}
