import type { Lesson } from './types'

/**
 * 第三课：数据库与数据建模
 *
 * 承接第一课的"数据在内存里，重启就没了"。
 * 重点不是 SQL 语法，是三个会决定系统能不能长大的决定：怎么建模、怎么建索引、怎么分页。
 */
export const lesson03: Lesson = {
  id: 'L03',
  moduleId: 'db',
  order: 3,
  path: '/learn/03-database',
  title: '数据库与数据建模：让数据活过下一次重启',
  subtitle: '建表只是开始。真正决定系统能不能长大的，是索引、分页和事务这三个决定。',
  minutes: 80,
  level: '入门',
  outcome: '能为一个业务设计出三个月后自己还看得懂的表结构，判断该建什么索引，并写出不会在第 10 万条数据时崩掉的分页查询。',
  goals: [
    '说清为什么内存存储在生产环境一定不可行',
    '把业务需求翻译成实体、关系、约束，而不是先想字段',
    '理解 B-tree 索引原理，判断该建单列还是复合索引，以及最左前缀',
    '识别并修复 N+1 查询，写出 keyset 分页而不是 offset 分页',
    '知道什么时候必须开事务，以及不同隔离级别各自防住什么',
    '用迁移管理表结构变更，而不是手改数据库',
  ],
  prereqs: [
    '学过第二课，知道 repository 层的职责',
    '会写基础 SQL（SELECT / INSERT / UPDATE / WHERE）',
    '知道什么是主键',
  ],

  steps: [
    {
      id: 's1',
      title: '为什么内存 Map 在生产环境一定不可行',
      checkpoint: '如果只部署一个进程，内存存储是不是就够了？',
      blocks: [
        {
          type: 'p',
          text: '第一课用 `new Map()` 存笔记，第二课换成了 SQLite。为什么要换？不是因为"生产要用数据库"这种教条，而是四个具体的技术限制。',
        },
        {
          type: 'table',
          head: ['限制', '具体表现', '什么时候暴露'],
          rows: [
            ['重启即丢', '进程退出、容器重建、机器重启，数据全没', '第一次部署更新时'],
            ['无法多进程共享', '开两个实例做负载均衡，A 写的 B 看不见', '第一次水平扩容时'],
            ['无法按条件查询', '要"查这个用户最近 20 条"，只能全表遍历', '数据超过几千条时'],
            ['没有事务', '扣款和记账两个操作，中途崩溃就数据不一致', '第一次涉及金额或库存时'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '一个常见误区',
          text: '"我的服务只有一个实例，所以内存够用" —— 这句话在**重启**面前立刻失效。哪怕是个内部工具，每次发版数据清零也是不可接受的。内存存储只适合缓存和测试替身，不适合当主存储。',
        },
        {
          type: 'p',
          text: '这一课用 SQLite 举例，因为它是零配置的单文件数据库，`node:sqlite` 是 Node 22 内置的，不用装任何东西。**但下面讲的建模、索引、分页、事务，在 PostgreSQL / MySQL 上完全一样**——这些是关系数据库的通用知识，不是某个产品的特性。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'Node 22 内置的 SQLite，不用装包',
          code: `import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('./data.db')
db.exec('PRAGMA journal_mode = WAL')   // 允许读写并发，强烈建议
db.exec('PRAGMA foreign_keys = ON')    // 外键约束默认是关的！

const row = db.prepare('SELECT * FROM notes WHERE id = ?').get('abc')
const rows = db.prepare('SELECT * FROM notes WHERE user_id = ?').all('u1')`,
          note: 'PRAGMA foreign_keys 默认关闭是 SQLite 的历史包袱。不打开它，你写的外键只是注释。',
        },
      ],
    },

    {
      id: 's2',
      title: '建模第一步：先想实体和关系，别想字段',
      checkpoint: '"一篇笔记可以有多个标签，一个标签可以属于多篇笔记"，这是几对几关系？',
      blocks: [
        {
          type: 'p',
          text: '新手建模直接从字段开始：notes 表里放 id、title、content、tags。写完发现"按标签搜索"要 `LIKE "%work%"`（或者用 `JSON_CONTAINS`），然后开始后悔。',
        },
        {
          type: 'p',
          text: '正确的顺序是：**先找名词（实体）→ 再找动词（关系）→ 最后才是字段。** 名词和动词决定了表的数量和连接方式，字段只是细节。',
        },
        {
          type: 'flow',
          title: '从需求到表结构',
          ascii: `需求：用户写笔记，笔记可以有标签，用户可以给笔记加星标

名词：用户、笔记、标签
动词：
  用户 —写→ 笔记          1 : N   （一篇笔记只有一个作者）
  笔记 —有→ 标签          M : N   （需要中间表）
  用户 —星标→ 笔记        M : N   （需要中间表，且带额外字段 starred_at）

结果：
  users
  notes          (user_id → users.id)
  tags
  note_tags      (note_id, tag_id)   复合主键
  stars          (user_id, note_id, starred_at)  复合主键`,
        },
        {
          type: 'code',
          lang: 'sql',
          title: '完整表结构（含约束）',
          code: `CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL
);

CREATE TABLE notes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  content     TEXT NOT NULL DEFAULT '',
  deleted_at  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE tags (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE stars (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  starred_at TEXT NOT NULL,
  PRIMARY KEY (user_id, note_id)
);`,
          note: '注意三个细节：CHECK 约束把"标题 1~120 字"写进了数据库；ON DELETE CASCADE 让删用户时自动清理关联；中间表用复合主键天然防重复。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '约束写在数据库里，不只是应用里',
          text: '应用层校验会被绕过（别的服务、手工 SQL、导入脚本）。数据库约束是最后一道闸门。**能在数据库里表达的规则，就不要只写在代码里**——UNIQUE、NOT NULL、CHECK、外键，都是免费的保险。',
        },
        {
          type: 'qa',
          q: '为什么不直接在 notes 表里放一个 tags 字段（JSON 数组）？',
          a: '能用，但有三个代价：① "查所有带 work 标签的笔记"没法走索引（只能全表扫 + JSON 解析）；② 标签改名要遍历所有行；③ 没法保证标签存在性。**什么时候可以用 JSON 字段？** 当这份数据只跟着主记录整体读写、永远不需要单独查询和统计时（比如"用户偏好设置"）。一旦要"按它筛选"，就该独立成表。',
        },
      ],
    },

    {
      id: 's3',
      title: '索引：不是越多越好，是有顺序才行',
      checkpoint: '索引 (user_id, created_at) 能加速 `WHERE created_at > ?` 吗？',
      blocks: [
        {
          type: 'p',
          text: '没有索引时，`WHERE user_id = ?` 要逐行扫描整张表——这叫全表扫描。10 万行时可能几十毫秒，100 万行时就是几百毫秒，而你的接口要在一秒内返回。',
        },
        {
          type: 'p',
          text: '索引本质是**排好序的副本**。B-tree 索引把某一列（或几列的组合）按顺序存一份，查找从 O(n) 变成 O(log n)。代价是：每次写入都要同步更新索引，且占磁盘。',
        },
        {
          type: 'analogy',
          title: '和 Vue 的 computed 对照',
          text: '索引像 computed：用空间换时间，源数据变了要重算。区别是 computed 只在你读的时候算，索引是每次写入都要维护。所以**写多读少的表，索引是负担**——比如日志表、事件表，索引要克制。',
        },
        { type: 'h', text: '复合索引与最左前缀' },
        {
          type: 'p',
          text: '这是面试和实战都必考的一点。索引 `(user_id, created_at DESC)` 相当于一本"先按 user_id 排序、同一 user_id 内再按 created_at 倒序"的目录。',
        },
        {
          type: 'table',
          head: ['查询条件', '能否用上 (user_id, created_at) 索引', '原因'],
          rows: [
            ['WHERE user_id = ?', '能（用第一列）', '最左列命中'],
            ['WHERE user_id = ? ORDER BY created_at DESC', '能，且排序也免费', '索引本身已是这个顺序'],
            ['WHERE user_id = ? AND created_at > ?', '能（两列都用上）', '最左前缀连续命中'],
            ['WHERE created_at > ?', '**不能**', '跳过了最左列 user_id'],
            ['WHERE created_at > ? AND user_id = ?', '能', '查询优化器会自动调整顺序，和上一条不同'],
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '最左前缀是硬规则',
          text: '`(a, b)` 的索引不能单独用于 `WHERE b = ?`。这就是为什么"给每个字段都建一个单列索引"往往不如"建一个顺序正确的复合索引"——后者一个顶三个，写入成本还更低。',
        },
        { type: 'h', text: '什么时候索引反而拖慢' },
        {
          type: 'list',
          items: [
            '**区分度低的列**：`status` 只有 3 个值，索引扫一半行还不如全表扫。',
            '**写多读少**：每插一行要更新 5 个索引，插入性能直接砍半。',
            '**小表**：100 行的表全表扫比走索引还快（索引要先读索引页再回表）。',
            '**频繁更新的列**：每次 UPDATE 都会移动 B-tree 中的位置。',
          ],
        },
        {
          type: 'code',
          lang: 'sql',
          title: '看执行计划，不要猜',
          code: `EXPLAIN QUERY PLAN
SELECT * FROM notes
WHERE user_id = 'u1' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 期望看到：SEARCH notes USING INDEX idx_notes_user_created (user_id=?)
-- 如果看到 SCAN notes，就是全表扫描，索引没生效`,
          note: 'PostgreSQL 用 EXPLAIN ANALYZE，MySQL 用 EXPLAIN。养成"改完索引先看执行计划"的习惯，比背索引规则有用。',
        },
      ],
    },

    {
      id: 's4',
      title: '查询：N+1 和分页是两个必踩的坑',
      checkpoint: '为什么 OFFSET 100000 会很慢？',
      blocks: [
        { type: 'h', text: '坑一：N+1 查询' },
        {
          type: 'p',
          text: '最典型的性能杀手，而且代码看起来完全正常：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '反例：1 + N 次查询',
          code: `const notes = await repo.listByUser(userId, { limit: 20 })   // 1 次

for (const note of notes) {
  // 每篇笔记查一次标签 → N 次
  note.tags = await tagRepo.listByNote(note.id)
}
// 总共 21 次往返。列表 100 条就是 101 次。`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: '正例：2 次查询，在内存里拼',
          code: `const notes = await repo.listByUser(userId, { limit: 20 })      // 1 次
const ids = notes.map((n) => n.id)

// 一次把 20 篇笔记的标签全查出来
const rows = await db.prepare(
  'SELECT note_id, tag_id FROM note_tags WHERE note_id IN (' +
  ids.map(() => '?').join(',') + ')'
).all(...ids)                                                    // 1 次

const byNote = new Map<string, string[]>()
for (const r of rows) {
  if (!byNote.has(r.note_id)) byNote.set(r.note_id, [])
  byNote.get(r.note_id)!.push(r.tag_id)
}
for (const n of notes) n.tags = byNote.get(n.id) ?? []`,
          note: '这是 DataLoader 的核心思想：把 N 次单查合并成 1 次批量查。GraphQL 生态里它是标配。',
        },
        {
          type: 'p',
          text: '也可以用一次 JOIN 搞定，但要注意：**一对多 JOIN 会让主表行数膨胀**（一篇笔记 5 个标签就变成 5 行），需要应用层去重。数据量大时，"两次查询 + 内存拼装"通常比 JOIN 更可控。',
        },
        { type: 'h', text: '坑二：OFFSET 分页' },
        {
          type: 'p',
          text: '`LIMIT 20 OFFSET 100000` 的执行方式是：**先扫描并丢弃前 100000 行**，再取 20 行。翻到后面越翻越慢，第 5000 页可能要好几百毫秒。',
        },
        {
          type: 'code',
          lang: 'sql',
          title: 'keyset 分页（游标分页）',
          code: `-- 第一页
SELECT * FROM notes
WHERE user_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- 下一页：把上一页最后一行的 (created_at, id) 传进来
SELECT * FROM notes
WHERE user_id = ? AND deleted_at IS NULL
  AND (created_at, id) < (?, ?)      -- 行值比较，SQLite/PG 都支持
ORDER BY created_at DESC, id DESC
LIMIT 20;`,
          note: '为什么还要带 id？因为 created_at 可能重复，只用时间做游标会漏行或重复。这叫"稳定排序键"。',
        },
        {
          type: 'table',
          head: ['', 'OFFSET 分页', 'keyset 分页'],
          rows: [
            ['第 1 页速度', '快', '快'],
            ['第 5000 页速度', '很慢（要扫 10 万行）', '和第一页一样快'],
            ['能否跳页', '能（第 1/50/100 页）', '不能，只能上一页/下一页'],
            ['数据变动时', '可能重复或漏行', '稳定'],
            ['适用', '后台管理、需要页码', '信息流、无限滚动、API'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '怎么选',
          text: '需要"跳到第 37 页"就用 OFFSET，但要限制最大页数（比如只允许翻到 100 页）。信息流、聊天记录、API 列表用 keyset。**两者不是替代关系，是不同场景。**',
        },
      ],
    },

    {
      id: 's5',
      title: '事务：什么时候必须开',
      checkpoint: '把"扣库存"和"写订单"分成两条独立 SQL 执行，中途崩溃会怎样？',
      blocks: [
        {
          type: 'p',
          text: '事务保证一组操作"要么全成功，要么全失败"。判断标准很简单：**这组操作中间失败，数据会不会不一致？** 会，就必须包事务。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '必须用事务的例子：转账',
          code: `// 反例：两条独立语句
await db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(100, 'A')
// ← 这里进程崩溃 / 数据库连接断开
await db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(100, 'B')
// 结果：A 少了 100，B 没多。钱消失了。

// 正例：包在事务里
db.exec('BEGIN IMMEDIATE')
try {
  db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(100, 'A')
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(100, 'B')
  db.exec('COMMIT')
} catch (err) {
  db.exec('ROLLBACK')
  throw err
}`,
          note: 'BEGIN IMMEDIATE 而不是 BEGIN：立刻拿写锁，避免"读的时候没冲突、写的时候才发现要回滚"。',
        },
        { type: 'h', text: '隔离级别：各自防住什么' },
        {
          type: 'table',
          head: ['级别', '脏读', '不可重复读', '幻读', '说明'],
          rows: [
            ['READ UNCOMMITTED', '可能', '可能', '可能', '几乎不用'],
            ['READ COMMITTED', '不可能', '可能', '可能', 'PostgreSQL 默认'],
            ['REPEATABLE READ', '不可能', '不可能', '可能（MySQL 用间隙锁基本防住）', 'MySQL InnoDB 默认'],
            ['SERIALIZABLE', '不可能', '不可能', '不可能', '最安全，并发最差'],
          ],
        },
        {
          type: 'p',
          text: '三个名词翻译成人话：',
        },
        {
          type: 'list',
          items: [
            '**脏读**：读到了别人还没提交的数据（对方可能回滚，你读到的是幻觉）。',
            '**不可重复读**：同一个事务里读两次，结果不一样（别人中间改了）。',
            '**幻读**：同一个事务里查两次，第二次多出了新行（别人中间插入了）。',
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '事务不是越多越好',
          text: '事务持锁期间，其他请求要排队。**绝对不要在事务里做网络请求**（调 LLM、调支付、发 HTTP）——那是几百毫秒到几十秒的持锁，会把并发打穿。正确做法：先在事务外把外部调用做完，再开短事务写库。',
        },
        {
          type: 'qa',
          q: '乐观锁和悲观锁怎么选？',
          a: '悲观锁是 `SELECT ... FOR UPDATE`，先锁住再改，适合冲突频繁的场景（抢库存）。乐观锁是加一个 version 字段，更新时 `WHERE id = ? AND version = ?`，影响行数为 0 就说明被人改过，适合冲突少的场景（编辑文档）。**Web 应用默认选乐观锁**，因为悲观锁会把连接池占满。',
        },
      ],
    },

    {
      id: 's6',
      title: '迁移：别再用 CREATE TABLE IF NOT EXISTS 当迁移',
      checkpoint: '直接给生产表加一个 NOT NULL 字段，为什么会失败？',
      blocks: [
        {
          type: 'p',
          text: '很多项目把建表语句写在代码启动时执行，用 `IF NOT EXISTS` 兜底。这在只有一张表时能用，一旦要**改**表结构就彻底失效——因为 `IF NOT EXISTS` 只在"表不存在"时生效，"表存在但缺字段"它管不了。',
        },
        {
          type: 'code',
          lang: 'text',
          title: '迁移的形态：一串有序的、只跑一次的文件',
          code: `migrations/
  001_create_users.sql
  002_create_notes.sql
  003_add_notes_deleted_at.sql
  004_add_index_notes_user_created.sql

schema_migrations 表记录已执行到哪一版：
  version | applied_at
  001     | 2026-10-01 10:00
  002     | 2026-10-01 10:00
  003     | 2026-10-15 09:12`,
        },
        {
          type: 'p',
          text: '规则只有三条：**每个迁移只做一件事、只前进不回头（回滚靠写一个新的反向迁移）、一旦合并到主干就不能再改内容。**',
        },
        { type: 'h', text: '加 NOT NULL 字段的正确顺序' },
        {
          type: 'p',
          text: '直接 `ALTER TABLE notes ADD COLUMN status TEXT NOT NULL` 在已有数据的表上会失败（老行没有值）。正确的三步走：',
        },
        {
          type: 'code',
          lang: 'sql',
          title: '在线加字段：三步，每步都可独立发布',
          code: `-- 第 1 步：加可空字段（瞬间完成，不锁表）
ALTER TABLE notes ADD COLUMN status TEXT;

-- 第 2 步：回填历史数据（分批，避免长事务）
UPDATE notes SET status = 'active' WHERE status IS NULL AND id IN (
  SELECT id FROM notes WHERE status IS NULL LIMIT 1000
);
-- 重复执行直到影响行数为 0

-- 第 3 步：加约束（此时已无 NULL）
ALTER TABLE notes ALTER COLUMN status SET NOT NULL;
ALTER TABLE notes ADD CONSTRAINT chk_status CHECK (status IN ('active','archived'));`,
          note: '第 2 步要分批，是因为一次 UPDATE 十万行会持有长事务，阻塞其他写入甚至撑爆 WAL。',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '迁移里最危险的三件事',
          text: '① **删列**：代码可能还在读它，先停止读写、观察一周、再删。② **改列类型**：可能重写整张表并长时间锁表。③ **在迁移里跑业务逻辑**：迁移应该只改结构，不写业务数据（除了必要的回填）。',
        },
      ],
    },

    {
      id: 's7',
      title: '软删除：一个看起来简单、实际很坑的需求',
      checkpoint: '软删除之后，原来的唯一索引还能防重复吗？',
      blocks: [
        {
          type: 'p',
          text: '软删除就是加一个 `deleted_at`，查询时都带 `WHERE deleted_at IS NULL`。好处是可恢复、可审计。坑在于它会悄悄破坏原来的约束。',
        },
        {
          type: 'code',
          lang: 'sql',
          title: '坑：唯一索引被软删除破坏',
          code: `-- 原来：email 唯一
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 用户 a@x.com 被软删除后，想重新注册同一个邮箱 → 冲突
-- 因为那一行还在，只是 deleted_at 有值

-- 解法 1：部分索引（PostgreSQL / SQLite 支持）
CREATE UNIQUE INDEX idx_users_email_active
  ON users(email) WHERE deleted_at IS NULL;

-- 解法 2：唯一键带上删除标记（MySQL 常用）
-- 删除时把 email 改成 a@x.com#deleted#1699999999
ALTER TABLE users ADD UNIQUE KEY uk_email_deleted (email, deleted_at);`,
          note: '部分索引更干净，但需要数据库支持。MySQL 没有部分索引，只能用解法 2 这种"删除时改名"的笨办法。',
        },
        {
          type: 'p',
          text: '还有三个必须一起考虑的点：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**所有查询都要带过滤条件**。漏一个就是"用户删了但还能看到"。建议在 repository 层统一加，不要让业务代码各自记着写。',
            '**索引要包含 deleted_at**。`(user_id, deleted_at, created_at)` 或部分索引，否则每次查询都要回表过滤。',
            '**数据删除 ≠ 标记删除**。用户要求"删除我的账号"时（GDPR / 个人信息保护法），标记删除不算删除。必须真的抹掉，且要覆盖**主表、索引、缓存、备份、派生数据**五处。',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          title: '什么时候不用软删除',
          text: '日志、事件、会话记录这类数据本来就不该删，直接按时间分区清理。软删除适合"用户会误删、需要回收站"的业务对象。**不要给所有表都加 deleted_at**——那是给自己埋坑。',
        },
      ],
    },

    {
      id: 's8',
      title: '什么时候不该用关系数据库',
      checkpoint: '把每次 LLM 调用的日志写进 PostgreSQL，会有什么问题？',
      blocks: [
        {
          type: 'p',
          text: '关系数据库很强，但不是所有数据都适合。判断标准：**数据量级 × 访问模式 × 一致性要求**。',
        },
        {
          type: 'table',
          head: ['场景', '更适合', '原因'],
          rows: [
            ['业务实体（用户、订单、笔记）', '关系库', '需要事务、关联、约束'],
            ['高频写入的日志 / trace', '时序库 / ClickHouse / 文件 + 对象存储', '每秒上万行，关系库的索引维护成本撑不住'],
            ['向量检索', 'pgvector（够用时）或专用向量库', 'Postgres + pgvector 在百万级以内完全够用，别一上来就上 Milvus'],
            ['大文件（图片、PDF）', '对象存储 + 库里只存 key', '数据库存 BLOB 会让备份和迁移变成灾难'],
            ['会话 / 缓存 / 限流计数', 'Redis', '需要 TTL 和极高的读写 QPS'],
            ['全文搜索（中文）', '专用搜索引擎或 PG 的 zhparser', 'LIKE 查询无法处理分词和相关性排序'],
          ],
        },
        {
          type: 'p',
          text: '这里有一条给 AI 应用工程的实用建议：**先把 pgvector 用起来，不要一开始就引入向量数据库。** 百万级向量以内，PostgreSQL + pgvector 的性能完全够，而且它能和业务表做 JOIN、能进同一个事务——这在"删除文档时要同时删向量"这类场景里价值巨大。',
        },
        {
          type: 'code',
          lang: 'sql',
          title: 'pgvector 最小可用配置',
          code: `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
  id          BIGSERIAL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   vector(1024) NOT NULL     -- 维度要和模型一致
);

-- HNSW 索引：m 控制连接数（越大越准越慢），ef_construction 控制建索引的搜索深度
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 检索：<=> 是余弦距离，<-> 是欧氏距离，<#> 是负内积
SELECT id, content, 1 - (embedding <=> $1) AS similarity
FROM document_chunks
WHERE document_id = ANY($2)          -- 权限过滤必须在 SQL 里，不能查完再过滤
ORDER BY embedding <=> $1
LIMIT 20;`,
          note: '注意最后那条 WHERE：向量检索的权限过滤必须下推到 SQL。查完再过滤会导致"召回 20 条全是无权限的"，这是 RAG 权限设计里最经典的错误。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '这一课最重要的一句',
          text: '**数据库选型不是选最强的，是选"能让你的团队少维护一个组件"的。** 每引入一个存储，就多一套备份、监控、权限、故障处理。Postgres 能扛住 90% 的场景，剩下 10% 再拆。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '复合索引能加速哪些查询',
      prompt:
        '表 notes 上有索引 `(user_id, created_at DESC)`。下面哪个查询**用不上**这个索引？',
      points: 10,
      options: [
        { id: 'a', text: 'WHERE user_id = ? ORDER BY created_at DESC LIMIT 20' },
        { id: 'b', text: 'WHERE user_id = ? AND created_at > ?' },
        { id: 'c', text: 'WHERE created_at > ? ORDER BY created_at DESC' },
        { id: 'd', text: 'WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 20' },
      ],
      answer: ['c'],
      hints: [
        '索引是"先按第一列排、同一第一列内再按第二列排"。问自己：只给第二列条件时，这本目录还有用吗？',
        '最左前缀原则：复合索引必须从最左列开始连续使用。',
        '正确答案 C。`(user_id, created_at)` 的排序是"先 user_id 后 created_at"，所以只有 created_at 条件时，符合条件的行散落在所有 user_id 分区里，无法定位——只能全表扫描。A、B、D 都以 user_id 开头，能连续命中索引，且 A 和 D 的排序还能免费得到（索引本身就是这个顺序，不需要额外排序）。',
      ],
      explanation:
        '复合索引的列顺序决定了它能服务哪些查询。写索引前先列出所有查询模式，找公共前缀，而不是"每个字段建一个索引"。',
      approach: [
        '列出这张表的所有查询条件组合',
        '找出出现频率最高的前缀',
        '按"等值列在前、范围列在后、排序列跟着走"排序',
      ],
      knowledge: ['复合索引', '最左前缀', '执行计划'],
      pitfalls: [
        '以为数据库会自动调整列顺序 —— 优化器能调整 WHERE 里条件的顺序，但改不了索引本身的列顺序',
      ],
    },

    {
      id: 'e2',
      type: 'multi',
      title: '哪些操作必须包在事务里',
      prompt: '下面哪些操作如果不包事务，可能导致数据不一致？（多选）',
      points: 15,
      options: [
        { id: 'a', text: '扣减库存 + 创建订单' },
        { id: 'b', text: '查询用户信息并返回' },
        { id: 'c', text: '转账：A 减 100、B 加 100' },
        { id: 'd', text: '给笔记打标签：插入 3 条 note_tags' },
        { id: 'e', text: '在事务外调用 LLM 生成摘要' },
      ],
      answer: ['a', 'c', 'd'],
      hints: [
        '判断标准：这组操作中途失败，数据会不会处于"业务上不可能出现"的状态？',
        '纯读操作不需要事务（除非要读一致快照）。而 E 恰恰相反——外部调用绝不该放进事务里。',
        '正确答案 A、C、D。A：扣了库存没建订单，或建了订单没扣库存，都是超卖/丢单。C：钱会消失或凭空出现。D：只插了 1 条标签，笔记处于"半个标签"状态。B 是纯读，不需要。E 是**必须放在事务外**——LLM 调用可能几秒到几十秒，放事务里会长时间持锁，把并发打穿。',
      ],
      explanation:
        '事务解决的是"多条写入的原子性"。它不解决读一致性（那是隔离级别的事），更不该用来包裹慢速外部调用。',
      approach: [
        '找出所有"成对/成组出现"的写操作',
        '问：中间失败会留下什么非法状态',
        '把外部调用（HTTP、LLM、支付）挪到事务外',
      ],
      knowledge: ['事务边界', '数据一致性', '长事务危害'],
      pitfalls: [
        '把事务当成"越包越安全" —— 包得越大，持锁越久，并发越差',
      ],
    },

    {
      id: 'e3',
      type: 'fill',
      title: '填空：写出正确的索引和分页',
      prompt:
        '需求：查某个用户未删除的笔记，按创建时间倒序，每页 20 条，用游标分页。补全下面两段 SQL。',
      points: 20,
      templateLang: 'sql',
      template: `-- 1) 建索引：要让"按 user_id 过滤 + 按 created_at 排序"走同一个索引
CREATE INDEX idx_notes_list
  ON notes ({{idx1}}, {{idx2}}, {{idx3}});

-- 2) 查下一页：上一页最后一行的 created_at = '2026-10-30T10:00:00Z'，id = 'n_42'
SELECT * FROM notes
WHERE user_id = ?
  AND deleted_at IS NULL
  AND (created_at, id) {{op}} (?, ?)
ORDER BY created_at DESC, id DESC
LIMIT {{limit}};`,
      blanks: [
        {
          id: 'idx1',
          label: '索引第一列（过滤条件）',
          accept: ['user_id'],
          placeholder: 'user_id',
          width: 10,
        },
        {
          id: 'idx2',
          label: '索引第二列（软删除过滤，让查询只扫有效行）',
          accept: ['deleted_at'],
          placeholder: 'deleted_at',
          width: 12,
        },
        {
          id: 'idx3',
          label: '索引第三列（排序列）',
          accept: ['created_at desc', 'created_at'],
          placeholder: 'created_at DESC',
          width: 18,
        },
        {
          id: 'op',
          label: '游标比较用的运算符（往更早的方向翻页）',
          accept: ['<'],
          placeholder: '<',
          width: 4,
        },
        {
          id: 'limit',
          label: '每页条数',
          accept: ['20'],
          placeholder: '20',
          width: 6,
        },
      ],
      hints: [
        '索引列的顺序不是随便排的：等值过滤列在前（user_id、deleted_at），范围/排序列在后（created_at）。这样等值部分能定位到小区间，区间内又已经是排好序的。',
        '游标分页是"从上一页最后一行继续往后取"。因为按 created_at DESC 排序，下一页的行 created_at 更小，所以是 `<`。',
        '完整答案：`(user_id, deleted_at, created_at DESC)` + `<` + `LIMIT 20`。注意行值比较 `(created_at, id) < (?, ?)` 里的 id 是必须的——created_at 可能重复，只用一个列做游标会漏行或重复。',
      ],
      explanation:
        '一个索引同时服务"过滤"和"排序"，是关系库性能优化的核心技巧。索引列顺序 = 等值列 → 范围列 → 排序列。',
      approach: [
        '先写 WHERE：user_id = ? AND deleted_at IS NULL（两个等值）',
        '再写 ORDER BY：created_at DESC（排序）',
        '索引按"等值 → 排序"排：user_id, deleted_at, created_at',
        '游标用行值比较，带上 id 保证稳定',
      ],
      knowledge: ['复合索引顺序', 'keyset 分页', '软删除过滤', '行值比较'],
      pitfalls: [
        '把 created_at 放索引第一列 —— 过滤时用不上，等于白建',
        '游标只带 created_at 不带 id —— 同一秒创建的多条记录会被跳过',
      ],
    },

    {
      id: 'e4',
      type: 'code',
      title: '编程：实现游标分页的参数构造',
      prompt:
        '实现 `buildPage(cursor, limit)`：cursor 是上一页返回的 `"createdAt|id"` 字符串（第一页传 null），返回 `{ where, params }`，用于拼进 SQL。检查项全部通过才算对。',
      points: 25,
      starter: `function buildPage(cursor, limit) {
  // cursor 形如 '2026-10-30T10:00:00.000Z|n_42'
  // 第一页（cursor 为 null/空）时：where 里不含游标条件，params 只有 [limit]

  // 返回：
  //   第一页: { where: '', params: [limit] }
  //   后续页: { where: ' AND (created_at, id) < (?, ?)', params: [createdAt, id, limit] }

  return { where: '', params: [limit] }
}

// —— 检查用 ——
const first = buildPage(null, 20)
const next = buildPage('2026-10-30T10:00:00.000Z|n_42', 20)
const broken = buildPage('bad-format', 20)

return { first, next, broken }`,
      checks: [
        { name: '第一页没有游标条件', expr: "result.first.where === ''" },
        { name: '第一页参数只有 limit', expr: "JSON.stringify(result.first.params) === '[20]'" },
        { name: '后续页含行值比较', expr: "result.next.where.includes('(created_at, id) <')" },
        { name: '后续页参数顺序正确', expr: "result.next.params[0] === '2026-10-30T10:00:00.000Z' && result.next.params[1] === 'n_42' && result.next.params[2] === 20" },
        { name: '非法游标退化为第一页', expr: "result.broken.where === ''" },
      ],
      solution: `function buildPage(cursor, limit) {
  if (!cursor) return { where: '', params: [limit] }

  const parts = String(cursor).split('|')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { where: '', params: [limit] }   // 游标坏了就当第一页，别让接口 500
  }

  return {
    where: ' AND (created_at, id) < (?, ?)',
    params: [parts[0], parts[1], limit],
  }
}`,
      hints: [
        '先处理第一页：没有游标时不加任何条件，参数只有 limit。这一步对了就能过两项检查。',
        '游标解析用 split("|")，要检查结果是 2 段且都非空。参数顺序必须和 SQL 里占位符顺序一致：先 created_at，再 id，最后 limit。',
        '完整实现见下。最容易被忽略的是"非法游标"的处理：真实场景里客户端可能传垃圾值，直接抛错会让接口 500，正确做法是退化成第一页——分页参数坏了不该导致整个请求失败。',
      ],
      explanation:
        '游标分页的核心是"把上一页的最后一行编码成不透明字符串"。编码格式属于实现细节，客户端不该解析它——这也是为什么很多 API 把游标做成 base64。',
      approach: [
        '空游标 → 无额外条件',
        'split("|") 并校验两段非空',
        '参数顺序对齐 SQL 占位符：游标值在前，limit 在后',
        '非法输入退化处理，不抛异常',
      ],
      knowledge: ['keyset 分页', '游标编码', '参数化查询'],
      pitfalls: [
        '把游标值直接拼进 SQL 字符串 —— SQL 注入，必须用参数化',
        '参数顺序写反 —— 查询不报错但结果全错，最难查的一类 bug',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '复合索引 (a, b) 能用于哪个查询？',
        options: [
          { id: 'a', text: 'WHERE b = ?' },
          { id: 'b', text: 'WHERE a = ? AND b > ?' },
          { id: 'c', text: 'ORDER BY b' },
          { id: 'd', text: 'WHERE b = ? ORDER BY a' },
        ],
        answer: 'b',
        why: '最左前缀：必须从 a 开始连续使用。只给 b 的条件时，符合条件的行散落在所有 a 分区里，无法定位。',
        stepId: 's3',
      },
      {
        id: 'q2',
        stem: '为什么 OFFSET 100000 LIMIT 20 很慢？',
        options: [
          { id: 'a', text: '因为要传很大的数字给数据库' },
          { id: 'b', text: '因为要先扫描并丢弃前 100000 行' },
          { id: 'c', text: '因为 LIMIT 在小偏移时才快' },
          { id: 'd', text: '因为索引失效了' },
        ],
        answer: 'b',
        why: 'OFFSET 的语义就是"跳过前 N 行"，数据库必须真的把这 N 行读出来再丢掉。翻得越深越慢。keyset 分页用"从上一行继续"绕过了这个开销。',
        stepId: 's4',
      },
      {
        id: 'q3',
        stem: 'N+1 查询的本质是什么？',
        options: [
          { id: 'a', text: '查询语句写得太长' },
          { id: 'b', text: '先查主表拿 N 条，再为每条单独查关联表，共 1+N 次往返' },
          { id: 'c', text: '索引建少了' },
          { id: 'd', text: '数据库连接池太小' },
        ],
        answer: 'b',
        why: '每次往返都有网络和解析开销，1+N 次在 N=100 时就是 101 次。解法是批量查（IN 查询）后在内存拼装，或一次 JOIN。',
        stepId: 's4',
      },
      {
        id: 'q4',
        stem: '下面哪个操作**不该**放在事务里？',
        options: [
          { id: 'a', text: '扣库存 + 建订单' },
          { id: 'b', text: '调用 LLM 生成摘要' },
          { id: 'c', text: '转账两条 UPDATE' },
          { id: 'd', text: '批量插入关联表' },
        ],
        answer: 'b',
        why: 'LLM 调用是几百毫秒到几十秒的外部请求。放在事务里意味着持锁同样长的时间，并发会被打穿。正确做法是先在事务外调完，再用短事务写库。',
        stepId: 's5',
      },
      {
        id: 'q5',
        stem: '在已有数据的表上加 NOT NULL 字段，正确顺序是？',
        options: [
          { id: 'a', text: '直接 ALTER TABLE ADD COLUMN ... NOT NULL' },
          { id: 'b', text: '先加可空字段 → 分批回填 → 再加 NOT NULL 约束' },
          { id: 'c', text: '先删表重建' },
          { id: 'd', text: '先加字段，再改代码，不用管老数据' },
        ],
        answer: 'b',
        why: '老行没有值，直接加 NOT NULL 会失败。三步走：加可空列（瞬间完成）、分批回填（避免长事务）、加约束。每步都能独立发布，不用停机。',
        stepId: 's6',
      },
      {
        id: 'q6',
        stem: '软删除后，原来的 UNIQUE(email) 会带来什么问题？',
        options: [
          { id: 'a', text: '没有任何问题' },
          { id: 'b', text: '已软删除的行仍占用唯一值，导致同邮箱无法重新注册' },
          { id: 'c', text: '会导致索引失效' },
          { id: 'd', text: '会导致外键约束失败' },
        ],
        answer: 'b',
        why: '软删除只是打标记，行还在表里，唯一索引照样生效。解法是部分索引（WHERE deleted_at IS NULL）或在唯一键里带上删除标记。',
        stepId: 's7',
      },
      {
        id: 'q7',
        stem: '为什么向量检索的权限过滤必须写在 SQL 的 WHERE 里？',
        options: [
          { id: 'a', text: '因为 SQL 更快' },
          { id: 'b', text: '因为先查 top-k 再过滤，可能 20 条全被过滤掉，召回为空' },
          { id: 'c', text: '因为向量库不支持应用层过滤' },
          { id: 'd', text: '因为这样代码更短' },
        ],
        answer: 'b',
        why: '向量检索只返回最相似的 k 条。如果这 k 条恰好都是用户无权限的文档，过滤后就什么都不剩——用户看到"没找到"。必须把权限条件下推到查询里，让数据库在候选集上就过滤。',
        stepId: 's8',
      },
      {
        id: 'q8',
        stem: '关于数据库选型，下面哪个判断最合理？',
        options: [
          { id: 'a', text: '一开始就上专用向量库，因为以后数据会变多' },
          { id: 'b', text: '先用 pgvector，等真的到瓶颈再拆出去' },
          { id: 'c', text: '日志也用关系库，统一好维护' },
          { id: 'd', text: '文件直接存进数据库 BLOB，省一个存储服务' },
        ],
        answer: 'b',
        why: '每引入一个存储就多一套备份、监控、权限、故障处理。百万级向量以内 pgvector 完全够用，还能和业务表 JOIN、进同一个事务（删文档时同时删向量）。到瓶颈再拆，是成本最低的路径。',
        stepId: 's8',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统的后端骨架',
    contributes:
      '这一课把第二课的 InMemory repo 换成真正的 SQLite 实现，并定下表结构。后面存文档、切分块、存向量，都在这套表上扩展。',
    tasks: [
      '按本课的 DDL 建表，打开 WAL 和 foreign_keys',
      '实现 SqliteNoteRepo，替换掉 InMemory 版本（组装根换一行）',
      '写迁移脚本 001~004，用一个 schema_migrations 表记录已执行版本',
      '把 list 接口改成 keyset 分页，用 EXPLAIN QUERY PLAN 确认走了索引',
      '给 service 层加一个"删除笔记"用例，用软删除，并验证列表接口看不到已删数据',
    ],
    done: '杀掉进程重启，数据还在；用 EXPLAIN 看到 SEARCH ... USING INDEX 而不是 SCAN；翻到第 100 页的响应时间和第 1 页一样。',
  },

  further: [
    { text: 'PostgreSQL 官方文档 · Using EXPLAIN' },
    { text: 'Use The Index, Luke · 索引与最左前缀的图解' },
    { text: 'pgvector README · HNSW 参数 m / ef_construction 的取舍' },
  ],
}
