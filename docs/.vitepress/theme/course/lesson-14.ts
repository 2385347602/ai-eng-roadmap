import type { Lesson } from './types'

/**
 * 第十四课：多模态
 *
 * 核心立场：多模态不是"模型能看图"，是"选对通道"。
 * 大多数场景下 OCR + 文本模型比直接喂图更准、更便宜、更可验证。
 */
export const lesson14: Lesson = {
  id: 'L14',
  moduleId: 'multimodal',
  order: 14,
  path: '/learn/14-multimodal',
  title: '多模态：图片、PDF、音频、视频，每一种都有坑',
  subtitle: '把图直接喂给模型看起来很酷，但在票据、表格、合同上，OCR + 文本往往更准。',
  minutes: 70,
  level: '进阶',
  outcome: '能为一个多模态需求选出正确的通道组合，并算清它的 token 成本与准确率边界。',
  goals: [
    '区分"原生多模态"和"OCR/ASR + 文本"两条路，知道各自适合什么',
    '算清图片的 token 成本，并知道分辨率与细节的取舍',
    '处理 PDF 的版面、表格、扫描件三种形态',
    '设计音频转写的分段与时间戳方案',
    '判断视频该抽帧、读字幕，还是只听音频',
    '搭建图文混排的检索，并评估多模态效果',
  ],
  prereqs: [
    '学过第七课，理解检索与切分',
    '学过第五课，会算 token 成本',
    '手上有真实的图片/PDF/音频样本（不要用合成的完美样本）',
  ],

  steps: [
    {
      id: 's1',
      title: '两条路：原生多模态 vs 专用模型 + 文本',
      checkpoint: '一张增值税发票要提取 8 个字段，该直接喂图还是先 OCR？',
      blocks: [
        {
          type: 'p',
          text: '几乎所有"AI 看图片"的需求，都有两条实现路径，而且**大多数情况下第二条更靠谱**：',
        },
        {
          type: 'table',
          head: ['', '原生多模态（直接喂图）', '专用模型 + 文本（OCR/ASR）'],
          rows: [
            ['原理', '图片编码成视觉 token，和文本一起进模型', '先用专用模型转成文本，再走文本链路'],
            ['准确率（自然图像）', '高，能理解场景、表情、图表趋势', '低（OCR 只认字）'],
            ['准确率（票据/表格）', '中，容易串行、漏字段', '高，专用 OCR 对版式有优化'],
            ['可验证性', '低，你没法知道它"看错"了哪里', '高，能看到识别出的原始文本'],
            ['成本', '高（一张图几百到上千 token）', '低（OCR 通常几分钱一张）'],
            ['延迟', '中', '低（可批量预跑）'],
            ['适合', '截图问答、图表理解、UI 还原', '发票、合同、证件、表格、扫描件'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '判断标准很简单',
          text: '**问："这个任务的正确答案，能不能用一段文本完整表达？"** 能（发票字段、合同条款、字幕内容），就走 OCR/ASR + 文本——可验证、可检索、可审计。不能（这张 UI 哪里不对、这个图表说明了什么趋势），才走原生多模态。',
        },
        {
          type: 'p',
          text: '还有第三条路，很多人忽略：**两者结合**。OCR 拿到文本 + 同时把原图一起给模型，让它在"有文本可依据"的同时看到版面。这在表格和复杂排版上效果最好，成本也只比纯图多一点。',
        },
        {
          type: 'analogy',
          title: '和前端做图片识别对照',
          text: '这就像"用 canvas 逐像素分析"和"用现成的 OCR 库"。前者灵活但要自己处理所有边界情况（旋转、模糊、水印），后者在它擅长的场景里又准又快。**工程上永远先问"有没有专用工具"，而不是"通用模型能不能硬做"。**',
        },
      ],
    },

    {
      id: 's2',
      title: '图片：token 成本与分辨率的取舍',
      checkpoint: '一张 4000×3000 的合同扫描件，直接喂给模型会有什么问题？',
      blocks: [
        {
          type: 'p',
          text: '图片进模型前会被切成小块（patch），每块变成若干 token。**分辨率越高，token 越多，成本越高，但细节也越多。** 这个取舍必须算清楚。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '估算图片 token（数量级参考，具体看模型文档）',
          code: `function estimateImageTokens(width: number, height: number, detail: 'low' | 'high') {
  if (detail === 'low') return 85          // 固定低价档，适合判断"这是什么"

  // high 档：先缩放到最长边 2048，再按 512×512 的块计费
  const scale = Math.min(1, 2048 / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
  return 85 + tiles * 170
}

estimateImageTokens(4000, 3000, 'high')
// 缩放到 2048×1536 → 4×3 = 12 块 → 85 + 2040 = 2125 token
// 一张图 2000+ token，100 张就是 20 万 token —— 必须提前算`,
        },
        {
          type: 'table',
          head: ['场景', '建议', '理由'],
          rows: [
            ['判断"这是什么"', 'low 档 / 缩到 512', '不需要细节'],
            ['读票据字段', 'OCR 优先；必须用图时裁到关键区域', '全图喂进去反而串行'],
            ['UI 截图找问题', '原分辨率 + high', '细节决定判断'],
            ['图表趋势', 'high，但要说明"只看趋势不看精确数值"', '精确数值模型会编'],
            ['手写体', '先试 OCR，不行再用图', '专用手写 OCR 通常更准'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '两个必踩的坑',
          text: '① **长图被压缩**：4000×3000 缩到 2048 长边后，小字可能糊成一团，模型"看不清就编"；② **多图顺序**：一次传 5 张图，模型可能把第 2 张的内容说成第 4 张的。**给每张图加明确标注**（"图 1：正面；图 2：反面"），并要求它按标注引用。',
        },
        {
          type: 'p',
          text: '还有一个非常实用的技巧：**先裁再问**。合同要提取"甲方名称"，不要整页喂进去，先用 OCR 拿到文本定位到"甲方"那一行，再把那一小块图裁出来问模型。**准确率会显著提升，成本会显著下降。**',
        },
      ],
    },

    {
      id: 's3',
      title: 'PDF：三种形态，三种处理',
      checkpoint: '同一份 PDF，为什么有的能直接复制文字，有的复制出来是乱码？',
      blocks: [
        {
          type: 'p',
          text: 'PDF 不是"一种文件"，是三种完全不同的东西，处理方式也完全不同：',
        },
        {
          type: 'table',
          head: ['形态', '特征', '提取方式', '常见问题'],
          rows: [
            ['文本型', '能选中复制文字', 'pdf.js / pdfplumber 直接抽文本', '多栏排版会串行；页眉页脚混进正文'],
            ['扫描型', '整页是一张图', 'OCR（先转图，再识别）', '倾斜、噪点、印章遮挡；分辨率不足'],
            ['混合型', '正文是文本，图表/公式是图', '文本抽取 + 图片区域单独 OCR', '公式识别错；表格结构丢失'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '按块提取，保留版面信息',
          note: '关键是把"页 + 坐标 + 类型"一起存下来。后面做引用时，用户点"查看原文"要能跳到那一页那个位置。',
          code: `type PdfBlock = {
  page: number
  bbox: [number, number, number, number]  // x0, y0, x1, y1
  type: 'text' | 'table' | 'figure'
  text: string
  confidence?: number
}

async function extractPdf(buf: Buffer): Promise<PdfBlock[]> {
  const doc = await loadPdf(buf)
  const blocks: PdfBlock[] = []

  for (let p = 0; p < doc.pageCount; p++) {
    const page = await doc.getPage(p)

    // 1) 先尝试文本层
    const textItems = await page.getTextContent()
    const textLen = textItems.items.reduce((a, i) => a + (i.str?.length ?? 0), 0)

    if (textLen > 50) {
      // 文本型：按行聚合成块，保留坐标
      blocks.push(...groupIntoBlocks(textItems, p))
    } else {
      // 扫描型：转图 + OCR
      const img = await page.render({ scale: 2 })     // 2 倍缩放，提高 OCR 准确率
      const ocr = await runOcr(img)
      blocks.push(...ocr.map((r) => ({ page: p, bbox: r.bbox, type: 'text' as const,
                                       text: r.text, confidence: r.confidence })))
    }

    // 2) 表格单独识别（文本层里的表格通常是错乱的）
    const tables = await detectTables(page)
    blocks.push(...tables.map((t) => ({ page: p, bbox: t.bbox, type: 'table' as const,
                                        text: t.markdown })))
  }

  return blocks
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '表格是 PDF 提取的头号难题',
          text: '直接抽文本时，表格会变成"单元格文字按阅读顺序排成一列"，行列关系全丢。模型看到这种文本会彻底误读。**正确做法：检测到表格区域就单独用表格识别（转 HTML/Markdown 保留结构），或者干脆把表格区域当图片喂给多模态模型。** 一个数字错位，整份报告就废了。',
        },
        {
          type: 'p',
          text: '切分策略也要跟着变：**PDF 不能按字符数切**。按"页 + 章节标题 + 块类型"切，并且每个块都带 `page` 和 `bbox`。检索命中后，前端可以直接渲染"第 12 页，这里"——这是用户信任的来源。',
        },
      ],
    },

    {
      id: 's4',
      title: '音频：转写只是第一步',
      checkpoint: '一段 1 小时的会议录音，直接整段转写会得到什么？',
      blocks: [
        {
          type: 'p',
          text: '会得到两万字没有标点、没有分段、不知道谁在说话的文本。**这样的文本既不能检索，也不能喂给模型。** 音频处理的重点不是"转写"，是"转写后的结构化"。',
        },
        {
          type: 'table',
          head: ['能力', '作用', '不做会怎样'],
          rows: [
            ['分段 + 时间戳', '每个句子有起止时间', '无法定位"这句话在第几分钟"'],
            ['说话人分离', '区分谁说的', '会议记录变成一锅粥'],
            ['标点与断句', '可读性', '模型理解困难'],
            ['领域词表', '人名、产品名、术语', '"飞书"被转成"非书"'],
            ['置信度', '标记低质量片段', '把听错的内容当真'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '按"话题段"切分，而不是按固定时长',
          note: '关键：转写结果要保留时间戳，切分时以"语义段"为单位，并且每段都带 start/end，前端能直接跳到音频对应位置。',
          code: `type Segment = {
  start: number      // 秒
  end: number
  speaker: string
  text: string
  confidence: number
}

function chunkTranscript(segs: Segment[], maxChars = 600): Segment[][] {
  const chunks: Segment[][] = []
  let cur: Segment[] = []
  let len = 0

  for (const s of segs) {
    // 说话人切换或超长时断开
    const speakerChanged = cur.length > 0 && cur.at(-1)!.speaker !== s.speaker
    if (len + s.text.length > maxChars || (speakerChanged && len > 200)) {
      chunks.push(cur)
      cur = []
      len = 0
    }
    cur.push(s)
    len += s.text.length
  }
  if (cur.length) chunks.push(cur)
  return chunks
}

// 每个 chunk 拼成带标注的文本，喂给模型时它能区分谁在说
const text = chunk.map((s) => \`[\${fmt(s.start)}] \${s.speaker}: \${s.text}\`).join('\\n')`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '低置信度片段要显式标记',
          text: 'ASR 在噪声、方言、多人抢话时准确率会掉到 60% 以下。**不要把这些文本当事实**。做法：置信度低于阈值的片段在文本里标注 `[识别不确定]`，并在 prompt 里说明"标注部分可能不准确，如涉及关键信息请提示用户确认"。**这比让模型自信地复述错误内容好一百倍。**',
        },
        {
          type: 'p',
          text: '如果要做"会议纪要"，还有一步很重要：**先抽取结构，再生成文字**。让模型先输出 `{ attendees, decisions[], actionItems[{owner, task, due}] }` 这样的结构化结果，再由代码渲染成纪要。直接让它写一段流畅的纪要，会漏掉 action item，或者把讨论中的假设写成决定。',
        },
      ],
    },

    {
      id: 's5',
      title: '视频：三种读法，成本差 100 倍',
      checkpoint: '一个 30 分钟的产品演示视频，你要提取"讲了哪些功能"。该怎么处理？',
      blocks: [
        {
          type: 'p',
          text: '视频是最贵的模态。三种读法的成本差两个数量级，选错了会直接烧掉预算。',
        },
        {
          type: 'table',
          head: ['读法', '成本（30 分钟）', '能回答什么', '不能回答什么'],
          rows: [
            ['抽帧（1 帧/10 秒）', '约 180 帧 × 800 token ≈ 14 万 token', '画面里出现了什么', '说了什么、前后关系'],
            ['读字幕/ASR', '约 6000 字 ≈ 1 万 token', '讲了什么内容', '画面演示了什么'],
            ['抽帧 + 字幕对齐', '约 15 万 token', '既有内容又有画面', '精确的时长/动作细节'],
            ['完整视频输入', '极大，通常不可行', '—', '—'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '按"场景变化"抽帧，而不是按固定间隔',
          note: '固定间隔抽帧会得到 20 张几乎一样的人脸。按画面变化抽帧，能在同样数量下覆盖更多信息。',
          code: `async function smartFrames(videoPath: string, maxFrames = 40) {
  const meta = await probe(videoPath)          // 时长、帧率
  const dur = meta.duration

  // 第一遍：粗采样，算相邻帧的差异
  const step = Math.max(1, Math.floor(dur / 200))
  const diffs: { t: number; score: number }[] = []
  let prev: Buffer | null = null

  for (let t = 0; t < dur; t += step) {
    const frame = await grabFrame(videoPath, t, { width: 160 })
    if (prev) diffs.push({ t, score: phashDistance(prev, frame) })
    prev = frame
  }

  // 第二遍：取差异最大的 N 个时刻（场景切换点）
  return diffs
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFrames)
    .map((d) => d.t)
    .sort((a, b) => a - b)          // 还原时间顺序
}`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '先问"有没有字幕"',
          text: '大量视频（课程、发布会、会议录屏）本身带字幕或讲稿。**有字幕就直接用字幕，成本是抽帧的 1/10，信息密度还更高。** 只有"演示操作类"视频（画面即信息）才需要抽帧。判断方法：闭上眼睛听，能不能知道内容？能 → 读音频；不能 → 需要画面。',
        },
        {
          type: 'p',
          text: '时间对齐是视频的独特价值：每帧带上 `t`（秒），每段字幕带上 `start/end`，合并后每个内容块都知道"这在第几分钟"。用户问"那个功能在第几分钟演示的"，你能直接回答并跳转。**没有时间戳的视频理解，等于把视频变成了一堆无序的图片。**',
        },
      ],
    },

    {
      id: 's6',
      title: '多模态检索与评估',
      checkpoint: '用户上传一张截图问"这个报错什么意思"，你的检索该查什么？',
      blocks: [
        {
          type: 'p',
          text: '多模态检索的核心问题是：**用什么去查什么。** 四种组合，用途完全不同。',
        },
        {
          type: 'table',
          head: ['查询', '库', '做法', '场景'],
          rows: [
            ['文本 → 文本', '文档 chunk', '普通 RAG', '知识问答'],
            ['文本 → 图', '图片的文本描述', '给每张图生成 caption，检索 caption', '找"那张架构图"'],
            ['图 → 图', '图片 embedding', 'CLIP 类模型，跨模态向量空间', '找相似图片、以图搜图'],
            ['图 → 文本', '文本 chunk', '先把图 OCR/描述成文本，再检索', '截图报错 → 查文档'],
          ],
        },
        {
          type: 'p',
          text: '最后一种（图 → 文本）是最常见也最容易做错的。用户上传一张报错截图，正确链路是：',
        },
        {
          type: 'flow',
          title: '截图问答的正确链路',
          ascii: `用户上传截图
   │
   ├─► OCR 抽出文字（错误码、堆栈、界面文案）
   │      │
   │      └─► 如果 OCR 置信度低 → 用多模态模型"读图"补充
   │
   ├─► 用抽出的文字做混合检索（关键词优先，因为错误码是精确串）
   │
   ├─► 命中文档 + 原截图一起放进上下文
   │      └─► prompt 里说明：文字来自 OCR，可能有识别错误
   │
   └─► 生成答案，引用文档 + 标注"根据你截图里的 ERR_2041"`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '错误码必须走关键词检索',
          text: '第七课讲过：embedding 对 `ERR_2041` 这类罕见串几乎无效。截图里的报错码要先 OCR 出来，然后用**关键词检索**去查，不能指望向量相似度。这是多模态 RAG 里最高频的失效点。',
        },
        {
          type: 'p',
          text: '评估方面，多模态比纯文本难得多，因为"对不对"往往需要看图。三个可操作的做法：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**把任务降级成可自动检查的形式**：票据提取 → 比对 8 个字段是否全对；截图问答 → 答案里是否包含正确的错误码。**能用 if 判断的，不要用 judge。**',
            '**分通道度量**：OCR 准确率（字符级）、检索命中率、生成准确率，分开看。混在一起你不知道该换 OCR 还是换模型。',
            '**人工抽检必须看原图**。只看文本答案会漏掉"模型把图看错了但答案凑巧对"的情况。',
          ],
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '选通道',
      points: 10,
      prompt: '要从 2000 张增值税发票里提取 8 个字段（金额、税号、开票日期等），要求准确率 99% 以上。最合适的方案是？',
      options: [
        { id: 'a', text: '每张图直接喂给多模态大模型，让它输出 JSON' },
        { id: 'b', text: '用专用票据 OCR（带版式识别）提取，再用规则 + 少量模型校验，低置信度的才转人工' },
        { id: 'c', text: '用通用 OCR 抽文本，再让模型从文本里找字段' },
        { id: 'd', text: '人工录入' },
      ],
      answer: ['b'],
      hints: [
        '先问：这个任务的正确答案能不能用一段文本完整表达？能 → 优先专用模型。',
        '2000 张 × 99% 意味着最多只能错 20 张，通用方案很难达到。',
        'b 是对的：专用票据 OCR 对版式有优化，准确率最高、成本最低、可验证（能看到识别结果）。a 成本高且容易串行漏字段；c 丢了版式信息，字段容易错位；d 不可扩展。',
      ],
      explanation: '正确答案是 b。票据是"结构化字段提取"任务，专用 OCR + 规则 + 人工兜底是行业标准做法。',
      approach: [
        '判断任务类型：结构化提取 vs 开放理解',
        '结构化提取优先专用 OCR（可验证、成本低、准确率高）',
        '低置信度样本转人工，形成闭环',
        '保留原图，供人工复核时对照',
      ],
      knowledge: ['通道选择', '票据 OCR', '置信度兜底'],
      pitfalls: [
        '所有图片任务都用多模态大模型',
        '通用 OCR 丢了版式，字段错位',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: 'PDF 处理要点',
      points: 15,
      prompt: '处理一批混合型 PDF（正文是文本，图表和表格是图片），下面哪些做法是对的？（多选）',
      options: [
        { id: 'a', text: '先检测有没有文本层，没有就走 OCR' },
        { id: 'b', text: '表格区域单独识别，保留行列结构（转 Markdown/HTML）' },
        { id: 'c', text: '每个块保留页码和坐标，供"查看原文"跳转' },
        { id: 'd', text: '按固定字符数切分，简单可靠' },
        { id: 'e', text: '页眉页脚在提取时去掉，避免污染正文' },
      ],
      answer: ['a', 'b', 'c', 'e'],
      hints: [
        '想三件事：怎么判断该 OCR、怎么保住结构、怎么让用户能验证。',
        'd 是反模式——PDF 有天然结构（页、章节、段落），按字数切会切断语义。',
        'a 决定走哪条提取路径；b 保住表格的行列关系（否则数字全错位）；c 让引用可跳转，是信任的基础；e 去掉页眉页脚避免每块都重复同样的噪声。d 会切断段落和表格。',
      ],
      explanation: 'a、b、c、e 正确。PDF 切分要按结构（页/章节/块类型），不能按字符数。',
      approach: [
        '先探测文本层，决定走文本抽取还是 OCR',
        '表格单独检测 + 结构化识别',
        '每块保留 page 和 bbox',
        '清理页眉页脚、水印等重复噪声',
        '按章节/段落切分，不按字符数',
      ],
      knowledge: ['PDF 提取', '表格识别', '版面信息', '切分'],
      pitfalls: [
        '按字符数切 PDF',
        '表格当普通文本抽，行列错位',
        '不保留页码，用户无法验证',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '算清图片成本',
      points: 15,
      prompt: '某模型按"长边缩放到 2048 后，512×512 一块，基础 85 token + 每块 170 token"计费。一张 4096×3072 的图片按 high 档，需要多少 token？1000 张要多少？按输入单价 $0.5/百万 token 算，总成本多少？',
      templateLang: 'text',
      template: `缩放：长边 4096 → 2048，比例 0.5
尺寸：2048 × {{w1}}

块数：ceil(2048/512) × ceil({{h1}}/512) = 4 × {{b1}} = {{tiles}} 块

单张 token = 85 + {{tiles}} × 170 = {{per}}

1000 张 = {{total}} token

成本 = {{total}} × 0.5 / 1e6 = \${{cost}}`,
      blanks: [
        { id: 'w1', label: '缩放后的宽度', accept: ['1536', '1,536'], width: 70 },
        { id: 'h1', label: '缩放后的高度', accept: ['1536', '1,536'], width: 70 },
        { id: 'b1', label: '纵向块数', accept: ['3'], width: 50 },
        { id: 'tiles', label: '总块数', accept: ['12'], width: 50 },
        { id: 'per', label: '单张 token', accept: ['2125', '2,125'], width: 80 },
        { id: 'total', label: '1000 张总 token', accept: ['2125000', '2,125,000'], width: 110 },
        { id: 'cost', label: '总成本（美元）', accept: ['1.06', '1.0625', '1.063'], width: 80 },
      ],
      hints: [
        '先算缩放比例：4096 缩到 2048，比例是 0.5，所以高度也乘 0.5。',
        '3072 × 0.5 = 1536，1536/512 = 3 块。',
        '缩放后 2048×1536 → 4×3 = 12 块 → 85 + 12×170 = 2125 token/张。1000 张 = 2,125,000 token。成本 = 2.125 × 0.5 = $1.0625。**看起来不贵，但如果这 1000 张只是"判断这是什么"，用 low 档（85 token）能省 96%。**',
      ],
      explanation: '单张 2125 token，1000 张约 $1.06。关键洞察：**图片成本对"分辨率档位"极其敏感**，low 档 85 token vs high 档 2125 token，差 25 倍。按任务需求选档位是最有效的成本优化。',
      approach: [
        '先按长边限制算缩放比例',
        '缩放后尺寸除以 512，向上取整得块数',
        '85 + 块数 × 170 得单张 token',
        '乘以数量、乘以单价得成本',
      ],
      knowledge: ['图片 token', '分辨率档位', '成本估算'],
      pitfalls: [
        '忘了长边限制会缩放（直接按原尺寸算块数）',
        '不区分 low/high 档',
        '块数忘记向上取整',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现均匀抽帧',
      points: 20,
      prompt: '实现 `planFrames(durationSec, maxFrames)`：返回在 `[0, durationSec]` 区间内均匀分布的时间点数组（秒），长度不超过 `maxFrames`。要求：首帧在 0 附近但不在 0（避免黑场，用 `duration/(maxFrames*2)` 作为起始偏移），相邻间隔相等，最后一帧不超过时长。返回数字数组，保留两位小数。',
      starter: `function planFrames(durationSec, maxFrames) {
  // TODO
  return []
}

return planFrames`,
      checks: [
        { name: '返回长度等于 maxFrames', expr: 'result(600, 10).length === 10' },
        { name: '第一帧有偏移（不是 0）', expr: 'result(600, 10)[0] > 0' },
        { name: '间隔相等', expr: '(() => { const f = result(600, 10); const d = f[1] - f[0]; return f.every((v, i) => i === 0 || Math.abs((v - f[i-1]) - d) < 1e-9) })()' },
        { name: '最后一帧不超过时长', expr: 'result(600, 10).slice(-1)[0] <= 600' },
        { name: '短视频也能处理', expr: 'result(3, 10).length === 10 && result(3, 10).slice(-1)[0] <= 3' },
        { name: '时长为 0 返回空数组', expr: 'result(0, 10).length === 0' },
      ],
      solution: `function planFrames(durationSec, maxFrames) {
  if (!(durationSec > 0) || !(maxFrames > 0)) return []
  const n = Math.floor(maxFrames)
  const step = durationSec / n
  const offset = step / 2
  const out = []
  for (let i = 0; i < n; i++) {
    const t = offset + i * step
    if (t > durationSec) break
    out.push(Math.round(t * 100) / 100)
  }
  return out
}`,
      hints: [
        '把时长分成 n 段，每段中点就是一个采样点——这样首尾都不会贴边。',
        '`step = duration / n`，第 i 个点是 `step/2 + i*step`。',
        '完整实现：先判非正数返回空数组；`step = duration / n`；循环 i 从 0 到 n-1，`t = step/2 + i*step`；超过时长就 break；`Math.round(t*100)/100` 保留两位。注意 3 秒 10 帧时 step 只有 0.3 秒，最后一帧在 2.85 秒，仍在范围内。',
      ],
      explanation: '均匀抽帧是最便宜的基线方案。真实场景还会叠加"场景变化检测"（见 s5），但先用均匀抽帧跑通，再优化。',
      approach: [
        '把时长均分成 n 段',
        '每段取中点作为采样时刻（避开片头片尾黑场）',
        '超过时长的丢弃',
        '保留两位小数，避免浮点噪声',
      ],
      knowledge: ['抽帧', '时间轴', '均匀采样'],
      pitfalls: [
        '从 0 开始抽，第一帧常是黑场',
        '最后一帧超出时长',
        '不处理 duration 为 0 的情况',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '判断该用原生多模态还是 OCR + 文本，最好的标准是？',
        options: [
          { id: 'a', text: '图片大小' },
          { id: 'b', text: '任务的正确答案能不能用一段文本完整表达' },
          { id: 'c', text: '模型价格' },
          { id: 'd', text: '有没有 GPU' },
        ],
        answer: 'b',
        why: '能（字段、条款、字幕）就走 OCR/ASR，可验证可审计；不能（UI 哪里不对、趋势如何）才走原生多模态。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '为什么 PDF 里的表格不能当普通文本抽取？',
        options: [
          { id: 'a', text: '表格字太小' },
          { id: 'b', text: '行列关系会丢失，单元格文字变成一列，模型会彻底误读' },
          { id: 'c', text: '表格是图片' },
          { id: 'd', text: '表格不支持中文' },
        ],
        answer: 'b',
        why: '文本层按阅读顺序输出，表格结构不在文本里。必须单独做表格识别（转 Markdown/HTML），或把表格区域当图喂给模型。',
        stepId: 's3',
      },
      {
        id: 'q3',
        stem: '一段 1 小时会议录音，直接整段转写的主要问题是什么？',
        options: [
          { id: 'a', text: '太慢' },
          { id: 'b', text: '没有分段、没有说话人、没有时间戳，既不能检索也不能定位' },
          { id: 'c', text: '太贵' },
          { id: 'd', text: '中文识别不准' },
        ],
        answer: 'b',
        why: '转写只是第一步。分段、说话人分离、时间戳、领域词表、置信度标记，这些才决定它能不能用。',
        stepId: 's4',
      },
      {
        id: 'q4',
        stem: '视频理解最省成本又有效的做法通常是？',
        options: [
          { id: 'a', text: '逐帧分析' },
          { id: 'b', text: '先看有没有字幕/讲稿，有就读文本；只有"画面即信息"的视频才抽帧' },
          { id: 'c', text: '把视频转成 GIF' },
          { id: 'd', text: '让人看完写摘要' },
        ],
        answer: 'b',
        why: '字幕的信息密度更高、成本低一个数量级。判断方法：闭上眼睛听，能知道内容就不需要画面。',
        stepId: 's5',
      },
      {
        id: 'q5',
        stem: '用户上传报错截图提问，链路里最关键的一步是？',
        options: [
          { id: 'a', text: '把截图直接喂给模型' },
          { id: 'b', text: 'OCR 抽出错误码，然后用关键词检索查文档（错误码是精确串，向量检索无效）' },
          { id: 'c', text: '先转成 PDF' },
          { id: 'd', text: '压缩图片' },
        ],
        answer: 'b',
        why: '错误码是罕见字符串，embedding 会稀释它。必须先 OCR 出来，再走关键词检索。这是多模态 RAG 最高频的失效点。',
        stepId: 's6',
      },
      {
        id: 'q6',
        stem: '图片的 low 档和 high 档 token 差多少倍？该怎么选？',
        options: [
          { id: 'a', text: '差不多，随便选' },
          { id: 'b', text: '差 20 倍以上（85 vs 2000+），按任务需求选：判断"是什么"用 low，读细节用 high' },
          { id: 'c', text: 'low 更准' },
          { id: 'd', text: 'high 更便宜' },
        ],
        answer: 'b',
        why: '档位差一个数量级。大量"只需粗判"的图用 high 档是纯浪费；反之需要细节时用 low 档会逼模型瞎编。',
        stepId: 's2',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：多模态输入',
    contributes:
      '这一课让项目支持"上传截图提问"。核心不是接模型，是 OCR + 关键词检索 + 原图对照这条可验证的链路。',
    tasks: [
      '实现 PDF 提取：文本层探测 → 文本抽取或 OCR → 表格单独识别 → 每块带 page 和 bbox',
      '实现截图问答：OCR 抽文字 → 混合检索（错误码走关键词）→ 命中文档 + 原图一起进上下文',
      '给每张图/每个 PDF 块生成 caption，存进向量库，支持"找那张架构图"',
      '实现图片成本估算与档位选择：粗判用 low，读细节用 high',
      '在 prompt 里声明"文字来自 OCR，可能识别错误"，并对低置信度片段加标记',
      '建 30 条多模态评测用例（10 张票据、10 张截图、10 页 PDF），分通道度量 OCR 准确率 / 检索命中率 / 生成准确率',
    ],
    done: '上传一张报错截图，能在 3 秒内给出正确答案并引用对应文档，且答案里明确指出"根据你截图里的 ERR_2041"；上传一张票据，8 个字段里至少 7 个正确，且能点开原图核对。',
  },

  further: [
    { text: 'OpenAI Vision 文档 · detail 档位与 token 计算' },
    { text: '论文 · CLIP: Learning Transferable Visual Models From Natural Language Supervision' },
    { text: '知识地图 23 多模态 AI 应用（/guide/23-multimodal）' },
  ],
}
