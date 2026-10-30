# 16 · 项目实战手册

> 面试能不能过，七成取决于你有没有一个**真做过、有数字、能扛住三层追问**的项目。
> 这一章给三个项目的完整实现路径，包括文件结构、关键代码、评测方案、和简历怎么写。

## 怎么选

按顺序做，不要跳：

| 项目 | 周期 | 核心价值 | 面试权重 |
| --- | --- | --- | --- |
| **1. 带评测的企业知识库** | 4~6 周 | 证明你会 RAG 工程化 | 最重要，必须有 |
| **2. 多工具 Agent + 审批** | 3~4 周 | 证明你懂可靠性 | 加分项 |
| **3. 模型网关 + 成本看板** | 2~3 周 | 证明你有平台思维 | 差异化 |

做完 1 就能去面初级岗。做完 1+2 能面中级。三个都做完，你比大部分"调包选手"强。

---

# 项目 1 · 带评测的企业知识库

## 1.1 需求定义（这一步决定项目成败）

**不要做的**：一个"能上传 PDF 然后聊天"的 demo。这种东西面试官见过一百个。

**要做的**：一个**可测量、可优化、能说清每个错误来源**的知识库。

具体场景建议选一个你熟悉的领域，比如：
- 某开源项目的官方文档问答（文档现成，且有标准答案可对照）
- 某个法规/政策的查询（结构清晰，有明确的"哪一条"）
- 你自己的技术笔记库（最真实，但要有足够量）

**验收标准（写下来，做完对照）**：

| 指标 | 目标 | 怎么测 |
| --- | --- | --- |
| Recall@5 | ≥ 80% | 200 条标注集 |
| Faithfulness | ≥ 90% | RAGAS |
| P95 首字延迟 | ≤ 2s | 压测 |
| 单次成本 | 有明确数字 | token 统计 |
| 越权测试 | 100% 拦住 | A 租户问 B 租户 |

## 1.2 技术选型（要能说出理由）

| 层 | 选型 | 理由（面试要能讲） |
| --- | --- | --- |
| 语言 | Python + FastAPI | AI 生态在 Python，评测工具链齐全 |
| 向量库 | pgvector | 数据量十万级、已有 Postgres、需要行级权限、不想多维护一套 |
| Embedding | bge-m3 | 中文强、支持多语言、可本地部署 |
| 重排 | bge-reranker-v2-m3 | 与 embedding 同系列、可本地跑、延迟可接受 |
| 解析 | PyMuPDF + MinerU | 原生 PDF 用前者快，复杂版面用后者准 |
| 评测 | RAGAS + 自建规则 | 前者给通用指标，后者给业务规则 |
| 可观测 | Langfuse | 开源自部署，trace + 成本一体 |

**注意**：这张表的"理由"栏才是面试重点。选型本身没有对错，能讲清取舍才是能力。

## 1.3 文件结构

```text
kb/
├── app/
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置（模型、参数、版本）
│   ├── api/
│   │   ├── chat.py             # 对话接口（SSE 流式）
│   │   └── admin.py            # 文档管理、索引重建
│   ├── ingest/
│   │   ├── loader.py           # 按类型分发解析
│   │   ├── pdf.py              # PDF 解析（含版面分析）
│   │   ├── cleaner.py          # 清洗：页眉页脚、断行、全半角
│   │   └── chunker.py          # 分块（递归 + 父子块）
│   ├── retrieve/
│   │   ├── embed.py            # embedding 批处理 + 限流
│   │   ├── index.py            # 建索引 / 增量更新 / 删除
│   │   ├── search.py           # 混合检索（向量 + BM25 + RRF）
│   │   ├── rerank.py           # 重排
│   │   └── assemble.py         # 上下文组装（排序、去重、压缩）
│   ├── generate/
│   │   ├── prompt.py           # 模板 + 版本号
│   │   └── answer.py           # 生成 + 引用解析
│   └── eval/
│       ├── dataset.jsonl       # 200 条评测集
│       ├── run_eval.py         # 跑评测
│       └── report.py           # 生成对比报告
├── migrations/                 # 数据库迁移
├── docker-compose.yml
└── README.md
```

**这个结构本身就是加分项**：它证明了你知道"解析/检索/生成/评测"要分开，而不是一个文件写到底。

## 1.4 关键代码

### 分块：递归 + 父子块

```python
# app/ingest/chunker.py
from dataclasses import dataclass

@dataclass
class Chunk:
    id: str
    text: str
    parent_id: str | None
    metadata: dict          # doc_id, section_path, page, tenant_id

def split_recursive(text: str, size: int = 400, overlap: int = 60) -> list[str]:
    """按 段落 -> 句子 -> 字符 逐级降级切分。中文 size 按字符算。"""
    seps = ["\n\n", "\n", "。", "！", "？", "；", ""]
    if len(text) <= size:
        return [text]

    for sep in seps:
        if sep == "":
            # 最后兜底：硬切
            return [text[i:i + size] for i in range(0, len(text), size - overlap)]
        parts = text.split(sep)
        if len(parts) == 1:
            continue
        chunks, buf = [], ""
        for p in parts:
            piece = p + (sep if sep != "\n\n" else "\n\n")
            if len(buf) + len(piece) <= size:
                buf += piece
            else:
                if buf:
                    chunks.append(buf)
                buf = piece if len(piece) <= size else ""
                if len(piece) > size:
                    chunks.extend(split_recursive(piece, size, overlap))
        if buf:
            chunks.append(buf)
        if chunks:
            return chunks
    return [text]

def build_parent_child(text: str, doc_meta: dict) -> list[Chunk]:
    """小块检索、大块返回。parent 用 1600 字，child 用 400 字。"""
    parents = split_recursive(text, size=1600, overlap=100)
    out = []
    for pi, ptext in enumerate(parents):
        pid = f"{doc_meta['doc_id']}#p{pi}"
        for ci, ctext in enumerate(split_recursive(ptext, size=400, overlap=60)):
            # 关键：把章节路径拼进 chunk，显著提升检索准确率
            header = doc_meta.get("section_path", "")
            out.append(Chunk(
                id=f"{pid}#c{ci}",
                text=f"{header}\n{ctext}" if header else ctext,
                parent_id=pid,
                metadata={**doc_meta, "parent_text": ptext},
            ))
    return out
```

**面试会问**：「为什么 400 / 1600 这两个数？」——诚实回答：从 300~800 试了几档，在自己语料上 400 左右 Recall 最好；1600 是保证一个完整小节不被切断。**关键是"我试过"，不是"这个数最优"。**

### 混合检索 + RRF

```python
# app/retrieve/search.py
from collections import defaultdict

def rrf_fuse(rankings: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    """Reciprocal Rank Fusion：不需要调权重，比加权求和省事且稳。"""
    scores = defaultdict(float)
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] += 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda x: -x[1])

async def hybrid_search(query: str, tenant_id: str, top_k: int = 50):
    # 1. 两路并行召回
    dense_task = vector_search(query, tenant_id, limit=top_k)
    sparse_task = bm25_search(query, tenant_id, limit=top_k)
    dense, sparse = await asyncio.gather(dense_task, sparse_task)

    # 2. RRF 融合
    fused = rrf_fuse([[d.id for d in dense], [s.id for s in sparse]])

    # 3. 重排（取前 30 条精排，最终取 6 条）
    candidates = [get_chunk(cid) for cid, _ in fused[:30]]
    reranked = rerank(query, candidates, top_n=6)

    # 4. 组装：最相关的放首尾，对抗 lost in the middle
    return arrange_context(reranked)
```

**注意 `tenant_id` 的位置**——它在检索函数的第一层就生效，不是在应用层过滤。这是权限安全的底线，面试一定会问。

### 上下文组装

```python
# app/retrieve/assemble.py
def arrange_context(chunks: list, max_tokens: int = 6000) -> str:
    """最相关的放首尾，次要的放中间。"""
    ordered = sorted(chunks, key=lambda c: -c.score)
    budget, selected = 0, []
    for c in ordered:
        if budget + c.tokens > max_tokens:
            break
        selected.append(c)
        budget += c.tokens

    # 交替排列：第 1 名放头，第 2 名放尾，第 3 名放第二，以此类推
    head, tail = [], []
    for i, c in enumerate(selected):
        (head if i % 2 == 0 else tail).append(c)
    final = head + list(reversed(tail))

    return "\n\n".join(
        f"[{i+1}] (来源: {c.metadata['doc_name']} p.{c.metadata.get('page','?')})\n{c.text}"
        for i, c in enumerate(final)
    )
```

### 评测：分层归因

```python
# app/eval/run_eval.py
async def evaluate(samples: list[dict]) -> dict:
    """关键：检索和生成分开评，否则无法定位问题。"""
    retrieval_hits, faithfulness, relevancy = [], [], []

    for s in samples:
        ctx = await retrieve(s["question"])
        retrieved_ids = {c.id for c in ctx}
        expected_ids = set(s["gold_chunk_ids"])

        # 层 1：检索有没有找到
        hit = len(retrieved_ids & expected_ids) / max(len(expected_ids), 1)
        retrieval_hits.append(hit)

        if hit == 0:
            # 检索没找到，生成层不用评（评了也没意义）
            faithfulness.append(None)
            relevancy.append(None)
            continue

        answer = await generate(s["question"], ctx)
        faithfulness.append(await judge_faithfulness(answer, ctx))
        relevancy.append(await judge_relevancy(s["question"], answer))

    return {
        "recall@5": mean(retrieval_hits),
        "faithfulness": mean([x for x in faithfulness if x is not None]),
        "answer_relevancy": mean([x for x in relevancy if x is not None]),
        "retrieval_fail_rate": sum(1 for x in retrieval_hits if x == 0) / len(retrieval_hits),
    }
```

**这个 `retrieval_fail_rate` 是面试杀手锏**。它直接回答"你怎么知道问题出在哪一层"，而且是一个别人通常想不到的指标。

## 1.5 优化过程（这是面试最想听的部分）

做完 baseline 后，按这个顺序优化，每步都记录指标：

| 步骤 | 动作 | 预期提升 | 记录什么 |
| --- | --- | --- | --- |
| 0 | baseline（固定分块 + 纯向量） | — | 全部指标 |
| 1 | 换递归分块 + 加章节路径 | Recall +5~10% | 对比表 |
| 2 | 加 BM25 混合检索 + RRF | Recall +5~8% | 对比表 |
| 3 | 加 rerank | Recall@5 提升明显，但延迟上升 | 延迟变化 |
| 4 | 父子块 | 答案完整性提升 | Faithfulness |
| 5 | 上下文重排 + 压缩 | 成本下降 | 成本对比 |

**面试时你要能拿出这张表。** 它比任何技术描述都有说服力——因为它证明了你有方法论，不是碰运气。

## 1.6 简历怎么写

> **企业知识库问答系统**（独立开发，2026.08–2026.10）
>
> 处理 1.2 万份 PDF（含 30% 扫描件），自建解析流水线解决双栏与跨页表格问题。设计混合检索（向量 + BM25 + RRF）加 bge-reranker 精排，在 200 条标注集上 Recall@5 从 62% 提升到 89%。通过父子块与上下文压缩将单次请求成本降低 40%。建立分层评测体系，能区分检索失败与生成失败，检索失败率从 38% 降到 11%。

**每一句都有数字，每一句都能被追问。** 这就是目标形态。

---

# 项目 2 · 多工具 Agent + 人工审批

## 2.1 需求定义

**不要做**："一个能查天气、能搜索、能算数的 Agent"。玩具。

**要做**：一个**有真实副作用、因此必须处理可靠性**的 Agent。建议场景：
- 会议纪要 → 自动创建日历事件 + 发邮件通知（有副作用，需要审批）
- 客服工单 → 查询订单 + 发起退款（有副作用，需要审批）
- 代码仓库 → 查 issue + 提 PR（有副作用）

**核心不是"它能做多少事"，而是"我怎么保证它不出事"。**

**验收标准**：

| 指标 | 目标 |
| --- | --- |
| 10 步任务成功率 | ≥ 70% |
| 死循环拦截 | 100% |
| 副作用幂等 | 重试不重复执行 |
| 高风险操作 | 100% 经审批 |
| 成本超限 | 自动终止 |
| Trace 回放 | 完整可复现 |

## 2.2 架构

```text
用户请求
   │
   ▼
路由（意图分类，小模型）
   │
   ├── 简单任务 → 固定工作流（不经 Agent）
   │
   └── 复杂任务 → Agent 循环
                    │
                    ├── 规划（Plan）
                    ├── 工具调用（带超时/重试/幂等）
                    ├── 观察（结果校验）
                    ├── 终止判断（步数/成本/无进展）
                    └── 高风险动作 → 暂停 → 人工审批 → 继续
   │
   ▼
Trace 记录（每步）
```

**这个架构里最重要的两个决策**：
1. **简单任务不走 Agent**（工作流更快更便宜更可靠）
2. **高风险动作必须暂停**（不是让模型自己判断）

这两条是面试时最能体现"你懂工程"的地方。

## 2.3 关键代码

### 带终止条件的循环

```python
# app/agent/loop.py
@dataclass
class Budget:
    max_steps: int = 12
    max_tokens: int = 60_000
    max_seconds: int = 120

async def run_agent(task: str, budget: Budget = Budget()) -> AgentResult:
    state = AgentState(task=task, steps=[], tokens=0, started=time.time())
    no_progress = 0

    for step in range(budget.max_steps):
        # 三重终止条件
        if state.tokens > budget.max_tokens:
            return state.finish("budget_exceeded")
        if time.time() - state.started > budget.max_seconds:
            return state.finish("timeout")

        action = await plan_next(state)

        if action.type == "final":
            return state.finish("success", action.answer)

        if action.type == "needs_approval":
            # 关键：暂停而不是拒绝
            return state.suspend(action.pending_action)

        result = await execute_tool(action, state)

        # 无进展检测：连续 3 步没有产生新信息
        if not result.produced_new_info:
            no_progress += 1
            if no_progress >= 3:
                return state.finish("no_progress")
        else:
            no_progress = 0

        state.steps.append(Step(action, result))
        state.tokens += result.tokens

    return state.finish("max_steps")
```

### 幂等的工具执行

```python
# app/agent/tools.py
async def execute_tool(action: Action, state: AgentState) -> ToolResult:
    tool = TOOLS[action.name]

    # 幂等键：用任务 ID + 动作签名，不用时间戳
    idem_key = hashlib.sha256(
        f"{state.task_id}:{action.name}:{json.dumps(action.args, sort_keys=True)}".encode()
    ).hexdigest()

    if cached := await redis.get(f"idem:{idem_key}"):
        return ToolResult.ok(json.loads(cached), cached=True)

    try:
        result = await asyncio.wait_for(
            tool.run(**action.args), timeout=tool.timeout
        )
        await redis.setex(f"idem:{idem_key}", 3600, json.dumps(result))
        return ToolResult.ok(result)
    except asyncio.TimeoutError:
        return ToolResult.retryable("工具超时，请稍后重试或换一种方式")
    except ValidationError as e:
        # 关键：错误信息要能指导模型修正，而不是抛原始异常
        return ToolResult.fatal(f"参数错误：{e.field} 应为 {e.expected}，你传的是 {e.got}")
```

**注意 `fatal` 和 `retryable` 的区分**——参数错误重试没用，超时可以重试。模型看到不同的标记会做不同决策。这是很多人想不到的细节。

### 人工审批

```python
# app/agent/approval.py
RISK_RULES = {
    "send_email":     Risk.HIGH,    # 不可撤回
    "create_event":   Risk.MEDIUM,  # 可删除
    "search":         Risk.LOW,     # 无副作用
    "refund":         Risk.HIGH,
}

async def gate(action: Action, user_id: str) -> ApprovalDecision:
    risk = RISK_RULES.get(action.name, Risk.HIGH)

    if risk == Risk.LOW:
        return ApprovalDecision.auto()

    if risk == Risk.MEDIUM:
        # 自动执行但给用户撤销窗口
        return ApprovalDecision.auto_with_undo(window_seconds=300)

    # HIGH：暂停，等人确认
    ticket = await create_approval_ticket(
        user_id=user_id,
        action=action,
        preview=render_preview(action),   # 人话描述将要发生什么
    )
    return ApprovalDecision.need_human(ticket.id)
```

`render_preview` 很关键——审批界面要用人话说明"将要给张三发一封主题为 X 的邮件"，而不是展示 JSON。

## 2.4 简历怎么写

> **多工具 Agent 编排系统**（独立开发，2026.10–2026.11）
>
> 设计"路由 + 工作流 + Agent"三层架构，简单任务走固定工作流（成本降低 70%），复杂任务才进 Agent 循环。实现三重终止条件（步数/成本/无进展检测）、工具级幂等键、以及分级人工审批（低风险自动/中风险可撤销/高风险确认），10 步任务成功率 72%，无一次重复副作用。全链路 trace 支持完整回放。

---

# 项目 3 · 模型网关 + 成本看板

## 3.1 为什么这个项目有价值

前两个项目证明你会做功能，这个证明你**有平台思维**。面试官看到这个项目，会认为你能承担更大的责任。

而且它解决一个真实痛点：**没人知道钱花在哪了**。

## 3.2 功能清单

- 统一接口（OpenAI 兼容），业务方换模型不改代码
- 多模型路由（按任务类型/成本/延迟）
- 自动降级（主模型超时切备用）
- 限流与配额（按用户/租户/接口）
- 精确缓存 + 语义缓存
- 成本统计（按租户/功能/模型/日期）
- Trace 记录与回放

## 3.3 关键代码

```python
# app/gateway/router.py
ROUTES = {
    "chat.fast":   ["qwen-turbo", "gpt-4o-mini"],
    "chat.smart":  ["claude-sonnet", "gpt-4o"],
    "reasoning":   ["deepseek-r1", "o3-mini"],
}

async def call_with_fallback(task: str, payload: dict) -> Response:
    last_error = None
    for model in ROUTES[task]:
        try:
            return await call_model(model, payload, timeout=30)
        except (TimeoutError, RateLimitError) as e:
            last_error = e
            metrics.inc(f"fallback.{model}")
            continue   # 切下一个
        except BadRequestError:
            raise      # 参数错误换模型也没用，直接抛
    raise AllModelsFailed(last_error)
```

```python
# app/gateway/billing.py
def record_cost(tenant: str, model: str, usage) -> None:
    """成本必须在这一层统计，业务代码统计不准。"""
    price = PRICES[model]
    cost = usage.prompt_tokens * price.input + usage.completion_tokens * price.output
    db.insert("cost_log", {
        "tenant": tenant, "model": model,
        "prompt_tokens": usage.prompt_tokens,
        "completion_tokens": usage.completion_tokens,
        "cost": cost, "ts": now(),
    })
```

## 3.4 简历怎么写

> **多模型网关与成本治理平台**（独立开发，2026.11–2026.12）
>
> 统一接入 6 家模型供应商，提供 OpenAI 兼容接口，业务方切换模型零改动。实现任务级路由（快/智能/推理三档）、超时自动降级、按租户限流与配额、两级缓存。建立成本看板，按租户/功能/模型维度统计，发现某功能占总成本 62% 后通过小模型路由将其降低 55%。

---

# 三个项目的通用建议

## 时间分配

如果你每周投入 10 小时：

| 阶段 | 周数 | 产出 |
| --- | --- | --- |
| 项目 1 的解析与索引 | 2 | 能检索到正确内容 |
| 项目 1 的评测体系 | 1 | 200 条评测集 + 报告 |
| 项目 1 的优化迭代 | 2 | 对比表 + 最终指标 |
| 项目 2 | 3 | 可靠性设计 + trace |
| 项目 3 | 2 | 网关 + 看板 |

**这是估算，实际会超。** 尤其项目 1 的文档解析，做好超时一倍的准备。

## 每个项目都要留下的东西

1. **一份 README**：架构图 + 关键决策 + 指标 + 怎么跑
2. **一张优化对比表**：每步改动的指标变化
3. **三个故障复盘**：出了什么问题、怎么定位的、怎么修的
4. **一个 demo 视频或在线地址**：面试时能演示

**第 3 条最容易被忽略，但它是面试时最有价值的东西。** 因为"我遇到过什么问题"是无法编造的。

## 企业级场景方案库（面试问"你做过什么业务"时用）

上面三个项目是"能力证明"。但面试官常问的下一句是："**放到我们业务里，你怎么做？**"——这时候你需要能现场拆解一个行业场景。

下面是 ToB AI 最常见的三个场景，每个给出**方案骨架 + 关键难点 + 会被追问的点**。**不用都做，但每个都要能讲五分钟。**

### 场景 A · 智能客服与工单协同

| 环节 | 做法 | 关键难点 |
| --- | --- | --- |
| 意图识别 | 小模型分类 + 兜底转人工 | 多意图混合、闲聊夹杂 |
| 知识回答 | RAG（产品文档 + 历史工单） | **历史工单里大量"错误答案"不能直接进知识库** |
| 多轮追问 | 槽位填充 + 状态机 | 用户答非所问时不能死循环 |
| 建单 | 工具调用（写工单系统） | 幂等（用户连点两次不能建两张单） |
| 分派 | 规则 + 负载均衡 | 技能组匹配 |
| 人工接管 | 一键转人工 + 上下文交接 | **交接必须带摘要，不能让用户重说一遍** |
| 闭环 | 工单解决后回流进知识库 | 谁审核？答错的工单不能自动入库 |

**会被追问**："答错了谁负责？"——正确答法：**给出引用来源 + 明确"仅供参考"，关键操作（退款、改配置）必须人工确认**。这不是技术问题，是责任边界问题。

### 场景 B · 企业知识治理与智能检索

| 环节 | 做法 | 关键难点 |
| --- | --- | --- |
| 接入 | 多源（网盘/Confluence/企微/邮件）+ 增量同步 | **权限模型各不相同，要统一抽象** |
| 解析 | 版面分析 + OCR + 表格还原 | 双栏 PDF、扫描件、附件里的附件 |
| 治理 | 去重、去噪、过期标记、敏感分级 | **谁来判断"这份文档过期了"** |
| 索引 | 分块 + 向量 + 全文 + 元数据 | 表头/标题要绑进 chunk |
| 检索 | 混合检索 + rerank + **权限过滤下推** | 权限必须在 SQL 层过滤，不能检索后过滤 |
| 运营 | 搜索日志分析、无结果 query 挖掘、点击率 | **这是"运营平台"和"demo"的区别** |
| 评测 | 召回率 + 答案忠实度 + 人工抽检 | 要能按部门/文档类型分层看 |

**会被追问**："怎么保证不越权？"——答：**权限条件进检索 SQL 的 where，用行级安全（RLS）强制，并做 A 租户查 B 租户文档的越权测试**。见 [09 · 安全](/guide/09-security)。

### 场景 C · 多模态内容安全与智能审核

| 环节 | 做法 | 关键难点 |
| --- | --- | --- |
| 输入 | 文本 / 图片 / 音频 / 视频 | 视频要抽帧 + 转写，成本高 |
| 初筛 | 便宜的分类模型 / 关键词 / 哈希比对 | **先挡掉 90% 明显没问题的，省大钱** |
| 精判 | VLM + 审核模型 | 边界案例（擦边、反讽、谐音） |
| 处置 | 通过 / 拦截 / 转人工 / 限流 | 分级处置，别一刀切 |
| 申诉 | 用户申诉 → 人工复核 → 回流训练 | **误杀率是这类产品的核心指标** |
| 合规 | 留证、审计、生成内容标识 | 见 [09 · 安全](/guide/09-security) 的合规一节 |

**会被追问**："误杀和漏放怎么权衡？"——答：**按业务定阈值，且分层**：高风险类目（涉未成年）宁可误杀，低风险类目（广告法用语）宁可漏放 + 事后抽检。**能说出"分层阈值"就说明你想过真实业务**。

### 怎么把场景写进简历

不要说"做过智能客服"，要说：

> 客服工单场景：RAG 答产品问题（召回率 87%），多轮槽位填充建单，工具调用带幂等键；答错时强制带引用来源，退款类操作走人工审批；工单解决后经人工审核回流知识库，月均新增 300 条。

**结构是：场景 + 关键机制 + 数字 + 边界处理。** 四样都有，可信度就上来了。

## 最后一句话

不要等"学完"再开始做。**项目会告诉你该学什么**——你在做检索时自然会去查 HNSW 参数，在做评测时自然会去理解 judge 偏差。反过来先学再做，你会学一堆暂时用不上的东西，然后忘掉。

先做项目 1 的第一步：找一份真实的 PDF，把它解析成干净文本。这一步就会教你很多东西。
