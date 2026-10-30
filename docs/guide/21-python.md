# 21 · Python 与 AI 生态

> **投入权重：8%** · 补的一章。上一版这块只有一句话，太薄。
>
> 先说结论：**要不要学 Python，取决于你投什么岗**。投 AI 应用/全栈，TS 一条路走通更省力；投 LLM 工程、算法应用、或者要读开源实现，Python 是硬门槛。两条清单在这点上打架（一份说"主语言定 Python"，一份推荐 NestJS 全家桶），我的判断是：**后端主语言选一个，但 Python 必须能读能改**。

## 为什么绕不开

不是因为它更好，是因为生态在那。RAG 的评测工具（RAGAS）、微调框架（LLaMA-Factory、Unsloth）、推理引擎（vLLM、SGLang）、文档解析（MinerU、unstructured）、数据处理（pandas），全是 Python 优先。你在 TS 里找对应库，要么没有，要么是薄封装。

**但"能读能改"和"用它做主后端"是两回事。** 前者两三周够，后者要几个月。建议先做到前者。

## 语言基础

- **基础语法与缩进** <span class="prio prio-must">必须</span> — 没有大括号，靠缩进。看起来简单，但混用 tab/space 会报错。
- **动态类型与类型注解** <span class="prio prio-must">必须</span> — 注解不强制检查，但 FastAPI/Pydantic 靠它做校验和文档。**这是 Python 里最重要的"工程化"习惯**。
- **list / dict / tuple / set** <span class="prio prio-must">必须</span> — dict 是有序的（3.7+），tuple 不可变可做 key。
- **切片与推导式** <span class="prio prio-must">必须</span> — `a[1:5:2]`、`[x*2 for x in xs if x>0]`。读别人代码天天见。
- **函数与默认参数陷阱** <span class="prio prio-must">必须</span> — `def f(a=[])` 的可变默认值会跨调用共享，这是经典 bug。
- **装饰器** <span class="prio prio-imp">重要</span> — `@app.get`、`@pytest.fixture`、`@retry` 全是装饰器。要能读懂闭包实现的原理。
- **类与 `__init__` / `__repr__` / `__eq__`** <span class="prio prio-imp">重要</span> — 不需要精通元类，但要会写 dataclass 风格的类。
- **dataclass** <span class="prio prio-must">必须</span> — `@dataclass` 自动生成 init/repr/eq。**比手写类省一半代码**，配置对象、消息结构都用它。
- **Generator 与 `yield`** <span class="prio prio-must">必须</span> — 流式响应、批量处理的核心。理解"惰性求值"。
- **`async` / `await` / `asyncio`** <span class="prio prio-must">必须</span> — LLM 调用是 IO 密集，必须异步。`asyncio.gather` 并发、`Semaphore` 限流。
- **异常处理** <span class="prio prio-must">必须</span> — `try/except/else/finally`、自定义异常、`raise ... from`。**别写裸 `except:`**，会吞掉 KeyboardInterrupt。
- **Context Manager（`with`）** <span class="prio prio-imp">重要</span> — 文件、连接、锁。自己写要会 `__enter__`/`__exit__` 或 `@contextmanager`。
- **pathlib** <span class="prio prio-imp">重要</span> — 路径操作用它，别拼字符串。
- **json 与序列化** <span class="prio prio-must">必须</span> — `json.dumps(ensure_ascii=False)` 不然中文变 `\uXXXX`。
- **logging** <span class="prio prio-must">必须</span> — 别用 print。配置 handler、formatter、level。
- **pytest** <span class="prio prio-must">必须</span> — fixture、参数化、mock。评测脚本本质就是 pytest。

## 工具链

- **uv（推荐）/ pip** <span class="prio prio-must">必须</span> — uv 是目前最快的包管理器，能替代 pip + venv + pyenv。**新项目直接上 uv**。
- **venv 虚拟环境** <span class="prio prio-must">必须</span> — 每个项目独立环境，否则依赖冲突无解。
- **pyproject.toml** <span class="prio prio-must">必须</span> — 现代 Python 项目的标准配置，替代 setup.py。
- **Ruff** <span class="prio prio-must">必须</span> — lint + format 二合一，比 flake8+black+isort 快几十倍。
- **FastAPI** <span class="prio prio-must">必须</span> — 异步、类型驱动、自动生成 OpenAPI。**AI 服务后端首选**。
- **Pydantic** <span class="prio prio-must">必须</span> — 运行时校验 + 类型转换，作用等同于 TS 的 zod。**LLM 结构化输出必用**。
- **Uvicorn** <span class="prio prio-must">必须</span> — ASGI 服务器。生产用 gunicorn + uvicorn worker。
- **mypy / pyright** <span class="prio prio-imp">重要</span> — 静态类型检查。有注解不检查等于白写。

## 数据处理

- **NumPy 基础** <span class="prio prio-imp">重要</span> — 数组、广播、矩阵运算。**理解向量运算才看得懂 embedding 相似度**。
- **pandas** <span class="prio prio-must">必须</span> — DataFrame、groupby、merge、apply。处理评测结果、成本统计、文档元数据都靠它。
- **CSV / JSON / Parquet** <span class="prio prio-imp">重要</span> — Parquet 比 CSV 小且快，大数据集用它。
- **文档解析库** <span class="prio prio-must">必须</span> — PyMuPDF、python-docx、openpyxl、BeautifulSoup。RAG 的数据入口。
- **数据清洗** <span class="prio prio-must">必须</span> — 去重、去噪、编码修正、全半角统一。**这步做不好后面全白费**。
- **Jupyter Notebook** <span class="prio prio-imp">重要</span> — 探索数据、调 prompt、跑评测时用它。**但别把 notebook 当生产代码**。
- **Matplotlib / seaborn** <span class="prio prio-opt">选学</span> — 画指标曲线。简单够用就行，展示交给前端。

## AI 生态

- **Hugging Face Hub** <span class="prio prio-must">必须</span> — 模型/数据集的家。会用 `hf` CLI 下载、看 model card。
- **Transformers** <span class="prio prio-imp">重要</span> — `AutoModel` / `AutoTokenizer` / `pipeline`。**能跑通推理就够**，不必读源码。
- **Datasets** <span class="prio prio-imp">重要</span> — 高效加载大数据集，支持流式。
- **Tokenizers** <span class="prio prio-imp">重要</span> — 算 token 数、看分词结果。**调成本必用**。
- **Sentence Transformers** <span class="prio prio-must">必须</span> — 跑 embedding 和 rerank 模型的标准方式。bge 系列都走这个。
- **PyTorch 入门** <span class="prio prio-opt">选学</span> — 理解 tensor、device、`.to('cuda')`、推理时 `torch.no_grad()`。**不必会训练**。
- **模型推理 API** <span class="prio prio-must">必须</span> — 本地加载模型跑推理、批量推理、显存管理。

## 和 TS 的分工（这条最重要）

不要两个都学一半。明确分工：

| 层 | 语言 | 理由 |
| --- | --- | --- |
| 前端 / BFF | TypeScript | 你的存量，生态成熟 |
| API 网关 / 业务服务 | TS 或 Python，**选一个** | 团队用什么就用什么 |
| RAG / 评测 / 数据处理 | **Python** | 生态只有这边有 |
| 微调 / 推理 | **Python** | 无选择 |
| Agent 编排 | 看框架 | LangGraph 两边都有，Vercel AI SDK 只有 TS |

**建议**：主后端用 TS（你的迁移成本最低），但把 RAG 的评测、数据处理、微调脚本用 Python 写。两个服务之间用 HTTP 或队列通信。

## 学习边界

不要一上来研究 CUDA、自动求导、分布式训练。**你的目标是"能读懂并修改常见的 Python AI 应用代码"**，具体是：

- 能看懂一个 RAG 项目的目录结构和主流程
- 能改一个评测脚本的指标计算
- 能跑通一个 LoRA 微调并解释超参
- 能自己写一个 FastAPI 的流式接口

达到这四条，Python 这一章就过关了。
