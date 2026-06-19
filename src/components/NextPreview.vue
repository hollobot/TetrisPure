<script setup>
// ============================================================
// 下一方块预览（渲染层）
// 监听逻辑层的 next 类型，在小画布中居中绘制对应方块。
// ============================================================
import { ref, watch, onMounted } from 'vue'
import { SHAPES, COLORS } from '../game/constants.js'

const props = defineProps({
  next: { type: String, default: null } // 下一方块类型
})

const CELL = 22
const SIZE = 4 * CELL // 4×4 预览区域
const canvasRef = ref(null)
let ctx = null

// 绘制预览：清空后将方块矩阵居中渲染。
function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, SIZE, SIZE)
  if (!props.next) return

  const matrix = SHAPES[props.next]
  const color = COLORS[props.next]
  const n = matrix.length
  // 居中偏移（以格为单位）
  const offset = (4 - n) / 2

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue
      const x = (offset + c) * CELL
      const y = (offset + r) * CELL
      ctx.fillStyle = color
      ctx.fillRect(x, y, CELL, CELL)
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(x, y, CELL, 3)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)
    }
  }
}

watch(() => props.next, draw)
onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  draw()
})
</script>

<template>
  <canvas
    ref="canvasRef"
    :width="SIZE"
    :height="SIZE"
    class="rounded-md bg-slate-900/60 ring-1 ring-white/10"
  ></canvas>
</template>
