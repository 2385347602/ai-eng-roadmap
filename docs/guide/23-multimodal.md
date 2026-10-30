# 23 · 多模态 AI 应用

> **投入权重：6%** · 新增一章。图片、语音、视频、文档——这些是"AI 应用"和"聊天框"的分界线。
>
> 前端转过来的一个隐藏优势：**你比算法背景的人更懂"用户界面上的图片和音频到底是怎么流动的"**。上传、压缩、预览、进度、失败重试、格式兼容——这些你干过。多模态应用里，一半的坑在这里。

## 视觉

- **VLM（视觉语言模型）** <span class="prio prio-must">必须</span> — 能同时吃图和文。GPT-4o、Claude、Qwen-VL、Gemini。**理解"图是被切成 patch 后当 token 处理"**，这决定了分辨率与成本的换算关系。
- **图像输入的 token 成本** <span class="prio prio-must">必须</span> — 一张 1024×1024 的图可能是几百到上千 token。**高分辨率图比长文本还贵**。工程上要先降采样再送。
- **分辨率与细节的权衡** <span class="prio prio-imp">重要</span> — 缩太小看不清小字，原图直送成本爆炸。做法：整体缩略图 + 关键区域裁切放大，两路一起送。
- **OCR** <span class="prio prio-must">必须</span> — 从图里取文字。传统引擎（PaddleOCR、Tesseract）便宜稳定；VLM 擅长手写和复杂版式但会**幻觉出原文没有的字**。生产上常组合用。
- **OCR 的幻觉问题** <span class="prio prio-must">必须</span> — VLM 做 OCR 时会"脑补"合理但不存在的数字。**金额、编号、日期这类字段必须二次校验**（正则 + 校验位 + 交叉比对）。
- **Screenshot / UI 理解** <span class="prio prio-imp">重要</span> — 让模型看截图回答"这个按钮在哪"、"报错是什么"。这是 Computer Use / 浏览器 Agent 的基础。
- **图表识别** <span class="prio prio-imp">重要</span> — 把柱状图/折线图读成结构化数据。**模型经常读错坐标轴刻度**，关键场景要人工抽检。
- **表格识别** <span class="prio prio-must">必须</span> — 图里的表格还原成 Markdown 或 CSV。合并单元格、跨页表是难点。
- **文档版面分析（Layout Analysis）** <span class="prio prio-must">必须</span> — 判断哪块是标题、正文、表格、页眉、图注。**这是 PDF 解析质量的关键**，直接影响 RAG 切片是否合理。
- **Image Embedding** <span class="prio prio-imp">重要</span> — 图文同一向量空间（CLIP 系）。实现"以图搜图"、"以文搜图"。
- **图像生成 API** <span class="prio prio-opt">选学</span> — 文生图、图生图、局部重绘（inpainting）、扩图（outpainting）。了解参数：尺寸、步数、引导强度、种子。
- **图像编辑的一致性** <span class="prio prio-imp">重要</span> — 改图时保持主体不变是难点。产品上常用"蒙版 + 局部重绘"而不是整图重生成。

## 音频

- **ASR / STT（语音转文字）** <span class="prio prio-must">必须</span> — Whisper 系是主流。关注：语言支持、标点、时间戳、热词（专有名词识别）。
- **流式 ASR** <span class="prio prio-must">必须</span> — 边说话边出字。**这是语音对话体验的分水岭**——非流式要等你说完才开始，感觉像对讲机。
- **VAD（语音活动检测）** <span class="prio prio-must">必须</span> — 判断"人开始说了"和"人说完了"。**判"说完"的静音阈值定得太短会切断句子，太长会卡顿**。这是语音产品最需要调的参数。
- **TTS（文字转语音）** <span class="prio prio-must">必须</span> — 关注：音色、语速、情感、是否流式。流式 TTS 才能做到"边说边播"。
- **首包延迟（TTFB）** <span class="prio prio-must">必须</span> — 语音对话的核心指标。ASR 出字 → LLM 出首 token → TTS 出首帧，三段延迟叠加。**超过 1.5 秒用户就觉得卡**。
- **打断（Barge-in）** <span class="prio prio-must">必须</span> — 用户插话时立刻停止播报 + 停止生成。**这需要全链路可取消**，从 TTS 播放器一路取消到 LLM 请求。
- **Speaker Diarization（说话人分离）** <span class="prio prio-imp">重要</span> — 多人会议里区分"谁说的"。转写结果的 `[说话人1]` 标记。
- **音视频转写** <span class="prio prio-must">必须</span> — 长音频要分片、并行、拼接时间戳。**注意切片边界会切断词**，重叠切片 + 去重是标准做法。
- **实时语音对话（Realtime API）** <span class="prio prio-imp">重要</span> — 端到端语音模型（不走 ASR→LLM→TTS 三段），延迟更低、能传递语气，但**可控性差、成本高、难审计**。

## 视频

- **帧提取** <span class="prio prio-must">必须</span> — 按固定间隔抽帧（如每 2 秒）。**间隔怎么定取决于内容变化速度**，讲课视频和体育视频完全不同。
- **关键帧检测** <span class="prio prio-imp">重要</span> — 只在画面显著变化时抽帧，省 token。
- **视频摘要** <span class="prio prio-imp">重要</span> — 抽帧 → 逐帧描述 → 汇总。**长视频要分层汇总**（帧→片段→整片），否则上下文爆掉。
- **时间轴对齐** <span class="prio prio-imp">重要</span> — 摘要必须能定位回时间点（"第 3 分 20 秒讲到…"）。**没有时间戳的摘要在产品里没用**。
- **字幕对齐** <span class="prio prio-must">必须</span> — 转写文本 + 时间戳。SRT/VTT 格式，注意换行和最短显示时长。
- **事件检测** <span class="prio prio-opt">选学</span> — 检测"有人进入画面"、"发生碰撞"。需要专门的模型，通用 VLM 做不好。
- **视频检索** <span class="prio prio-imp">重要</span> — 把视频切成片段，每段生成描述 + 向量化。检索时先命中片段再定位时间点。

## 实时交互

- **WebRTC** <span class="prio prio-imp">重要</span> — 浏览器实时音视频的标准方案。要理解信令、ICE、STUN/TURN。**企业内网经常打不通，必须有 TURN 兜底**。
- **WebSocket vs SSE** <span class="prio prio-must">必须</span> — 语音要双向（上行音频 + 下行结果）用 WebSocket；纯文本流式用 SSE 更简单。**别为了"统一"把所有东西都做成 WebSocket**。
- **多模态会话状态** <span class="prio prio-imp">重要</span> — 一轮对话里同时有音频流、文本、图片。状态要能表达"这一段是用户在说话的第 2 秒"。
- **端到端延迟预算** <span class="prio prio-must">必须</span> — 把总延迟拆到每一跳：采集 50ms + 编码 30ms + 上行 80ms + ASR 300ms + LLM 首 token 500ms + TTS 首帧 200ms + 下行 80ms + 播放缓冲 100ms。**先算账再优化，别凭感觉。**
- **音频编码与带宽** <span class="prio prio-imp">重要</span> — Opus 是首选。16kHz 单声道够语音用。**采样率选高了纯浪费带宽**。

## 文档智能

这块在 To B 场景里最值钱，也是最容易被低估的。

- **PDF 结构解析** <span class="prio prio-must">必须</span> — 分清"文本型 PDF"和"扫描型 PDF"。前者直接抽文字，后者必须 OCR。**混着处理是常见错误**。
- **版面还原顺序** <span class="prio prio-must">必须</span> — 双栏 PDF 直接按坐标排序会串行。要按栏位分区再排序。**这是 RAG 在论文/合同上效果差的头号原因**。
- **表格与图片的位置关系** <span class="prio prio-imp">重要</span> — 表格必须和它的标题、脚注绑定，否则切片后表头丢了，表格变成天书。
- **发票 / 票据识别** <span class="prio prio-imp">重要</span> — 固定版式，优先用模板 + 规则，VLM 兜底。**纯 VLM 方案在金额上出错率不可接受**。
- **合同抽取** <span class="prio prio-must">必须</span> — 抽当事人、金额、期限、违约责任、管辖地。要输出**原文引用 + 页码**，不能只给结论。
- **合同比对** <span class="prio prio-imp">重要</span> — 两版合同的差异检测。按条款对齐后逐条比对，而不是全文 diff。
- **OCR + LLM 组合** <span class="prio prio-must">必须</span> — 主流做法：版面分析定区域 → OCR 出文字 → LLM 做结构化。**纯 VLM 端到端简单但不可控、不可审计**。
- **字段校验** <span class="prio prio-must">必须</span> — 抽出来的字段要校验：金额合计是否等于明细之和、日期是否合法、税号校验位、身份证校验位。**这一步能把准确率从 85% 拉到 99%**。

## 工程上的坑（前端经验直接用得上）

- **上传与压缩** — 前端先压图（canvas / wasm），别把 8MB 原图传上去。**服务端还要再校验一次**，前端压缩不可信。
- **格式兼容** — HEIC（iPhone 默认）、WebP、AVIF。**HEIC 是投诉重灾区**，服务端要转码。
- **EXIF 方向** — 手机拍的图带旋转标记，不处理就是躺着的。前端 `createImageBitmap` 和服务端都要处理。
- **长音频/大文件分片上传** — 断点续传、分片校验、合并。这套你做过就直接复用。
- **进度与可取消** — 多模态处理慢，必须有进度条和取消按钮。取消要真的停掉后端任务，不只是前端隐藏。
- **失败重试与降级** — 图片识别失败降级到"请描述图片内容"的文本输入。**别让用户卡死在死路上**。
- **成本上限** — 按用户/租户设多模态调用配额。**一张图几毛钱，放开就是烧钱**。

## 你会在面试里被问到的

1. **"做文档问答，PDF 里有表格和双栏排版，怎么处理？"** — 答：先判文本型/扫描型 → 版面分析分区 → 按栏位排序 → 表格与标题绑定 → 切片时保留表头。**能说出"双栏串行"这个具体坑，说明真做过。**
2. **"语音对话怎么做到不卡？"** — 答：流式 ASR + 流式 TTS + 拆延迟预算 + VAD 调参 + 全链路可取消。**说出"打断要取消到 LLM 请求层"这句会加分。**
3. **"VLM 做 OCR 有什么风险？"** — 答：幻觉出原文没有的字，金额/编号尤其危险。方案：规则校验 + 传统 OCR 交叉验证 + 关键字段人工抽检。
4. **"一张图多少 token，成本怎么控？"** — 答：图被切 patch 当 token 算，高分辨率很贵。控法：降采样、区域裁切、缓存识别结果、按租户配额。
5. **"视频怎么让模型理解？"** — 答：抽帧 + 逐帧描述 + 分层汇总 + 时间戳对齐。说清"没有时间戳的摘要在产品里没用"。

## 验收标准

- 能画出一条语音对话的完整链路，并给出每跳的延迟预算
- 能处理一份双栏带表格的 PDF，切片后表头不丢
- 能解释 VLM 做 OCR 的幻觉风险与至少两条缓解手段
- 能说出图像 token 成本的估算方式
- 能设计一个带进度、可取消、可降级的多模态上传流程
