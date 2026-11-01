/**
 * 用 GitHub Contents API 提交单个文件（github.com:443 不通时的兜底）。
 * 用法：GH_TOKEN=xxx node scripts/put-file.mjs <本地路径> <仓库内路径> [分支]
 */
import { readFileSync } from 'node:fs'

const OWNER = '2385347602'
const REPO = 'ai-eng-roadmap'
const token = process.env.GH_TOKEN
if (!token) throw new Error('缺少 GH_TOKEN')

const [localPath, repoPath, branch = 'main'] = process.argv.slice(2)
if (!localPath || !repoPath) throw new Error('用法：put-file.mjs <本地路径> <仓库内路径> [分支]')

const H = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'ai-eng-roadmap-deploy',
}
const base = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${repoPath}`

// 已存在就要带上 sha，否则 422
let sha
const cur = await fetch(`${base}?ref=${branch}`, { headers: H })
if (cur.ok) sha = (await cur.json()).sha

const res = await fetch(base, {
  method: 'PUT',
  headers: H,
  body: JSON.stringify({
    message: `chore: 更新 ${repoPath}`,
    content: readFileSync(localPath).toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  }),
})
if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`)
const out = await res.json()
console.log(`✓ ${repoPath} → ${out.commit.sha.slice(0, 7)}`)
