# 19 · 数据库与数据建模

> **投入权重：8%** · 补的一章。AI 应用的数据模型比普通 CRUD 复杂得多——会话、消息、工具调用、Agent 执行记录、知识库、评测结果，全都要能追溯。
>
> 这一章的价值在最后那节：**AI 专属表设计**。面试问"你怎么存会话和工具调用"，能画出表结构的人不多。

## PostgreSQL 基础

- **建表与约束** <span class="prio prio-must">必须</span> — 主键、外键、唯一、非空、CHECK。**约束写在数据库里，不要只写在应用层**——应用有 bug 时数据库是最后一道防线。
- **索引类型** <span class="prio prio-must">必须</span> — B-tree（默认）、GIN（JSONB、数组、全文）、GiST、HNSW（向量）。选错索引类型等于没建。
- **复合索引的顺序** <span class="prio prio-must">必须</span> — 最左前缀原则。`(tenant_id, created_at)` 能服务"按租户查最近"，反过来不行。
- **部分索引** <span class="prio prio-imp">重要</span> — `WHERE deleted_at IS NULL`，只索引有效行，省空间且更快。
- **`EXPLAIN ANALYZE`** <span class="prio prio-must">必须</span> — 看是否走索引、扫描行数、实际耗时。**不会看执行计划就没法优化查询。**
- **事务与隔离级别** <span class="prio prio-must">必须</span> — 默认 Read Committed，需要防幻读时用 Repeatable Read。理解每种级别解决什么问题。
- **行锁与乐观锁** <span class="prio prio-imp">重要</span> — `SELECT ... FOR UPDATE` 与 version 字段。并发更新会话状态时会用到。
- **JSONB** <span class="prio prio-must">必须</span> — 存工具的任意参数、模型的原始响应。**但要清楚边界**：常查询的字段要提成独立列，JSONB 只放不确定结构的部分。
- **数组类型** <span class="prio prio-imp">重要</span> — 存 tag、chunk_ids 这类小集合。
- **全文检索 `tsvector`** <span class="prio prio-must">必须</span> — 中文需要分词扩展（zhparser / pg_jieba）。**这是 BM25 混合检索的基础**，不用额外部署 ES。
- **迁移管理** <span class="prio prio-must">必须</span> — Prisma Migrate / Drizzle Kit / node-pg-migrate。迁移要可回滚，且不能破坏线上。
- **连接池** <span class="prio prio-must">必须</span> — 池大小 = 并发查询数，不是并发请求数。**AI 应用里模型调用慢，连接不能一直占着。**

## pgvector

- **扩展安装与类型** <span class="prio prio-must">必须</span> — `CREATE EXTENSION vector`，`vector(1024)` 指定维度。
- **距离运算符** <span class="prio prio-must">必须</span> — `<->` 欧氏、`<#>` 负内积、`<=>` 余弦距离。**用错运算符结果完全不对，而且不报错。**
- **HNSW 索引** <span class="prio prio-must">必须</span> — `USING hnsw (embedding vector_cosine_ops)`，参数 `m`（每层连接数）和 `ef_construction`（构建时的候选数）。查询时用 `SET hnsw.ef_search`。
- **IVFFlat 索引** <span class="prio prio-imp">重要</span> — 构建快、内存小，但召回依赖 `lists` 参数且需要数据先填充。
- **过滤 + 向量的组合** <span class="prio prio-must">必须</span> — 先 `WHERE tenant_id = ?` 再排序。**pgvector 的过滤是后置的**，选择性差时可能先取 top-k 再过滤导致结果不足。解法：调大 k 或建部分索引。
- **维度与性能** <span class="prio prio-imp">重要</span> — 维度越高索引越大越慢。1024 维是常见折中。
- **批量插入** <span class="prio prio-imp">重要</span> — 用 `COPY` 或批量 INSERT，逐条插会慢几十倍。

## Redis

- **五种数据结构与场景** <span class="prio prio-must">必须</span> — String（缓存、计数器）、Hash（会话）、List（简单队列）、Set（去重）、ZSet（排行榜、延时队列）。
- **TTL 与过期策略** <span class="prio prio-must">必须</span> — 缓存必须设过期，否则内存会满。
- **Cache Aside 模式** <span class="prio prio-must">必须</span> — 读时未命中查库回填，写时删缓存（不是更新缓存）。
- **缓存穿透 / 击穿 / 雪崩** <span class="prio prio-must">必须</span> — 空值缓存、互斥锁、过期时间加随机。**AI 场景里击穿很致命**——一个热门问题缓存失效，几十个请求同时打模型。
- **语义缓存的坑** <span class="prio prio-must">必须</span> — 相似度高不等于答案相同。必须设高阈值 + 排除时效性/数值类查询 + key 带上模型和 prompt 版本。
- **分布式锁** <span class="prio prio-imp">重要</span> — `SET key val NX PX 30000`，释放时校验 val（防误删别人的锁）。
- **限流器** <span class="prio prio-must">必须</span> — 滑动窗口或令牌桶，用 Lua 脚本保证原子性。
- **幂等键存储** <span class="prio prio-must">必须</span> — `SET idem:xxx 1 NX EX 3600`，成功才写入。

## AI 专属数据模型

这是本章最有价值的部分。下面是一套能支撑真实产品的表设计，**面试时能画出来就是加分项**。

### 核心业务表

```sql
-- 租户（多租户隔离的根）
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'free',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 用户
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  email       text NOT NULL,
  password_hash text,
  role        text NOT NULL DEFAULT 'member',   -- owner/admin/member
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX ON users (tenant_id);

-- 会话
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  title       text,
  model       text NOT NULL,
  system_prompt_version text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX ON conversations (tenant_id, user_id, updated_at DESC);

-- 消息（核心表，字段要克制）
CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            text NOT NULL,          -- user/assistant/tool/system
  content         text,
  tool_calls      jsonb,                  -- assistant 发起的调用
  tool_call_id    text,                   -- tool 角色对应的调用 ID
  token_input     int,
  token_output    int,
  model           text,
  finish_reason   text,
  latency_ms      int,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON messages (conversation_id, created_at);
```

**设计要点**：`tool_calls` 用 JSONB 而不是单独表，因为它的结构随模型厂商变化；但 `tool_call_id` 单独成列，因为要 JOIN 和去重。

### Agent 执行表

```sql
-- 一次 Agent 运行
CREATE TABLE agent_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  conversation_id uuid REFERENCES conversations(id),
  status          text NOT NULL,          -- pending/running/waiting_approval/succeeded/failed/cancelled
  input           jsonb NOT NULL,
  output          jsonb,
  total_steps     int NOT NULL DEFAULT 0,
  total_tokens    int NOT NULL DEFAULT 0,
  total_cost      numeric(12,6) NOT NULL DEFAULT 0,
  error           jsonb,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE INDEX ON agent_runs (tenant_id, status, started_at DESC);

-- 每一步（这是 trace 的持久化）
CREATE TABLE agent_steps (
  id          bigserial PRIMARY KEY,
  run_id      uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_no     int NOT NULL,
  type        text NOT NULL,              -- thought/tool_call/observation/answer
  tool_name   text,
  tool_input  jsonb,
  tool_output jsonb,
  error       text,
  tokens      int,
  duration_ms int,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON agent_steps (run_id, step_no);

-- 检查点（断点恢复的关键）
CREATE TABLE agent_checkpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_no     int NOT NULL,
  state       jsonb NOT NULL,             -- 完整可序列化的运行时状态
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON agent_checkpoints (run_id, step_no DESC);

-- 人工审批
CREATE TABLE approvals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES agent_runs(id),
  step_id     bigint NOT NULL REFERENCES agent_steps(id),
  action      jsonb NOT NULL,             -- 将要执行的动作
  preview     text NOT NULL,              -- 人话描述，给审批人看
  risk        text NOT NULL,              -- low/medium/high
  status      text NOT NULL DEFAULT 'pending',
  decided_by  uuid REFERENCES users(id),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON approvals (status, created_at);
```

**面试考点**：为什么要有 `agent_checkpoints`？因为"执行到第三步服务器重启"是真实场景，没有检查点就只能从头跑，成本和体验都不可接受。

### 知识库表

```sql
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  title       text NOT NULL,
  source_uri  text,
  mime_type   text,
  content_hash text NOT NULL,             -- 用于增量更新去重
  version     int NOT NULL DEFAULT 1,
  status      text NOT NULL DEFAULT 'pending',  -- pending/parsing/indexed/failed
  error       text,
  metadata    jsonb NOT NULL DEFAULT '{}', -- 部门、密级、生效日期
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX ON documents (tenant_id, source_uri) WHERE deleted_at IS NULL;

CREATE TABLE document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,              -- 冗余存储，用于检索时直接过滤
  parent_id   uuid,                       -- 父子块
  chunk_index int NOT NULL,
  content     text NOT NULL,
  section_path text,                      -- "第三章 > 3.2 退款政策"
  page        int,
  token_count int,
  embedding   vector(1024),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON document_chunks (tenant_id, document_id);
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

**三个关键设计**：
1. `content_hash` —— 判断文档是否真变了，避免无意义重建索引
2. `tenant_id` 冗余在 chunks 上 —— 检索时能直接过滤，不用 JOIN
3. `ON DELETE CASCADE` —— 删文档时 chunk 自动清理，避免"删了还在检索到"

### 成本与评测表

```sql
CREATE TABLE model_usage (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  user_id       uuid,
  feature       text NOT NULL,            -- chat/rag/agent/eval
  model         text NOT NULL,
  prompt_tokens int NOT NULL,
  completion_tokens int NOT NULL,
  cached_tokens int DEFAULT 0,
  cost          numeric(12,6) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON model_usage (tenant_id, created_at);
CREATE INDEX ON model_usage (feature, created_at);

CREATE TABLE eval_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version text NOT NULL,
  prompt_version  text NOT NULL,
  model       text NOT NULL,
  metrics     jsonb NOT NULL,             -- {recall@5: 0.89, faithfulness: 0.93}
  sample_count int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**`feature` 这一列是关键**——没有它，你只知道总成本，不知道是聊天贵还是 RAG 贵还是评测贵。

## 验收标准

能从零设计出上面这套表，并且能回答：

- 为什么 `tenant_id` 在 chunks 上冗余？
- 为什么检查点要单独一张表而不是塞进 `agent_steps`？
- 会话列表查询走哪个索引？
- 用户要求删除数据时，要删哪几张表？

答得出来，这一章就过关了。
