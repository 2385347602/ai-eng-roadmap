import type { Lesson } from './types'

/**
 * 第二课：分层与依赖注入
 *
 * 承接第一课结尾留下的三个问题：数据在内存、没有分层、没有认证。
 * 这一课只解决第二个——但要用"为什么"讲透，不是给你一套目录模板。
 */
export const lesson02: Lesson = {
  id: 'L02',
  moduleId: 'nest',
  order: 2,
  path: '/learn/02-layered-architecture',
  title: '分层与依赖注入：把 90 行拆成能被三个人同时维护的结构',
  subtitle: '分层不是把文件放进不同文件夹。它是"依赖只能朝一个方向流动"这条规则。',
  minutes: 70,
  level: '入门',
  outcome: '能独立判断一个模块该拆成几层、每层放什么、什么情况下不该拆，并手写一个依赖注入容器。',
  goals: [
    '说清分层的本质是依赖方向，而不是目录结构',
    '把一个混在一起的 handler 拆成 controller / service / repository 三层',
    '解释 new 为什么是问题，以及依赖注入解决的三个具体痛点',
    '手写一个 40 行的 DI 容器，含单例、循环依赖检测',
    '判断什么时候不该分层，识别过度抽象的三种症状',
    '不启动 HTTP 服务器就能测业务逻辑',
  ],
  prereqs: [
    '学过第一课，知道 req / res 是什么',
    '用过 class 和 interface',
    '能看懂 async / await',
  ],

  steps: [
    {
      id: 's1',
      title: '先看清楚：90 行之后会发生什么',
      checkpoint: '你现在这个 server.ts，如果要加"笔记必须属于某个用户"，需要改几个地方？',
      blocks: [
        {
          type: 'p',
          text: '第一课那份 90 行的 server.ts 是能跑的。问题不在于它错，而在于它**只能停在 90 行**。一旦变成 900 行，会出现三个具体的痛，而且这三个痛都不是"代码不好看"这种审美问题。',
        },
        {
          type: 'table',
          head: ['痛', '具体表现', '后果'],
          rows: [
            ['改一处要读全文', '加一个字段要动 readJson、校验、组装、序列化四段', '改错概率随行数线性上升'],
            ['没法单独测', '业务逻辑和 req/res 绑死，测一个"余额不足"要起 HTTP 服务、造请求、解析响应', '测试慢到没人愿意写'],
            ['换实现要动业务', '从内存换 SQLite、从 SQLite 换 Postgres，业务代码跟着改', '技术选型被锁死'],
          ],
        },
        {
          type: 'p',
          text: '分层要解决的正是这三件事。**注意它不解决"代码变多"**——分层之后文件数会变多，总行数也会略微上升。如果它只让代码变多，那确实是过度设计。它换来的是：**改动的影响范围可预测**。',
        },
        {
          type: 'analogy',
          title: '和 Vue 的组件拆分对照',
          text: '你把一个 800 行的页面拆成 12 个组件，不是为了行数变少，而是为了让"改价格显示"只动 PriceCard，不碰其余 11 个。分层做的是同一件事，只不过拆的维度是"职责"而不是"界面区域"。',
        },
        {
          type: 'callout',
          tone: 'info',
          title: '一个判断标准',
          text: '如果你改一个需求，需要同时打开三个以上文件才能确认改对了，那说明职责边界划错了。好的分层让"改一个需求"落在 1~2 个文件里。',
        },
      ],
    },

    {
      id: 's2',
      title: '分层的本质：依赖方向，不是文件夹',
      checkpoint: 'service 层能不能 import node:http？为什么？',
      blocks: [
        {
          type: 'p',
          text: '大多数人对分层的理解是"建三个文件夹 controller/service/repository"。这是结果，不是本质。本质是一条规则：**依赖只能单向流动，内层不知道外层的存在。**',
        },
        {
          type: 'flow',
          title: '正确的依赖方向',
          ascii: `        ┌──────────────┐
        │  Controller  │  ← 只认识 HTTP：req / res / 状态码
        └──────┬───────┘
               │ 调用（向下）
        ┌──────▼───────┐
        │   Service    │  ← 只认识业务：输入对象 / 领域错误
        └──────┬───────┘
               │ 调用（向下，通过接口）
        ┌──────▼───────┐
        │  Repository  │  ← 只认识存储：SQL / ORM
        └──────────────┘

规则：箭头只能向下。
Controller 可以 import Service；
Service 绝不能 import Controller，也绝不能 import node:http。`,
        },
        {
          type: 'p',
          text: '为什么 service 不能 import http？因为一旦 import 了，service 就知道了"世界上有 HTTP 这回事"。它的输入变成 req，输出变成 res.end()。这时候：',
        },
        {
          type: 'list',
          items: [
            '你没法在定时任务里复用它（那里没有 req）',
            '你没法在 CLI 里复用它',
            '你没法给它写单元测试（要造一个假的 req/res）',
            '将来要支持 gRPC 或消息队列，业务代码要重写一遍',
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一句话记住',
          text: '**内层不允许知道外层用什么方式调用它。** Service 收到的应该是"一个普通的对象"，返回的应该是"一个普通的对象或一个领域错误"，而不是 req / res / HTTP 状态码。',
        },
        { type: 'h', text: '那 HTTP 状态码怎么办？' },
        {
          type: 'p',
          text: '这是新手最常卡住的地方：service 里发现"余额不足"，它想说 422，但它不能知道 422。解法是：**service 抛一个领域错误，controller 负责翻译成状态码。**',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '领域错误 + 翻译层',
          code: `// domain/errors.ts —— 不认识 HTTP
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export class InsufficientBalance extends DomainError {
  constructor(need: number, have: number) {
    super('INSUFFICIENT_BALANCE', '余额不足', { need, have })
  }
}

export class NoteNotFound extends DomainError {
  constructor(id: string) {
    super('NOTE_NOT_FOUND', '笔记不存在', { id })
  }
}

// interface/http/error-map.ts —— 只有这一层知道状态码
const STATUS: Record<string, number> = {
  INSUFFICIENT_BALANCE: 422,
  NOTE_NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  VALIDATION_FAILED: 400,
}

export function toResponse(err: unknown) {
  if (err instanceof DomainError) {
    return { status: STATUS[err.code] ?? 400, body: { code: err.code, message: err.message } }
  }
  return { status: 500, body: { code: 'INTERNAL_ERROR', message: '服务异常' } }
}`,
          note: '这张映射表是整条链路里唯一出现状态码的地方（除了 controller 自己写 201/204）。它让"改状态码"变成一个纯配置动作。',
        },
        {
          type: 'qa',
          q: 'repository 层返回数据库的行对象，还是领域对象？',
          a: '小项目直接返回领域对象（字段名一致）就行。一旦出现"数据库字段是 snake_case、业务里用 camelCase"或者"需要把两个表拼成一个对象"，就该在 repository 里做映射。判断标准：业务层不应该知道任何数据库细节，包括列名。',
        },
      ],
    },

    {
      id: 's3',
      title: '第一刀：Controller 只做"HTTP 翻译"',
      checkpoint: 'Controller 里能不能写 if (note.ownerId !== user.id) throw ...？',
      blocks: [
        {
          type: 'p',
          text: 'Controller 的职责只有三件：**读输入、调 service、写输出。** 它不该有 if 判断业务规则，因为业务规则属于 service。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'interface/http/note.controller.ts',
          code: `import type { IncomingMessage, ServerResponse } from 'node:http'
import { CreateNoteSchema } from '../../application/dto.js'
import type { NoteService } from '../../application/note.service.js'
import { readJson, sendJson } from './helpers.js'
import { toResponse } from './error-map.js'

export function createNoteController(notes: NoteService) {
  return async (req: IncomingMessage, res: ServerResponse, ctx: { userId: string }) => {
    // 1. 读输入：只做"格式转换"，不做业务判断
    const raw = await readJson(req)
    const parsed = CreateNoteSchema.safeParse(raw)
    if (!parsed.success) {
      return sendJson(res, 400, {
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
        field: parsed.error.issues[0].path.join('.'),
      })
    }

    // 2. 调 service：出错就交给统一错误出口
    try {
      const note = await notes.create(ctx.userId, parsed.data)
      res.setHeader('Location', '/api/notes/' + note.id)
      return sendJson(res, 201, note)
    } catch (err) {
      const { status, body } = toResponse(err)
      return sendJson(res, status, body)
    }
  }
}`,
          note: '注意 ctx.userId：controller 从 token 里解析出用户身份，作为参数传给 service。service 从不自己去读 header。',
        },
        {
          type: 'p',
          text: '这个 controller 里没有一行业务逻辑。它做的是：JSON 解析、schema 校验、调用、把结果或错误写成响应。**如果某天要支持 gRPC，这个文件被替换掉，service 一行不动。**',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '最常见的越界：在 controller 里查权限',
          text: '`if (note.ownerId !== ctx.userId) throw new Forbidden()` 写在 controller 里，看起来"反正都是判断"，但它其实是一条业务规则（"只有作者能改"）。写在 controller，意味着从 CLI 或定时任务调用 service 时就绕过了这条规则。**权限判断必须下沉到 service 或更内层。**',
        },
        {
          type: 'qa',
          q: '为什么 controller 用工厂函数 createNoteController(notes)，而不是直接 export 一个函数去 import service？',
          a: '因为工厂函数把依赖变成了参数。这样测试时可以传一个假的 service（不用连数据库），运行时由容器传入真的。这就是依赖注入的最小形态——不需要框架，一个闭包就够了。',
        },
      ],
    },

    {
      id: 's4',
      title: '第二刀：Service 只认业务，不认 HTTP',
      checkpoint: 'service 的输入应该是什么形状？为什么不是 req？',
      blocks: [
        {
          type: 'p',
          text: 'Service 是整个应用里最值钱的一层——它包含所有业务规则，也是唯一值得写详细单元测试的地方。它的签名应该长这样：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'application/note.service.ts',
          code: `import { randomUUID } from 'node:crypto'
import { NoteNotFound } from '../domain/errors.js'
import type { NoteRepo } from '../domain/note.repo.js'
import type { CreateNoteInput, Note } from '../domain/note.js'

export class NoteService {
  constructor(private readonly repo: NoteRepo) {}

  async create(userId: string, input: CreateNoteInput): Promise<Note> {
    const note: Note = {
      id: randomUUID(),
      userId,
      title: input.title.trim(),
      content: input.content,
      createdAt: new Date(),
    }
    return this.repo.insert(note)
  }

  async get(userId: string, id: string): Promise<Note> {
    const note = await this.repo.findById(id)
    // 权限规则在这里，不在 controller
    if (!note || note.userId !== userId) throw new NoteNotFound(id)
    return note
  }

  async rename(userId: string, id: string, title: string): Promise<Note> {
    const note = await this.get(userId, id)   // 复用权限检查
    if (title.trim().length === 0) {
      throw new Error('标题不能为空')   // 更严谨的做法是抛 DomainError
    }
    return this.repo.update({ ...note, title: title.trim() })
  }
}`,
          note: '整个文件没有 import node:http，也没有 req / res / statusCode。这就是"可复用"和"可测试"的来源。',
        },
        {
          type: 'p',
          text: '现在测"不能看别人的笔记"这条规则，只需要：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'test/note.service.test.ts —— 毫秒级，不需要起服务',
          code: `import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NoteService } from '../src/application/note.service.js'
import { NoteNotFound } from '../src/domain/errors.js'

// 手写一个假 repo，10 行
const fakeRepo = {
  store: new Map<string, any>(),
  async insert(n: any) { this.store.set(n.id, n); return n },
  async findById(id: string) { return this.store.get(id) ?? null },
  async update(n: any) { this.store.set(n.id, n); return n },
}

test('别人的笔记查不到', async () => {
  const svc = new NoteService(fakeRepo as any)
  const note = await svc.create('user-A', { title: 'a', content: '' })

  await assert.rejects(
    () => svc.get('user-B', note.id),
    (err: any) => err instanceof NoteNotFound,
  )
})`,
          note: '这就是分层的直接回报：一个测试 3 行代码，跑 2 毫秒。如果业务逻辑在 handler 里，这个测试要起服务、造请求、解析响应，20 行起步、200 毫秒。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一个反直觉的判断',
          text: '如果一段逻辑你没法在 service 层测试，那它八成写错位置了。**"不好测"通常不是测试的问题，是设计的问题。**',
        },
      ],
    },

    {
      id: 's5',
      title: '第三刀：Repository 把存储关在门里',
      checkpoint: '为什么 repository 要先定义 interface，再写实现？',
      blocks: [
        {
          type: 'p',
          text: 'Repository 是"集合"的抽象：对外表现得像一个对象集合（增删查改），对内随便你用 SQL、ORM 还是内存 Map。关键是**接口定义在 domain 层，实现放在 infrastructure 层**。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'domain/note.repo.ts —— 接口（内层定义，不依赖任何实现）',
          code: `import type { Note } from './note.js'

export interface NoteRepo {
  insert(note: Note): Promise<Note>
  findById(id: string): Promise<Note | null>
  listByUser(userId: string, opts: { limit: number; cursor?: string }): Promise<Note[]>
  update(note: Note): Promise<Note>
  delete(id: string): Promise<boolean>
}`,
          note: '这个文件只 import 了类型，没有任何运行时依赖。它是最"干净"的一层。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'infrastructure/note.repo.sqlite.ts —— 实现',
          code: `import { DatabaseSync } from 'node:sqlite'
import type { NoteRepo } from '../domain/note.repo.js'
import type { Note } from '../domain/note.js'

export class SqliteNoteRepo implements NoteRepo {
  constructor(private readonly db: DatabaseSync) {
    db.exec(\`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_user_created
        ON notes(user_id, created_at DESC);
    \`)
  }

  async insert(n: Note): Promise<Note> {
    this.db.prepare(
      'INSERT INTO notes (id,user_id,title,content,created_at) VALUES (?,?,?,?,?)'
    ).run(n.id, n.userId, n.title, n.content, n.createdAt.toISOString())
    return n
  }

  async findById(id: string): Promise<Note | null> {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any
    return row ? this.toDomain(row) : null
  }

  async listByUser(userId: string, opts: { limit: number; cursor?: string }) {
    const rows = this.db.prepare(
      'SELECT * FROM notes WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?'
    ).all(userId, opts.cursor ?? '9999-12-31', opts.limit) as any[]
    return rows.map((r) => this.toDomain(r))
  }

  async update(n: Note) {
    this.db.prepare('UPDATE notes SET title=?, content=? WHERE id=?').run(n.title, n.content, n.id)
    return n
  }

  async delete(id: string) {
    return this.db.prepare('DELETE FROM notes WHERE id=?').run(id).changes > 0
  }

  /** 行 → 领域对象。所有 snake_case 只出现在这里 */
  private toDomain(row: any): Note {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      createdAt: new Date(row.created_at),
    }
  }
}`,
          note: '注意 toDomain：数据库列名只在这个文件里出现。业务层看到的一直是 camelCase 的领域对象。',
        },
        {
          type: 'p',
          text: '这个设计有一个非常实际的收益：**你可以先用内存实现跑通业务，再换数据库，service 一行不改。** 第一课那份代码用的是 Map，换成 SQLite 只需要新写一个类。',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'Repository 最常见的两个错误',
          text: '① **把业务逻辑塞进 repo**（比如在 listByUser 里判断"如果是管理员就返回全部"）——这会让规则散落在 SQL 里，再也测不到。② **让 service 直接拿到 db 对象**——一旦 service 能执行任意 SQL，repository 就白写了。',
        },
      ],
    },

    {
      id: 's6',
      title: '为什么 new 是问题',
      checkpoint: '如果 NoteService 里写 new SqliteNoteRepo(db)，会带来哪三个具体麻烦？',
      blocks: [
        {
          type: 'p',
          text: '分层之后，最自然的写法是：service 里 `new` 一个 repo。这能跑，但会带来三个麻烦，而且第三个最致命。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '反例：在构造函数里 new',
          code: `export class NoteService {
  private repo = new SqliteNoteRepo(new DatabaseSync('./data.db'))
  //                    ^^^^^^^^^^^^^^^^ 硬编码实现
}`,
        },
        {
          type: 'table',
          head: ['麻烦', '具体后果'],
          rows: [
            ['换实现要改源码', '想换成 Postgres 或内存实现，必须改 service 文件，并重新编译'],
            ['测试必须连真库', '测试跑起来会创建 data.db、写脏数据、并行时互相干扰'],
            ['构造顺序失控', 'A 依赖 B，B 依赖 C，C 又依赖 A，你在 new 的时候才会发现死循环'],
          ],
        },
        {
          type: 'p',
          text: '依赖注入（DI）就是把"我 new 一个"改成"你传给我一个"。**它不是框架特性，是一个构造函数参数的写法。**',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '正例：依赖从外面来',
          code: `export class NoteService {
  // 依赖通过构造函数传入，类型是接口，不是具体类
  constructor(private readonly repo: NoteRepo) {}
}

// 运行时由组装层决定用哪个实现
const repo = new SqliteNoteRepo(db)
const notes = new NoteService(repo)
const controller = createNoteController(notes)`,
        },
        {
          type: 'analogy',
          title: '和 Vue 的 props 对照',
          text: '组件不自己 new 一个 store，而是从 props 拿数据——这样你才能在 Storybook 里传假数据、在测试里传 mock。DI 就是这个思路用在类上：**依赖是参数，不是内部构造。**',
        },
        {
          type: 'callout',
          tone: 'info',
          title: '依赖注入 vs 依赖注入容器',
          text: '这是两件事。**依赖注入**是"从外面传进来"这个写法，手写就行。**容器**是帮你自动完成"谁依赖谁、按什么顺序创建"的工具。小项目只要前者，模块超过 20 个才需要后者。别为了用容器而用容器。',
        },
      ],
    },

    {
      id: 's7',
      title: '手写一个 40 行的 DI 容器',
      checkpoint: '容器如何发现循环依赖？如果不检测会怎样？',
      blocks: [
        {
          type: 'p',
          text: '容器要做的事只有三件：注册（名字 → 工厂函数）、解析（按名字创建，依赖自动注入）、管理生命周期（单例还是每次新建）。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'container.ts —— 40 行，够用',
          code: `type Factory<T> = (c: Container) => T

export class Container {
  private factories = new Map<string, Factory<any>>()
  private instances = new Map<string, any>()
  /** 正在解析的链，用于检测循环依赖 */
  private resolving: string[] = []

  register<T>(name: string, factory: Factory<T>, opts: { singleton?: boolean } = {}) {
    this.factories.set(name, opts.singleton === false ? factory : this.once(name, factory))
    return this
  }

  private once<T>(name: string, factory: Factory<T>): Factory<T> {
    return (c) => {
      if (!this.instances.has(name)) this.instances.set(name, factory(c))
      return this.instances.get(name)
    }
  }

  resolve<T>(name: string): T {
    const factory = this.factories.get(name)
    if (!factory) throw new Error('未注册的依赖: ' + name)

    if (this.resolving.includes(name)) {
      throw new Error('检测到循环依赖: ' + [...this.resolving, name].join(' -> '))
    }

    this.resolving.push(name)
    try {
      return factory(this) as T
    } finally {
      this.resolving.pop()
    }
  }
}`,
          note: '这个容器没有装饰器、没有反射、没有自动扫描。但它解决了 90% 的场景，而且你能在面试里讲清每一行。',
        },
        {
          type: 'p',
          text: '用起来是这样：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'composition-root.ts —— 整个应用唯一 new 东西的地方',
          code: `const c = new Container()

c.register('db', () => new DatabaseSync('./data.db'))
c.register('noteRepo', (c) => new SqliteNoteRepo(c.resolve('db')))
c.register('noteService', (c) => new NoteService(c.resolve('noteRepo')))
c.register('noteController', (c) => createNoteController(c.resolve('noteService')))

// 测试时换一行就够
// c.register('noteRepo', () => new InMemoryNoteRepo())

export const container = c`,
          note: '这个文件叫 composition root（组装根）。整个应用里只有它知道"哪个接口用哪个实现"，这是依赖倒置的落点。',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '循环依赖不是"少见的情况"',
          text: 'A 服务要发通知给 B 服务，B 服务要查 A 的状态——这在业务里非常自然，代码里就是死循环。不检测的话，你会看到 "Maximum call stack size exceeded" 或者进程直接卡死，而堆栈指向一堆无关的行。**容器里那 6 行检测，能省你半天。**',
        },
        {
          type: 'p',
          text: '修循环依赖的办法不是加大栈，是**换方向**：A 不该直接调 B，应该发一个事件，或者由上层编排两者。这也是后面 Workflow 编排那一课的前置概念。',
        },
      ],
    },

    {
      id: 's8',
      title: '什么时候不该分层（这一节比前面都重要）',
      checkpoint: '一个只有 3 个接口、2 个月后就不维护的内部工具，需要分层吗？',
      blocks: [
        {
          type: 'p',
          text: '分层有成本：文件数 ×3，跳转次数变多，新人要花半天理解结构。**收益（可测、可换、可维护）只有在代码会长期活着、会有人接手时才兑现。**',
        },
        {
          type: 'table',
          head: ['场景', '建议', '理由'],
          rows: [
            ['一次性脚本、数据迁移', '不分层，一个文件写完', '活不过一周，分层的收益为零'],
            ['内部工具，3 个接口，半年后废弃', '两层就够（handler + 直接查库）', '没有第二个人接手，可测性不是刚需'],
            ['会长期维护的业务系统', '三层 + 接口', '改需求是常态，边界值钱'],
            ['多人协作（3 人以上）', '必须分层', '否则每天都在解决 merge 冲突'],
            ['准备做成产品 / 要接多种端', '分层 + 接口 + 组装根', '换实现是必然发生的事'],
          ],
        },
        { type: 'h', text: '过度抽象的三种症状' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**接口只有一个实现，而且可以预见永远只有一个。** 比如 `interface UserIdGenerator` 只被 `UuidGenerator` 实现——这种接口不产生任何灵活性，只产生一个跳转。',
            '**为了"以后可能换"而抽象。** "以后可能要支持 MySQL"——那就等真要换的时候再抽象。YAGNI 不是懒惰，是不给未来下赌注。',
            '**每层都只是把参数原样往下传。** `controller → service.create(data) → repo.insert(data)`，中间那层没有任何逻辑。这时候 service 层是空的，可以删掉。',
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一个可执行的判断',
          text: '问自己："这一层里有没有一个 if、一次转换、或者一条规则？" 如果三层都只是转发，那就压成一层。**分层的合法性来自它承载的逻辑，不来自目录结构。**',
        },
        {
          type: 'qa',
          q: 'NestJS 的 Module / Provider 和这套手写容器是什么关系？',
          a: 'NestJS 用装饰器（@Injectable）+ 反射元数据自动完成注册和解析，你不再手写 composition root。它多做的是：模块作用域、请求作用域、生命周期钩子、以及和框架的集成。理解手写容器之后，NestJS 的 "为什么我的 provider 注入不进去" 就不再是玄学——那就是"名字没注册"或"作用域不匹配"。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '哪一层不该出现 node:http',
      prompt: '下面哪个文件里出现 `import type { IncomingMessage } from "node:http"` 是**设计错误**？',
      points: 10,
      options: [
        { id: 'a', text: 'interface/http/note.controller.ts' },
        { id: 'b', text: 'application/note.service.ts' },
        { id: 'c', text: 'interface/http/helpers.ts（readJson / sendJson）' },
        { id: 'd', text: 'server.ts（组装和启动）' },
      ],
      answer: ['b'],
      hints: [
        '想一想：哪一层的代码需要在"没有 HTTP"的环境里也能跑？比如定时任务、CLI、消息队列消费者。',
        'controller、helpers、server.ts 都是 HTTP 的边界，出现 req/res 很正常。而 service 是业务核心，它一旦认识 req，就再也离不开 HTTP 了。',
        '正确答案是 B。service 层如果 import 了 node:http，说明它拿到了 req 或 res，那它就变成了"只能被 HTTP 调用"的代码：没法在定时任务里复用、没法在 CLI 里复用、测试必须造假的 req/res。A、C、D 都在 HTTP 边界上，出现 http 类型是正确的。',
      ],
      explanation:
        '判断标准不是"这个文件在哪个文件夹"，而是"这段代码是否需要在非 HTTP 环境运行"。需要在，就不能认识 HTTP。',
      approach: [
        '找出这段代码的所有调用方（HTTP？定时任务？CLI？）',
        '只要有一个调用方不是 HTTP，就不能出现 req/res',
        '把 HTTP 相关的东西收敛到 controller 和 helpers',
      ],
      knowledge: ['依赖方向', 'Service 层职责', '可测试性'],
      pitfalls: [
        '以为"只要不 import 具体函数，import type 就没事" —— 类型也会把耦合带进来，因为你会开始写 req.body',
      ],
    },

    {
      id: 'e2',
      type: 'multi',
      title: '分层的真实收益与代价',
      prompt: '关于分层，下面哪些说法是**准确**的？（多选）',
      points: 15,
      options: [
        { id: 'a', text: '分层的主要收益是让代码总行数变少' },
        { id: 'b', text: '分层之后，改动的影响范围变得可预测' },
        { id: 'c', text: '分层让业务逻辑可以脱离 HTTP 单独测试' },
        { id: 'd', text: '分层之后文件数会增加，总行数通常略微上升' },
        { id: 'e', text: '只要分了层，代码质量就一定更好' },
      ],
      answer: ['b', 'c', 'd'],
      hints: [
        '先排除那个明显反直觉的：分层会让代码变少吗？',
        '再看那个绝对化的表述："只要……就一定……"。软件工程里几乎没有这样的句式。',
        '正确答案 B、C、D。A 错：分层会让文件数和总行数都上升（多出的接口、类型、转发）。B 对：这是分层的核心收益。C 对：这是最直接的工程回报。D 对：承认代价才是诚实的。E 错：分错层的代码比不分层更难维护，因为它制造了"看起来有结构"的假象。',
      ],
      explanation:
        '分层是**用结构复杂度换变更可控性**的交易。交易划不划算取决于代码要活多久、几个人维护。',
      approach: [
        '先问代码的生命周期',
        '再问维护人数',
        '最后问"换实现/换调用方式"的概率',
      ],
      knowledge: ['分层收益', '技术债', 'YAGNI'],
      pitfalls: [
        '把"分层"当成政治正确的答案，在任何场景都套一遍',
      ],
    },

    {
      id: 'e3',
      type: 'debug',
      title: '找错：这个 service 有三处越界',
      prompt:
        '下面这段代码放在 `application/note.service.ts` 里。它违反了分层规则，也埋了两个 bug。找出所有问题。',
      points: 20,
      buggyLang: 'ts',
      buggyCode: `export class NoteService {
  async rename(req: IncomingMessage, res: ServerResponse) {
    const id = req.url!.split('/').pop()!
    const body = await readJson(req)

    const note = await this.repo.findById(id)
    if (note.userId !== req.headers['x-user-id']) {
      res.statusCode = 403
      return res.end('forbidden')
    }

    note.title = body.title
    await this.repo.update(note)
    res.statusCode = 200
    res.end(JSON.stringify(note))
  }
}`,
      options: [
        { id: 'a', text: 'service 接收了 req/res，把 HTTP 耦合进了业务层' },
        { id: 'b', text: '权限判断用了客户端传来的 x-user-id 头，可被伪造，属于越权漏洞' },
        { id: 'c', text: '没有判断 note 是否为 null，findById 返回 null 时会抛 TypeError' },
        { id: 'd', text: '直接改了 findById 返回的对象再 update，如果 repo 返回的是引用会污染缓存' },
        { id: 'e', text: 'res.statusCode 应该写在 res.end() 之后' },
        { id: 'f', text: 'body.title 没有做长度/类型校验，可能写入超长或非字符串' },
      ],
      answer: ['a', 'b', 'c', 'f'],
      hints: [
        '先看函数签名。service 的方法参数应该是什么？',
        '再看权限来源：req.headers 里的 x-user-id 是谁设置的？客户端可以随便写。',
        '正确答案 A、B、C、F。A：service 收 req/res 是根本性错误，导致整个方法无法在非 HTTP 环境调用。B：`x-user-id` 是客户端可控的头，攻击者改成别人的 id 就能改别人的笔记——这是水平越权。C：`findById` 返回 `Note | null`，没判空就访问 `.userId` 会抛 `Cannot read properties of null`，最终变成 500 而不是 404。F：`body.title` 可能是数字、对象或超长字符串，没有校验就直接写库。D 是"可能但不确定"的推断，不属于这三处硬伤；E 是错的——statusCode 必须在 end 之前设置。',
      ],
      explanation:
        '这四处错误的共同点是：**把 HTTP 层的问题带进了业务层，同时丢掉了业务层该有的保护。** 分层不只是"文件分开"，它要求每层只处理自己那一类问题。',
      approach: [
        '看签名：有没有 req/res/statusCode',
        '看身份来源：是不是从可伪造的地方取的',
        '看可空返回：有没有判空',
        '看外部输入：有没有校验',
      ],
      knowledge: ['分层越界', '水平越权', '空值处理', '输入校验'],
      pitfalls: [
        '以为"只是读一个 header，不算耦合" —— 读了 header 就意味着这段代码必须有 HTTP 上下文',
      ],
    },

    {
      id: 'e4',
      type: 'code',
      title: '编程：实现依赖注入容器',
      prompt:
        '实现一个 `Container`，支持 `register(name, factory)` 和 `resolve(name)`，默认单例，并检测循环依赖。下面的检查项全部通过才算对。',
      points: 25,
      starter: `class Container {
  constructor() {
    this.factories = new Map()
    this.instances = new Map()
    this.resolving = []
  }

  register(name, factory) {
    // 默认单例：第一次 resolve 时创建，之后复用
    // 提示：把 factory 包一层，缓存结果
    return this
  }

  resolve(name) {
    // 1. 没注册要抛错
    // 2. 正在解析同一个名字 → 循环依赖，抛错并给出链路
    // 3. 正常：push → 执行 → pop
    return undefined
  }
}

// —— 下面是检查用的场景，不要改 ——
const c = new Container()
let count = 0
c.register('db', () => { count++; return { kind: 'db' } })
c.register('repo', (x) => ({ kind: 'repo', db: x.resolve('db') }))
c.register('svc', (x) => ({ kind: 'svc', repo: x.resolve('repo') }))

const a = c.resolve('svc')
const b = c.resolve('svc')
const d1 = c.resolve('db')

let unregisteredError = ''
try { c.resolve('nope') } catch (e) { unregisteredError = e.message }

const cyc = new Container()
cyc.register('x', (k) => k.resolve('y'))
cyc.register('y', (k) => k.resolve('x'))
let cycleError = ''
try { cyc.resolve('x') } catch (e) { cycleError = e.message }

return { a, b, d1, count, unregisteredError, cycleError }`,
      checks: [
        { name: '单例：两次 resolve 拿到同一个对象', expr: 'result.a === result.b' },
        { name: '依赖被正确注入', expr: "result.a.repo.db.kind === 'db'" },
        { name: '工厂只被调用一次', expr: 'result.count === 1' },
        { name: '未注册时报错', expr: "result.unregisteredError.includes('未注册')" },
        { name: '检测循环依赖', expr: "result.cycleError.includes('循环')" },
        { name: '循环依赖报错包含链路', expr: "result.cycleError.includes('x') && result.cycleError.includes('y')" },
      ],
      solution: `class Container {
  constructor() {
    this.factories = new Map()
    this.instances = new Map()
    this.resolving = []
  }

  register(name, factory) {
    this.factories.set(name, (c) => {
      if (!this.instances.has(name)) this.instances.set(name, factory(c))
      return this.instances.get(name)
    })
    return this
  }

  resolve(name) {
    const factory = this.factories.get(name)
    if (!factory) throw new Error('未注册的依赖: ' + name)
    if (this.resolving.includes(name)) {
      throw new Error('检测到循环依赖: ' + [...this.resolving, name].join(' -> '))
    }
    this.resolving.push(name)
    try {
      return factory(this)
    } finally {
      this.resolving.pop()
    }
  }
}`,
      hints: [
        '单例的关键是"缓存"：register 时不要直接存 factory，而是存一个包装过的函数，它先查 instances，没有才调用 factory。',
        '循环依赖检测靠一个"正在解析的栈"：进入 resolve 时 push 名字，离开时 pop（用 finally 保证异常时也 pop）。如果 push 前发现名字已经在栈里，就是循环。',
        '完整实现见下。三个要点：① 包装函数缓存实例 ② 用 try/finally 保证 pop 一定执行 ③ 报错信息里带上完整链路（x -> y -> x），否则你只知道有循环，不知道断在哪。',
      ],
      explanation:
        '这就是 NestJS / InversifyJS 的核心机制，去掉装饰器和反射之后剩下的部分。手写一遍，你就知道"provider 注入不进去"通常是什么原因。',
      approach: [
        'register 存一个带缓存的包装函数',
        'resolve 先查注册表，没有就抛错',
        '用 resolving 栈检测循环',
        'finally 里 pop，保证异常路径也清理',
      ],
      knowledge: ['依赖注入容器', '单例生命周期', '循环依赖检测'],
      pitfalls: [
        '忘了 finally：一旦某次 resolve 抛错，栈里残留名字，之后所有正常解析都会被误判为循环依赖',
        '把实例存在 factory 的闭包里：这样每次 resolve 都会新建，单例失效',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 10,
    questions: [
      {
        id: 'q1',
        stem: '分层的本质是什么？',
        options: [
          { id: 'a', text: '把文件放进 controller / service / repository 三个文件夹' },
          { id: 'b', text: '依赖只能单向流动，内层不知道外层的存在' },
          { id: 'c', text: '让代码总行数变少' },
          { id: 'd', text: '每一层都必须有对应的接口' },
        ],
        answer: 'b',
        why: '目录结构只是结果。真正起作用的是依赖方向：controller 可以 import service，service 不能 import controller，更不能 import node:http。方向错了，文件夹分得再整齐也没用。',
        stepId: 's2',
      },
      {
        id: 'q2',
        stem: 'service 层发现"余额不足"，应该怎么表达？',
        options: [
          { id: 'a', text: '直接 res.statusCode = 422' },
          { id: 'b', text: '抛一个 InsufficientBalance 领域错误，由 controller 翻译成 422' },
          { id: 'c', text: '返回 null，让 controller 猜' },
          { id: 'd', text: '返回 { ok: false, status: 422 }' },
        ],
        answer: 'b',
        why: 'service 不能知道 HTTP 存在。抛领域错误、由边界层翻译成状态码，是唯一既能表达业务含义、又不引入 HTTP 耦合的做法。C 丢失了错误原因，D 把状态码又带回了业务层。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '为什么 repository 的接口要定义在 domain 层，实现放在 infrastructure 层？',
        options: [
          { id: 'a', text: '为了目录整齐' },
          { id: 'b', text: '这样 service 只依赖抽象，换存储实现时 service 不用改' },
          { id: 'c', text: '因为 TypeScript 要求接口和实现分开文件' },
          { id: 'd', text: '为了减少编译时间' },
        ],
        answer: 'b',
        why: '接口在内层、实现在外层，就是依赖倒置：内层不依赖外层，外层来实现内层定义的契约。这样从内存换成 SQLite、再换成 Postgres，service 一行不动。',
        stepId: 's5',
      },
      {
        id: 'q4',
        stem: '在 service 构造函数里 new 一个 repo，最致命的问题是什么？',
        options: [
          { id: 'a', text: '代码看起来不优雅' },
          { id: 'b', text: '性能更差' },
          { id: 'c', text: '实现被硬编码，测试必须连真库，且构造顺序失控时才发现循环依赖' },
          { id: 'd', text: 'TypeScript 会报类型错误' },
        ],
        answer: 'c',
        why: 'new 把"用哪个实现"这个决定写死在了业务代码里。后果是换实现要改源码、测试要连真库（慢且脏）、依赖成环时在运行时才炸。改成构造函数注入，三个问题一起消失。',
        stepId: 's6',
      },
      {
        id: 'q5',
        stem: 'DI 容器如何检测循环依赖？',
        options: [
          { id: 'a', text: '靠 TypeScript 编译期检查' },
          { id: 'b', text: '维护一个"正在解析"的栈，进入时 push、离开时 pop，push 前发现已在栈中即为循环' },
          { id: 'c', text: '设置超时，超过 5 秒就报错' },
          { id: 'd', text: '靠 try/catch 捕获栈溢出' },
        ],
        answer: 'b',
        why: '解析栈是最直接的办法。关键是离开时用 finally 保证 pop，否则一次异常就会让栈残留，之后所有正常解析都被误判为循环。超时和栈溢出都是事后补救，报错信息里没有链路，排查成本高得多。',
        stepId: 's7',
      },
      {
        id: 'q6',
        stem: '下面哪种情况**最不应该**分层？',
        options: [
          { id: 'a', text: '三人协作、预计维护两年的业务系统' },
          { id: 'b', text: '要同时支持 HTTP 和消息队列的订单服务' },
          { id: 'c', text: '一次性的数据迁移脚本，跑完就删' },
          { id: 'd', text: '需要写详细单元测试的计费模块' },
        ],
        answer: 'c',
        why: '一次性脚本的寿命比写它的时间还短，分层的收益（可测、可换、可维护）根本来不及兑现，只剩成本。A、B、D 都有明确的长期收益。',
        stepId: 's8',
      },
      {
        id: 'q7',
        stem: 'controller 里写 `if (note.ownerId !== ctx.userId) throw new Forbidden()`，问题在哪？',
        options: [
          { id: 'a', text: '没问题，controller 就该做权限判断' },
          { id: 'b', text: '权限是业务规则，写在 controller 意味着从 CLI / 定时任务调用 service 时会绕过它' },
          { id: 'c', text: '应该用 404 而不是 403' },
          { id: 'd', text: '应该放在中间件里' },
        ],
        answer: 'b',
        why: '这条规则的本质是"只有作者能改"，属于业务不变量，必须住在 service 或更内层。写在 controller，任何非 HTTP 入口都会绕过它——这类漏洞在加了定时任务或内部工具之后才会暴露。',
        stepId: 's3',
      },
      {
        id: 'q8',
        stem: 'composition root（组装根）的作用是什么？',
        options: [
          { id: 'a', text: '存放所有业务逻辑' },
          { id: 'b', text: '整个应用里唯一知道"哪个接口用哪个实现"的地方' },
          { id: 'c', text: '启动 HTTP 服务器' },
          { id: 'd', text: '做参数校验' },
        ],
        answer: 'b',
        why: '组装根把"选实现"这个决策收敛到一个文件。测试时换一行就能把 SqliteRepo 换成 InMemoryRepo。这也是为什么业务层不该出现 new ——一旦出现，决策就散开了。',
        stepId: 's7',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统的后端骨架',
    contributes:
      '这一课把第一课的 90 行拆成 controller / service / repository 三层 + 一个组装根。后面加 RAG 检索、Agent 工具、鉴权，都是往这三层里加文件，而不是往一个文件里加行数。',
    tasks: [
      '按三层重构第一课的 server.ts，业务逻辑全部搬进 service',
      '定义 NoteRepo 接口，写两个实现：InMemory 和 SQLite，用组装根切换',
      '写 3 个 service 单元测试（创建、越权查询、重命名），全部不启动 HTTP 服务器',
      '实现 Container，把组装根里的 new 全部换成 register + resolve',
    ],
    done: '删掉 interface/http 整个目录，service 层测试仍能全部通过——这说明业务逻辑真的和 HTTP 解耦了。',
  },

  further: [
    { text: 'Martin Fowler · Inversion of Control 容器与依赖注入模式' },
    { text: 'NestJS 官方文档 · Providers 与 Module 作用域' },
    { text: '《架构整洁之道》第 22 章 · 整洁架构（依赖规则）' },
  ],
}
