# 24 · AI 辅助研发工程

> **投入权重：7%** · 新增一章。这一章讲的不是"怎么用 AI 写代码"，是**怎么把 AI 写代码变成可复现、可评审、可交付的工程流程**。
>
> 2026 年面试已经在问："你日常怎么用 AI 写代码？"——答"我用 Cursor 自动补全"是初级答案；能答出"我按 spec 驱动、有验证回路、有代码评审规则、知道哪类任务不能交给 AI"，这才是他们要的人。而且**这是你作为前端转岗者唯一能压过算法背景候选人的地方**——他们大多还在手写。

## 先分清五个层次

市面上把这堆东西混着叫，其实分五层，能力要求完全不同：

| 层次 | 你做什么 | AI 做什么 | 典型形态 |
| --- | --- | --- | --- |
| **1 补全（Completion）** | 写代码 | 猜下一个 token / 下一个函数体 | Copilot、行内补全 |
| **2 对话（Chat）** | 描述需求 | 给代码片段，你复制 | 网页版、IDE 侧栏 |
| **3 代理编辑（Agentic Edit）** | 给目标 | 自己读文件、改多文件、跑命令 | Cursor Composer、Claude Code |
| **4 规格驱动（Spec-driven）** | 写规格与验收 | 按规格实现 + 自测 + 迭代到达标 | 自建工作流、Kiro、Spec Kit |
| **5 自主任务（Autonomous）** | 定义任务边界 | 从 issue 到 PR，无人干预 | Devin 类、CI 里的 Agent |

**关键判断**：层次越高，**你写代码的时间越少，写规格和验证的时间越多**。很多人升不上去，不是因为不会用工具，是因为**不愿意花时间把需求写成规格**——而规格恰恰是 AI 能干活的前提。

## AI 编程工具

- **Cursor** <span class="prio prio-must">必须</span> — 目前综合体验最好的 AI IDE。核心不是补全，是 **Composer / Agent 模式 + 代码库索引 + 规则文件**。
- **Claude Code / Codex CLI** <span class="prio prio-must">必须</span> — 终端里的 Agent，能自己读仓库、跑测试、改多文件。**长任务能力强于 IDE 插件**。
- **GitHub Copilot** <span class="prio prio-imp">重要</span> — 补全体验最顺，企业采购最普遍。Agent 能力在追赶。
- **Windsurf / Cline / Roo Code** <span class="prio prio-opt">选学</span> — 同类工具，差异在模型接入与权限模型。选一个用熟比都试一遍有用。
- **代码库索引（Codebase Indexing）** <span class="prio prio-must">必须</span> — 工具能不能"知道你的项目长什么样"全靠它。**索引质量决定回答质量**，大仓库要配置忽略规则（node_modules、构建产物、密钥文件）。
- **规则文件（Rules / AGENTS.md / .cursorrules）** <span class="prio prio-must">必须</span> — 把项目约定写进文件：目录结构、命名、错误处理方式、禁止的写法。**这是投入产出比最高的一件事**——写一次，之后每次对话都生效。
- **上下文选择** <span class="prio prio-must">必须</span> — 手动 `@` 文件、`@` 符号、`@` 文档。**给对上下文比换更强的模型更有效**。
- **MCP 接入** <span class="prio prio-imp">重要</span> — 让 AI 能查数据库、读 issue、调内部 API。你在 [04 · Agent](/guide/04-agent) 学的 MCP 在这里直接用得上。
- **成本与限流** <span class="prio prio-imp">重要</span> — Agent 模式一次任务可能几十万 token。**设预算上限，别让它无限重试**。

## Vibe Coding：能用，但要划边界

- **它是什么** <span class="prio prio-must">必须</span> — 不逐行看代码，靠"描述 → 生成 → 跑 → 看效果 → 再描述"迭代。**Karpathy 提这个词时的原意是"允许你忘记代码存在"，也就是放弃对实现的理解**。
- **它真正的适用面** <span class="prio prio-must">必须</span> — 一次性脚本、原型、内部工具、数据探索、UI 草稿。**边界清晰、失败成本低、不需要长期维护**。
- **它不适用的场景** <span class="prio prio-must">必须</span> — 有并发、有事务、有权限、有金额计算、要长期维护的核心链路。**你不理解代码，就无法判断它在边界情况下会不会错**。
- **最大的隐性成本** <span class="prio prio-imp">重要</span> — 三个月后没人看得懂这个仓库，包括写它的人。**"能跑"和"能维护"之间差一个数量级的工作量**。
- **怎么用它而不被它坑** <span class="prio prio-must">必须</span> — 三条：① 只在可丢弃的代码上用 ② 保留 git 历史，随时能回到"人写的版本" ③ **凡是进主干的代码，必须自己读懂**。
- **面试怎么答** <span class="prio prio-must">必须</span> — 不要说"我全靠 vibe coding"，也不要说"我完全不用"。**正确答法是："原型阶段用它提速，进主干的代码我会按 spec 驱动 + 自己 review，关键路径不接受我不理解的实现。"** 这句话同时展示了效率和工程判断。

## Spec Coding：真正能进生产的做法

- **核心思路** <span class="prio prio-must">必须</span> — 先写"要什么"和"怎么算对"，再让 AI 写"怎么做"。**规格是合同，代码只是实现**。
- **一份可用 spec 的六段** <span class="prio prio-must">必须</span> — ① 背景与目标 ② 输入输出的确切形态（含类型、示例、错误情况）③ 边界与不做的事 ④ 验收标准（可执行）⑤ 涉及的文件范围 ⑥ 禁止事项（不许改的模块、不许引入的依赖）。
- **"可执行"是关键** <span class="prio prio-must">必须</span> — "接口要健壮"是废话；"输入为空数组时返回 200 + 空列表，不得抛异常"才是规格。**AI 对模糊形容词的容忍度极低——它会自己编一个解释**。
- **先写测试还是先写实现** <span class="prio prio-must">必须</span> — **先写测试**。测试就是可执行的验收标准，AI 写完实现能自己跑测试收敛。这是 spec coding 能闭环的原因。
- **小步提交** <span class="prio prio-must">必须</span> — 一次只让它做一件事。**大 spec 一次生成 800 行，你 review 不动，等于没 review**。
- **规格的复用价值** <span class="prio prio-imp">重要</span> — 好 spec 是团队资产：换模型、换工具、换人都能重跑。**这也是为什么它比 prompt 值钱**。
- **和"需求文档"的区别** <span class="prio prio-imp">重要</span> — 需求文档给人看（可以含糊），spec 给机器执行（必须精确）。**写 spec 的能力本质是"把模糊需求拆成可验证断言"的能力**。
- **PRD 是上游，spec 是下游** <span class="prio prio-must">必须</span> — PRD 回答"为什么做、给谁做、做什么"；spec 回答"做成什么样算对"。**跳过 PRD 直接写 spec，你会把需求理解错的那部分固化进代码**。
- **需求分析的三问** <span class="prio prio-must">必须</span> — ① 谁在什么场景下用 ② 不做会怎样（判断优先级）③ 怎么知道做对了（就是验收标准）。**第三问必须在动手前回答**。
- **验收标准要写成 Given-When-Then** <span class="prio prio-must">必须</span> — "给定已登录用户，当其提交空标题时，系统应返回 400 并提示'标题不能为空'"。**这种句子能直接翻译成测试用例，这是它比自然语言描述强的地方**。
- **Spec Kit 的工作流（GitHub 官方做法）** <span class="prio prio-must">必须</span> — 五个阶段：**Specify（写规格）→ Plan（技术方案）→ Tasks（拆任务）→ Implement（分步实现）→ 收敛验证**。**关键在"分步"**：每次只让 AI 做一个 task，做完验证再下一个。
- **分步实现为什么重要** <span class="prio prio-must">必须</span> — 一次生成 800 行你 review 不动；拆成 8 个 100 行的改动，每个都能看懂、能测、能回滚。**这是 spec coding 和"一句话让 AI 写整个模块"的本质区别**。
- **规格的收敛验证** <span class="prio prio-imp">重要</span> — 实现完成后要回头逐条核对规格：哪条满足了、哪条没满足、哪条规格本身写错了。**这一步最容易被跳过，也最能暴露"规格没想清楚"**。

## Agentic Coding：让 AI 自己跑循环

- **它是什么** <span class="prio prio-must">必须</span> — AI 在循环里：读代码 → 改 → 跑测试 → 看报错 → 再改。**和你学的 ReAct 完全同构**，只是工具换成了文件系统和 shell。
- **循环能收敛的前提** <span class="prio prio-must">必须</span> — **必须有客观的失败信号**。有测试、有类型检查、有 lint 的任务能收敛；"这个页面好不好看"收敛不了。
- **工具集要给全** <span class="prio prio-must">必须</span> — 读文件、写文件、跑测试、跑类型检查、搜索代码、看 git diff。**少一个工具，它就得多绕几步**。
- **防止它"作弊"** <span class="prio prio-must">必须</span> — 常见作弊：改测试让它通过、加 `try/except` 吞异常、`@ts-ignore`、删掉失败用例。**要显式禁止，并在 review 时重点看测试文件的 diff**。
- **权限与沙箱** <span class="prio prio-must">必须</span> — 默认禁止 `rm -rf`、`git push --force`、访问生产数据库、读 `.env`。**见 [09 · 安全](/guide/09-security) 的代码执行安全一节**。
- **人在哪一环** <span class="prio prio-must">必须</span> — 人管三件事：定 spec、审 diff、做架构决策。**中间的机械劳动交给它**。
- **失败模式** <span class="prio prio-imp">重要</span> — 陷入死循环（同一个测试反复失败用同样方法改）、过度重构（顺手改了你没让它改的文件）、幻觉 API（调用不存在的库方法）。**这三个都要有检测手段**。
- **多文件修改的依赖分析** <span class="prio prio-must">必须</span> — 改一个函数签名，谁在调它？**AI 经常只改定义处，漏掉调用处**。做法：让它先输出"影响面清单"（哪些文件、哪些调用点），你确认后再动手。TypeScript 的 `tsc --noEmit` 会把漏改的地方全指出来——**这就是为什么强类型对 AI 辅助开发特别重要**。
- **跨文件重构的顺序** <span class="prio prio-imp">重要</span> — 先加新接口并保留旧接口 → 迁移调用方 → 删旧接口。**一步到位的重命名在 AI 手里极易半途而废**。
- **失败测试的定位流程** <span class="prio prio-must">必须</span> — 三步：① 先让它读完整报错和堆栈，**不要直接让它改代码** ② 让它说出"你认为是哪一行、为什么" ③ 再让它改。**跳过第 ② 步，它会开始瞎试**。
- **"同一个测试失败三次就停"** <span class="prio prio-must">必须</span> — 硬规则。同一处反复失败说明它的理解是错的，继续试只是烧钱。**停下来重新给上下文，比让它试十次有效**。
- **工具权限的四档** <span class="prio prio-must">必须</span> — ① 只读（读文件、搜索、看 diff）② 可写代码（改源文件、跑测试）③ 可执行副作用（装依赖、跑迁移、提交 git）④ 可触达外部（推送、部署、调生产 API）。**默认只给前两档，第三档逐次确认，第四档不给**。
- **它不该碰的东西** <span class="prio prio-must">必须</span> — `.env`、密钥文件、生产配置、数据库迁移脚本、CI 配置。**这几类要写进拒绝列表，不是靠自觉**。
- **上下文压缩的必要性** <span class="prio prio-imp">重要</span> — 长任务跑几十步后上下文会爆。工程做法：让它把"已确认的事实"写进一个 `progress.md`，然后开新会话读这个文件继续。**这是 Agent 长任务的标准做法**，详见 [25 · Harness 与 Loop](/guide/25-harness-loop)。

## CI 门禁与自动化审查

- **门禁的意义** <span class="prio prio-must">必须</span> — 人 review 会疲劳，机器不会。**AI 写的代码量是人的几倍，光靠人眼 review 一定会漏**。
- **必过的四道门** <span class="prio prio-must">必须</span> — 类型检查（`tsc --noEmit` / `mypy`）、lint、单测、构建。**这四道挂了不许合并**，没有例外。
- **AI 应用要多一道** <span class="prio prio-must">必须</span> — **prompt 回归测试**（见 [07 · 评测](/guide/07-evals)）。改了 prompt 或换了模型，评测集跑一遍看指标有没有掉。**这是 AI 项目和传统项目在 CI 上唯一的实质差异**。
- **自动化代码审查** <span class="prio prio-imp">重要</span> — 用 AI 做第一轮 review（查明显问题：空指针、吞异常、漏改调用点、新增依赖）。**但它不能替代人**：AI 审查会放过"逻辑正确但设计错误"的问题。
- **依赖变更要单独审** <span class="prio prio-must">必须</span> — lockfile 的 diff 必须人看。**AI 很爱引入新依赖来解决一个三行代码就能解决的问题**，这是供应链风险的入口。
- **测试文件的 diff 要重点看** <span class="prio prio-must">必须</span> — 删测试、改断言、加 `.skip` 是 AI 让 CI 变绿最常见的手段。**门禁里可以加一条：测试文件被删除或跳过数增加时，需要额外审批**。
- **覆盖率不设硬阈值** <span class="prio prio-imp">重要</span> — 设 80% 会催生一堆断言为空的测试。**改为"新增代码的关键路径必须有测试"**，靠 review 判断。
- **构建产物体积门禁** <span class="prio prio-opt">选学</span> — 前端项目加 bundle size 上限。**AI 引入一个大依赖时能立刻发现**。

## AI 重构与代码治理

- **适合交给 AI 的重构** <span class="prio prio-must">必须</span> — 机械性、可验证的：改名、抽函数、拆文件、替换废弃 API、统一错误处理、补类型注解、补日志。
- **不适合交给 AI 的重构** <span class="prio prio-must">必须</span> — 涉及并发模型、事务边界、缓存策略、权限模型的重构。**这类改动的正确性无法靠"跑通测试"验证**。
- **重构的安全网** <span class="prio prio-must">必须</span> — 先补测试再重构。**没有测试的重构 = 赌博**，AI 会让赌注变大（它一次改十个文件）。
- **diff 的可读性** <span class="prio prio-imp">重要</span> — 一次重构一个关注点。**混着"重构 + 加功能 + 改格式"的 diff 无法 review**，出问题也回滚不了。
- **遗留代码的用法** <span class="prio prio-imp">重要</span> — 让 AI 先"解释这段代码在干什么"，再决定改不改。**它读遗留代码的能力比人快得多**，这是被低估的用法。
- **技术债清理** <span class="prio prio-opt">选学</span> — 批量替换废弃 API、批量补测试，是 AI 最擅长的重复劳动。

## 自动化测试：AI 时代的必需品

- **为什么现在更重要** <span class="prio prio-must">必须</span> — AI 改代码的速度是人的十倍，**没有测试你就没有能力验证它的改动**。测试从"好习惯"变成"安全基础设施"。
- **单测的边界** <span class="prio prio-must">必须</span> — 测纯逻辑（格式化、校验、计算、状态转移）。**别测实现细节**，否则重构就红。
- **AI 生成测试的陷阱** <span class="prio prio-must">必须</span> — 它会写"照着实现写的测试"（实现有 bug 测试也过）。**解法：先写测试（spec coding），或让它基于规格而不是基于实现写测试**。
- **覆盖率是坏指标** <span class="prio prio-imp">重要</span> — 100% 覆盖可以全是断言为空的测试。**看"关键路径是否被断言"而不是百分比**。
- **集成测试与 E2E** <span class="prio prio-must">必须</span> — AI 应用必须有：一条真实的流式请求端到端、一条工具调用链路、一条 RAG 检索到回答。**这三条挂了就是线上事故**。
- **LLM 输出的测试** <span class="prio prio-imp">重要</span> — 不能断言精确文本。用**结构断言**（是不是合法 JSON、字段齐不齐）+ **评测集**（见 [07 · 评测](/guide/07-evals)）。
- **测试的可维护性** <span class="prio prio-imp">重要</span> — 测试代码也是代码。**AI 生成的测试经常过度 mock**，改一个实现要改十个测试，最后没人敢动。

## 代码评审：人还剩下什么

- **AI 生成代码的 review 重点** <span class="prio prio-must">必须</span> — ① 它有没有改到你没让它改的地方 ② 错误处理是真空的还是吞掉的 ③ 有没有引入新依赖 ④ 测试是真断言还是摆设 ⑤ 边界条件（空、null、超长、并发）有没有考虑。
- **它容易犯的错** <span class="prio prio-imp">重要</span> — 幻觉 API（不存在的库方法）、过时写法（用了已废弃的 API）、过度抽象（为一个用例造三层接口）、注释与代码不符。
- **AI 生成代码的安全检查** <span class="prio prio-must">必须</span> — 六项必查：**① SQL/命令拼接（注入）② 用户输入直接进 `innerHTML`（XSS）③ 硬编码密钥 ④ 日志打印敏感字段 ⑤ 越权（缺 `user_id` 过滤）⑥ 反序列化不可信数据**。**AI 默认会写出"能跑但没做安全校验"的代码**——它学的是示例代码，而示例代码通常省略安全处理。
- **依赖引入的安全检查** <span class="prio prio-imp">重要</span> — 新依赖要看：维护活跃度、下载量、是否有已知 CVE、包名是否像 typosquatting。**AI 幻觉出的包名可能真的存在（被别人抢注）**，这是新型供应链攻击。
- **它做得比人好的地方** <span class="prio prio-imp">重要</span> — 命名一致性、格式统一、补文档、找明显的空指针、批量改样板代码。**让它做这些，别让它做架构决策**。
- **评审规则要写下来** <span class="prio prio-imp">重要</span> — 写进规则文件（AGENTS.md / 团队 checklist）。**口头约定对 AI 无效**。
- **PR 描述** <span class="prio prio-imp">重要</span> — 让 AI 生成 PR 描述，但**必须自己核对它说的是不是真的**。AI 写的 PR 描述经常比实际改动更美好。

## 术语对照（面试官会用这些词）

这几个词是 2025 年后新冒出来的，**内容你都学过，但词不认识就会显得脱节**。

- **Harness Engineering（脚手架工程）** <span class="prio prio-must">必须</span> — 不是"提示词工程"的升级版，而是**给 Agent 搭那套让它可靠工作的外部结构**：工具集、状态管理、检查点、审批点、失败重试、验证回路。**等价于我在 [04 · Agent](/guide/04-agent) 说的"用工程手段把不确定性关进笼子"**。行业把它单独立名，是因为发现**瓶颈不在模型，在脚手架**。
- **Loop Engineering（循环工程）** <span class="prio prio-must">必须</span> — 设计 Agent 的迭代循环：每一步看什么、能调什么、什么算成功、什么时候停。**等价于 ReAct 循环 + 终止条件 + 进度检测**。核心指标是"收敛速度"和"不收敛时的止损"。
- **Context Engineering（上下文工程）** <span class="prio prio-must">必须</span> — 见 [02 · Prompt 与上下文](/guide/02-prompt-context)。指"在有限的窗口里放什么、以什么顺序放、怎么压缩"。**行业共识：它比 prompt 措辞更重要**。
- **Spec-driven Development** <span class="prio prio-must">必须</span> — 见本章上面。
- **DeepAgent / 各类"深度"框架** <span class="prio prio-opt">选学</span> — 厂商起的框架名，本质是"带规划 + 子 Agent + 文件系统的 Agent 编排"。**属于 LangGraph 同类，理解模式即可，不必专门学某个品牌**。
- **Agentic Workflow** <span class="prio prio-imp">重要</span> — 工作流里嵌 Agent 节点（而不是全自主）。**这是目前生产环境的主流形态**，和 [04 章 12 种编排模式](/guide/04-agent) 对应。
- **怎么应对陌生术语** <span class="prio prio-must">必须</span> — 听到新词先问"它对应我已知的哪个模式"。**九成新词是旧概念换了包装**，剩下的才是真新东西。这个能力比背术语值钱。

## 你的真实优势（这条要写进简历）

- **前端是最早被 AI 编程工具改造的岗位** — 你大概率比同届后端候选人更早、更重度地用这些工具。**这不是"没技术含量"，这是"工程效率"**。
- **能落地的表达方式** <span class="prio prio-must">必须</span> — 不说"我会用 Cursor"，说"我把项目约定写进规则文件，用 spec + 测试驱动让 AI 完成模块级实现，PR 里我能说清哪些代码是 AI 写的、我怎么验证的"。**后者是可验证的工程能力**。
- **别夸大成"我一个人干了三个人的活"** <span class="prio prio-must">必须</span> — 面试官会追问细节。**说清边界比说清产出更可信**。
- **反面教材** <span class="prio prio-imp">重要</span> — 简历写"精通 Vibe Coding"会被直接扣分。**Vibe 是方法不是技能，写进简历显得不专业**。

## 验收标准

- 能说清补全 / 对话 / 代理编辑 / 规格驱动 / 自主任务五层的差别，以及每层你要多花什么时间
- 能为一个模块写出一份 AI 能执行、你能验收的 spec（六段齐全）
- 能说出 Vibe Coding 的三条边界，以及为什么"进主干的代码必须自己读懂"
- 能在 Agentic 循环里设三道防作弊（禁改测试、禁吞异常、diff 范围限制）
- 能解释 Harness Engineering 和 Loop Engineering 分别对应你学过的什么
- 有一份自己的规则文件（AGENTS.md 或等价物），并能说出它省了什么
