/**
 * 走 GitHub Git Data API 发布 gh-pages。
 * 为什么不用 git push：本机 github.com:443 被干扰，但 api.github.com 可达。
 * 用法：GH_TOKEN=xxx node deploy-api.mjs <构建目录>
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const OWNER = '2385347602'
const REPO = 'ai-eng-roadmap'
const BRANCH = 'gh-pages'
const token = process.env.GH_TOKEN
if (!token) throw new Error('缺少 GH_TOKEN')

const root = process.argv[2]
if (!root) throw new Error('缺少构建目录参数')

const API = 'https://api.github.com'

async function api(path, init = {}, attempt = 1) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ai-eng-roadmap-deploy',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      return api(path, init, attempt + 1)
    }
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
  }
  return res.json()
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, base, out)
    else out.push(relative(base, full).split('\\').join('/'))
  }
  return out
}

const files = walk(root).sort()
console.log(`文件数：${files.length}`)

// 1. 当前 gh-pages 指向的提交
const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`)
const parentSha = ref.object.sha
console.log(`父提交：${parentSha.slice(0, 7)}`)

// 2. 上传 blob（限并发 6）
const entries = []
let cursor = 0
async function worker() {
  while (cursor < files.length) {
    const i = cursor++
    const rel = files[i]
    const content = readFileSync(join(root, rel)).toString('base64')
    const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content, encoding: 'base64' }),
    })
    entries.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha })
    if (entries.length % 40 === 0) console.log(`  已上传 ${entries.length}/${files.length}`)
  }
}
await Promise.all(Array.from({ length: 6 }, worker))
console.log(`blob 完成：${entries.length}`)

// 3. 建树（不给 base_tree = 完整替换）
const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({ tree: entries }),
})
console.log(`tree：${tree.sha.slice(0, 7)}`)

// 4. 建提交
const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({
    message: `deploy: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} 24 节课全部上线`,
    tree: tree.sha,
    parents: [parentSha],
  }),
})
console.log(`commit：${commit.sha.slice(0, 7)}`)

// 5. 移动分支
await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: true }),
})
console.log(`✓ ${BRANCH} 已更新到 ${commit.sha.slice(0, 7)}`)
