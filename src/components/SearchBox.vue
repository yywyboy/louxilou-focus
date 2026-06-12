<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { gsap } from 'gsap'
import { useEngines } from '../stores/engines'

const emit = defineEmits<{ focus: []; blur: []; hover: []; leave: [] }>()
const { getIcon, engines, setActive, activeId, activeEngine } = useEngines()

const PROXY_URL = import.meta.env.VITE_SUGGEST_PROXY || '/api/suggest'

const query = ref('')
const suggestions = ref<string[]>([])
const selectedIndex = ref(-1)
const inputRef = ref<HTMLInputElement>()
const barRef = ref<HTMLElement>()
const wrapperRef = ref<HTMLElement>()
const isFocused = ref(false)
const isHovered = ref(false)
const showEngineList = ref(false)

let focusTimeline: gsap.core.Timeline | null = null
let isAnimating = false
let isSwitching = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let abortCtrl: AbortController | null = null

watch(query, (q) => {
  selectedIndex.value = -1
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!q.trim()) { suggestions.value = []; return }
  debounceTimer = setTimeout(() => fetchSuggestions(q), 300)
})

async function fetchSuggestions(q: string) {
  const engine = activeEngine.value
  if (!engine.suggestUrl) { suggestions.value = []; return }

  abortCtrl?.abort()
  abortCtrl = new AbortController()

  const url = PROXY_URL
    ? `${PROXY_URL}?engine=${engine.id}&q=${encodeURIComponent(q)}`
    : engine.suggestUrl + encodeURIComponent(q)

  try {
    const res = await fetch(url, { signal: abortCtrl.signal })
    if (!res.ok) { suggestions.value = []; return }
    const data = await res.json()
    if (Array.isArray(data) && Array.isArray(data[1])) {
      suggestions.value = data[1].slice(0, 6)
    } else if (data.s && Array.isArray(data.s)) {
      suggestions.value = data.s.slice(0, 6)
    } else if (data.result && data.result.tag && Array.isArray(data.result.tag)) {
      suggestions.value = data.result.tag.map((t: any) => t.value || t.term).slice(0, 6)
    } else {
      suggestions.value = []
    }
  } catch {
    suggestions.value = []
  }
}

function handleClickOutside(e: MouseEvent) {
  if (!isFocused.value) return
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    doBlur()
  }
}

function handleGlobalKey(e: KeyboardEvent) {
  if (isFocused.value || isAnimating) return
  if (e.key === 'Escape') return
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault()
      doFocus()
    }
  }
}

function handleGlobalEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFocused.value) doBlur()
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleGlobalKey)
  document.addEventListener('keydown', handleGlobalEsc)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleGlobalKey)
  document.removeEventListener('keydown', handleGlobalEsc)
})

function doFocus() {
  if (isFocused.value || isAnimating) return
  isFocused.value = true
  isAnimating = true
  emit('focus')

  nextTick(() => {
    inputRef.value?.focus()
    const bar = barRef.value
    if (!bar) { isAnimating = false; return }

    const engineEl = bar.querySelector('.engine-anim') as HTMLElement
    const engineName = bar.querySelector('.engine-name') as HTMLElement

    gsap.set(engineEl, { x: -20, opacity: 0 })
    if (engineName) gsap.set(engineName, { opacity: 0 })

    const tl = gsap.timeline({ onComplete: () => { isAnimating = false } })
    tl.to(engineEl, { x: 0, opacity: 1, duration: 0.25, ease: 'power2.out' })
    if (engineName) {
      tl.to(engineName, { opacity: 1, duration: 0.2, ease: 'power2.out' }, 0)
      tl.to(engineName, { opacity: 0, duration: 0.3, ease: 'power2.in' }, '+=0.5')
    }

    focusTimeline = tl
  })
}

function doBlur() {
  isFocused.value = false
  isHovered.value = false
  isAnimating = false
  query.value = ''
  suggestions.value = []
  selectedIndex.value = -1
  showEngineList.value = false
  emit('blur')
  inputRef.value?.blur()

  focusTimeline?.kill()
  focusTimeline = null

  const bar = barRef.value
  if (bar) {
    const engineEl = bar.querySelector('.engine-anim') as HTMLElement
    if (engineEl) gsap.set(engineEl, { opacity: 0, x: -20 })
  }
}

defineExpose({ doFocus, doBlur, isFocused })

function onSearch(term?: string) {
  const q = term ?? query.value
  if (!q.trim()) return
  window.open(activeEngine.value.searchUrl + encodeURIComponent(q), '_blank')
}

function selectSuggestion(s: string) {
  query.value = s
  suggestions.value = []
  onSearch(s)
}

function switchEngine(id: string) {
  if (isSwitching) return
  const bar = barRef.value
  if (!bar) { setActive(id); showEngineList.value = false; return }

  const engineIcon = bar.querySelector('.engine-icon') as HTMLElement
  const engineName = bar.querySelector('.engine-name') as HTMLElement
  if (!engineIcon) { setActive(id); showEngineList.value = false; return }

  isSwitching = true

  gsap.to([engineIcon, engineName], {
    y: -12, opacity: 0, duration: 0.15, ease: 'power2.in',
    onComplete: () => {
      setActive(id)
      nextTick(() => {
        gsap.set([engineIcon, engineName], { y: 12, opacity: 0 })
        gsap.to([engineIcon, engineName], {
          y: 0, opacity: 1, duration: 0.2, ease: 'power2.out',
          onComplete: () => {
            isSwitching = false
            gsap.to(engineName, { opacity: 0, duration: 0.3, ease: 'power2.in', delay: 0.5 })
          },
        })
      })
    },
  })

  showEngineList.value = false
}

function toggleEngineList() {
  showEngineList.value = !showEngineList.value
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (suggestions.value.length > 0) {
      selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (selectedIndex.value >= 0 && selectedIndex.value < suggestions.value.length) {
      selectSuggestion(suggestions.value[selectedIndex.value])
    } else {
      onSearch()
    }
  } else if (e.key === 'Escape') {
    if (suggestions.value.length > 0) {
      suggestions.value = []
      selectedIndex.value = -1
    } else {
      doBlur()
    }
  } else if (e.altKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault()
    const i = parseInt(e.key) - 1
    if (i < engines.value.length) switchEngine(engines.value[i].id)
  }
}
</script>

<template>
  <div ref="wrapperRef" class="search-wrapper">
    <div
      ref="barRef"
      class="search-bar"
      :class="{ 'is-focused': isFocused, 'is-hovered': isHovered }"
      @click="doFocus"
      @mouseenter="isHovered = true; emit('hover')"
      @mouseleave="isHovered = false; emit('leave')"
    >
      <!-- Engine icon + name -->
      <div class="engine-anim">
        <button class="engine-btn" :title="activeEngine.name" @click.stop="toggleEngineList">
          <div class="engine-icon" v-html="getIcon(activeEngine.id)"></div>
        </button>
        <span class="engine-name">{{ activeEngine.name }}</span>
      </div>

      <span class="search-text">搜索</span>

      <input
        ref="inputRef"
        v-model="query"
        class="search-input"
        role="combobox"
        :aria-expanded="suggestions.length > 0"
        aria-haspopup="listbox"
        @keydown="onKeyDown"
      />

      <button class="search-icon-btn" :class="{ 'is-active': isHovered || isFocused }" @click.stop="onSearch()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </div>

    <!-- Engine list dropdown -->
    <Transition name="dropdown">
      <div v-if="showEngineList && isFocused" class="engine-list glass">
        <button
          v-for="(eng, i) in engines"
          :key="eng.id"
          class="engine-item"
          :class="{ active: eng.id === activeId }"
          @click="switchEngine(eng.id)"
        >
          <span class="engine-item-icon" v-html="getIcon(eng.id)"></span>
          <span class="engine-item-name">{{ eng.name }}</span>
          <span class="engine-item-key">Alt+{{ i + 1 }}</span>
        </button>
      </div>
    </Transition>

    <!-- Suggestions dropdown -->
    <Transition name="dropdown">
      <div v-if="suggestions.length > 0 && isFocused && !showEngineList" class="suggestions glass" role="listbox">
        <button
          v-for="(s, i) in suggestions"
          :key="i"
          class="suggestion-item"
          :class="{ selected: i === selectedIndex }"
          role="option"
          :aria-selected="i === selectedIndex"
          @click="selectSuggestion(s)"
          @mouseenter="selectedIndex = i"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>{{ s }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.search-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 600px;
}

.search-bar {
  position: relative;
  width: 200px;
  height: 40px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 0.5px solid rgba(255, 255, 255, 0.15);
  cursor: text;
  overflow: hidden;
  transition: width 0.4s var(--ease), height 0.4s var(--ease), border-radius 0.4s var(--ease),
    background 0.3s var(--ease), border-color 0.3s var(--ease);
}

.search-bar.is-hovered {
  width: 100%;
  height: 48px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.35);
}

.search-bar.is-focused {
  width: 100%;
  height: 48px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.3);
}

.engine-anim {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  opacity: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.engine-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
  position: relative;
}

.engine-btn:hover { background: rgba(0, 0, 0, 0.06); }

.engine-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity;
}

.engine-name {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  pointer-events: none;
  will-change: transform, opacity;
}

.search-text {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 14px;
  color: white;
  opacity: 0.8;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
  transition: opacity 0.3s ease, filter 0.3s ease;
}

.search-bar.is-hovered .search-text,
.search-bar.is-focused .search-text {
  opacity: 0;
  filter: blur(8px);
}

.search-input {
  width: 100%;
  height: 100%;
  background: transparent;
  font-size: 16px;
  color: white;
  text-align: center;
  padding: 0 48px;
  z-index: 1;
  caret-color: transparent;
}

.search-input::placeholder { color: rgba(255, 255, 255, 0.4); }

.search-bar.is-focused .search-input {
  color: #1a1a1a;
  caret-color: #1a1a1a;
}

.search-bar.is-focused .search-input::placeholder { color: rgba(0, 0, 0, 0.3); }

.search-icon-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  pointer-events: auto;
  transition: background 0.15s;
}

.search-icon-btn:hover { background: rgba(255, 255, 255, 0.15); }
.search-icon-btn.is-active { stroke: #1a1a1a; }
.search-icon-btn.is-active:hover { background: rgba(0, 0, 0, 0.06); }
.search-icon-btn.is-active svg { stroke: #1a1a1a; }

/* Engine list */
.engine-list {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  border-radius: var(--radius);
  padding: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.engine-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  transition: background 0.1s;
}

.engine-item:hover { background: var(--bg-hover); }
.engine-item.active { background: rgba(0, 122, 255, 0.08); color: var(--accent); }

.engine-item-icon { display: flex; align-items: center; }
.engine-item-name { flex: 1; }
.engine-item-key { font-size: 11px; color: var(--ink-ghost); }

/* Suggestions */
.suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  border-radius: var(--radius);
  padding: 6px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--ink-dim);
  transition: background 0.1s;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background: var(--bg-hover);
  color: var(--ink);
}

.dropdown-enter-active { transition: all 0.2s var(--ease); }
.dropdown-leave-active { transition: all 0.15s ease; }
.dropdown-enter-from { opacity: 0; transform: translateY(-8px); }
.dropdown-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
