import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'
import './learn.css'

import LessonPlayer from './components/LessonPlayer.vue'
import LearnDashboard from './components/LearnDashboard.vue'
import LearnHero from './components/LearnHero.vue'
import ReviewBook from './components/ReviewBook.vue'
import BlockView from './components/BlockView.vue'
import ExerciseCard from './components/ExerciseCard.vue'
import MasteryTest from './components/MasteryTest.vue'
import CodeSandbox from './components/CodeSandbox.vue'
import NoteBox from './components/NoteBox.vue'
import AiTutor from './components/AiTutor.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 全局注册，这样 markdown 页面里可以直接写 <LessonPlayer :lesson="lesson01" />
    app.component('LessonPlayer', LessonPlayer)
    app.component('LearnDashboard', LearnDashboard)
    app.component('LearnHero', LearnHero)
    app.component('ReviewBook', ReviewBook)
    app.component('BlockView', BlockView)
    app.component('ExerciseCard', ExerciseCard)
    app.component('MasteryTest', MasteryTest)
    app.component('CodeSandbox', CodeSandbox)
    app.component('NoteBox', NoteBox)
    app.component('AiTutor', AiTutor)
  },
} satisfies Theme
