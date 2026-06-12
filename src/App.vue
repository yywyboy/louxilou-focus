<script setup lang="ts">
import { ref } from 'vue'
import { gsap } from 'gsap'
import SearchBox from './components/SearchBox.vue'

const searchRef = ref<InstanceType<typeof SearchBox>>()
const searchFocused = ref(false)
const bgRef = ref<HTMLElement>()

function onSearchHover() {
  if (bgRef.value) {
    gsap.to(bgRef.value, { scale: 1.05, duration: 0.6, ease: 'power2.out' })
  }
}

function onSearchLeave() {
  if (!searchFocused.value && bgRef.value) {
    gsap.to(bgRef.value, { scale: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' })
  }
}

function onSearchFocus() {
  searchFocused.value = true
  if (bgRef.value) {
    gsap.to(bgRef.value, { scale: 1.05, filter: 'blur(8px)', duration: 0.6, ease: 'power2.out' })
  }
}

function onSearchBlur() {
  searchFocused.value = false
  if (bgRef.value) {
    gsap.to(bgRef.value, { scale: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' })
  }
}
</script>

<template>
  <div class="focus-app">
    <div ref="bgRef" class="bg"></div>
    <div class="main">
      <SearchBox ref="searchRef" @hover="onSearchHover" @leave="onSearchLeave" @focus="onSearchFocus" @blur="onSearchBlur" />
    </div>
  </div>
</template>

<style scoped>
.focus-app {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.bg {
  position: absolute;
  inset: 0;
  background: var(--bg) url('/bg.jpg') center / cover no-repeat;
  transform-origin: center;
  will-change: transform, filter;
}

.main {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
