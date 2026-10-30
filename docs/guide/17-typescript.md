# 17 · TypeScript 深入

> **投入权重：8%** · 这一章不在原来的 14 个模块里，是补的。
>
> 原因很直接：AI 应用里 TS 不只是写组件，它要承担**工具 schema、流式事件、Agent 状态机、API 契约**。这些地方类型错了，运行时才炸，而且炸得很难查。

## 为什么 AI 应用特别需要 TS

三个具体场景，都是类型系统直接救命的地方：

**一、工具定义。** 你给模型的 tool schema 和你在代码里执行的函数，必须是同一份定义。手写两份必然漂移——模型按 A 填参数，你按 B 解析，出错时你甚至不知道是谁的错。用 TS 从类型推导 schema，或者用 zod 定义后反推类型，才能保证一致。

**二、流式事件。** SSE 推过来的事件有六七种（text-delta / tool-call / tool-result / reasoning / done / error），每种字段不同。没有 discriminated union，你的 switch 里全是 `as any`，加一种事件就漏一处。

**三、Agent 状态机。** 一个 Agent 运行有十几个状态，每个状态允许的动作不同。用联合类型表达，编译器能帮你拦住"在等待审批时调用了执行工具"这类错误。

## 类型系统核心

- **类型标注与推断** <span class="prio prio-must">必须</span> — 标注是约束，推断是省事。函数返回值建议显式标注（防止实现变化导致调用方静默出错）。
- **`interface` 与 `type` 的区别** <span class="prio prio-must">必须</span> — interface 可声明合并、适合对象契约；type 能表达联合、交叉、条件类型。**团队约定一个默认，别混着用。**
- **可选属性与 `exactOptionalPropertyTypes`** <span class="prio prio-imp">重要</span> — `a?: string` 和 `a: string | undefined` 在严格模式下不等价。开这个选项能抓到一批"传了 undefined 覆盖了默认值"的 bug。
- **联合类型** <span class="prio prio-must">必须</span> — AI 场景到处都是联合：`Content = TextPart | ImagePart | ToolCallPart`。
- **字面量类型与 `as const`** <span class="prio prio-must">必须</span> — 工具名、事件类型、模型 ID 都应该是字面量联合，而不是 string。写错一个字母编译期就报。
- **类型收窄（narrowing）** <span class="prio prio-must">必须</span> — `typeof` / `in` / `instanceof` / 判别属性。**判别联合（discriminated union）是处理流式事件的标准姿势**。
- **`unknown` 与 `any`** <span class="prio prio-must">必须</span> — 外部输入（API 响应、JSON.parse、工具返回值）一律 `unknown`，校验后再用。`any` 会让整条链路失去保护。
- **`never` 与穷尽检查** <span class="prio prio-imp">重要</span> — switch 处理事件类型时，default 分支写 `const _: never = evt`，新增事件类型时编译器会提醒你。
- **类型断言的风险** <span class="prio prio-imp">重要</span> — `as` 是"我保证"，不是"我检查"。用在校验之后，不要用在校验之前。

## 泛型

- **函数泛型** <span class="prio prio-must">必须</span> — 工具执行器、结果包装器这类通用逻辑必须泛型化。
- **泛型约束 `extends`** <span class="prio prio-must">必须</span> — 约束到"有 id 字段"这类最小契约，而不是约束到具体类型。
- **泛型默认值** <span class="prio prio-imp">重要</span> — 让常见用法不用显式传参。
- **`keyof` 与索引访问类型** <span class="prio prio-imp">重要</span> — 从对象类型取键，做类型安全的字段访问。
- **`infer`** <span class="prio prio-imp">重要</span> — 从函数返回值、数组元素、Promise 内部提取类型。写通用工具时用。
- **条件类型** <span class="prio prio-imp">重要</span> — `T extends X ? A : B`，配 `infer` 能做类型转换。
- **映射类型** <span class="prio prio-imp">重要</span> — 把一组字段批量变成可选/只读/可空。
- **模板字面量类型** <span class="prio prio-opt">选学</span> — 拼字符串类型，做事件名、路由名的约束。

**别陷进类型体操。** `type-challenges` 做前 20 题足够。工程里的类型是为了防错，不是为了炫技。写出三层嵌套的条件类型，三个月后你自己也看不懂。

## 工具类型（实际会用到的那几个）

- **`Partial` / `Required`** <span class="prio prio-must">必须</span> — 更新接口的参数、配置的默认值合并。
- **`Pick` / `Omit`** <span class="prio prio-must">必须</span> — 从数据库模型派生 API 响应类型（去掉 password、internal 字段），这是最常用的模式。
- **`Record`** <span class="prio prio-must">必须</span> — 模型注册表、工具注册表。
- **`ReturnType` / `Parameters`** <span class="prio prio-imp">重要</span> — 从函数反推类型，避免重复定义。
- **`Awaited`** <span class="prio prio-imp">重要</span> — 取 Promise 内部类型。
- **`NonNullable` / `Exclude`** <span class="prio prio-opt">选学</span> — 从联合里排除。

## 运行时校验：zod

类型在编译后消失，但 AI 应用面对的全是不可信输入——模型输出的 JSON、第三方 API、工具返回值。**必须有运行时校验。**

- **Schema 定义** <span class="prio prio-must">必须</span> — `z.object({...})`，字段级约束（长度、范围、枚举）。
- **`z.infer` 反推类型** <span class="prio prio-must">必须</span> — 一份定义同时得到运行时校验和编译期类型，**这是消除重复的唯一正确做法**。
- **`safeParse` 与错误处理** <span class="prio prio-must">必须</span> — 不要用 `parse` 抛异常，用 `safeParse` 拿结构化错误，把错误信息回喂给模型让它修正。
- **`z.discriminatedUnion`** <span class="prio prio-must">必须</span> — 流式事件、工具调用的标准写法。
- **`z.coerce`** <span class="prio prio-imp">重要</span> — 模型经常把数字写成字符串，`z.coerce.number()` 能救一批。
- **Schema 转 JSON Schema** <span class="prio prio-must">必须</span> — 用 `zod-to-json-schema` 直接把 zod 定义喂给模型的 tool schema，保证两边一致。
- **默认值与可选** <span class="prio prio-imp">重要</span> — `.default()` 在 AI 场景很关键，模型经常漏字段。
- **错误信息要能指导模型** <span class="prio prio-must">必须</span> — 校验失败时返回"字段 X 应为枚举值 [a,b,c]，你传的是 d"，而不是"validation failed"。

## 类型安全的 API 契约

- **前后端共享类型** <span class="prio prio-must">必须</span> — monorepo 里放一个 `packages/shared`，或者用 OpenAPI 生成。手写两份必然漂移。
- **响应类型与数据库模型分离** <span class="prio prio-must">必须</span> — 数据库模型不能直接当 API 响应，会泄露内部字段。
- **错误类型也建模** <span class="prio prio-must">必须</span> — 统一错误结构 `{ code, message, detail }`，用联合类型枚举 code。
- **`satisfies` 运算符** <span class="prio prio-imp">重要</span> — 既校验类型又保留字面量推断，写配置对象时特别有用。
- **品牌类型（branded type）** <span class="prio prio-opt">选学</span> — 区分 `UserId` 和 `TenantId`，防止传错参数。AI 场景里权限参数传错是安全事故。

## tsconfig 关键项

- **`strict: true`** <span class="prio prio-must">必须</span> — 这是底线。不开 strict 的 TS 约等于加了注释的 JS。
- **`noUncheckedIndexedAccess`** <span class="prio prio-must">必须</span> — 数组下标访问返回 `T | undefined`。能抓到一批"数组为空时崩了"的 bug。
- **`exactOptionalPropertyTypes`** <span class="prio prio-imp">重要</span> — 区分"没有这个字段"和"字段是 undefined"。
- **`noImplicitOverride`** <span class="prio prio-opt">选学</span> — 类继承时强制写 override。
- **`verbatimModuleSyntax`** <span class="prio prio-opt">选学</span> — 明确区分类型导入和值导入，打包体积更可控。
- **`moduleResolution: bundler`** <span class="prio prio-imp">重要</span> — 现代项目的默认，别再用手写的 paths 别名硬凑。

## 在 AI 场景的具体用法

- **工具定义只写一次** <span class="prio prio-must">必须</span> — 用 zod 定义参数，`z.infer` 得类型，`zodToJsonSchema` 得 schema。三处一致，不会漂移。
- **流式事件用判别联合** <span class="prio prio-must">必须</span> — `type StreamEvent = { type:'text', delta:string } | { type:'tool_call', id:string, name:string, args:unknown } | ...`。
- **Agent 状态机用联合类型** <span class="prio prio-must">必须</span> — 每个状态带自己的数据，`switch` 时编译器强制你处理所有分支。
- **模型输出先 `unknown` 再校验** <span class="prio prio-must">必须</span> — `JSON.parse` 的结果就是 `unknown`，别直接 `as`。
- **权限参数用品牌类型** <span class="prio prio-imp">重要</span> — 防止把 `userId` 传到 `tenantId` 的位置。

## 验收标准

把现有项目开到 `strict` + `noUncheckedIndexedAccess` 全绿，并且：

- 工具定义没有一处手写 JSON Schema
- 流式事件的 switch 有穷尽检查
- 所有外部输入都经过 zod 校验
- 没有 `as any`（除了极少数标注了原因的）

**这是能写进简历的一句话**：「将项目迁移到 strict 模式并引入 zod 做运行时校验，消除 30+ 处类型逃逸，工具定义与 schema 由单一来源生成。」
