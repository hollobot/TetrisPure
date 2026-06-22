<script setup>
// ============================================================
// 应用根组件（UI 层 + 输入处理）— 经典「Good Old Tetris」掌机外观
// 负责：装配逻辑层与渲染层、键盘/按钮输入分发、外壳与信息面板渲染。
// 所有玩法逻辑都委托给 useTetris，UI 仅读取状态、调用动作。
// ============================================================
import { onMounted, onUnmounted, ref, reactive, computed } from 'vue'
import {
  Volume2, VolumeX, ChevronUp, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-vue-next'
import GameCanvas from './components/GameCanvas.vue'
import NextPreview from './components/NextPreview.vue'
import BezelDecor from './components/BezelDecor.vue'
import { useTetris } from './game/useTetris.js'
import { useAudio } from './composables/useAudio.js'

const audio = useAudio()
const game = useTetris(audio)
const { state } = game

const playing = computed(() => state.status === 'playing')
const idleOrOver = computed(() => state.status === 'idle' || state.status === 'gameover')

// Max = 历史最高分；本局得分超过纪录时实时刷新为新纪录，否则保持历史最高。
const maxScore = computed(() => Math.max(state.highScore, state.score))

// 将数值按固定位宽补零，并拆分为「暗淡的前导零」与「点亮的有效位」，
// 还原 LCD 数码管中未点亮段隐约可见的质感。
function padParts(value, width) {
  const s = String(value).padStart(width, '0')
  const i = s.search(/[1-9]/)
  if (i === -1) return { dim: s.slice(0, -1), bright: s.slice(-1) }
  return { dim: s.slice(0, i), bright: s.slice(i) }
}
const maxParts = computed(() => padParts(maxScore.value, 6))
const scoreParts = computed(() => padParts(state.score, 6)) // 本局实时得分
const startParts = computed(() => padParts(state.startLevel, 6))

// 实时时钟（HH:MM），每秒刷新一次。
const timeStr = ref('')
let clockTimer = 0
function updateClock() {
  const d = new Date()
  timeStr.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ---------------- 操作动作分发 ----------------
// 游戏中执行玩法操作；待机/结束时方向键用于调节起始等级、其余键开始游戏。
function doLeft() {
  if (playing.value) game.moveLeft()
  else if (idleOrOver.value) game.changeStartLevel(-1)
}
function doRight() {
  if (playing.value) game.moveRight()
  else if (idleOrOver.value) game.changeStartLevel(1)
}
function doRotate() {
  if (playing.value) game.rotate(1)
  else if (idleOrOver.value) game.start()
}
function doDown() {
  if (playing.value) game.softDrop()
  else if (idleOrOver.value) game.start()
}
function doDrop() {
  if (playing.value) game.hardDrop()
  else if (idleOrOver.value) game.start()
}

// ---------------- 按钮按下视觉反馈 ----------------
// 记录各屏幕按钮的「按下」状态，使键盘操作时对应按钮也显示点击特效。
const pressed = reactive({})

// 鼠标/触摸按下：执行动作并点亮按钮特效。
function press(id, action) {
  pressed[id] = true
  action()
}
function release(id) {
  pressed[id] = false
}

// 将按键映射到对应的屏幕按钮 id（Ctrl+↓ 映射到硬降键）。
function keyToBtn(e) {
  const k = e.key
  if (k === 'p' || k === 'P' || k === 'Escape') return 'pause'
  if (k === 's' || k === 'S') return 'sound'
  if (k === 'r' || k === 'R') return 'reset'
  if (k === 'ArrowLeft') return 'left'
  if (k === 'ArrowRight') return 'right'
  if (k === 'ArrowUp' || k === 'x' || k === 'X') return 'rotation'
  if (k === ' ') return 'drop'
  if (k === 'ArrowDown') return e.ctrlKey ? 'drop' : 'down'
  return null
}

// ---------------- 键盘输入 ----------------
function onKeyDown(e) {
  const btn = keyToBtn(e)
  if (btn) pressed[btn] = true // 同步按钮按下特效

  const k = e.key
  if (k === 'p' || k === 'P' || k === 'Escape') {
    if (state.status === 'playing' || state.status === 'paused') game.togglePause()
    return
  }
  if (k === 's' || k === 'S') { audio.toggle(); return }
  if (k === 'r' || k === 'R') { game.reset(); return }

  switch (k) {
    case 'ArrowLeft': e.preventDefault(); doLeft(); break
    case 'ArrowRight': e.preventDefault(); doRight(); break
    case 'ArrowDown':
      e.preventDefault()
      // Ctrl + ↓ 直接硬降（快速落下），普通 ↓ 为软降。
      if (e.ctrlKey) { if (!e.repeat) doDrop() }
      else doDown()
      break
    case 'ArrowUp':
    case 'x':
    case 'X':
      e.preventDefault()
      if (!e.repeat) doRotate()
      break
    case ' ':
      e.preventDefault()
      if (!e.repeat) doDrop()
      break
  }
}

function onKeyUp(e) {
  // ↓ 键松开时同时清除软降/硬降两个按钮态（Ctrl 可能已先松开）。
  if (e.key === 'ArrowDown') { pressed.down = false; pressed.drop = false; return }
  const btn = keyToBtn(e)
  if (btn) pressed[btn] = false
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})
onUnmounted(() => {
  clearInterval(clockTimer)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <div class="min-h-screen bg-slate-200 flex items-center justify-center p-4 select-none">
    <!-- 掌机机身 -->
    <div class="tetris-body">
      <!-- 屏幕区：两侧方块装饰（机身黄底上）夹着黑色描边相框；相框内仅含标题条 + 灰色内框绿屏，贴合官方 -->
      <div class="screen-row">
        <BezelDecor :height="360" />

        <!-- 黑色描边相框：仅含顶部标题条 + 灰色内框绿屏（不含两侧装饰） -->
        <div class="bezel">
          <!-- 顶部标题条：两侧虚线（与边框同粗、连接到上方两角）+ 居中标题，深色显示在机身黄底上 -->
          <div class="title-bar">
            <span class="title-dash"></span>
            <h1 class="title-text">Good Old Tetris</h1>
            <span class="title-dash"></span>
          </div>

          <!-- 灰色立体内框：机身与绿屏之间的银灰色斜角边框 -->
          <div class="inner-frame">
          <!-- LCD 绿屏：左侧游戏区 + 右侧信息面板 -->
          <div class="screen">
          <GameCanvas :state="state" />

          <div class="info-panel">
            <!-- Max：历史最高分 -->
            <div>
              <p class="info-label">Max</p>
              <p class="lcd-digits"><span class="dim">{{ maxParts.dim }}</span>{{ maxParts.bright }}</p>
            </div>
            <!-- Score：本局实时得分 -->
            <div>
              <p class="info-label">Score</p>
              <p class="lcd-digits"><span class="dim">{{ scoreParts.dim }}</span>{{ scoreParts.bright }}</p>
            </div>
            <!-- Start Line（起始等级） -->
            <div>
              <p class="info-label">Start Line</p>
              <p class="lcd-digits"><span class="dim">{{ startParts.dim }}</span>{{ startParts.bright }}</p>
            </div>
            <!-- Level（当前等级） -->
            <div>
              <p class="info-label">Level</p>
              <p class="lcd-digits text-right">{{ state.level }}</p>
            </div>
            <!-- Next 预览 -->
            <div>
              <p class="info-label">Next</p>
              <div class="flex justify-end pr-1 pt-1">
                <NextPreview :next="state.next" />
              </div>
            </div>
            <!-- 静音状态 + 时钟 -->
            <div class="mt-auto flex items-center justify-end gap-1 text-[#2b3010]">
              <component :is="audio.enabled.value ? Volume2 : VolumeX" :size="14" />
              <span class="lcd-digits text-base">{{ timeStr }}</span>
            </div>
          </div>
          </div>
          </div>
        </div>

        <BezelDecor :height="360" mirror />
      </div>

      <!-- 控制区。每个按钮：pointerdown 执行动作并点亮特效，松开/移出复位；
           is-pressed 类用于键盘操作时同步显示按下特效。 -->
      <div class="mt-5 px-2">
        <!-- Pause / Sound / Reset 一排 -->
        <div class="flex gap-5">
          <div class="btn-group">
            <button
              class="btn-round btn-green btn-sm" :class="{ 'is-pressed': pressed.pause }"
              @pointerdown.prevent="press('pause', () => game.togglePause())"
              @pointerup="release('pause')" @pointerleave="release('pause')" @pointercancel="release('pause')"
            ></button>
            <span class="btn-label">Pause(P)</span>
          </div>
          <div class="btn-group">
            <button
              class="btn-round btn-green btn-sm" :class="{ 'is-pressed': pressed.sound }"
              @pointerdown.prevent="press('sound', () => audio.toggle())"
              @pointerup="release('sound')" @pointerleave="release('sound')" @pointercancel="release('sound')"
            ></button>
            <span class="btn-label">Sound(S)</span>
          </div>
          <div class="btn-group">
            <button
              class="btn-round btn-red btn-sm" :class="{ 'is-pressed': pressed.reset }"
              @pointerdown.prevent="press('reset', () => game.reset())"
              @pointerup="release('reset')" @pointerleave="release('reset')" @pointercancel="release('reset')"
            ></button>
            <span class="btn-label">Reset(R)</span>
          </div>
        </div>

        <!-- Drop（左） + 方向键（右，Rotation 居方向键顶部） -->
        <div class="flex items-center justify-between mt-5">
          <div class="btn-group">
            <button
              class="btn-round btn-blue btn-xl" :class="{ 'is-pressed': pressed.drop }"
              @pointerdown.prevent="press('drop', doDrop)"
              @pointerup="release('drop')" @pointerleave="release('drop')" @pointercancel="release('drop')"
            ></button>
            <span class="btn-label">Drop (SPACE)</span>
          </div>

          <!-- 方向键钻石布局：上 Rotation，中央方向指示，左 / 右 / 下三按钮环绕 -->
          <div class="dpad">
            <div></div>
            <div class="btn-group">
              <button
                class="btn-round btn-blue btn-rot" :class="{ 'is-pressed': pressed.rotation }"
                @pointerdown.prevent="press('rotation', doRotate)"
                @pointerup="release('rotation')" @pointerleave="release('rotation')" @pointercancel="release('rotation')"
              ></button>
              <span class="btn-label">Rotation</span>
            </div>
            <div></div>

            <div class="btn-group">
              <button
                class="btn-round btn-blue btn-md" :class="{ 'is-pressed': pressed.left }"
                @pointerdown.prevent="press('left', doLeft)"
                @pointerup="release('left')" @pointerleave="release('left')" @pointercancel="release('left')"
              ></button>
              <span class="btn-label">Left</span>
            </div>
            <div class="dir-cross">
              <ChevronUp :size="15" />
              <div class="flex items-center"><ChevronLeft :size="15" /><ChevronRight :size="15" /></div>
              <ChevronDown :size="15" />
            </div>
            <div class="btn-group">
              <button
                class="btn-round btn-blue btn-md" :class="{ 'is-pressed': pressed.right }"
                @pointerdown.prevent="press('right', doRight)"
                @pointerup="release('right')" @pointerleave="release('right')" @pointercancel="release('right')"
              ></button>
              <span class="btn-label">Right</span>
            </div>

            <div></div>
            <div class="btn-group">
              <button
                class="btn-round btn-blue btn-md" :class="{ 'is-pressed': pressed.down }"
                @pointerdown.prevent="press('down', doDown)"
                @pointerup="release('down')" @pointerleave="release('down')" @pointercancel="release('down')"
              ></button>
              <span class="btn-label">Down</span>
            </div>
            <div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 机身：金黄色塑料质感 */
.tetris-body {
  width: 460px;
  max-width: 100%;
  padding: 16px;
  border-radius: 26px;
  background: linear-gradient(160deg, #ffd633 0%, #f4c30f 55%, #EFCC19 100%);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35), inset 0 2px 6px rgba(255, 255, 255, 0.5);
}

/* 标题两侧短虚线点缀：小方块短划，居中聚拢在标题两旁 */
.title-dash {
  width: 38px;
  height: 6px;
  background: repeating-linear-gradient(90deg, #141414 0 6px, transparent 6px 12px);
}

/* 屏幕区：左装饰列 + 黑框绿屏 + 右装饰列 横向排列 */
.screen-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
/* 黑色相框：四周圆角描边（机身黄底透出），带轻微立体投影与内高光，质感更精致 */
.bezel {
  padding: 8px 14px 14px;
  background: transparent;
  border: 6px solid #141414;
  border-radius: 16px;
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

/* 顶部标题条：居中标题，两侧短虚线点缀 */
.title-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 2px 0 8px;
}
.title-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #141414;
}

/* 灰色立体内框：银灰色斜角边框，营造绿屏内嵌的立体感 */
.inner-frame {
  padding: 8px;
  border-radius: 10px;
  background: linear-gradient(160deg, #cdd0bb 0%, #b3b6a0 60%, #9ea08b 100%);
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, 0.65),
    inset 0 -3px 5px rgba(0, 0, 0, 0.3),
    inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}

/* LCD 绿屏 */
.screen {
  display: flex;
  gap: 6px;
  padding: 8px;
  background: #9aa97a;
  border-radius: 6px;
  border: 2px solid #5c6640;
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.3);
}

/* 右侧信息面板（紧凑布局） */
.info-panel {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 92px;
  color: #2b3010;
}
.info-label {
  font-size: 11px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}
/* LCD 数码字体 */
.lcd-digits {
  font-family: 'Courier New', monospace;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 1px;
  text-align: right;
  line-height: 1.1;
}
.lcd-digits .dim {
  color: rgba(43, 48, 16, 0.18);
}

/* ---------------- 按钮 ---------------- */
.btn-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.btn-label {
  font-size: 11px;
  font-weight: 600;
  color: #1a1a1a;
}
.btn-round {
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  /* 立体球面感：顶部高光 + 底部内阴影压暗 + 外部厚度与投影 */
  box-shadow:
    inset 0 3px 5px rgba(255, 255, 255, 0.5),
    inset 0 -6px 8px rgba(0, 0, 0, 0.45),
    0 5px 1px rgba(0, 0, 0, 0.35),
    0 8px 10px rgba(0, 0, 0, 0.35);
  transition: transform 0.06s ease, box-shadow 0.06s ease, filter 0.06s ease;
}
/* 按下特效：点击（:active）与键盘按下（.is-pressed）共用——下沉 + 变暗 */
.btn-round:active,
.btn-round.is-pressed {
  transform: translateY(4px);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.3),
    inset 0 4px 8px rgba(0, 0, 0, 0.5),
    0 1px 1px rgba(0, 0, 0, 0.35),
    0 2px 4px rgba(0, 0, 0, 0.3);
  filter: brightness(0.88);
}
.btn-sm { width: 38px; height: 38px; }
.btn-md { width: 54px; height: 54px; }
.btn-rot { width: 60px; height: 60px; }
.btn-xl { width: 96px; height: 96px; }

/* 按钮配色：深色、提高饱和度，避免发白；径向渐变营造球面光泽 */
.btn-green { background: radial-gradient(circle at 35% 28%, #6fd07f, #239038 55%, #0f5a23); }
.btn-red { background: radial-gradient(circle at 35% 28%, #f5775f, #c12819 55%, #7d150b); }
.btn-blue { background: radial-gradient(circle at 35% 28%, #828ff0, #3b49c4 55%, #232f86); }

/* 方向键 3×3 网格 */
.dpad {
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 6px;
  align-items: center;
  justify-items: center;
}
/* 中央方向指示十字（上 / 左右 / 下） */
.dir-cross {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #374151;
  line-height: 0.6;
}
</style>
