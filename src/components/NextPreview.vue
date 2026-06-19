<script setup>
// ============================================================
// 下一方块预览（渲染层）— 单色 LCD 砖块风格
// 监听逻辑层 next 类型，在小画布中居中绘制对应方块。
// ============================================================
import { ref, watch, onMounted } from 'vue'
import { SHAPES } from '../game/constants.js'

const props = defineProps({
  next: { type: String, default: null } // 下一方块类型
})

const CELL = 13
const COLS_N = 4
const W = COLS_N * CELL
const H = 2 * CELL // 预览仅需 2 行高度即可容纳所有方块横放形态
const LCD_ON = '#2b3010'

const canvasRef = ref(null)
let ctx = null

// 绘制单个砖块（与主画布一致的外圈 + 中心点样式）。
function drawBrick(x, y) {
  const s = CELL
  ctx.fillStyle = LCD_ON
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2)
  ctx.fillStyle = '#9aa97a'
  ctx.fillRect(x + 3, y + 3, s - 6, s - 6)
  ctx.fillStyle = LCD_ON
  ctx.fillRect(x + 4, y + 4, s - 8, s - 8)
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  if (!props.next) return

  // 取方块矩阵中实际占用的行（忽略 SHAPES 中的空白行），使预览紧凑居中。
  const matrix = SHAPES[props.next]
  const rows = matrix.filter((row) => row.some((v) => v))
  const widthCells = matrix[0].length
  const offsetX = (COLS_N - widthCells) / 2
  const offsetY = (2 - rows.length) / 2

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < widthCells; c++) {
      if (rows[r][c]) drawBrick((offsetX + c) * CELL, (offsetY + r) * CELL)
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
  <canvas ref="canvasRef" :width="W" :height="H" class="block"></canvas>
</template>
