import type { Lesson } from './types'

/**
 * 第十九课：Python 与 AI 生态
 *
 * 核心立场：学 Python 不是为了写 Python 服务，是为了能读懂和改造 AI 生态里的东西。
 * 你的主服务可以是 Node，但你必须能进到那个世界里去。
 */
export const lesson19: Lesson = {
  id: 'L19',
  moduleId: 'python',
  order: 19,
  path: '/learn/19-python',
  title: 'Python 与 AI 生态：能读懂、能改造、能协作',
  subtitle: 'RAGAS、vLLM、LLaMA-Factory 都是 Python 写的。看不懂源码，就只能等别人给你做封装。',
  minutes: 65,
  level: '进阶',
  outcome: '能读懂主流 AI 开源项目的关键代码，能写 Python 侧车服务，并能和 Node 主服务正确协作。',
  goals: [
    '说清为什么 AI 生态是 Python，以及这对你的技术选型意味着什么',
    '用现代工具管理环境与依赖，不再被"版本冲突"折磨',
    '用类型注解 + pydantic + ruff + mypy 把 Python 写成可维护的工程',
    '理解 GIL、asyncio、多进程的边界，知道什么任务该怎么跑',
    '认得出主流库各自解决什么问题，不再"看到 import 就懵"',
    '把 Python 侧车服务和 Node 主服务正确集成',
  ],
  prereqs: [
    '会一门编程语言（TypeScript 就够）',
    '跑过至少一个 Python 脚本',
    '用过 pip 或 conda，被依赖问题坑过',
  ],

  steps: [
    {
      id: 's1',
      title: '为什么是 Python，以及这意味着什么',
      checkpoint: '你的主服务是 Node，还需要学 Python 吗？',
      blocks: [
        {
          type: 'p',
          text: '不是"Python 语言更好"，而是**生态在这里**。训练框架（PyTorch）、推理引擎（vLLM、SGLang）、微调工具（LLaMA-Factory、PEFT）、评测框架（RAGAS、lm-evaluation-harness）、数据处理（pandas、datasets）——这些的第一实现和最新特性都在 Python。',
        },
        {
          type: 'table',
          head: ['你想做的事', '只能/主要用 Python 吗', '说明'],
          rows: [
            ['训练/微调模型', '是', 'PyTorch 生态，没有替代品'],
            ['自建推理服务', '基本是', 'vLLM/SGLang 是 Python，虽然底层是 C++/CUDA'],
            ['跑标准评测（RAGAS）', '是', '官方实现是 Python'],
            ['处理大规模数据集', '倾向是', 'pandas/polars/datasets'],
            ['写业务 API', '不是', 'Node/Go/Java 都可以，Python 也行但没优势'],
            ['写前端/全栈', '不是', 'TS 更合适'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '对你的实际含义',
          text: '**不需要把主服务迁到 Python。** 正确的做法是：主服务用你最熟的语言（Node），AI 相关的重活（微调、批量评测、自建推理）用 Python 做成独立服务，通过 HTTP/gRPC/CLI 协作。**你要的是"能进去改"，不是"全用 Python 重写"。**',
        },
        {
          type: 'analogy',
          title: '和"要不要学 SQL"对照',
          text: '你不会用 SQL 写整个后端，但你必须会写查询——因为数据在那里。Python 对 AI 是一样的定位：**它是一门"必须能用的工具语言"，不是"必须精通的主语言"。** 目标是"能读懂源码、能改一行、能写个脚本验证想法"。',
        },
      ],
    },

    {
      id: 's2',
      title: '环境与依赖：别再被版本冲突折磨',
      checkpoint: '为什么"pip install 一堆包"最后一定会坏？',
      blocks: [
        {
          type: 'p',
          text: '因为 pip 默认装到全局环境，不同项目的依赖互相覆盖。Python 没有 Node 那样的 `node_modules` 天然隔离（虽然 venv 能做到，但很多人不用）。',
        },
        {
          type: 'table',
          head: ['工具', '定位', '推荐度'],
          rows: [
            ['venv + pip', '标准库自带，最基础', '够用，但要手动管 requirements'],
            ['uv', 'Rust 写的极速包管理器，替代 pip+venv+poetry', '**当前首选**，快 10~100 倍'],
            ['poetry', '依赖解析 + 打包，成熟稳定', '老项目常见'],
            ['conda / mamba', '能装非 Python 依赖（CUDA、编译好的库）', 'GPU 环境常用'],
            ['pip-tools', '生成锁定的 requirements.txt', '配合 pip 用'],
          ],
        },
        {
          type: 'code',
          lang: 'bash',
          title: 'uv 的日常用法',
          code: `# 建项目（自动创建 .venv + pyproject.toml）
uv init my-ai-service && cd my-ai-service

# 加依赖（自动解析 + 写入 pyproject + 生成 uv.lock）
uv add fastapi pydantic openai
uv add --dev pytest ruff mypy

# 同步环境（按 lock 文件精确安装，可复现）
uv sync

# 跑脚本（自动用项目环境，不用手动 activate）
uv run python main.py
uv run pytest

# 看依赖树，排查冲突
uv tree`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '两条铁律',
          text: '① **锁文件必须进 git**（`uv.lock` / `poetry.lock` / `requirements.txt` 带版本号）。不锁版本，三个月后你的项目装不回来。② **绝不 `pip install` 到全局**。全局环境污染后，你会遇到"明明装了却 import 不到"或"装了 A 版本但实际用的是 B 版本"这类灵异问题。',
        },
        {
          type: 'p',
          text: 'GPU 环境还有额外的坑：**CUDA 版本必须和 PyTorch 版本匹配**。`torch==2.4.0+cu121` 里的 `cu121` 表示 CUDA 12.1。装错了会报 `CUDA driver version is insufficient` 或者静默退回 CPU（训练慢 100 倍）。**先 `nvidia-smi` 看驱动支持的 CUDA 版本，再选对应的 torch 轮子。**',
        },
      ],
    },

    {
      id: 's3',
      title: '把 Python 写成工程：类型、校验、检查',
      checkpoint: 'Python 是动态类型，为什么还要写类型注解？',
      blocks: [
        {
          type: 'p',
          text: '因为**类型注解不是为了运行时，是为了人和工具**。它能让你在改别人代码时不靠猜，让 IDE 给出补全，让 CI 在合并前发现"传错了参数"。',
        },
        {
          type: 'code',
          lang: 'python',
          title: '从"能跑"到"能维护"',
          note: '关键变化：用 pydantic 在边界做校验（而不是到处 if 判断），用 dataclass/pydantic 代替裸 dict，用类型注解让 mypy 能检查。',
          code: `# ❌ 能跑，但三个月后没人敢改
def process(data):
    docs = data["docs"]
    result = []
    for d in docs:
        if d.get("text"):
            result.append({"id": d["id"], "len": len(d["text"])})
    return {"count": len(result), "items": result}

# ✅ 有边界校验、有类型、有明确结构
from pydantic import BaseModel, Field
from typing import Sequence

class Doc(BaseModel):
    id: str
    text: str = Field(min_length=1, max_length=100_000)
    metadata: dict[str, str] = Field(default_factory=dict)

class ProcessRequest(BaseModel):
    docs: Sequence[Doc] = Field(min_length=1, max_length=1000)

class ProcessedDoc(BaseModel):
    id: str
    length: int

class ProcessResponse(BaseModel):
    count: int
    items: list[ProcessedDoc]

def process(req: ProcessRequest) -> ProcessResponse:
    items = [ProcessedDoc(id=d.id, length=len(d.text)) for d in req.docs]
    return ProcessResponse(count=len(items), items=items)`,
        },
        {
          type: 'table',
          head: ['工具', '作用', '相当于 JS 世界的'],
          rows: [
            ['pydantic', '运行时数据校验 + 序列化', 'zod'],
            ['typing', '类型注解（静态检查用）', 'TypeScript 类型'],
            ['mypy / pyright', '静态类型检查', 'tsc'],
            ['ruff', 'lint + format，极快', 'eslint + prettier'],
            ['pytest', '测试框架', 'vitest'],
            ['fastapi', 'Web 框架，自带 pydantic 集成和 OpenAPI', 'express + zod 集成'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '和 TS 的对应关系',
          text: '你会发现 **pydantic ≈ zod，mypy ≈ tsc，ruff ≈ eslint+prettier，fastapi ≈ express**。**你已有的工程直觉几乎可以直接迁移**——差的只是语法。这也是为什么 TS 工程师学 Python 通常一两周就能上手。',
        },
        {
          type: 'p',
          text: '一个具体的迁移技巧：**先用 pydantic 定义所有进出边界的数据结构**（请求体、响应体、LLM 输出），再写逻辑。这和你用 zod 定义 schema 的习惯完全一致，而且能让 `mypy --strict` 真正有用（否则到处是 `Any`，检查形同虚设）。',
        },
      ],
    },

    {
      id: 's4',
      title: 'GIL、asyncio、多进程：什么任务该怎么跑',
      checkpoint: '一个"批量调 1000 次 LLM API"的脚本，该用 asyncio 还是多进程？',
      blocks: [
        {
          type: 'p',
          text: 'Python 的并发模型和 Node 有个关键差异：**GIL（全局解释器锁）** 让同一时刻只有一个线程执行 Python 字节码。这决定了三种并发方式的适用范围：',
        },
        {
          type: 'table',
          head: ['方式', '适合', '不适合', '原因'],
          rows: [
            ['asyncio', 'IO 密集（网络、文件）', 'CPU 密集', '单线程事件循环，和 Node 一样'],
            ['多线程', 'IO 密集（但有同步阻塞库时）', 'CPU 密集', 'GIL 限制，多线程不能并行计算'],
            ['多进程', '**CPU 密集**（数据处理、推理）', 'IO 密集（进程开销大）', '每个进程独立 GIL，能真并行'],
          ],
        },
        {
          type: 'code',
          lang: 'python',
          title: 'asyncio：批量调用 LLM 的正确写法',
          note: '注意 Semaphore 限制并发——不限的话 1000 个请求同时发出去，会被限流打回来一大半，重试反而更慢。',
          code: `import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def one_call(sem: asyncio.Semaphore, prompt: str) -> str:
    async with sem:                                  # 限制并发数
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            timeout=30,
        )
        return resp.choices[0].message.content

async def batch(prompts: list[str], concurrency: int = 8):
    sem = asyncio.Semaphore(concurrency)
    tasks = [one_call(sem, p) for p in prompts]
    # return_exceptions=True：单个失败不影响整批
    results = await asyncio.gather(*tasks, return_exceptions=True)

    ok = [r for r in results if isinstance(r, str)]
    failed = [r for r in results if not isinstance(r, str)]
    print(f"成功 {len(ok)} / 失败 {len(failed)}")
    return ok

# 1000 个请求，8 并发 → 约 125 轮
asyncio.run(batch(prompts, concurrency=8))`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '三个 asyncio 常见坑',
          text: '① **在 async 函数里调用同步阻塞库**（`requests`、`time.sleep`、同步 DB 驱动）——会阻塞整个事件循环，所有并发全部卡住。要用 `asyncio.to_thread()` 包一层，或者换异步库（`httpx`、`aiosqlite`）。② **忘了 Semaphore**——1000 个请求同时发，被限流后疯狂重试。③ **`gather` 不加 `return_exceptions=True`**——一个失败整批抛出，前面成功的结果全丢。',
        },
        {
          type: 'p',
          text: '回到 checkpoint 的问题：**批量调 API 是 IO 密集，用 asyncio**。而"批量处理 1000 个 PDF 做 OCR/embedding 计算"是 CPU 密集，用多进程（`ProcessPoolExecutor` 或 `multiprocessing.Pool`）。**判据：任务在等网络/磁盘，还是在算？**',
        },
      ],
    },

    {
      id: 's5',
      title: '库地图：看到 import 不再懵',
      checkpoint: '`transformers` 和 `vllm` 都在做推理，区别是什么？',
      blocks: [
        {
          type: 'table',
          head: ['领域', '库', '解决什么'],
          rows: [
            ['数据', 'numpy / pandas / polars', '数组与表格计算（polars 更快）'],
            ['数据', 'datasets', '加载和流式处理大规模数据集'],
            ['深度学习', 'torch', '张量计算 + 自动求导，一切的基础'],
            ['模型', 'transformers', '加载预训练模型、tokenizer、推理（**单机、简单、不快**）'],
            ['推理', 'vllm / sglang', '高吞吐服务化推理（**连续批处理、PagedAttention**）'],
            ['微调', 'peft / trl / LLaMA-Factory', 'LoRA/QLoRA 微调，后两个是封装好的工具'],
            ['评测', 'ragas / lm-evaluation-harness', 'RAG 指标 / 通用 benchmark'],
            ['服务', 'fastapi / uvicorn', 'Web 框架 / ASGI 服务器'],
            ['校验', 'pydantic', '数据模型与校验'],
            ['向量', 'sentence-transformers / faiss', 'embedding 模型 / 向量索引'],
            ['编排', 'langchain / llama-index', '高层封装（**谨慎使用，容易过度抽象**）'],
          ],
        },
        {
          type: 'p',
          text: '回答 checkpoint：**`transformers` 是"能跑"，`vllm` 是"能扛住并发"。** 前者适合单条测试、实验；后者适合对外提供服务（连续批处理、KV cache 管理、OpenAI 兼容 API）。用 transformers 做线上服务，GPU 利用率会低得可怜。',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '对 langchain / llama-index 的态度',
          text: '它们能让你 20 行搭出一个 demo，但也容易让你在出问题时**不知道问题出在哪一层**。建议：**学习阶段可以用，生产环境慎用**——至少要把关键链路（检索、prompt 拼接、解析）自己实现一遍，你才知道每一层在做什么。**过度抽象的代价是失去控制权。**',
        },
        {
          type: 'p',
          text: '还有一个实用建议：**看一个库，先看它的 `examples/` 和 `tests/`**。文档可能过时，README 可能夸大，但测试是"这个库真正保证什么"的唯一证据。想知道 `ragas` 的 faithfulness 怎么算，直接看它的测试用例比读文档快十倍。',
        },
      ],
    },

    {
      id: 's6',
      title: '和 Node 主服务协作：三种集成方式',
      checkpoint: 'Python 侧车服务挂了，你的主服务该怎么办？',
      blocks: [
        {
          type: 'table',
          head: ['方式', '形态', '优点', '缺点'],
          rows: [
            ['HTTP 服务', 'FastAPI 起一个端口，Node 用 fetch 调', '语言无关、可独立部署扩容', '多一层网络、要处理超时重试'],
            ['子进程 + CLI', 'Node spawn 一个 python 脚本，读 stdout', '简单、无端口、适合批处理', '启动慢、错误处理麻烦、并发差'],
            ['消息队列', 'Node 投任务，Python worker 消费', '天然异步、可重试、可扩', '架构复杂、要维护队列'],
          ],
        },
        {
          type: 'code',
          lang: 'python',
          title: 'FastAPI 侧车：健康检查 + 结构化错误',
          code: `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import time, logging

app = FastAPI()
START = time.time()

class EmbedRequest(BaseModel):
    texts: list[str]
    model: str = "bge-m3"

class EmbedResponse(BaseModel):
    vectors: list[list[float]]
    dim: int

@app.get("/health")
def health():
    """Node 侧启动时探活，失败就降级到"只做关键词检索" """
    return {
        "ok": True,
        "model_loaded": model is not None,
        "uptime_sec": round(time.time() - START),
        "version": "1.2.0",
    }

@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    if len(req.texts) > 256:
        raise HTTPException(413, detail="单次最多 256 条")
    try:
        vecs = model.encode(req.texts, normalize_embeddings=True).tolist()
        return EmbedResponse(vectors=vecs, dim=len(vecs[0]))
    except Exception as e:
        logging.exception("embed failed")     # 完整信息写日志
        raise HTTPException(500, detail="embedding failed")  # 对外一句话`,
        },
        {
          type: 'p',
          text: 'Node 侧的调用要按"外部依赖"对待（第十二课）：超时、重试、熔断、降级，一样不少。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'Node 侧：把 Python 服务当外部依赖',
          code: `const PY = process.env.PY_SERVICE ?? 'http://127.0.0.1:8001'

async function embed(texts: string[]) {
  try {
    const res = await fetch(\`\${PY}/embed\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(\`py service \${res.status}\`)
    return await res.json()
  } catch (e) {
    logger.warn({ err: e }, 'embedding service unavailable')
    // 降级：返回 null，调用方改用纯关键词检索
    return null
  }
}

// 调用方
const vec = await embed([query])
const results = vec
  ? await hybridSearch(query, vec.vectors[0])   // 正常路径
  : await keywordSearch(query)                  // 降级路径`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '侧车服务的三个必做',
          text: '① **健康检查**：Node 启动时探活，决定用完整路径还是降级路径；② **超时 + 熔断**：Python 服务卡住不能拖死 Node（它的 GIL 可能被某个重活占着）；③ **版本对齐**：embedding 模型版本变了，向量维度或语义空间会变，**旧索引全部失效**。健康检查里返回 `model` 和 `version`，Node 侧校验，不匹配就拒绝写入。',
        },
        {
          type: 'p',
          text: '最后一条很重要但经常被忘：**embedding 模型升级是一次"全量重建索引"的事件**，不是"换个包"这么简单。要么保持版本不变，要么准备好重建（可能要几小时）。在服务里把模型名和维度写进健康检查，能让这个事故提前暴露。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '并发方式选择',
      points: 10,
      prompt: '一个脚本要处理 5000 个 PDF：每个都做 OCR 和文本清洗，纯本地计算，单核跑要 4 小时。最合适的方案是？',
      options: [
        { id: 'a', text: 'asyncio 并发' },
        { id: 'b', text: '多进程（ProcessPoolExecutor），按 CPU 核数并行' },
        { id: 'c', text: '多线程' },
        { id: 'd', text: '串行，慢慢跑' },
      ],
      answer: ['b'],
      hints: [
        '判断标准：任务在等 IO 还是在算 CPU？',
        'OCR 和文本清洗都是纯计算，没有网络等待。',
        'b 是对的：CPU 密集任务要用多进程，每个进程有独立的 GIL 才能真正并行。a 是单线程事件循环，CPU 密集任务会完全串行；c 受 GIL 限制，多线程无法并行计算；d 是 4 小时。',
      ],
      explanation: '正确答案是 b。CPU 密集用多进程，IO 密集用 asyncio。这是 Python 并发最重要的一条分界线。',
      approach: [
        '判断任务类型：CPU 密集还是 IO 密集',
        'CPU 密集 → 多进程（绕过 GIL）',
        'IO 密集 → asyncio（单线程事件循环）',
        '注意进程数不超过 CPU 核数，否则切换开销反而拖慢',
      ],
      knowledge: ['GIL', 'asyncio', '多进程', 'CPU/IO 密集'],
      pitfalls: [
        'CPU 密集任务用 asyncio（完全串行）',
        '多线程做 CPU 密集（GIL 限制，没加速）',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: 'Python 工程化要点',
      points: 15,
      prompt: '下面哪些是让 Python 项目可维护的正确做法？（多选）',
      options: [
        { id: 'a', text: '用锁文件（uv.lock / requirements.txt 带版本）并把锁文件提交到 git' },
        { id: 'b', text: '用 pydantic 在边界做数据校验，而不是到处写 if 判断' },
        { id: 'c', text: '用 venv/uv 隔离每个项目的环境，不用全局 pip' },
        { id: 'd', text: '类型注解可写可不写，反正运行时不检查' },
        { id: 'e', text: '用 ruff 做 lint 和 format，用 mypy 做类型检查，都进 CI' },
      ],
      answer: ['a', 'b', 'c', 'e'],
      hints: [
        '想三件事：环境可复现、数据可信、错误早发现。',
        'd 是常见误解——类型注解的价值在于静态检查和可读性，不是运行时。',
        'a 保证三个月后还能装回来；b 让边界清晰、错误早暴露；c 避免全局污染；e 让机器替你检查。d 错在只看运行时——类型注解让 IDE 能补全、让 mypy 能发现传错参数，价值远大于运行时检查。',
      ],
      explanation: 'a、b、c、e 正确。d 是最常见的误解：类型注解的价值在开发期，不在运行期。',
      approach: [
        '锁文件进 git，保证可复现',
        '每个项目独立环境（uv/venv）',
        '边界用 pydantic 校验',
        '类型注解 + mypy + ruff 进 CI',
        '测试用 pytest，覆盖关键路径',
      ],
      knowledge: ['依赖管理', 'pydantic', '类型注解', 'CI'],
      pitfalls: [
        '不锁版本，三个月后装不回来',
        '全局 pip install 导致环境互相污染',
        '以为类型注解运行时有用（其实只对静态检查有用）',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: 'asyncio 批量调用',
      points: 15,
      prompt: '补全批量调用 LLM 的异步代码。要求：限制并发数、单个失败不影响整批。',
      templateLang: 'python',
      template: `async def batch(prompts, concurrency=8):
    sem = asyncio.{{f1}}(concurrency)

    async def one(p):
        async with {{f2}}:
            return await call_llm(p)

    tasks = [one(p) for p in prompts]
    results = await asyncio.{{f3}}(*tasks, return_exceptions={{f4}})

    ok = [r for r in results if isinstance(r, str)]
    return ok`,
      blanks: [
        { id: 'f1', label: '创建信号量的类', accept: ['semaphore', 'Semaphore'], width: 90 },
        { id: 'f2', label: '进入信号量的语法', accept: ['sem', 'semaphore'], width: 70 },
        { id: 'f3', label: '并发执行并收集结果', accept: ['gather'], width: 70 },
        { id: 'f4', label: '是否返回异常而不是抛出', accept: ['true', 'True'], width: 70 },
      ],
      hints: [
        '限制并发用 Semaphore，等结果用 gather。',
        '`return_exceptions` 是布尔值。',
        '① `asyncio.Semaphore` ② `async with sem` ③ `asyncio.gather` ④ `True`。`return_exceptions=True` 是关键——否则一个请求失败会让整批抛出，前面成功的全丢。',
      ],
      explanation: '这四个空对应四个关键点：并发控制、资源占用、结果收集、错误隔离。缺任何一个，批量脚本都会在真实场景里出问题。',
      approach: [
        '用 Semaphore 限制同时进行的请求数',
        '每个任务用 `async with sem` 占用名额',
        '用 gather 并发执行',
        '`return_exceptions=True` 让失败变成返回值而不是抛出',
        '最后按类型分离成功和失败',
      ],
      knowledge: ['asyncio', 'Semaphore', 'gather', '错误隔离'],
      pitfalls: [
        '不限并发，被限流后疯狂重试',
        'gather 不加 return_exceptions，一个失败全批丢',
        '在 async 函数里用 requests（阻塞事件循环）',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '解析 Python 服务的进度流',
      points: 20,
      prompt: 'Python 服务按行输出 JSON（JSONL）进度事件，形如 `{"type":"progress","done":3,"total":10}`。实现 `parseProgress(lines)`：忽略空行和非法 JSON，返回 `{ events, done, total, errors }`。`done`/`total` 取最后一个合法 progress 事件的值；没有 progress 事件时都为 0。',
      starter: `function parseProgress(lines) {
  // TODO
  return { events: [], done: 0, total: 0, errors: 0 }
}

return parseProgress`,
      checks: [
        {
          name: '正常解析',
          expr: "(() => { const r = result(['{\"type\":\"progress\",\"done\":3,\"total\":10}']); return r.events.length === 1 && r.done === 3 && r.total === 10 && r.errors === 0 })()",
        },
        {
          name: '忽略空行',
          expr: "result(['', '   ', '{\"type\":\"progress\",\"done\":1,\"total\":2}']).events.length === 1",
        },
        {
          name: '非法 JSON 计入 errors',
          expr: "(() => { const r = result(['not json', '{\"type\":\"progress\",\"done\":1,\"total\":2}']); return r.errors === 1 && r.events.length === 1 })()",
        },
        {
          name: '取最后一个 progress 的值',
          expr: "(() => { const r = result(['{\"type\":\"progress\",\"done\":1,\"total\":10}','{\"type\":\"progress\",\"done\":7,\"total\":10}']); return r.done === 7 })()",
        },
        {
          name: '没有 progress 时全为 0',
          expr: "(() => { const r = result(['{\"type\":\"log\",\"msg\":\"hi\"}']); return r.done === 0 && r.total === 0 && r.events.length === 1 })()",
        },
        {
          name: '非字符串输入不炸',
          expr: "(() => { try { const r = result([null, 42]); return typeof r.errors === 'number' } catch { return false } })()",
        },
      ],
      solution: `function parseProgress(lines) {
  const events = []
  let done = 0
  let total = 0
  let errors = 0

  for (const line of lines) {
    if (typeof line !== 'string') { errors++; continue }
    const s = line.trim()
    if (!s) continue

    let evt
    try {
      evt = JSON.parse(s)
    } catch {
      errors++
      continue
    }

    events.push(evt)
    if (evt && evt.type === 'progress') {
      if (typeof evt.done === 'number') done = evt.done
      if (typeof evt.total === 'number') total = evt.total
    }
  }

  return { events, done, total, errors }
}`,
      hints: [
        '逐行处理，用 try/catch 包住 JSON.parse。',
        '注意"最后一个 progress 事件"——所以是覆盖而不是累加。',
        '完整实现：遍历每一行，非字符串计入 errors 并跳过；trim 后空行跳过；JSON.parse 失败计入 errors；成功就 push 进 events；如果是 progress 类型且 done/total 是数字，覆盖全局变量。',
      ],
      explanation: '这个模式在集成 Python 侧车服务时非常常见：Python 端边跑边输出 JSONL，Node 端逐行解析、实时更新进度。它比"等整个任务结束再返回"体验好得多。',
      approach: [
        '逐行处理，跳过空行',
        'try/catch 包 JSON.parse，失败计入 errors',
        '成功解析的 push 进 events',
        'progress 类型覆盖 done/total（取最新）',
        '非字符串输入也要防，计入 errors',
      ],
      knowledge: ['JSONL', '流式解析', '容错处理', '侧车集成'],
      pitfalls: [
        '用 `JSON.parse(lines.join(""))`（JSONL 不是 JSON 数组）',
        '累加 done（应该是覆盖，取最新值）',
        '不 try/catch，一行坏数据整批失败',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '主服务是 Node，需要 Python 吗？',
        options: [
          { id: 'a', text: '不需要，Node 什么都能做' },
          { id: 'b', text: '需要，但只作为"工具语言"：能读懂源码、写脚本验证、做独立侧车服务' },
          { id: 'c', text: '需要，主服务应该全部改成 Python' },
          { id: 'd', text: '不需要，用 API 就行' },
        ],
        answer: 'b',
        why: '训练、推理引擎、评测框架的第一实现都在 Python。你要的是"能进去改"，不是"全用 Python 重写"。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: 'Python 项目为什么必须提交锁文件？',
        options: [
          { id: 'a', text: '为了减小仓库体积' },
          { id: 'b', text: '不锁版本，三个月后依赖升级会导致项目装不回来或行为变化' },
          { id: 'c', text: '为了加快安装' },
          { id: 'd', text: '不需要' },
        ],
        answer: 'b',
        why: '依赖解析是随时间变化的。锁文件保证"任何人、任何时间、任何机器"装出完全一样的环境。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: 'Python 的类型注解在运行时会检查吗？',
        options: [
          { id: 'a', text: '会，传错类型会报错' },
          { id: 'b', text: '不会，价值在于静态检查（mypy/pyright）和可读性' },
          { id: 'c', text: '只在 Python 3.10+ 会' },
          { id: 'd', text: '取决于解释器' },
        ],
        answer: 'b',
        why: '注解只是元数据，运行时不校验。要在边界做运行时校验，用 pydantic。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '在 async 函数里调用 `requests.get()` 会怎样？',
        options: [
          { id: 'a', text: '正常工作' },
          { id: 'b', text: '阻塞整个事件循环，所有并发请求都被卡住' },
          { id: 'c', text: '自动变成异步' },
          { id: 'd', text: '报错' },
        ],
        answer: 'b',
        why: '`requests` 是同步阻塞库。在事件循环里调用它，整个循环停下来等网络返回。要用 `httpx`（异步）或 `asyncio.to_thread()` 包一层。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '`transformers` 和 `vllm` 的区别是？',
        options: [
          { id: 'a', text: '没区别' },
          { id: 'b', text: 'transformers 适合单条实验（简单但不快），vllm 适合高并发服务（连续批处理、KV cache 管理）' },
          { id: 'c', text: 'vllm 只能跑小模型' },
          { id: 'd', text: 'transformers 更快' },
        ],
        answer: 'b',
        why: '用 transformers 做线上服务，GPU 利用率会低得可怜。高并发必须用带连续批处理的推理引擎。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: 'Node 主服务调用 Python 侧车服务时，必须做的是？',
        options: [
          { id: 'a', text: '直接调用，失败了再人工处理' },
          { id: 'b', text: '健康检查 + 超时 + 熔断 + 降级路径（比如降级到纯关键词检索）' },
          { id: 'c', text: '把 Python 服务合并进 Node 进程' },
          { id: 'd', text: '只用本地子进程，不用网络' },
        ],
        answer: 'b',
        why: '侧车服务是外部依赖，它可能因为 GIL 被占、模型加载、OOM 而变慢或挂掉。必须有完整的容错链路。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：Python 侧车',
    contributes:
      '这一课给项目加一个 Python 侧车服务，承担 embedding、rerank 和批量评测三件事，并和 Node 主服务正确集成。',
    tasks: [
      '用 uv 建 Python 项目，锁文件进 git，写 pyproject.toml 配 ruff + mypy',
      '用 FastAPI 起侧车服务：/health（返回模型名、维度、版本）、/embed、/rerank',
      '用 pydantic 定义所有请求/响应模型，边界校验（条数上限、长度上限）',
      'Node 侧封装客户端：超时 5s、失败降级到纯关键词检索、健康检查不通过时跳过侧车',
      '健康检查里校验 embedding 模型版本，Node 侧比对，版本不一致时拒绝写入并告警',
      '写一个批量评测脚本：asyncio + Semaphore 限制 8 并发，逐行输出 JSONL 进度',
      'Node 侧实现 JSONL 进度解析，把进度实时推给前端',
      '用多进程跑一次 5000 份文档的批量 embedding，对比单进程的耗时',
    ],
    done: '停掉 Python 服务，问答仍然可用（自动降级到关键词检索）；启动服务后自动恢复完整链路；批量 embedding 5000 份文档从 40 分钟降到 6 分钟；embedding 模型版本变更时系统能拒绝写入并提示需要重建索引。',
  },

  further: [
    { text: 'uv 官方文档 · 依赖解析与 lock 机制' },
    { text: 'FastAPI 文档 · 依赖注入与 pydantic 集成' },
    { text: 'Python 官方文档 · asyncio 任务与同步原语' },
    { text: '知识地图 21 Python 与 AI 生态（/guide/21-python）' },
  ],
}
