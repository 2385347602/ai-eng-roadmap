/**
 * 极简行内标记渲染：**粗体** 和 `代码`
 *
 * 先转义 HTML 再替换，避免课程内容里的尖括号被当成标签。
 * 课程内容是我们自己写的数据，不是用户输入，但仍然走转义。
 */
export function inline(text: string): string {
  const escaped = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}
