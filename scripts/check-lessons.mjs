/**
 * 课程内容门禁：逐节课真实执行模块，抓 esbuild 抓不到的错。
 *
 * 为什么需要它：单引号字符串里嵌 `'%work%'` 这类写法，esbuild 会当成取模运算
 * 正常编译，直到运行时才炸 `work is not defined`。语法检查不够，必须真跑。
 *
 * 用法：npm run check:lessons
 */
import { readdirSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = resolve(root, 'docs/.vitepress/theme/course')
const tmpDir = resolve(root, 'node_modules/.lessons-check')

rmSync(tmpDir, { recursive: true, force: true })
mkdirSync(tmpDir, { recursive: true })

const files = readdirSync(srcDir)
  .filter((f) => /^lesson-\d+\.ts$/.test(f))
  .sort()

let bad = 0
for (const f of files) {
  const out = resolve(tmpDir, f.replace('.ts', '.mjs'))
  try {
    await build({
      entryPoints: [resolve(srcDir, f)],
      outfile: out,
      format: 'esm',
      bundle: false,
      logLevel: 'silent',
    })
  } catch (e) {
    const msg = (e.errors ?? [])
      .map((x) => `${x.location?.line}:${x.location?.column} ${x.text}`)
      .join(' | ')
    console.log(`SYNTAX ${f}: ${msg || e.message}`)
    bad++
    continue
  }

  try {
    const mod = await import(`file://${out.replace(/\\/g, '/')}?t=${Date.now()}`)
    const key = Object.keys(mod).find((k) => k.startsWith('lesson'))
    const l = mod[key]
    if (!l || !l.id) throw new Error('没找到 lesson 导出')

    const flags = []
    if (!l.path?.startsWith('/learn/')) flags.push('path 不合法')
    if (!l.title || !l.outcome) flags.push('缺 title/outcome')
    if (l.steps.length < 5) flags.push(`steps=${l.steps.length} (<5)`)
    if (!l.exercises.every((e) => e.hints?.length === 3)) flags.push('有练习不是三级提示')
    if (!l.test || l.test.questions.length < 5) flags.push('掌握测试少于 5 题')
    if (!l.test || l.test.passScore < 60) flags.push('passScore 过低')

    // 编程题的 starter 必须有一句顶层 return，否则沙箱拿不到函数/结果
    for (const e of l.exercises.filter((x) => x.type === 'code')) {
      if (!/^return\b/m.test(e.starter ?? '')) {
        flags.push(`${e.id} 的 starter 没有顶层 return`)
      }
      if (!e.checks?.length) flags.push(`${e.id} 没有 checks`)
    }

    if (flags.length) {
      console.log(`WARN ${f}: ${flags.join('; ')}`)
      bad++
    }
  } catch (e) {
    console.log(`EVAL ${f}: ${e.message}`)
    bad++
  }
}

rmSync(tmpDir, { recursive: true, force: true })

if (bad === 0) {
  console.log(`✓ ${files.length} 节课全部通过`)
  process.exit(0)
} else {
  console.log(`✗ ${bad}/${files.length} 节课有问题`)
  process.exit(1)
}
