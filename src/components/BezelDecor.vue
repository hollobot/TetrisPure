<script setup>
// ============================================================
// 机身上的装饰性方块图案（纯静态装饰，无交互）
// 直接绘制在黄色机身上：黑色砖块（外圈 + 中心点，与游戏内方块同款样式）
// 拼成俄罗斯方块剪影，竖直循环铺排。画布背景透明，缝隙透出机身黄色。
// mirror 为真时整体水平镜像，用于右侧列与左侧列左右对称。
// ============================================================
import { ref, onMounted } from 'vue'

const props = defineProps({
  width: { type: Number, default: 46 }, // 画布宽度
  height: { type: Number, default: 340 }, // 画布高度
  cell: { type: Number, default: 14 }, // 单个像素方块边长（与游戏区接近）
  mirror: { type: Boolean, default: false } // 是否水平镜像
})

// 循环铺排的方块形状集合（均不超过 3 格宽，适配较窄的装饰列；含竖向 I）。
const SHAPES = [
  [[1, 1], [1, 1]], // O
  [[1, 1, 1], [0, 1, 0]], // T
  [[1, 1, 0], [0, 1, 1]], // Z
  [[1, 0], [1, 0], [1, 1]], // L
  [[0, 1, 1], [1, 1, 0]], // S
  [[1], [1], [1], [1]], // I（竖向）
  [[0, 1], [0, 1], [1, 1]] // J
]

const DARK = '#141414'
const canvasRef = ref(null)

// 绘制单个砖块：外框 + 镂空 + 中心点，与 GameCanvas.drawBrick 同款三层结构；
// 镂空处用 clearRect 透出机身黄色，模拟游戏方块的中空质感。
function drawCell(ctx, x, y, s) {
  ctx.fillStyle = DARK
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2) // 外实心方块
  ctx.clearRect(x + 3, y + 3, s - 6, s - 6) // 挖空形成外圈
  ctx.fillStyle = DARK
  ctx.fillRect(x + 5, y + 5, s - 10, s - 10) // 中心点
}

onMounted(() => {
  const ctx = canvasRef.value.getContext('2d')
  const { width, height, cell, mirror } = props
  const gap = cell // 形状之间的垂直间距（约一格高，密集铺排）

  // 第一遍：自上而下按「形状高度 + 间距」累计，统计能【完整】容纳的形状数，
  // 据此算出顶部留白，使整列形状居中且铺满，且末尾形状不会被画布裁切。
  let total = 0
  let count = 0
  while (true) {
    const h = SHAPES[count % SHAPES.length].length * cell
    const next = total + (count > 0 ? gap : 0) + h
    if (next > height) break
    total = next
    count++
  }

  // 第二遍：从居中起点逐个绘制。
  let y = (height - total) / 2
  for (let k = 0; k < count; k++) {
    let shape = SHAPES[k % SHAPES.length]
    if (mirror) shape = shape.map((row) => [...row].reverse()) // 镜像
    const shapeW = shape[0].length * cell
    const offsetX = (width - shapeW) / 2
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) drawCell(ctx, offsetX + c * cell, y + r * cell, cell)
      }
    }
    y += shape.length * cell + gap
  }
})
</script>

<template>
  <canvas ref="canvasRef" :width="width" :height="height" class="block"></canvas>
</template>
