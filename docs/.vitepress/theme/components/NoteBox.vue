<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { state, saveNote, removeNote, loadProgress } from '../course/progress'

const props = defineProps<{
  lessonId: string
  stepId: string
  stepTitle: string
}>()

const text = ref('')
const open = ref(false)

onMounted(() => loadProgress())

const myNotes = computed(() => state.notes.filter((n) => n.lessonId === props.lessonId))

function save() {
  const t = text.value.trim()
  if (!t) return
  saveNote({
    lessonId: props.lessonId,
    stepId: props.stepId,
    stepTitle: props.stepTitle,
    text: t,
  })
  text.value = ''
}

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <section class="nb">
    <button class="nb-head" @click="open = !open">
      <span class="nb-title">学习笔记</span>
      <span class="nb-count">{{ myNotes.length }} 条 · {{ open ? '收起' : '展开' }}</span>
    </button>

    <div v-if="open" class="nb-body">
      <p class="nb-tip">
        笔记会挂在这一步上（{{ stepTitle }}），和错题本一起存在本地。
        建议只记"我原来理解错了什么"，不要抄正文——抄一遍不会让你记住。
      </p>
      <textarea
        v-model="text"
        class="nb-input"
        rows="3"
        placeholder="例：我一直以为 res.end() 只是结束响应，其实它才是真正把响应发出去的动作。"
      />
      <div class="nb-actions">
        <button class="nb-save" :disabled="!text.trim()" @click="save">保存笔记</button>
      </div>

      <ul v-if="myNotes.length" class="nb-list">
        <li v-for="n in myNotes" :key="n.id" class="nb-item">
          <div class="nb-item-head">
            <span class="nb-step">{{ n.stepTitle }}</span>
            <span class="nb-time">{{ fmt(n.at) }}</span>
            <button class="nb-del" @click="removeNote(n.id)">删除</button>
          </div>
          <p class="nb-text">{{ n.text }}</p>
        </li>
      </ul>
      <p v-else class="nb-empty">还没有笔记。</p>
    </div>
  </section>
</template>

<style scoped>
.nb {
  margin: 36px 0 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 11px;
  overflow: hidden;
}
.nb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: var(--vp-c-bg-soft);
  border: 0;
  cursor: pointer;
  color: var(--vp-c-text-1);
}
.nb-title { font-size: 14.5px; font-weight: 700; }
.nb-count { font-size: 12px; color: var(--vp-c-text-3); }

.nb-body { padding: 16px; border-top: 1px solid var(--vp-c-divider); }
.nb-tip { margin: 0 0 12px; font-size: 12.5px; line-height: 1.75; color: var(--vp-c-text-3); }
.nb-input {
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
.nb-input:focus { border-color: var(--vp-c-brand-1); }
.nb-actions { margin-top: 10px; }
.nb-save {
  padding: 7px 16px;
  border-radius: 7px;
  border: 0;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.nb-save:disabled { opacity: 0.45; cursor: not-allowed; }

.nb-list { list-style: none; margin: 18px 0 0; padding: 0; }
.nb-item {
  padding: 11px 0;
  border-top: 1px solid var(--vp-c-divider);
}
.nb-item-head { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
.nb-step { font-size: 11.5px; color: var(--vp-c-brand-1); font-weight: 600; }
.nb-time { font-size: 11px; color: var(--vp-c-text-3); }
.nb-del {
  margin-left: auto;
  font-size: 11px;
  color: var(--vp-c-text-3);
  background: transparent;
  border: 0;
  cursor: pointer;
}
.nb-del:hover { color: #ef4444; }
.nb-text { margin: 0; font-size: 13.5px; line-height: 1.8; color: var(--vp-c-text-1); }
.nb-empty { margin: 16px 0 0; font-size: 12.5px; color: var(--vp-c-text-3); }
</style>
