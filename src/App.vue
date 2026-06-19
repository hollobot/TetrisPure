<script setup>
// ============================================================
// 应用根组件（UI 层 + 输入处理）
// 负责：装配逻辑层与渲染层、键盘/触控输入分发、外围 UI 与状态展示。
// 所有玩法逻辑都委托给 useTetris，UI 仅读取状态、调用动作。
// ============================================================
import { onMounted, onUnmounted, computed } from 'vue'
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX,
  ArrowLeft, ArrowRight, ArrowDown, ChevronsDown
} from 'lucide-vue-next'
import GameCanvas from './components/GameCanvas.vue'
import NextPreview from './components/NextPreview.vue'
import { useTetris } from './game/useTetris.js'
import { useAudio } from './composables/useAudio.js'
import { DIFFICULTIES } from './game/constants.js'

const audio = useAudio()
const game = useTetris(audio)
const { state } = game

// 难度选项（用于难度选择按钮渲染）
const difficultyList = Object.entries(DIFFICULTIES).map(([key, v]) => ({
  key,
  label: v.label
}))

// 是否处于「待开始 / 已结束」可重新选择难度的状态
const canChooseDifficulty = computed(
  () => state.status === 'idle' || state.status === 'gameover'
)

// 选择难度（仅在未开始时允许切换偏好）
function chooseDifficulty(key) {
  if (!canChooseDifficulty.value) return
  state.difficulty = key
}

// ---------------- 键盘输入 ----------------
function onKeyDown(e) {
  // 暂停 / 继续（游戏中或暂停时均可触发）
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (state.status === 'playing' || state.status === 'paused') game.togglePause()
    return
  }
  if (state.status !== 'playing') return

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      game.moveLeft()
      break
    case 'ArrowRight':
      e.preventDefault()
      game.moveRight()
      break
    case 'ArrowDown':
      e.preventDefault()
      game.softDrop()
      break
    case 'ArrowUp':
    case 'x':
    case 'X':
      e.preventDefault()
      if (!e.repeat) game.rotate(1) // 顺时针，忽略长按重复
      break
    case 'z':
    case 'Z':
    case 'Control':
      e.preventDefault()
      if (!e.repeat) game.rotate(-1) // 逆时针
      break
    case ' ':
      e.preventDefault()
      if (!e.repeat) game.hardDrop() // 硬降，避免长按连发
      break
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-6 px-4 select-none">
    <h1 class="text-2xl font-bold tracking-widest mb-5 text-cyan-300">TETRIS PURE</h1>

    <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
      <!-- 游戏主画布 + 暂停遮罩 -->
      <div class="relative">
        <GameCanvas :state="state" :get-ghost-y="game.getGhostY" />

        <!-- 暂停遮罩 -->
        <div
          v-if="state.status === 'paused'"
          class="absolute inset-0 flex items-center justify-center bg-slate-950/70 rounded-lg"
        >
          <span class="text-xl font-semibold tracking-wider">已暂停</span>
        </div>

        <!-- 游戏结束弹窗 -->
        <div
          v-if="state.status === 'gameover'"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 rounded-lg"
        >
          <span class="text-2xl font-bold text-rose-400">游戏结束</span>
          <div class="text-center text-sm text-slate-300">
            <p>本次得分：<span class="text-cyan-300 font-semibold">{{ state.score }}</span></p>
            <p>历史最高：<span class="text-amber-300 font-semibold">{{ state.highScore }}</span></p>
          </div>
          <button
            class="mt-2 flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 transition"
            @click="game.restart()"
          >
            <RotateCcw :size="18" /> 再来一局
          </button>
        </div>
      </div>

      <!-- 右侧信息面板与控制菜单 -->
      <div class="w-56 flex flex-col gap-4">
        <!-- 下一方块预览 -->
        <div class="bg-slate-900/60 rounded-lg p-3 ring-1 ring-white/10">
          <p class="text-xs text-slate-400 mb-2">下一个</p>
          <div class="flex justify-center">
            <NextPreview :next="state.next" />
          </div>
        </div>

        <!-- 计分信息 -->
        <div class="bg-slate-900/60 rounded-lg p-3 ring-1 ring-white/10 space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-slate-400">分数</span><span class="font-semibold text-cyan-300">{{ state.score }}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">等级</span><span class="font-semibold">{{ state.level }}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">消除行</span><span class="font-semibold">{{ state.lines }}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">最高分</span><span class="font-semibold text-amber-300">{{ state.highScore }}</span></div>
        </div>

        <!-- 难度选择（仅待开始 / 结束时可改） -->
        <div class="bg-slate-900/60 rounded-lg p-3 ring-1 ring-white/10">
          <p class="text-xs text-slate-400 mb-2">难度</p>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="d in difficultyList"
              :key="d.key"
              class="py-1.5 rounded text-sm transition"
              :class="[
                state.difficulty === d.key ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
                !canChooseDifficulty && 'opacity-50 cursor-not-allowed'
              ]"
              :disabled="!canChooseDifficulty"
              @click="chooseDifficulty(d.key)"
            >
              {{ d.label }}
            </button>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="flex flex-col gap-2">
          <button
            v-if="state.status === 'idle' || state.status === 'gameover'"
            class="flex items-center justify-center gap-2 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 transition"
            @click="game.start()"
          >
            <Play :size="18" /> 开始游戏
          </button>

          <button
            v-if="state.status === 'playing' || state.status === 'paused'"
            class="flex items-center justify-center gap-2 py-2 rounded-md bg-slate-700 hover:bg-slate-600 transition"
            @click="game.togglePause()"
          >
            <component :is="state.status === 'paused' ? Play : Pause" :size="18" />
            {{ state.status === 'paused' ? '继续' : '暂停' }}
          </button>

          <button
            v-if="state.status === 'playing' || state.status === 'paused'"
            class="flex items-center justify-center gap-2 py-2 rounded-md bg-slate-700 hover:bg-slate-600 transition"
            @click="game.restart()"
          >
            <RotateCcw :size="18" /> 重新开始
          </button>

          <button
            class="flex items-center justify-center gap-2 py-2 rounded-md bg-slate-800 hover:bg-slate-700 transition"
            @click="audio.toggle()"
          >
            <component :is="audio.enabled.value ? Volume2 : VolumeX" :size="18" />
            音效：{{ audio.enabled.value ? '开' : '关' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 移动端触控操作（仅小屏显示）。pointerdown 覆盖触摸与鼠标。 -->
    <div class="md:hidden mt-6 w-full max-w-xs grid grid-cols-3 gap-3">
      <button class="touch-btn" @pointerdown.prevent="game.moveLeft()"><ArrowLeft :size="22" /></button>
      <button class="touch-btn" @pointerdown.prevent="game.rotate(1)"><RotateCw :size="22" /></button>
      <button class="touch-btn" @pointerdown.prevent="game.moveRight()"><ArrowRight :size="22" /></button>
      <button class="touch-btn" @pointerdown.prevent="game.softDrop()"><ArrowDown :size="22" /></button>
      <button class="touch-btn" @pointerdown.prevent="game.hardDrop()"><ChevronsDown :size="22" /></button>
      <button class="touch-btn" @pointerdown.prevent="game.togglePause()"><Pause :size="22" /></button>
    </div>

    <!-- 操作说明 -->
    <div class="mt-6 text-xs text-slate-500 text-center leading-relaxed">
      <p>← → 移动 ｜ ↑ / X 顺时针 ｜ Z 逆时针 ｜ ↓ 软降 ｜ 空格 硬降 ｜ P / Esc 暂停</p>
    </div>
  </div>
</template>

<style scoped>
/* 移动端触控按钮统一样式 */
.touch-btn {
  @apply flex items-center justify-center py-4 rounded-lg bg-slate-800 active:bg-cyan-600 transition;
}
</style>
