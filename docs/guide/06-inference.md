# 06 · 推理与部署

> **投入权重：8%** · 不需要会写 CUDA，但必须能算清"一张卡能扛多少并发、一次请求多少钱"。
> 这是从工程师到负责人的分水岭。

## 为什么应用工程师也要懂这个

因为它直接决定产品形态。如果一次请求成本是 0.5 元，那你不可能做免费高频的 C 端产品；如果 TTFT 是 3 秒，那你必须设计"先出骨架"的交互。很多产品决策的约束条件，其实藏在推理成本里。

而且当老板问"为什么不用自己的模型"，你需要能给出一个有数字的答案，而不是"因为麻烦"。

## 推理引擎

- **vLLM** <span class="prio prio-must">必须</span> — PagedAttention 显存管理，工业界最主流。自部署首选。
- **SGLang** <span class="prio prio-must">必须</span> — RadixAttention 前缀缓存，多轮与 Agent 场景吞吐优势明显。
- **TensorRT-LLM** <span class="prio prio-imp">重要</span> — NVIDIA 官方，极致性能但编译复杂。
- **llama.cpp / GGUF** <span class="prio prio-must">必须</span> — CPU 与消费级显卡可跑，本地部署与端侧首选。
- **Ollama** <span class="prio prio-must">必须</span> — 本地开发体验最好，生产不建议。
- **HuggingFace TGI** <span class="prio prio-imp">重要</span> — 官方推理容器，集成简单。

## 关键指标

- **TTFT 首 token 延迟** <span class="prio prio-must">必须</span> — 用户感知的"快不快"主要由它决定。**目标 < 1s 是常见经验值，具体看场景。**
- **TPOT / ITL token 间隔** <span class="prio prio-must">必须</span> — 决定"读起来顺不顺"。**目标 < 50ms/token 是常见经验值。**
- **吞吐 vs 延迟的权衡** <span class="prio prio-must">必须</span> — 批处理提升吞吐但增加延迟。产品要哪个必须先定。
- **并发数与显存** <span class="prio prio-must">必须</span> — 并发 ≈ 可用显存 / 单请求 KV Cache。这是容量规划的核心公式。
- **延迟分位数** <span class="prio prio-imp">重要</span> — 只看平均值会骗人，必须看 P95 / P99。

## 优化技术

- **Continuous Batching** <span class="prio prio-must">必须</span> — 动态拼接请求，vLLM 的核心能力。
- **Prefix Caching 前缀缓存** <span class="prio prio-must">必须</span> — system prompt 相同就能复用，多轮场景省一大截。
- **KV Cache 管理与分页** <span class="prio prio-imp">重要</span> — 理解为什么长上下文会挤爆显存。
- **投机解码 Speculative Decoding** <span class="prio prio-imp">重要</span> — 小模型猜、大模型验，加速 2~3 倍。
- **张量并行 / 流水线并行** <span class="prio prio-imp">重要</span> — 多卡切分模型，单卡放不下时必须用。

## 量化

- **GPTQ** <span class="prio prio-imp">重要</span> — 训练后量化，4bit 常见，需要校准数据。
- **AWQ** <span class="prio prio-imp">重要</span> — 激活感知量化，效果通常优于 GPTQ。
- **GGUF 量化等级** <span class="prio prio-imp">重要</span> — Q4_K_M 是性价比甜点，Q8 接近原精度。
- **FP8 / INT8** <span class="prio prio-imp">重要</span> — 服务端常用，精度损失小。
- **量化对效果的影响** <span class="prio prio-must">必须</span> — 小模型量化损失明显大于大模型。要实测，别信"无损"宣传。

## 硬件与成本

- **显存估算公式** <span class="prio prio-must">必须</span> — 模型显存 ≈ 参数量 × 精度字节数。7B FP16 ≈ 14GB，加上 KV Cache 与框架开销要留余量。
- **GPU 选型** <span class="prio prio-imp">重要</span> — A100/H100 训练与高并发推理，L40S/4090 性价比推理，国产卡看生态。
- **云 GPU 成本核算** <span class="prio prio-must">必须</span> — 按小时算，再折算成"每千次请求成本"，这才是产品能用的数字。
- **Serverless 推理平台** <span class="prio prio-must">必须</span> — 按 token 计费，免运维。量小时比自建便宜得多。
- **自建 vs 调 API 的交叉点** <span class="prio prio-must">必须</span> — 用你的真实 QPS 和 token 量算，别用别人的结论。通常量小的时候自建永远更贵。

## 网关层

- **模型网关** <span class="prio prio-must">必须</span> — LiteLLM / OneAPI / OpenRouter：统一接口、多模型、计费、限流。
- **多模型路由与降级** <span class="prio prio-must">必须</span> — 主模型超时自动切备用，这是可用性的底线。
- **限流与配额** <span class="prio prio-must">必须</span> — 按用户/租户限流，防止单用户打爆成本。
- **语义缓存** <span class="prio prio-imp">重要</span> — 相似问题直接返回缓存答案。省钱效果显著，但要设相似度阈值防答错。
- **精确缓存** <span class="prio prio-must">必须</span> — 相同请求直接命中，最简单有效。
- **可观测与计费打通** <span class="prio prio-imp">重要</span> — 网关层是唯一能统一统计成本的地方，别把这事留给业务代码。
