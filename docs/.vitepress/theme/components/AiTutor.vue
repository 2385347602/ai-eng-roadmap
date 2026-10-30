<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { state, loadProgress, updateSettings } from '../course/progress'

/**
 * AI 导师
 *
 * 诚实原则：
 * - 没有配置模型服务时，明确显示"未配置"，并给出配置步骤
 * - 绝不伪造回答，绝不在前端硬编码或保存 API Key
 * - Key 只存在后端进程的环境变量里，前端只拿 endpoint 地址
 */
const props = defineProps<{
  lessonId: string
  lessonTitle: string
  stepTitle: string
}>()

type Status = 'checking' | 'ready' | 'unconfigured' | 'offline'

const status = ref<Status>('checking')
const statusDetail = ref('')
const open = ref(false)
const question = ref('')
const answer = ref('')
const streaming = ref(false)
const errorMsg = ref('')
const showSetup = ref(false)
const endpointInput = ref('')

const endpoint = computed(() => state.settings.tutorEndpoint)

onMounted(async () => {
  loadProgress()
  endpointInput.value = endpoint.value
  await probe()
})

async function probe() {
  status.value = 'checking'
  statusDetail.value = ''
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(endpoint.value.replace(/\/$/, '') + '/api/health', {
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) throw new Error('bad status ' + res.status)
    const data = await res.json()
    if (data.configured) {
      status.value = 'ready'
      statusDetail.value = data.model ? `模型：${data.model}` : ''
    } else {
      status.value = 'unconfigured'
      statusDetail.value = data.hint || '服务已启动，但没有配置模型 API Key'
    }
  } catch {
    status.value = 'offline'
    statusDetail.value = '连不上导师服务（默认 http://127.0.0.1:8787）'
  }
}

function saveEndpoint() {
  updateSettings({ tutorEndpoint: endpointInput.value.trim() || 'http://127.0.0.1:8787' })
  probe()
}

const modes = [
  { id: 'explain', label: '换个说法再讲一遍' },
  { id: 'deeper', label: '再深入一层' },
  { id: 'example', label: '给个 Vue 场景的例子' },
  { id: 'review', label: '审查我写的代码' },
]

const activeMode = ref('explain')

async function ask() {
  const q = question.value.trim()
  if (!q || streaming.value) return
  streaming.value = true
  answer.value = ''
  errorMsg.value = ''

  try {
    const res = await fetch(endpoint.value.replace(/\/$/, '') + '/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: activeMode.value,
        question: q,
        lessonId: props.lessonId,
        lessonTitle: props.lessonTitle,
        stepTitle: props.stepTitle,
      }),
    })

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '')
      throw new Error(txt || `HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      answer.value += decoder.decode(value, { stream: true })
    }
  } catch (e) {
    errorMsg.value =
      e instanceof Error ? e.message : '请求失败。检查导师服务是否在运行、以及是否配置了模型 Key。'
  } finally {
    streaming.value = false
  }
}

function quickAsk(mode: string) {
  activeMode.value = mode
  const preset: Record<string, string> = {
    explain: `请用更通俗的方式重讲这一步：${props.stepTitle}`,
    deeper: `这一步背后还有哪些我没看到的细节？请往深一层讲：${props.stepTitle}`,
    example: `请用一个 Vue3 前端工程师熟悉的场景举例说明：${props.stepTitle}`,
    review: '我想贴一段代码请你审查，请先告诉我需要提供哪些信息。',
  }
  question.value = preset[mode] || ''
}
</script>

<template>
  <section class="tutor">
    <button class="tutor-head" @click="open = !open">
      <span class="tutor-title">AI 导师</span>
      <span class="tutor-status" :class="status">
        {{
          status === 'ready'
            ? '已连接'
            : status === 'checking'
              ? '检查中…'
              : status === 'unconfigured'
                ? '未配置模型'
                : '未启动'
        }}
      </span>
      <span class="tutor-arrow">{{ open ? '收起' : '展开' }}</span>
    </button>

    <div v-if="open" class="tutor-body">
      <!-- 未就绪时的诚实提示 -->
      <div v-if="status !== 'ready'" class="tutor-setup">
        <p class="tutor-setup-title">
          {{ status === 'offline' ? '导师服务没有启动' : status === 'unconfigured' ? '导师服务已启动，但缺少模型 Key' : '正在检查导师服务…' }}
        </p>
        <p class="tutor-setup-desc">
          这个功能需要你自己跑一个本地代理服务。Key 只存在服务端的环境变量里，浏览器拿不到，
          也不会被写进 localStorage —— 这是唯一安全的做法，把 Key 放前端等于公开它。
        </p>

        <button class="tutor-link" @click="showSetup = !showSetup">
          {{ showSetup ? '收起配置步骤' : '怎么配置？（3 步）' }}
        </button>

        <div v-if="showSetup" class="tutor-steps">
          <ol>
            <li>
              在项目根目录执行
              <code>node server/tutor.mjs</code>
            </li>
            <li>
              启动前设置环境变量：
              <code>OPENAI_API_KEY=sk-...</code>（也支持
              <code>OPENAI_BASE_URL</code> 指向兼容接口）
            </li>
            <li>回到这里点"重新检测"</li>
          </ol>
          <div class="tutor-endpoint">
            <label>服务地址</label>
            <input v-model="endpointInput" spellcheck="false" />
            <button @click="saveEndpoint">保存并重试</button>
          </div>
          <p class="tutor-setup-note">
            注意：当前页面是静态站点，没有后端。导师功能是**可选增强**，不配置也完全不影响学习——
            正文、练习、判分、进度都不依赖它。
          </p>
        </div>
      </div>

      <!-- 已就绪 -->
      <template v-else>
        <div class="tutor-modes">
          <button
            v-for="m in modes"
            :key="m.id"
            class="tutor-mode"
            :class="{ active: activeMode === m.id }"
            @click="quickAsk(m.id)"
          >
            {{ m.label }}
          </button>
        </div>

        <textarea
          v-model="question"
          class="tutor-input"
          rows="3"
          placeholder="针对「{{ stepTitle }}」提问。比如：为什么这里必须是 Buffer 而不是字符串？"
        />

        <div class="tutor-actions">
          <button class="tutor-ask" :disabled="!question.trim() || streaming" @click="ask">
            {{ streaming ? '回答中…' : '提问' }}
          </button>
          <span class="tutor-hint">{{ statusDetail }}</span>
        </div>

        <div v-if="answer" class="tutor-answer">
          <div class="tutor-answer-label">导师回答</div>
          <pre class="tutor-answer-body">{{ answer }}</pre>
        </div>
        <p v-if="errorMsg" class="tutor-err">{{ errorMsg }}</p>

        <p class="tutor-warn">
          导师的回答可能有错。它的定位是"换个角度解释"，不是"权威答案"。
          凡是和你自己动手跑出来的结果冲突，以运行结果为准。
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.tutor {
  margin: 32px 0 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 11px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.tutor-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--vp-c-text-1);
}
.tutor-title { font-size: 14.5px; font-weight: 700; }
.tutor-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-3);
}
.tutor-status.ready { color: #10b981; border-color: rgba(16, 185, 129, 0.5); }
.tutor-status.unconfigured { color: #f59e0b; border-color: rgba(245, 158, 11, 0.5); }
.tutor-status.offline { color: var(--vp-c-text-3); }
.tutor-arrow { margin-left: auto; font-size: 12px; color: var(--vp-c-text-3); }

.tutor-body { padding: 0 16px 16px; border-top: 1px solid var(--vp-c-divider); }

.tutor-setup { padding-top: 14px; }
.tutor-setup-title { margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #f59e0b; }
.tutor-setup-desc { margin: 0 0 12px; font-size: 13.5px; line-height: 1.8; color: var(--vp-c-text-2); }
.tutor-link {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px dashed var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-brand-1);
  font-size: 12.5px;
  cursor: pointer;
}
.tutor-steps { margin-top: 14px; }
.tutor-steps ol { margin: 0 0 12px; padding-left: 20px; font-size: 13.5px; line-height: 2; }
.tutor-steps code {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  background: var(--vp-code-bg);
  padding: 2px 5px;
  border-radius: 4px;
}
.tutor-endpoint { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tutor-endpoint label { font-size: 12.5px; color: var(--vp-c-text-3); }
.tutor-endpoint input {
  flex: 1;
  min-width: 180px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 12.5px;
  font-family: var(--vp-font-family-mono);
}
.tutor-endpoint button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 0;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 12.5px;
  cursor: pointer;
}
.tutor-setup-note { margin: 12px 0 0; font-size: 12px; line-height: 1.75; color: var(--vp-c-text-3); }

.tutor-modes { display: flex; gap: 7px; flex-wrap: wrap; padding: 14px 0 10px; }
.tutor-mode {
  padding: 5px 11px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12.5px;
  cursor: pointer;
}
.tutor-mode.active { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }

.tutor-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13.5px;
  line-height: 1.7;
  font-family: inherit;
  resize: vertical;
  outline: none;
}
.tutor-input:focus { border-color: var(--vp-c-brand-1); }

.tutor-actions { display: flex; align-items: center; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
.tutor-ask {
  padding: 8px 18px;
  border-radius: 7px;
  border: 0;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
.tutor-ask:disabled { opacity: 0.45; cursor: not-allowed; }
.tutor-hint { font-size: 11.5px; color: var(--vp-c-text-3); }

.tutor-answer { margin-top: 14px; }
.tutor-answer-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  margin-bottom: 6px;
}
.tutor-answer-body {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  font-size: 13.5px;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  color: var(--vp-c-text-1);
}
.tutor-err { margin: 10px 0 0; font-size: 13px; color: #ef4444; }
.tutor-warn { margin: 14px 0 0; font-size: 11.5px; line-height: 1.7; color: var(--vp-c-text-3); }
</style>
