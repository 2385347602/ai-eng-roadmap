# 11 · 前端专有

> **你的存量优势** · 这一层不用"学"，是把你已有的能力翻译到 AI 场景。
> 翻译好了，你就是市场上稀缺的那类人。

## 为什么这是优势而不是劣势

很多人转 AI 会下意识觉得"前端离模型太远"。但真实情况是：AI 产品的体验瓶颈几乎全在交互层——等待怎么表达、流式怎么渲染、错误怎么兜住、引用怎么溯源。这些恰恰是后端工程师最不擅长的部分。

你去面试时，如果对方问"你为什么觉得自己能做这个"，最有力的回答不是"我在学 RAG"，而是"我能把模型的不确定性做成用户敢用的界面，而这正好是现在大部分 AI 产品最烂的地方"。

## 流式渲染

- **流式文本渲染性能** <span class="prio prio-must">必须</span> — 每来一个 token 就 setState 会卡死。用 buffer + requestAnimationFrame 批量刷新。
- **Markdown 增量渲染** <span class="prio prio-must">必须</span> — 不完整的 Markdown（比如代码块没闭合）会导致渲染抖动。需要容错解析。
- **代码块流式高亮** <span class="prio prio-imp">重要</span> — 高亮开销大，要节流或等代码块结束后再高亮。
- **LaTeX / 表格渲染** <span class="prio prio-imp">重要</span> — 流式过程中的半截公式与表格要有降级显示。
- **生成中断 AbortController** <span class="prio prio-must">必须</span> — 用户点"停止"要真正中断请求，并保留已生成内容。
- **重新生成与编辑重发** <span class="prio prio-must">必须</span> — 重新生成要能切换版本，编辑重发要截断后续消息。
- **滚动跟随策略** <span class="prio prio-imp">重要</span> — 用户上滑查看历史时不能强制拉回底部，这是最常被做错的细节。

## 会话 UI

- **消息列表虚拟滚动** <span class="prio prio-must">必须</span> — 长会话几百条消息，不虚拟化直接卡。
- **多轮会话状态** <span class="prio prio-must">必须</span> — 会话切换、草稿保存、未读标记。
- **引用与溯源展示** <span class="prio prio-must">必须</span> — 点引用能定位到原文片段，这是 RAG 产品的信任基础。
- **工具调用过程可视化** <span class="prio prio-must">必须</span> — "正在搜索…""正在读取文件…"，让等待可解释。
- **思考过程展示** <span class="prio prio-imp">重要</span> — reasoning 内容折叠展示，兼顾透明度与简洁。
- **错误态与降级** <span class="prio prio-must">必须</span> — 模型超时、审核拦截、额度用尽，每种都要有明确文案与出路。
- **空态与引导** <span class="prio prio-must">必须</span> — AI 产品最大的流失点是"不知道能问什么"。用示例问题引导。
- **生成中的可编辑性** <span class="prio prio-imp">重要</span> — 边生成边让用户改，还是生成完再改？交互范式要提前定。
- **多版本答案对比** <span class="prio prio-opt">选学</span> — 重新生成的多个版本可横向对比，适合写作类场景。

## 输入与多模态

- **附件上传与预览** <span class="prio prio-must">必须</span> — 图片、PDF、表格、代码文件。上传后要能预览与删除。
- **前端文件解析** <span class="prio prio-imp">重要</span> — PDF.js 抽文本、图片压缩、超大文件分片。
- **拖拽与粘贴** <span class="prio prio-must">必须</span> — 粘贴截图直接上传，是高频刚需。
- **语音输入 ASR** <span class="prio prio-imp">重要</span> — 流式转写、静音检测、打断。
- **TTS 播放与打断** <span class="prio prio-imp">重要</span> — 边生成边播、用户说话时立即停。
- **实时语音对话 WebRTC** <span class="prio prio-opt">选学</span> — 端到端延迟要求 < 800ms，架构与文本完全不同。
- **图像理解结果展示** <span class="prio prio-opt">选学</span> — 边界框、区域标注、多图对比。
- **上传进度与失败重试** <span class="prio prio-imp">重要</span> — 大文件上传必须有进度与断点续传。

## 交互范式

- **从"点击"到"对话 + 确认"** <span class="prio prio-must">必须</span> — AI 产品不是纯聊天框。最佳实践是"对话负责意图，控件负责精确"。
- **Generative UI** <span class="prio prio-imp">重要</span> — 模型输出组件描述，前端渲染成真实控件。前沿方向。
- **结构化输出的表单化** <span class="prio prio-must">必须</span> — 让模型填表比让它写文章更可靠，也更易校验。
- **渐进式披露** <span class="prio prio-imp">重要</span> — 先给结论再给细节，别一上来铺满屏幕。
- **可访问性** <span class="prio prio-imp">重要</span> — 动态内容要能被屏幕阅读器正确播报，aria-live 的节奏要控。
- **快捷键与命令面板** <span class="prio prio-opt">选学</span> — 重度用户效率的关键，也是产品成熟度标志。
- **移动端适配** <span class="prio prio-imp">重要</span> — 软键盘弹起、长文本滚动、横竖屏切换，在对话场景里都是坑。

## 一个具体的技术建议

如果你只做一件事来证明这块能力，就做一个"流式渲染性能过关的对话界面"：1000 条消息不卡、边生成边滚动不抖、代码块高亮不闪、断网能续、错误有出路。这件事后端做不了，而它是所有 AI 产品的地基。
