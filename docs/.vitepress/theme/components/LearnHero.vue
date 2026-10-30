<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <div class="learn-hero">
    <div class="learn-hero-kicker">交互式学习平台</div>
    <h1 class="learn-hero-title">在这里真的学会，而不是看完</h1>
    <p class="learn-hero-sub">
      每节课都有完整正文、分步讲解、可运行沙箱、逐级提示和掌握测试。
      进度、错题、笔记存在本地，刷新不丢。<strong>没通过测试，不算掌握。</strong>
    </p>
    <div class="learn-hero-links">
      <a class="learn-hero-a" :href="withBase('/learn/01-http-lifecycle')">开始学习第一课 →</a>
      <a class="learn-hero-b" :href="withBase('/learn/review')">错题本与笔记</a>
      <a class="learn-hero-b" :href="withBase('/guide/00-orientation')">知识地图</a>
    </div>
  </div>
</template>
