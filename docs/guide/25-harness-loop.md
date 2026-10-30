# 25 · Agent Harness 与 Loop Engineering

> **投入权重：8%** · 新增一章。**这一章讲的是 Codex、Claude Code、Cursor Agent 这类系统背后的运行机制**，不是"怎么用它们"。
>
> 行业终于给两件事起了名字，而这两件事你其实已经学了一半：**Harness 是模型外面那套让它能可靠干活的壳，Loop 是它迭代收敛的那个圈。** 但名字一旦出现，面试就会用名字问。这一章把词和内容对上。

## 一个公式先记住

```text
Agent = Model + Harness
```

- **Model 提供**：理解、推理、生成、决策建议。**它是商品**——你可以换，而且大家用的是同几家。
- **Harness 提供**：工具、状态、权限、执行、反馈。**它是你的产品**——同样的模型，Harness 不同，能干的活差一个数量级。

**这句话是整个 2026 年 Agent 工程的认知起点**：模型能力趋同，差异化全在壳上。所以面试问"你们 Agent 的核心竞争力"，答"我们用了 GPT-5"是零分，答"我们的工具设计、状态管理和验证回路"才是分数。

## Harness 是什么（一句话版）

**Harness = 把一个只会说话的模型，变成能改真实世界的系统的全部工程。**

它包含六件事：**能看什么（上下文）、能做什么（工具）、允许做什么（权限）、做过什么（状态）、做得对不对（验证）、出错怎么办（恢复）**。下面逐项拆。

### 运行时（Runtime）

- **Agent Runtime** <span class="prio prio-must">必须</span> — 承载 Agent 循环的进程/服务。它管三件事：**调度循环、分发工具调用、维护会话状态**。区别于"调一次 API"——Runtime 是常驻的。
- **Tool Execution Runtime** <span class="prio prio-must">必须</span> — 工具不是函数调用那么简单：要**并发控制、超时、重试、结果截断、错误标准化**。**工具执行层写不好，Agent 会因为一个慢工具整体卡死**。
- **执行隔离** <span class="prio prio-must">必须</span> — 每个工具调用应该在受控环境里跑（容器 / 子进程 / 沙箱），**不能和主进程共享内存和文件系统**。
- **并发与串行** <span class="prio prio-imp">重要</span> — 无依赖工具并行，有依赖的串行。**Runtime 要能判断依赖**（通常靠模型声明，所以工具 schema 里要写清前置条件）。

### 沙箱与文件系统

- **Agent Sandbox** <span class="prio prio-must">必须</span> — 代码执行必须隔离。四道约束：**无网络（默认）、资源配额、执行超时、只读根文件系统**。详见 [09 · 安全](/guide/09-security)。
- **Virtual Filesystem（虚拟文件系统）** <span class="prio prio-must">必须</span> — **这是 Codex / Claude Code 类系统的核心设计**：给 Agent 一个"看起来像文件系统"的工作区，实际上可能是数据库、对象存储或内存。好处有三个：① 模型天然会用文件（训练数据里全是）② 大块内容可以"写出去"，不用一直占上下文 ③ 状态可持久化、可回放。
- **工作区布局要稳定** <span class="prio prio-imp">重要</span> — `/workspace/input`（只读输入）、`/workspace/scratch`（草稿）、`/workspace/output`（产出）。**固定布局让模型的成功率显著上升**，因为它能形成稳定预期。
- **文件即状态** <span class="prio prio-imp">重要</span> — 长任务的中间结果写文件，不留在对话里。**这是"能做几小时任务"和"只能做十分钟任务"的分界线**。

### 上下文管理

- **Context Offloading（上下文卸载）** <span class="prio prio-must">必须</span> — 把大块内容挪出上下文，只留一个"句柄"（文件路径、记录 ID）。**模型需要时再读回来**。典型：抓到的网页写进文件，上下文里只留"已保存到 /scratch/page1.md，共 3200 字"。
- **Context Compaction（上下文压缩）** <span class="prio prio-must">必须</span> — 上下文快满时，把前面的对话压成摘要，保留关键结论和未完成事项。**和 [22 · 记忆](/guide/22-memory) 的滚动摘要同源，但目标是"不中断当前任务"而不是"跨会话记住"**。
- **压缩的时机** <span class="prio prio-imp">重要</span> — 不要等到 100%。**经验值：到窗口的 70~80% 就开始压**，因为压缩本身要花 token，而且压完还要留空间继续干活。
- **压缩会丢什么** <span class="prio prio-imp">重要</span> — 容易丢"限定词"（除了…、只在…时、不要…）。**所以"约束条件"要单独结构化存一份，不参与压缩**。
- **Memory Management（记忆管理）** <span class="prio prio-must">必须</span> — Harness 要区分三层：**当前任务的工作记忆、跨轮次的会话记忆、跨会话的长期记忆**。见 [22 章](/guide/22-memory)。
- **Skills Loading（技能按需加载）** <span class="prio prio-must">必须</span> — 不把所有能力塞进 system prompt，而是**先给目录、需要时加载全文**。这是 Skill 相对"全塞进去"的核心优势（渐进披露）。
- **上下文预算的显式分配** <span class="prio prio-must">必须</span> — system / 工具定义 / 检索结果 / 历史 / 输出预留，**五份抢一个池子，必须写死比例**。不分配就会某一项吃掉全部。

### 任务与委派

- **Task Planning（任务规划）** <span class="prio prio-must">必须</span> — 把目标拆成可验证的步骤，写成结构化列表（不是自然语言段落）。**能勾选完成的列表，比"我认为应该这样做"可靠得多**。
- **计划要能被修改** <span class="prio prio-imp">重要</span> — 执行中发现计划错了要能改。**"计划不可变"是常见设计错误**——它会让 Agent 硬着头皮走错路。
- **Subagent Delegation（子 Agent 委派）** <span class="prio prio-must">必须</span> — 把独立子任务交给子 Agent，**子 Agent 有自己干净的上下文**。这是多 Agent 唯一稳定的收益来源：**上下文隔离**，不是"更聪明"。
- **委派的成本** <span class="prio prio-imp">重要</span> — 每个子 Agent 都要重新建立上下文，**简单任务委派反而更慢更贵**。判断标准：子任务是否"需要读大量材料但只需要返回结论"。
- **委派深度限制** <span class="prio prio-must">必须</span> — 子 Agent 再分子 Agent，会指数级爆炸。**硬限制深度（通常 2 层）**。

### 权限与人机边界

- **Execution Permissions（执行权限）** <span class="prio prio-must">必须</span> — 分档授权：只读 / 可写文件 / 可执行命令 / 可访问网络 / 可触达外部系统。**默认最小，逐级申请**。见 [24 章的四档权限](/guide/24-ai-assisted-dev)。
- **权限要在工具层强制** <span class="prio prio-must">必须</span> — 不能靠 prompt 说"不要删文件"。**代码里没有这个工具，它就不可能删**。
- **Human-in-the-loop（人工介入）** <span class="prio prio-must">必须</span> — 三种形态：**事前审批**（高风险动作前问）、**事中打断**（发现跑偏立刻停）、**事后确认**（产出由人验收）。**三种都要有，只做一种不够**。
- **审批的粒度** <span class="prio prio-imp">重要</span> — 每个动作都问会烦死人，从不问会出事。**按"可逆性 × 影响范围"分级**：可逆且局部 → 自动；不可逆或对外 → 必须问。
- **审批要能"记住这次选择"** <span class="prio prio-opt">选学</span> — "本次会话内不再询问同类操作"。**体验细节，但决定用户会不会一直开着 Agent**。

### 状态与恢复

- **State Persistence（状态持久化）** <span class="prio prio-must">必须</span> — 状态必须能序列化成 JSON 落盘。**只在内存里的状态 = 重启就丢**。
- **Checkpoint Recovery（检查点恢复）** <span class="prio prio-must">必须</span> — 每个节点执行完存一次，失败从上个检查点继续。**配套必须有幂等键**，否则恢复会重复执行副作用。
- **恢复要能答三个问题** <span class="prio prio-must">必须</span> — 已做了什么、还剩什么、有没有副作用已经发生。**答不出第三个，恢复就是危险的**。
- **状态版本兼容** <span class="prio prio-imp">重要</span> — 加 `schema_version` + 迁移函数。**跑几小时的任务一定会跨代码版本**。

### 观测与评测

- **Trace / Debugging** <span class="prio prio-must">必须</span> — 每一步的输入、输出、耗时、token、工具调用参数都要记。**不能回放的 Agent 无法排障**。见 [08 · 可观测](/guide/08-observability)。
- **Evaluation Harness（评测脚手架）** <span class="prio prio-must">必须</span> — 能批量跑任务、能对比版本、能给出"这次改动是变好还是变坏"。**Harness 里没有评测，你就永远在盲改**。见 [07 · 评测](/guide/07-evals)。
- **成本与步数归因** <span class="prio prio-imp">重要</span> — 每次任务花了多少 token、多少钱、多少步。**没有归因就不知道钱花在哪个环节**。

## Loop Engineering：循环怎么设计

Harness 是"壳"，Loop 是"心跳"。**模型再强，循环设计错了也收敛不了。**

### 四拍循环

- **Observe → Act → Evaluate → Adjust** <span class="prio prio-must">必须</span> — 观察（看到什么）→ 行动（做什么）→ 评估（结果对不对）→ 调整（下一步改什么）。**ReAct 是它的简化版**（少了显式的 Evaluate）。
- **Evaluate 是大多数人漏掉的一拍** <span class="prio prio-must">必须</span> — 只做 Observe-Act 就是"瞎试"。**必须有独立的评估步骤**：这个结果算成功吗？为什么？**很多 Agent demo 失败就失败在"没有评估，只有下一步"**。
- **评估要客观** <span class="prio prio-must">必须</span> — 测试通过、编译成功、字段齐全、断言成立。**"模型自己说做完了"不算评估**。
- **评估结果结构化** <span class="prio prio-imp">重要</span> — 输出 `{passed: bool, reason: string, next_hint: string}`，而不是一段散文。**结构化的评估才能驱动下一步**。

### 终止条件

- **迭代终止条件** <span class="prio prio-must">必须</span> — 四个都要有：**成功终止**（评估通过）、**步数上限**、**成本上限**、**无进展检测**。少一个就可能烧钱。
- **成功判定要写死** <span class="prio prio-must">必须</span> — "看起来差不多了"不是判定。**必须是可执行断言**：测试全绿 / 输出匹配 schema / 文件存在且非空。
- **任务进度判断** <span class="prio prio-imp">重要</span> — 用"计划列表里已完成项数"而不是"感觉在推进"。**进度不涨就是卡住了**。
- **无效循环检测** <span class="prio prio-must">必须</span> — 三个信号：**相同动作重复**（同参数调同一工具）、**相同错误重复**（同样的报错出现三次）、**状态无变化**（文件没变、测试结果没变）。**任一触发就该停**。
- **停下来之后做什么** <span class="prio prio-imp">重要</span> — 不是直接报错，而是**降级**：给出半成品 + 说清卡在哪 + 建议人接手。**这比"任务失败"体验好一个量级**。

### 修复循环

- **错误修复循环** <span class="prio prio-must">必须</span> — 读报错 → 定位 → 假设原因 → 改一处 → 重跑。**关键是"改一处"**，一次改五处就不知道哪个生效了。
- **同一处失败三次就停** <span class="prio prio-must">必须</span> — 硬规则。**连续失败说明理解错了，继续试只是烧钱**。停下来重新给上下文，比试十次有效。
- **自我验证（Self-verification）** <span class="prio prio-must">必须</span> — 提交前自己检查一遍：改的文件对吗？有没有漏改调用方？有没有引入新依赖？**这一步能拦掉三成低级错误**。
- **测试驱动迭代** <span class="prio prio-must">必须</span> — 先有测试，循环才有客观信号。**没有测试的 Agentic 循环，等于没有方向盘**。

### 预算与性能

- **资源预算控制** <span class="prio prio-must">必须</span> — 每次任务设 token 预算、时间预算、工具调用次数预算。**超预算降级，不要硬跑**。
- **循环性能评测** <span class="prio prio-imp">重要</span> — 指标：**平均步数、平均成本、成功率、首次成功率、人工接管率**。**"平均步数下降"通常比"成功率上升"更能说明优化有效**。
- **收敛速度** <span class="prio prio-imp">重要</span> — 同样的任务，8 步做完和 20 步做完，成本差 2.5 倍。**优化步数是降本最直接的手段**。
- **过度循环** <span class="prio prio-imp">重要</span> — 已经成功了还在"优化"。**成功判定一旦通过就退出，不要贪心**。

## Deep Agents：一个具体的 Harness 实现

LangChain 的 Deep Agents 是**目前最容易看懂的完整 Harness 参考实现**，而且有 **JavaScript/TypeScript 版本**——对你来说这是最值得读的一份源码。

它把六件事组合在一起，正好对应上面 Harness 的六块：

| 能力 | 对应 Harness 组件 | 解决什么问题 |
| --- | --- | --- |
| **任务规划**（todo list 工具） | Task Planning | 长任务不跑偏，进度可见 |
| **虚拟文件系统** | Virtual Filesystem | 大块内容卸载，状态可持久 |
| **上下文管理**（自动压缩 + 卸载） | Context Compaction / Offloading | 能做几小时任务 |
| **子 Agent 委派** | Subagent Delegation | 隔离上下文，并行 |
| **记忆** | Memory Management | 跨轮次记住 |
| **人工审批** | Human-in-the-loop | 高风险动作可控 |

- **为什么值得读** <span class="prio prio-must">必须</span> — 它把这些能力**做成了一套可组合的原语**，而不是一个大框架。**读它能理解"Codex 那类系统是怎么搭出来的"**。
- **和 LangGraph 的关系** <span class="prio prio-imp">重要</span> — LangGraph 是底层图执行引擎，Deep Agents 是**在它之上封装的"开箱即用 Harness"**。**理解分层比记名字重要**。
- **可以直接抄的设计** <span class="prio prio-must">必须</span> — ① 规划用 todo 工具而不是让模型自由发挥 ② 大文件写进虚拟 FS ③ 子 Agent 只回传结论 ④ 审批点挂在工具层。**这四条抄过来就能用**。
- **别只学它** <span class="prio prio-imp">重要</span> — 它是参考实现，不是唯一答案。**你的业务场景（比如审批流、多租户、私有化）它没有覆盖**，要自己加。

## 为什么这一章比"学框架"值钱

- **框架会换，机制不会** <span class="prio prio-must">必须</span> — LangChain 三年换了三个抽象，但"工具执行要超时"这件事永远成立。**学机制的人换框架只需一周，学框架的人换框架等于重来**。
- **面试的分水岭** <span class="prio prio-must">必须</span> — 问"你怎么做的 Agent"，答"用 LangGraph 串了几个节点"是初级；答"我们自己实现了上下文卸载、检查点恢复和无效循环检测，因为框架在这三块不够用"——**这是能做 Codex 类系统的人**。
- **你的前端经验在这里有用** <span class="prio prio-imp">重要</span> — 虚拟文件系统像前端的虚拟 DOM，上下文卸载像前端的虚拟列表，检查点恢复像前端的草稿保存。**这些类比不是巧合，都是"用一层间接把昂贵资源管起来"**。

## 验收标准

- 能用一句话说清 `Agent = Model + Harness`，并解释为什么差异化在 Harness
- 能列出 Harness 的六块（上下文 / 工具 / 权限 / 状态 / 验证 / 恢复），每块举一个具体组件
- 能解释 Context Offloading 和 Context Compaction 的区别，以及各自什么时候用
- 能设计一个四拍循环（Observe/Act/Evaluate/Adjust），并说清 Evaluate 用什么客观信号
- 能说出四个终止条件，以及"无效循环"的三个检测信号
- 能画出虚拟文件系统的目录布局，并说明它解决什么问题
- 能读懂 Deep Agents 的核心设计，并说出哪四条可以直接抄进自己的项目
