<script setup>
// ============================================================
// 主游戏画布（渲染层）
// 仅「读取」逻辑层状态并逐帧绘制，不反向修改逻辑，保持解耦。
// 自带 requestAnimationFrame 渲染循环，保证 60 帧流畅度与动画表现。
// ============================================================
import { ref, onMounted, onUnmounted } from 'vue'
import { COLS, ROWS, COLORS, CLEAR_ANIM_MS } from '../game/constants.js'

const props = defineProps({
  state: { type: Object, required: true }, // 逻辑层响应式状态
  getGhostY: { type: Function, required: true } // 幽灵落点计算
})

const CELL = 30 // 单格像素尺寸
const WIDTH = COLS * CELL
const HEIGHT = ROWS * CELL

const canvasRef = ref(null)
let ctx = null
let rafId = 0

// 绘制单个方块格子：填充色 + 描边，附带高光使方块更立体。
function drawCell(col, row, color, { alpha = 1, ghost = false } = {}) {
  const x = col * CELL
  const y = row * CELL
  ctx.globalAlpha = alpha
  if (ghost) {
    // 幽灵方块：仅描边，半透明，表示落地预览位置。
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4)
  } else {
    ctx.fillStyle = color
    ctx.fillRect(x, y, CELL, CELL)
    // 顶部 / 左侧高光
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(x, y, CELL, 3)
    ctx.fillRect(x, y, 3, CELL)
    // 描边
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)
  }
  ctx.globalAlpha = 1
}

// 绘制背景网格线
function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(c * CELL, 0)
    ctx.lineTo(c * CELL, HEIGHT)
    ctx.stroke()
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * CELL)
    ctx.lineTo(WIDTH, r * CELL)
    ctx.stroke()
  }
}

// 逐帧渲染：背景 → 已堆叠方块 → 幽灵 → 当前方块 → 消行闪烁。
function render() {
  rafId = requestAnimationFrame(render)
  const { board, current, clearing } = props.state

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  drawGrid()

  // 已固化的堆叠方块
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawCell(c, r, COLORS[board[r][c]])
    }
  }

  // 当前方块的幽灵落点（落地阴影）与方块本体
  if (current) {
    const ghostY = props.getGhostY()
    const color = COLORS[current.type]
    for (let r = 0; r < current.matrix.length; r++) {
      for (let c = 0; c < current.matrix[r].length; c++) {
        if (!current.matrix[r][c]) continue
        if (ghostY !== null) drawCell(current.x + c, ghostY + r, color, { ghost: true })
        drawCell(current.x + c, current.y + r, color)
      }
    }
  }

  // 消行闪烁动画：白色覆盖随时间淡出。
  if (clearing) {
    const t = (performance.now() - clearing.start) / CLEAR_ANIM_MS
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.85 * (1 - t))})`
    for (const row of clearing.rows) {
      ctx.fillRect(0, row * CELL, WIDTH, CELL)
    }
  }
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  rafId = requestAnimationFrame(render)
})
onUnmounted(() => cancelAnimationFrame(rafId))
</script>

<template>
  <canvas
    ref="canvasRef"
    :width="WIDTH"
    :height="HEIGHT"
    class="rounded-lg shadow-2xl ring-1 ring-white/10 max-w-full h-auto touch-none"
    style="aspect-ratio: 1 / 2"
  ></canvas>
</template>
