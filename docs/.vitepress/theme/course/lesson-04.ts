import type { Lesson } from './types'

/**
 * 第四课：TypeScript 类型工程
 *
 * 这一课不是讲语法，是讲三件事：类型怎么在边界上保护你、
 * 判别联合怎么表达状态机、以及类型什么时候该停下。
 * 内容直接服务于后面的 AI 应用：流式事件、工具 schema、Agent 状态。
 */
export const lesson04: Lesson = {
  id: 'L04',
  moduleId: 'ts',
  order: 4,
  path: '/learn/04-type-engineering',
  title: 'TypeScript 类型工程：让编译器替你挡掉一半线上事故',
  subtitle: '类型不是写给人看的注释，是能在编译期证伪的约束。用错地方，它就是噪音。',
  minutes: 75,
  level: '进阶',
  outcome: '能用判别联合把流式事件和状态机写成"漏一个分支就编译不过"，用 zod 让类型和运行时校验共用一份定义。',
  goals: [
    '说清 any / unknown / never 的区别，以及为什么边界处必须用 unknown',
    '用判别联合表达流式事件和 Agent 状态机，并做到穷尽性检查',
    '用 zod 定义一次 schema，同时得到运行时校验、TS 类型、JSON Schema',
    '用 Result 类型替代 throw，让错误在类型签名里可见',
    '判断类型体操什么时候该停，识别三种过度抽象',
    '配好 tsconfig 里真正影响正确性的那几项',
  ],
  prereqs: [
    '写过 interface 和泛型',
    '知道 union 和 intersection 的区别',
    '学过第二课，理解"边界"这个概念',
  ],

  steps: [
    {
      id: 's1',
      title: '为什么后端比前端更需要类型',
      checkpoint: '前端拿到的数据来自自己的后端；后端拿到的数据来自哪里？',
      blocks: [
        {
          type: 'p',
          text: '前端写 TS，很多时候是"给自己的代码加注解"。数据来源是你自己调用的接口，出问题最多是页面白屏。',
        },
        {
          type: 'p',
          text: '后端的处境完全不同：**每一个入参都来自不可信的外部**。可能是前端写错了、可能是别人用 curl 手搓的、可能是攻击者构造的、可能是三个月前的旧版本客户端。类型在这里的作用不是"注释"，是**在边界上把 unknown 收窄成确定的形状**。',
        },
        {
          type: 'table',
          head: ['位置', '数据可信度', '类型的价值'],
          rows: [
            ['自己写的函数内部', '高', '低——主要是防手误'],
            ['HTTP 请求体', '零', '高——必须在边界处收窄'],
            ['数据库返回值', '中（列类型可信，但可空）', '高——null 是最常见的事故源'],
            ['第三方 API 响应', '低', '高——字段可能缺失、改名、变类型'],
            ['LLM 返回的 JSON', '极低', '极高——模型会编字段、少字段、多字段'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一句话定位',
          text: '**类型系统是你在编译期能免费跑的唯一一种测试。** 它测的不是"逻辑对不对"，而是"形状对不对"——而形状错误占了线上事故的一大半。',
        },
        {
          type: 'analogy',
          title: '和 Vue 的 props 校验对照',
          text: 'Vue 的 `defineProps<{ id: string }>()` 只在开发期警告，运行时该崩还是崩。TypeScript 的类型同理——它不产生运行时保护。所以真正需要保护的地方（HTTP 入口），必须同时有类型和运行时校验，这就是这一课后面讲 zod 的原因。',
        },
      ],
    },

    {
      id: 's2',
      title: 'any / unknown / never：三个必须分清的类型',
      checkpoint: '为什么说 any 是"关闭类型检查"，而不只是"任意类型"？',
      blocks: [
        {
          type: 'p',
          text: '这三个类型经常被混用，但它们的行为完全不同，而且 any 的危害被严重低估了。',
        },
        {
          type: 'table',
          head: ['类型', '含义', '能赋给谁', '能读属性吗'],
          rows: [
            ['any', '放弃检查', '任何类型（双向）', '能，且不会报错'],
            ['unknown', '未知，但必须收窄', '只能赋给 unknown / any', '不能，必须先判断'],
            ['never', '不可能存在的值', '任何类型（单向）', '能，但代码不可达'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'any 是怎么传染的',
          code: `// 反例
function handle(body: any) {
  // 从这里开始，所有下游全部失去保护
  const title = body.title          // any
  const len = title.length          // any，拼错成 title.lenght 也不报错
  return { title, len }             // any 顺着返回值流出去
}

// 正例
function handle(body: unknown) {
  // 不判断就用不了，编译器强制你先验证
  if (typeof body !== 'object' || body === null) throw new Error('body 必须是对象')
  const b = body as Record<string, unknown>
  if (typeof b.title !== 'string') throw new Error('title 必须是字符串')
  const title = b.title             // string
  return { title, len: title.length }
}`,
          note: 'any 的问题不是"这个值没类型"，而是它会**静默地污染所有接触它的变量**。一个 any 能毁掉整条调用链的类型。',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: 'any 与 @ts-ignore 的真实成本',
          text: '项目里每多一个 any，就意味着未来某个 bug 少了一道免费防线。而 `@ts-ignore` 更糟——它连"这里有问题"的提示都抹掉了。团队里应该有一条硬规则：**新增 any 需要 review 时说明理由**，`@ts-ignore` 一律改成 `@ts-expect-error`（后者在错误消失时会报错，自动提醒你清理）。',
        },
        { type: 'h', text: 'unknown 的正确用法：边界收窄' },
        {
          type: 'code',
          lang: 'ts',
          title: '类型收窄的四种手段',
          code: `function narrow(x: unknown) {
  // 1. typeof
  if (typeof x === 'string') x.toUpperCase()

  // 2. instanceof
  if (x instanceof Date) x.toISOString()

  // 3. in 操作符（判断字段存在）
  if (typeof x === 'object' && x !== null && 'id' in x) {
    const id = (x as { id: unknown }).id
  }

  // 4. 自定义类型守卫
  if (isNote(x)) x.title
}

function isNote(v: unknown): v is { id: string; title: string } {
  return typeof v === 'object' && v !== null
    && typeof (v as any).id === 'string'
    && typeof (v as any).title === 'string'
}`,
          note: '`v is T` 这个返回类型叫类型谓词。它是把运行时判断的结果"告诉"编译器的唯一方式。',
        },
        {
          type: 'qa',
          q: 'never 在实际代码里有什么用？',
          a: '两个用途：① 表达"函数永不返回"（throw 或无限循环），比如 `function fail(msg: string): never { throw new Error(msg) }`。② 做穷尽性检查——在 switch 的 default 分支里写 `const _exhaustive: never = event`，一旦你加了新的事件类型却忘了处理，这行会编译报错。第二个用途价值极大，下一节就用到。',
        },
      ],
    },

    {
      id: 's3',
      title: '判别联合：用一个字段锁死所有状态',
      checkpoint: '为什么 `{ status: string; error?: string }` 比判别联合差？',
      blocks: [
        {
          type: 'p',
          text: '这是整节课最值钱的一节。**判别联合**（discriminated union）是指：几个对象类型共享一个字面量字段，编译器靠这个字段区分它们。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '反例：可选字段表达状态',
          code: `// 这种写法看似灵活，实际允许 4 种非法组合
type BadState = {
  status: 'loading' | 'success' | 'error'
  data?: Note
  error?: string
}

// 编译器无法阻止你写出这些：
const a: BadState = { status: 'loading', data: someNote }   // loading 却有数据？
const b: BadState = { status: 'success' }                    // 成功却没数据？
const c: BadState = { status: 'error', data: someNote }      // 出错却有数据？`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: '正例：判别联合让非法状态无法表示',
          code: `type State =
  | { status: 'loading' }
  | { status: 'success'; data: Note }
  | { status: 'error'; error: string }

// 现在这些写法全部编译报错：
// { status: 'loading', data }     → 对象字面量只能指定已知属性
// { status: 'success' }           → 缺少 data
// { status: 'error', data }       → 缺少 error

// 使用时必须先判断 status，判断后类型自动收窄
function render(s: State) {
  switch (s.status) {
    case 'loading': return '加载中'
    case 'success': return s.data.title     // 这里 s.data 一定存在
    case 'error':   return s.error          // 这里 s.error 一定存在
  }
}`,
          note: '这就是"让非法状态无法表示"（make illegal states unrepresentable）。它比写一堆 if 判断强得多，因为错误在编译期就没了。',
        },
        { type: 'h', text: '穷尽性检查：漏一个分支就编译不过' },
        {
          type: 'code',
          lang: 'ts',
          title: '加新状态时，编译器帮你找出所有要改的地方',
          code: `function render(s: State): string {
  switch (s.status) {
    case 'loading': return '加载中'
    case 'success': return s.data.title
    case 'error':   return s.error
    default:
      // 如果 State 新增了 'cancelled'，这行会报错：
      // Type 'string' is not assignable to type 'never'
      const _exhaustive: never = s
      return _exhaustive
  }
}`,
          note: '没有这个 default，加新状态时编译器一声不响，你会在线上发现某个分支返回了 undefined。',
        },
        { type: 'h', text: '真实场景：SSE 流式事件' },
        {
          type: 'code',
          lang: 'ts',
          title: 'AI 应用里最典型的判别联合',
          code: `export type StreamEvent =
  | { type: 'start'; messageId: string }
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call'; toolCallId: string; name: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown; isError: boolean }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'done'; finishReason: 'stop' | 'length' | 'tool_calls' | 'error' }
  | { type: 'error'; code: string; message: string }

// 消费端：漏处理任何一个事件类型都会编译报错
function handleEvent(e: StreamEvent) {
  switch (e.type) {
    case 'start':  return initBubble(e.messageId)
    case 'text-delta': return appendText(e.delta)
    case 'reasoning-delta': return appendReasoning(e.delta)
    case 'tool-call': return showToolCard(e.toolCallId, e.name)
    case 'tool-result': return updateToolCard(e.toolCallId, e.result, e.isError)
    case 'usage': return recordUsage(e.inputTokens, e.outputTokens)
    case 'done': return finish(e.finishReason)
    case 'error': return showError(e.code, e.message)
  }
}`,
          note: '这个类型定义会贯穿整个项目。前端渲染、后端产出、日志解析共用它，新增一种事件时前后端会同时报错——这正是你要的效果。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '什么时候该用判别联合',
          text: '只要一个对象有"互斥的状态/种类"，就该用。典型：API 响应（成功/失败）、任务状态（排队/运行/成功/失败/取消）、消息类型、表单步骤、Agent 步骤。**看到 `xxx?: string` 这种可选字段在表达状态，就该警惕。**',
        },
      ],
    },

    {
      id: 's4',
      title: '从类型到运行时：zod 让一份定义干三件事',
      checkpoint: 'TS 类型在运行时存在吗？那 HTTP 请求体怎么校验？',
      blocks: [
        {
          type: 'p',
          text: 'TypeScript 的类型在编译后**全部消失**。所以 `function f(x: Note)` 在运行时不会检查 x 是不是 Note——它只会在你读 `x.title` 时，如果 x 是 null 就崩掉。',
        },
        {
          type: 'p',
          text: '边界处必须有运行时校验。手写 `if (typeof ...)` 能行，但会带来一个致命问题：**校验逻辑和类型定义会逐渐不一致**。你给类型加了个字段，忘了加校验，类型说"一定有"，运行时说"可能是 undefined"。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'zod：单一来源',
          code: `import { z } from 'zod'

// 1. 定义一次
export const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  content: z.string().max(50_000).default(''),
  tags: z.array(z.string().max(20)).max(10).default([]),
  createdAt: z.coerce.date(),
})

// 2. 得到 TS 类型（不是手写，是推导出来的）
export type Note = z.infer<typeof NoteSchema>

// 3. 得到运行时校验
const result = NoteSchema.safeParse(input)
if (!result.success) {
  // result.error.issues[0] = { path: ['title'], message: '...' }
  throw new ValidationError(result.error.issues)
}
const note: Note = result.data     // 这里的 note 已经是收窄后的类型`,
          note: '注意 `.default("")`：zod 会让输入类型里 content 变成可选，输出类型里一定是 string。`z.input` 和 `z.output` 因此不同——这是处理"客户端可不传、服务端一定有值"的标准做法。',
        },
        { type: 'h', text: 'AI 应用的关键用法：一份 schema 生成工具定义' },
        {
          type: 'p',
          text: '这是前端转 AI 工程最实用的一个技巧。LLM 的工具调用需要 JSON Schema，而你的校验需要 zod。**写两份一定会不同步**，所以要用一份生成另一份。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'zod → JSON Schema → 工具定义',
          code: `import { zodToJsonSchema } from 'zod-to-json-schema'

const SearchParams = z.object({
  query: z.string().describe('搜索关键词，中文或英文'),
  limit: z.number().int().min(1).max(20).default(5).describe('返回条数'),
  tags: z.array(z.string()).optional().describe('按标签过滤'),
})

const tool = {
  name: 'search_notes',
  description: '在用户的笔记里做语义搜索',
  parameters: zodToJsonSchema(SearchParams, { target: 'openai' }),
}

// 模型返回的参数，用同一个 schema 校验
const parsed = SearchParams.safeParse(toolCall.arguments)
if (!parsed.success) {
  // 不要抛错，把错误信息喂回给模型让它重试
  return { error: '参数不合法：' + parsed.error.message }
}`,
          note: '注意最后那段注释：模型给错参数时，把校验错误**返回给模型**比抛异常更有效，它通常能在第二轮改对。',
        },
        {
          type: 'callout',
          tone: 'info',
          title: '为什么 describe 很重要',
          text: '`.describe()` 的内容会进入 JSON Schema 的 description 字段，模型就是靠它理解参数含义的。**字段名 + describe 就是写给模型的 prompt。** 一个叫 `q` 没有描述的字段，模型八成会传错。',
        },
      ],
    },

    {
      id: 's5',
      title: 'Result 类型：让错误出现在签名里',
      checkpoint: 'throw 有什么问题？为什么有些团队禁止在 service 层 throw？',
      blocks: [
        {
          type: 'p',
          text: 'throw 的问题不是"不好用"，而是**它不出现在类型签名里**。你调用 `const note = await getNote(id)`，从类型上看它一定返回 Note，但实际可能抛错。调用方必须靠"记得写 try/catch"或"读源码"才知道。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'Result：把失败也变成一个值',
          code: `export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

// 使用
async function getNote(userId: string, id: string): Promise<Result<Note, 'NOT_FOUND' | 'FORBIDDEN'>> {
  const note = await repo.findById(id)
  if (!note) return err('NOT_FOUND')
  if (note.userId !== userId) return err('FORBIDDEN')
  return ok(note)
}

// 调用方被迫处理失败分支
const r = await getNote(uid, id)
if (!r.ok) {
  // 这里的 r.error 类型是 'NOT_FOUND' | 'FORBIDDEN'
  return sendJson(res, r.error === 'NOT_FOUND' ? 404 : 403, { code: r.error })
}
console.log(r.value.title)   // 这里一定是成功分支`,
          note: '注意错误类型是字面量联合：编译器知道所有可能的失败原因，switch 时还能做穷尽检查。',
        },
        {
          type: 'table',
          head: ['', 'throw', 'Result'],
          rows: [
            ['错误可见性', '不在签名里，靠文档', '类型里写明'],
            ['调用方是否被迫处理', '否（可以忘 try/catch）', '是（不判 ok 就拿不到 value）'],
            ['适合', '真正的异常（程序 bug、环境故障）', '可预期的业务失败'],
            ['栈开销', '有（构造 Error）', '无'],
            ['嵌套调用', '一层层 try/catch 或统一出口', '一层层 map/链式，容易啰嗦'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '不要全盘 Result 化',
          text: 'Result 在"业务失败是常态"的地方很有价值（登录失败、库存不足、权限拒绝）。但如果每个函数都返回 Result，代码会变成一堆 `if (!r.ok) return r`。**推荐边界：service 层用 Result 表达业务失败，基础设施故障仍然 throw，由 controller 统一兜底。**',
        },
      ],
    },

    {
      id: 's6',
      title: '类型体操的边界：什么时候该停',
      checkpoint: '你写了一个 20 行的条件类型，只有你能看懂。这算成功吗？',
      blocks: [
        {
          type: 'p',
          text: 'TypeScript 的类型系统是图灵完备的，理论上能表达任何约束。这也是它的陷阱：**能表达不等于该表达。**',
        },
        {
          type: 'table',
          head: ['场景', '该用什么', '别用什么'],
          rows: [
            ['对象形状', 'interface / type', '嵌套条件类型'],
            ['互斥状态', '判别联合', '可选字段 + 运行时判断'],
            ['"至少有一个字段"这类约束', '判别联合拆成几个类型', '复杂泛型 + keyof 运算'],
            ['API 响应包装', '泛型 `Result<T>`', '深层映射类型'],
            ['从路由表推导参数类型', '条件类型 + infer（值得）', '——'],
          ],
        },
        {
          type: 'p',
          text: '判断标准很简单：**如果一个类型报错，你团队里没人能在 5 分钟内看懂，那它就是在制造负债。**',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '三种过度抽象的症状',
          text: '① 类型报错信息超过 30 行（`Type instantiation is excessively deep` 是典型）。② 需要写类型测试来证明类型是对的。③ 新增一个字段要改 4 个类型文件。出现任何一个，就该退回去用简单写法。',
        },
        {
          type: 'p',
          text: '有一个例外值得学：**从已有定义推导**，因为它消除了重复。比如从 zod schema 推导类型、从路由表推导参数、从数据库 schema 推导行类型。这类"推导"是在消除不一致，不是在炫技。',
        },
      ],
    },

    {
      id: 's7',
      title: 'tsconfig：真正影响正确性的那几项',
      checkpoint: 'noUncheckedIndexedAccess 打开后，arr[0] 的类型会变成什么？',
      blocks: [
        {
          type: 'p',
          text: '大部分 tsconfig 选项是风格问题，但有几项直接决定"能不能抓到 bug"。',
        },
        {
          type: 'code',
          lang: 'json',
          title: '建议打开的五项',
          code: `{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}`,
        },
        {
          type: 'table',
          head: ['选项', '作用', '不打开会漏掉什么'],
          rows: [
            ['strict', '打开下面一批（含 strictNullChecks）', 'null / undefined 相关的一大半 bug'],
            ['noUncheckedIndexedAccess', '`arr[0]` 类型变成 `T | undefined`', '数组越界、Map.get 返回 undefined 直接使用'],
            ['exactOptionalPropertyTypes', '区分"字段不存在"和"字段值为 undefined"', '`{ a?: string }` 被赋 `{ a: undefined }`，序列化后行为不同'],
            ['noImplicitOverride', '子类覆盖父类方法必须写 override', '改名父类方法时子类静默失效'],
            ['noFallthroughCasesInSwitch', 'switch 分支忘了 break 会报错', '穿透执行，逻辑错但没人发现'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'noUncheckedIndexedAccess 抓到的真实 bug',
          code: `const parts = path.split('/')
const last = parts[parts.length - 1]
// 不打开：last 是 string，可以直接 .toUpperCase()
// 打开后：last 是 string | undefined，必须判断

if (last === undefined) return err('BAD_PATH')
last.toUpperCase()   // 安全`,
          note: '这一项在解析 URL、处理 split 结果、读 Map 时特别有用——这几处正是 undefined 崩溃的高发区。',
        },
        {
          type: 'callout',
          tone: 'info',
          title: '给存量项目开 strict 的实操',
          text: '别一次性全开，会炸出几千个错误。做法：先开 `strictNullChecks`（影响最大），修完；再开 `noUncheckedIndexedAccess`，它会多出几百个错误，但都是真问题；最后开其余。每个新选项配一个"错误数上限"的 CI 检查，只降不升。',
        },
      ],
    },

    {
      id: 's8',
      title: '把类型检查放进 CI，而不是靠自觉',
      checkpoint: '`tsc --noEmit` 在 CI 里能挡住哪类问题？',
      blocks: [
        {
          type: 'p',
          text: '类型检查最大的问题是"本地不跑就没人跑"。而它恰好是成本最低的检查：不需要数据库、不需要网络、几秒到几十秒出结果。',
        },
        {
          type: 'code',
          lang: 'bash',
          title: 'CI 里的四道门禁',
          code: `# 1. 类型检查（不产出文件，只检查）
tsc --noEmit

# 2. 未使用的变量/导入（tsc 不管这个，用 eslint）
eslint . --max-warnings 0

# 3. 禁止新增 any（自定义规则或 grep）
! grep -rn ": any" src --include=*.ts | grep -v "// any-ok"

# 4. 测试
node --test`,
          note: '第 3 条那种 grep 检查很土但有效。比它更好的做法是用 eslint 的 no-explicit-any 规则，配 eslint-disable-next-line 强制写明理由。',
        },
        {
          type: 'p',
          text: '还有一个容易被忽略的：**`tsc --noEmit` 能抓出"改了接口但忘了改调用方"**。这在多人协作里价值极高——你改了 `NoteRepo` 的签名，CI 会告诉你哪 12 个文件要跟着改。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '和 AI 编程的关系',
          text: 'AI 生成的代码经常"看起来对但类型不对"。把 `tsc --noEmit` 放在 CI 里，等于给 AI 加了一道自动纠错——它改完自己跑一遍，比人肉 review 快得多。这也是第 24 课讲 Agentic Coding 时"验证回路"的基础。',
        },
        {
          type: 'qa',
          q: '为什么用 tsc --noEmit 而不是让打包工具做类型检查？',
          a: '因为很多打包工具（esbuild、swc）只做转译，**完全不做类型检查**——它们为了速度把类型擦掉了。Vite 开发时就是这样：页面能跑，但类型错误一声不响。所以必须单独跑 tsc。这也是为什么"本地跑得好好的，CI 挂了"经常是类型问题。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: 'any 与 unknown 的区别',
      prompt: '关于 `any` 和 `unknown`，下面哪个说法**正确**？',
      points: 10,
      options: [
        { id: 'a', text: '两者等价，只是写法不同' },
        { id: 'b', text: 'unknown 必须先收窄才能使用，any 可以直接使用且会污染下游' },
        { id: 'c', text: 'any 更安全，因为它允许更多操作' },
        { id: 'd', text: 'unknown 只能用于函数参数' },
      ],
      answer: ['b'],
      hints: [
        '关键区别在"能不能直接用"。试着对一个 unknown 变量读属性，看编译器什么反应。',
        'any 会关闭检查并传染；unknown 强制你先验证，验证后自动收窄。',
        '正确答案 B。unknown 是"未知但必须验证"，读属性前必须用 typeof / instanceof / 类型守卫收窄。any 是"放弃检查"，而且会顺着赋值和返回值传染给下游所有变量。C 说反了：any 更不安全。D 错：unknown 可用于任何位置。',
      ],
      explanation:
        '边界处（HTTP body、JSON.parse、第三方响应）应该用 unknown，强制自己写校验；只有确实无法表达时才用 any，并且要写注释说明理由。',
      approach: [
        '入参来自外部 → unknown',
        '需要立即使用 → 先收窄',
        '确需 any → 写注释 + review 说明',
      ],
      knowledge: ['any 污染', 'unknown 收窄', '类型守卫'],
      pitfalls: [
        '用 as 强转绕过 unknown —— 等于把 unknown 变回 any，白写了校验',
      ],
    },

    {
      id: 'e2',
      type: 'multi',
      title: '判别联合解决了什么',
      prompt: '相比 `{ status: string; data?: T; error?: string }`，判别联合有哪些实际优势？（多选）',
      points: 15,
      options: [
        { id: 'a', text: '非法状态组合在编译期就无法表示' },
        { id: 'b', text: '判断 status 后，data / error 的类型自动收窄，不需要非空断言' },
        { id: 'c', text: '新增状态时，漏处理的分支会编译报错（配合 never 检查）' },
        { id: 'd', text: '运行时性能更好' },
        { id: 'e', text: '代码行数一定更少' },
      ],
      answer: ['a', 'b', 'c'],
      hints: [
        '先想"能表达什么"（表达能力），再想"用起来方便吗"（收窄），最后想"改的时候安全吗"（穷尽性）。',
        '性能和行数都不是类型系统的职责。',
        '正确答案 A、B、C。A：`{ status: "loading", data }` 这种组合直接编译不过。B：switch 后编译器知道 data 一定存在，不用写 `data!`。C：default 分支的 `never` 检查会在新增状态时报错。D 错：类型在编译后消失，没有运行时性能影响。E 错：判别联合往往要写更多类型定义，行数不一定少。',
      ],
      explanation:
        '判别联合的价值是"用类型系统消灭一整类 bug"，代价是多写几行类型。这是极划算的交易。',
      approach: [
        '找出所有互斥状态',
        '每个状态定义成独立对象类型，共享一个字面量字段',
        '用 switch + never 做穷尽检查',
      ],
      knowledge: ['判别联合', '穷尽性检查', '非法状态不可表示'],
      pitfalls: [
        '把判别字段写成 string 而不是字面量联合 —— 收窄立刻失效',
      ],
    },

    {
      id: 'e3',
      type: 'fill',
      title: '填空：补全一个流式事件类型',
      prompt:
        '这是一个 SSE 流式事件类型。补全缺失的部分，让"漏处理某个事件"能在编译期被发现。',
      points: 20,
      templateLang: 'ts',
      template: `type StreamEvent =
  | { {{k1}}: 'start'; messageId: string }
  | { {{k1}}: 'text-delta'; delta: string }
  | { {{k1}}: 'usage'; inputTokens: number; outputTokens: number }
  | { {{k1}}: 'error'; code: string; message: string }

function handle(e: StreamEvent) {
  switch (e.{{k2}}) {
    case 'start':  return init(e.messageId)
    case 'text-delta': return append(e.delta)
    case 'usage':  return record(e.inputTokens, e.outputTokens)
    case 'error':  return showError(e.code)
    default:
      const _never: {{k3}} = e
      return _never
  }
}`,
      blanks: [
        {
          id: 'k1',
          label: '判别字段名（所有分支共用的那个字段）',
          accept: ['type'],
          placeholder: 'type',
          width: 8,
        },
        {
          id: 'k2',
          label: 'switch 判断的字段',
          accept: ['type'],
          placeholder: 'type',
          width: 8,
        },
        {
          id: 'k3',
          label: '用于穷尽性检查的类型（所有分支都处理完后剩下的类型）',
          accept: ['never'],
          placeholder: 'never',
          width: 8,
        },
      ],
      hints: [
        '判别联合需要一个所有成员都有的字段，值各不相同。这个字段名通常叫 type 或 kind。',
        'switch 里判断的必须是那个判别字段，否则编译器收窄不了。',
        '完整答案：判别字段是 `type`，switch 判断 `e.type`，穷尽性检查用 `never`。原理是：所有 case 都处理完后，e 的类型被收窄成 `never`。如果新增了一个事件类型却漏了 case，e 就不再是 never，这行赋值会报错——编译器用这种方式提醒你"还有一个分支没处理"。',
      ],
      explanation:
        '这是 TypeScript 里最实用的一个模式，几乎每个状态机、每个事件处理都应该这么写。',
      approach: [
        '选一个所有成员共有的字面量字段作判别',
        'switch 它，让编译器自动收窄',
        'default 里赋给 never 触发穷尽检查',
      ],
      knowledge: ['判别联合', 'never', '穷尽性检查', 'SSE 事件'],
      pitfalls: [
        '判别字段用 string 类型 —— 收窄失效，never 检查也失效',
        'default 里写 throw 而不是赋给 never —— 拿不到编译期检查',
      ],
    },

    {
      id: 'e4',
      type: 'code',
      title: '编程：实现流式事件的运行时解析',
      prompt:
        '类型只在编译期存在。实现 `parseEvent(raw)`：把一行 JSON 解析成合法的 StreamEvent，不合法返回 `{ type: "error", code, message }`。检查项全部通过才算对。',
      points: 25,
      starter: `function parseEvent(raw) {
  // raw 可能是：'{"type":"text-delta","delta":"你好"}'
  // 也可能是垃圾：'not json' / '{"type":"unknown"}' / '{"type":"usage"}'
  //
  // 规则：
  //   - JSON 解析失败 → { type:'error', code:'BAD_JSON', message:... }
  //   - type 不在白名单 → { type:'error', code:'UNKNOWN_TYPE', message:... }
  //   - 必需字段缺失或类型不对 → { type:'error', code:'BAD_SHAPE', message:... }
  //   - 合法 → 返回原对象（可以带上缺省值）

  const REQUIRED = {
    'start': ['messageId'],
    'text-delta': ['delta'],
    'usage': ['inputTokens', 'outputTokens'],
    'error': ['code', 'message'],
  }

  return { type: 'error', code: 'NOT_IMPLEMENTED', message: '' }
}

// —— 检查用 ——
const results = {
  ok1: parseEvent('{"type":"text-delta","delta":"hi"}'),
  ok2: parseEvent('{"type":"usage","inputTokens":10,"outputTokens":5}'),
  badJson: parseEvent('not json'),
  unknown: parseEvent('{"type":"hack"}'),
  badShape: parseEvent('{"type":"usage"}'),
  empty: parseEvent(''),
}

return results`,
      checks: [
        { name: '合法事件原样返回', expr: "result.ok1.type === 'text-delta' && result.ok1.delta === 'hi'" },
        { name: 'usage 事件保留两个数字', expr: "result.ok2.inputTokens === 10 && result.ok2.outputTokens === 5" },
        { name: '非法 JSON 返回 BAD_JSON', expr: "result.badJson.type === 'error' && result.badJson.code === 'BAD_JSON'" },
        { name: '未知 type 返回 UNKNOWN_TYPE', expr: "result.unknown.type === 'error' && result.unknown.code === 'UNKNOWN_TYPE'" },
        { name: '缺字段返回 BAD_SHAPE', expr: "result.badShape.type === 'error' && result.badShape.code === 'BAD_SHAPE'" },
        { name: '空字符串不抛异常', expr: "result.empty.type === 'error'" },
      ],
      solution: `function parseEvent(raw) {
  const REQUIRED = {
    'start': ['messageId'],
    'text-delta': ['delta'],
    'usage': ['inputTokens', 'outputTokens'],
    'error': ['code', 'message'],
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    return { type: 'error', code: 'BAD_JSON', message: '空输入' }
  }

  let obj
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    return { type: 'error', code: 'BAD_JSON', message: String(e && e.message) }
  }

  if (!obj || typeof obj !== 'object' || typeof obj.type !== 'string') {
    return { type: 'error', code: 'BAD_SHAPE', message: '缺少 type 字段' }
  }

  const required = REQUIRED[obj.type]
  if (!required) {
    return { type: 'error', code: 'UNKNOWN_TYPE', message: '未知事件类型: ' + obj.type }
  }

  for (const key of required) {
    if (obj[key] === undefined || obj[key] === null) {
      return { type: 'error', code: 'BAD_SHAPE', message: '缺少字段: ' + key }
    }
  }

  return obj
}`,
      hints: [
        '顺序很重要：先判空字符串 → 再 try/catch JSON.parse → 再判 type 是否在白名单 → 最后逐字段检查。顺序错了会把"缺字段"误报成"JSON 错误"。',
        '用一张 REQUIRED 表把"每种事件需要哪些字段"写成数据，比一堆 if 好维护。遍历它就能做校验。',
        '完整实现见下。真实项目里这段应该用 zod 的 discriminatedUnion 写，代码更短、错误信息更好。但手写一遍能让你明白 zod 到底帮你做了什么——以及为什么"类型只在编译期存在"这件事必须靠运行时校验来补。',
      ],
      explanation:
        '这是所有流式解析器（OpenAI SDK、Vercel AI SDK）内部都在做的事：把不可信的字节流，一步步收窄成确定的类型。',
      approach: [
        '先处理空输入',
        'try/catch 包住 JSON.parse',
        '校验 type 在白名单内',
        '按类型检查必需字段',
        '任何一步失败都返回结构化的 error 事件，不抛异常',
      ],
      knowledge: ['运行时校验', '流式解析', '类型收窄', '错误结构化'],
      pitfalls: [
        '直接 JSON.parse 不包 try/catch —— 一个坏包就让整个流断掉',
        '校验失败时 throw —— 流式场景应该产生 error 事件让前端展示，而不是中断连接',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 10,
    questions: [
      {
        id: 'q1',
        stem: '为什么 HTTP 请求体的类型应该是 unknown 而不是 any？',
        options: [
          { id: 'a', text: 'unknown 性能更好' },
          { id: 'b', text: 'unknown 强制先校验再使用，any 会静默污染整条调用链' },
          { id: 'c', text: 'any 不能用于函数参数' },
          { id: 'd', text: '两者没区别' },
        ],
        answer: 'b',
        why: '外部数据不可信，必须验证。unknown 让"不验证就用"变成编译错误；any 让错误一路静默流到线上。',
        stepId: 's2',
      },
      {
        id: 'q2',
        stem: '判别联合的判别字段必须是什么类型？',
        options: [
          { id: 'a', text: 'string' },
          { id: 'b', text: '字面量类型（如 "loading" | "success"）' },
          { id: 'c', text: 'number' },
          { id: 'd', text: 'boolean' },
        ],
        answer: 'b',
        why: '必须是字面量类型，编译器才能靠具体值收窄。如果写成 string，所有分支的类型无法区分，收窄和穷尽检查都会失效。',
        stepId: 's3',
      },
      {
        id: 'q3',
        stem: 'switch 的 default 分支里写 `const _x: never = e` 的作用是？',
        options: [
          { id: 'a', text: '运行时检查类型' },
          { id: 'b', text: '穷尽性检查：新增分支未处理时编译报错' },
          { id: 'c', text: '提升性能' },
          { id: 'd', text: '防止 switch 穿透' },
        ],
        answer: 'b',
        why: '所有 case 处理完后 e 被收窄为 never。一旦新增了类型却没加 case，e 不再是 never，这行赋值就报错。这是编译期检查，运行时什么都不做。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: 'TS 类型在运行时存在吗？',
        options: [
          { id: 'a', text: '存在，可以用 typeof 检查' },
          { id: 'b', text: '不存在，编译后被擦除，所以边界必须做运行时校验' },
          { id: 'c', text: '只有 interface 存在' },
          { id: 'd', text: '取决于 tsconfig' },
        ],
        answer: 'b',
        why: '类型注解在编译后完全消失。所以 `function f(x: Note)` 不会检查 x 是不是 Note。这就是 zod 存在的理由：一份定义同时产出类型和运行时校验。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '用 zod 定义 schema 后，`z.infer<typeof Schema>` 得到什么？',
        options: [
          { id: 'a', text: 'schema 的 JSON 表示' },
          { id: 'b', text: '从 schema 推导出的 TypeScript 类型' },
          { id: 'c', text: '校验函数' },
          { id: 'd', text: '默认值对象' },
        ],
        answer: 'b',
        why: 'z.infer 把 schema 转成 TS 类型。这样类型和校验永远同源，不会出现"类型说有、运行时没有"。',
        stepId: 's4',
      },
      {
        id: 'q6',
        stem: 'Result<T, E> 相比 throw 的核心优势是？',
        options: [
          { id: 'a', text: '性能更好' },
          { id: 'b', text: '错误出现在类型签名里，调用方被迫处理' },
          { id: 'c', text: '代码更短' },
          { id: 'd', text: '不需要写 try/catch' },
        ],
        answer: 'b',
        why: 'throw 不在签名里，调用方可以完全不知道会抛什么。Result 把失败变成一个值，不判 ok 就拿不到 value，编译器强制你处理。',
        stepId: 's5',
      },
      {
        id: 'q7',
        stem: 'noUncheckedIndexedAccess 打开后，`arr[0]` 的类型变成？',
        options: [
          { id: 'a', text: 'T' },
          { id: 'b', text: 'T | undefined' },
          { id: 'c', text: 'T | null' },
          { id: 'd', text: 'unknown' },
        ],
        answer: 'b',
        why: '数组越界时确实返回 undefined，这一项让类型如实反映现实。代价是要多写判空，但那些判空本来就是必要的。',
        stepId: 's7',
      },
      {
        id: 'q8',
        stem: '下面哪种情况说明类型抽象过度了？',
        options: [
          { id: 'a', text: '用泛型写了一个 Result<T>' },
          { id: 'b', text: '从 zod schema 推导类型' },
          { id: 'c', text: '新增一个字段要改 4 个类型文件，且报错信息超过 30 行' },
          { id: 'd', text: '用判别联合表达任务状态' },
        ],
        answer: 'c',
        why: 'A、B、D 都是在消除重复或表达约束，收益明确。C 是典型的负债：维护成本超过了它挡住的 bug。判断标准是"团队里有没有人能在 5 分钟内看懂这个类型报错"。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统的后端骨架',
    contributes:
      '这一课给整个项目定下类型骨架：StreamEvent 判别联合、zod schema 单一来源、Result 表达业务失败。后面的 RAG 检索、Agent 工具调用，全部复用这三样。',
    tasks: [
      '把 StreamEvent 类型定义落到 src/types/stream.ts，前端消费端用 switch + never',
      '用 zod 重写所有请求体校验，用 z.infer 替换手写 interface',
      '给 note service 加 Result 返回值，错误用字面量联合而不是字符串',
      '打开 noUncheckedIndexedAccess，修完所有报错（会抓出真 bug）',
      '在 CI 里加 tsc --noEmit 和 eslint --max-warnings 0',
    ],
    done: 'tsc --noEmit 零错误；新增一个 StreamEvent 类型时，前端 handleEvent 立刻编译报错；请求体校验和类型定义是同一份代码。',
  },

  further: [
    { text: 'TypeScript 官方手册 · Narrowing 与 Discriminated Unions' },
    { text: 'zod 文档 · discriminatedUnion 与 z.infer' },
    { text: 'type-challenges · 用来练手，但别把题目风格带进生产代码' },
  ],
}
