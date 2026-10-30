# 04 · Agent 智能体

> **投入权重：15%** · 最热也最容易翻车的一块。
> 核心矛盾只有一个：**单步准确率乘以步数会衰减**，所以工程重点全在"如何减少步数"和"如何兜住错误"。

## 先把预期调对

绝大多数失败的 Agent 项目，问题不在模型不够强，而在设计者默认"模型会自己搞定"。真实情况是：模型在单步上表现不错，但每一步都有几个百分点的失败率，十步之后就只剩六成。这不是模型缺陷，是概率的算术。

所以所有成熟的 Agent 系统都在做同一件事：**用工程手段把不确定性关进笼子**。显式状态机、工具白名单、人工审批点、成本上限、终止条件——这些听起来不"智能"，但它们是能上生产的原因。

## 基础概念

- **Agent 的四要素** <span class="prio prio-must">必须</span> — LLM（决策）+ Tools（行动）+ Loop（迭代）+ Memory（状态）。缺一个就不是 Agent，只是带工具调用的问答。
- **自主 Agent vs 工作流** <span class="prio prio-must">必须</span> — Anthropic 的判断：能用工作流就别用自主 Agent。工作流可预测、可测、便宜。
- **单步可靠性的连乘衰减** <span class="prio prio-must">必须</span> — 单步 95%，十步之后约 60%。所以"减少步数"比"提升单步"收益更大。
- **什么时候该用 Agent** <span class="prio prio-must">必须</span> — 任务步数不定、路径不可预枚举、且容错空间大。三者缺一就别用。
- **成本与延迟的现实约束** <span class="prio prio-must">必须</span> — 一个 Agent 任务常常是普通问答的 10~50 倍成本，产品设计必须考虑。
- **Agent 的价值来源** <span class="prio prio-imp">重要</span> — 不是"更聪明"，是"能执行"。判断标准是它能不能改变外部世界的状态。

## 工具与协议

- **Function Calling 协议** <span class="prio prio-must">必须</span> — 模型输出结构化调用请求，你执行后回填结果。理解完整的消息流，包括 assistant 的 tool_calls 与 tool 角色的返回。
- **Tool Schema 设计** <span class="prio prio-must">必须</span> — 参数少、类型明确、必填项少。参数越多模型填错概率越高。
- **工具描述即 Prompt** <span class="prio prio-must">必须</span> — description 写得好不好直接决定调用准确率。要写"什么时候用"和"什么时候不用"。
- **工具粒度** <span class="prio prio-must">必须</span> — 太粗（一个万能工具）模型不会用，太细（几十个工具）模型选错。按任务域分组。
- **工具返回值设计** <span class="prio prio-must">必须</span> — 返回结构化、截断过长内容、带明确的成功/失败标记。别把 10KB HTML 直接塞回去。
- **错误返回与自愈** <span class="prio prio-must">必须</span> — 错误信息要能指导模型下一步（"参数 X 应为日期格式"），而不是抛异常字符串。
- **并行工具调用** <span class="prio prio-imp">重要</span> — 无依赖的调用并行执行，显著降延迟。
- **MCP（Model Context Protocol）** <span class="prio prio-must">必须</span> — Anthropic 提出、已被主流厂商采纳的工具接入标准。相当于 AI 应用的 USB 接口，必学。
- **MCP 架构** <span class="prio prio-must">必须</span> — Host / Client / Server 三角色，stdio 与 HTTP+SSE 两种传输。
- **MCP 生态与自建 Server** <span class="prio prio-imp">重要</span> — 官方 server 集合、社区 server、以及把自己的内部系统包成 MCP Server。这是最容易出彩的实践方向。
- **A2A 协议** <span class="prio prio-opt">选学</span> — Agent 间通信协议，多 Agent 协作的标准尝试，了解动向即可。

## 规划范式

- **ReAct 循环** <span class="prio prio-must">必须</span> — Thought → Action → Observation。所有 Agent 的祖宗，先把它手写一遍。
- **Plan-and-Execute** <span class="prio prio-must">必须</span> — 先出完整计划再执行。适合步骤明确的复杂任务，省 token。
- **Tree of Thoughts** <span class="prio prio-opt">选学</span> — 多路径探索 + 剪枝。成本高，适合难题。
- **Reflexion 自我反思** <span class="prio prio-imp">重要</span> — 失败后分析原因再重试。要有明确的失败信号才有用。
- **Router 路由** <span class="prio prio-must">必须</span> — 先用小模型分类任务，再分发给不同流程。降本利器。
- **状态机式 Agent** <span class="prio prio-must">必须</span> — 用显式状态图约束流程，而不是让模型自由发挥。生产环境更常用这个。
- **任务分解的粒度** <span class="prio prio-imp">重要</span> — 拆得太细，步数多误差累积；拆得太粗，单步难度高。按"单步可验证"来拆。

## 记忆

- **记忆分层** <span class="prio prio-imp">重要</span> — 工作记忆（当前上下文）/ 情景记忆（历史事件）/ 语义记忆（事实知识）/ 程序记忆（技能）。
- **短期记忆与上下文管理** <span class="prio prio-must">必须</span> — 滑动窗口、摘要、关键信息抽取。长对话必然要处理。
- **长期记忆实现** <span class="prio prio-imp">重要</span> — 向量库存事实 + 定期摘要。写入时机比检索算法更关键。
- **记忆写入策略** <span class="prio prio-imp">重要</span> — 不是所有对话都值得记。要有"重要性打分"再决定写不写。
- **记忆冲突与遗忘** <span class="prio prio-opt">选学</span> — 新旧信息矛盾时如何处理（覆盖/时间戳/并存）。这是长期记忆的真实难点。
- **记忆检索时机** <span class="prio prio-imp">重要</span> — 每次请求都检索全部记忆会污染上下文。要按相关性筛选。

## 多 Agent

- **协作模式** <span class="prio prio-imp">重要</span> — 顺序 / 并行 / 辩论 / 层级（主管-工人）。
- **角色分工设计** <span class="prio prio-imp">重要</span> — 分工要按"能力差异"而非"人格设定"，否则只是多花 token。
- **上下文隔离与消息传递** <span class="prio prio-must">必须</span> — 只传结构化结论，不传完整对话，否则污染爆炸。
- **编排框架** <span class="prio prio-must">必须</span> — LangGraph（图/状态机，生产首选）/ AutoGen / CrewAI / MetaGPT。
- **多 Agent 的真实收益** <span class="prio prio-must">必须</span> — 多数场景下多 Agent 不如一个好 Agent + 好工具。别为了架构而架构。

## 可靠性工程

- **循环终止条件** <span class="prio prio-must">必须</span> — 最大步数、最大成本、无进展检测。三个都要有，缺一个就可能烧钱。
- **超时与重试** <span class="prio prio-must">必须</span> — 工具调用必须有超时，重试要退避且限次。
- **幂等与副作用** <span class="prio prio-must">必须</span> — 写操作要幂等键，避免重试导致重复下单/重复发信。
- **人机协同 HITL** <span class="prio prio-must">必须</span> — 高风险动作前插入审批点。这是 Agent 落地的必要条件，不是可选项。
- **中断与恢复** <span class="prio prio-imp">重要</span> — 任务可暂停、可恢复、可回滚。长任务必须支持。
- **成本上限控制** <span class="prio prio-must">必须</span> — 按任务设 token 预算，超了降级或终止。
- **可观测性** <span class="prio prio-must">必须</span> — 每一步的输入输出都要能回放，否则出问题无法定位。
- **Agent 评估的困难** <span class="prio prio-imp">重要</span> — 路径不唯一，不能只比最终答案。需要评"过程合理性"与"效率"。
- **降级路径** <span class="prio prio-imp">重要</span> — Agent 卡住时要能退化成"给用户一个半成品 + 人工接管"。

## 执行环境

- **代码解释器 / 沙箱** <span class="prio prio-must">必须</span> — 执行模型生成的代码必须隔离：无网络、限资源、限时。
- **Computer Use / Browser Use** <span class="prio prio-imp">重要</span> — 让模型操作浏览器或桌面。能力上限高但稳定性差，适合有兜底的场景。
- **文件系统与工作区** <span class="prio prio-imp">重要</span> — 给 Agent 一个可读写的临时工作区，比全靠上下文传递更可靠。
- **权限边界** <span class="prio prio-must">必须</span> — Agent 代表用户操作时，权限必须是"用户的权限"而非"系统的权限"。

## MCP Server 开发（会用 ≠ 会做）

前面讲了 MCP 是什么，但**面试问的是"你写过 MCP Server 吗"**。这一节补齐。

- **最小 Server 结构** <span class="prio prio-must">必须</span> — 注册 server 信息 → 声明 capabilities → 实现 tool/resource handler → 连接 transport。三十行能跑起来一个。
- **Tool 定义三要素** <span class="prio prio-must">必须</span> — name、description、inputSchema（JSON Schema）。**description 是给模型看的，要写清"什么时候用"。**
- **返回值结构** <span class="prio prio-must">必须</span> — `content` 数组，每项有 type（text/image/resource）。**`isError` 标记很关键**，模型靠它判断要不要重试。
- **Resource 与 Tool 的区别** <span class="prio prio-imp">重要</span> — Resource 是被动的、可读取的数据（URI 寻址）；Tool 是主动的、有副作用的操作。别把查询做成 Tool，那是 Resource。
- **Prompts 能力** <span class="prio prio-opt">选学</span> — 服务端预置的提示模板，供客户端调用。
- **stdio 传输** <span class="prio prio-must">必须</span> — 本地进程，通过标准输入输出通信。适合本地工具，不能用于远程。
- **Streamable HTTP 传输** <span class="prio prio-must">必须</span> — 远程部署用，支持 SSE 流式响应和会话管理。
- **能力协商** <span class="prio prio-imp">重要</span> — 初始化时双方声明支持的能力，客户端只能调服务端声明过的。
- **进度通知与取消** <span class="prio prio-imp">重要</span> — 长任务要发 progress 通知；客户端取消要能中止服务端执行。
- **认证** <span class="prio prio-must">必须</span> — 远程 Server 必须做认证（OAuth 或 token），并且**把调用者身份透传到业务逻辑**，否则权限无从谈起。
- **MCP Inspector 调试** <span class="prio prio-must">必须</span> — 官方调试工具，能看到原始 JSON-RPC 消息。写 Server 必用。
- **信任边界** <span class="prio prio-must">必须</span> — 第三方 Server 等于在你机器上跑任意代码。生产环境要白名单 + 审计。
- **测试** <span class="prio prio-imp">重要</span> — 直接测 handler 函数（单元），再用 Inspector 测协议层（集成）。

## Workflow 与持久化执行

Agent 最容易翻车的地方不是"不会做"，是"做到一半挂了"。这一节解决它。

- **状态机 vs 自由循环** <span class="prio prio-must">必须</span> — 生产环境优先状态机：每个状态允许的动作是枚举的，非法转移直接报错。自由循环只适合探索阶段。
- **Checkpoint 的时机** <span class="prio prio-must">必须</span> — 每步执行完就存，不要等任务结束。存的内容是"完整可序列化的运行时状态"，不是日志。
- **持久化执行（Durable Execution）** <span class="prio prio-must">必须</span> — 服务器重启后从最后一个 checkpoint 继续，而不是从头跑。Temporal / Inngest / LangGraph 都在解决这个。
- **中断与恢复** <span class="prio prio-must">必须</span> — 暂停要能保存现场，恢复要能接着做。人工审批本质就是一次长时间中断。
- **补偿（Compensation）** <span class="prio prio-imp">重要</span> — 已经执行了副作用但后续失败，要能撤销。比如发了邮件但后面步骤失败，要能发更正。
- **幂等重放** <span class="prio prio-must">必须</span> — 从 checkpoint 恢复时，那一步可能已经执行过。必须靠幂等键保证不重复。
- **状态版本兼容** <span class="prio prio-imp">重要</span> — 代码升级后旧 checkpoint 可能反序列化失败。要版本号 + 迁移。
- **超时分层** <span class="prio prio-must">必须</span> — 步骤超时、任务总超时、审批超时（超时自动拒绝还是通过？要明确）。

## Agent Skills

- **Skill 是什么** <span class="prio prio-must">必须</span> — 把"做某类任务的方法"封装成可复用的文档 + 脚本 + 资源，模型按需加载。
- **`SKILL.md` 结构** <span class="prio prio-must">必须</span> — 元信息（名称、触发条件）+ 操作步骤 + 注意事项 + 依赖资源。
- **渐进披露（Progressive Disclosure）** <span class="prio prio-must">必须</span> — 先给模型看摘要，需要时再加载全文。**这是 Skill 相对"塞进 system prompt"的核心优势**——不占常驻上下文。
- **触发条件怎么写** <span class="prio prio-must">必须</span> — 要写"什么情况下用"，不是"这是什么"。写不好就不会被触发。
- **与 Function Calling / MCP 的区别** <span class="prio prio-must">必须</span> — Function Calling 是"调一个函数"，MCP 是"接一个工具服务"，Skill 是"教一套方法"。三者不互斥，常常一起用。
- **脚本与资源** <span class="prio prio-imp">重要</span> — Skill 可以带可执行脚本，但要声明依赖和权限。
- **版本与测试** <span class="prio prio-imp">重要</span> — Skill 改了要回归测试，否则会静默失效。

## 本章对应的面试题

共 20 题，见 [15 · 面试题库 · E 组](/guide/15-interview#e-agent-20-题)。

最关键的是第一题：**什么时候该用 Agent，什么时候用工作流**。答"Agent 更先进"会被直接扣分——正确的答案是"工作流优先，只有当步骤无法预先枚举时才用 Agent"。

配套动手部分见 [16 · 项目实战 · 项目 2](/guide/16-projects)。

