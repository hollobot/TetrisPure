<script setup>
// ============================================================
// 主游戏画布（渲染层）— 单色 LCD 砖块机风格
// 仅「读取」逻辑层状态并逐帧绘制，不反向修改逻辑，保持解耦。
// 自带 requestAnimationFrame 渲染循环，保证流畅度与消行动画。
// ============================================================
import { ref, onMounted, onUnmounted } from 'vue'
import { COLS, ROWS, CLEAR_ANIM_MS } from '../game/constants.js'

const props = defineProps({
  state: { type: Object, required: true } // 逻辑层响应式状态
})

const CELL = 16 // 单格像素尺寸
const WIDTH = COLS * CELL
const HEIGHT = ROWS * CELL

// LCD 配色：底色为橄榄绿，点亮像素为近黑深色，熄灭像素为极淡轮廓。
const LCD_BG = '#9aa97a'
const LCD_ON = '#2b3010'
const LCD_OFF = 'rgba(43,48,16,0.10)'

const canvasRef = ref(null)
let ctx = null
let rafId = 0

// Chrome 离线小恐龙像素位图（1 = 点亮，0 = 透空），用于开机待机画面。
// 取自官网（tetris.game）精灵图第 4 帧，按官方原生 2px 提取为 40×43 网格、朝向右侧，与官网完全一致：
// 右侧大方头（含眼睛透空像素）+ 右伸吻部（张口的下颌）+ 左侧尾巴 + 身体 + 底部双腿（奔跑姿态）。
const DINO = [
  '0000000000000000000011111111111111111100', // 头顶
  '0000000000000000000011111111111111111100',
  '0000000000000000000011111111111111111111',
  '0000000000000000000011110011111111111111', // 眼睛：cols24-25 透空像素
  '0000000000000000000011110011111111111111',
  '0000000000000000000011111111111111111111',
  '0000000000000000000011111111111111111111',
  '0000000000000000000011111111111111111111',
  '0000000000000000000011111111111111111111',
  '0000000000000000000011111111111111111111',
  '0000000000000000000011111111111111111111',
  '0000000000000000000011111111110000000000', // 颌部内收
  '0000000000000000000011111111110000000000',
  '0000000000000000000011111111111111110000', // 右伸吻部（张口的下颌）
  '0000000000000000000011111111111111110000',
  '1100000000000000001111111111000000000000', // 尾巴尖（左）+ 颈部
  '1100000000000000001111111111000000000000',
  '1100000000000001111111111111000000000000',
  '1100000000000001111111111111000000000000',
  '1111000000001111111111111111111100000000',
  '1111000000001111111111111111111100000000',
  '1111110000111111111111111111001100000000', // 小前肢
  '1111110000111111111111111111001100000000',
  '1111111111111111111111111111000000000000', // 尾巴并入身体
  '1111111111111111111111111111000000000000',
  '1111111111111111111111111111000000000000',
  '1111111111111111111111111111000000000000',
  '0011111111111111111111111111000000000000',
  '0011111111111111111111111100000000000000',
  '0000111111111111111111111100000000000000',
  '0000111111111111111111111100000000000000',
  '0000001111111111111111110000000000000000',
  '0000001111111111111111110000000000000000',
  '0000000011111111111111000000000000000000', // 腹部下沿
  '0000000011111111111111000000000000000000',
  '0000000000111111000011111000000000000000', // 双腿分出（前/后腿）
  '0000000000111111000011111000000000000000',
  '0000000000111100000000000000000000000000', // 后腿抬起，前腿落下
  '0000000000111100000000000000000000000000',
  '0000000000110000000000000000000000000000',
  '0000000000110000000000000000000000000000',
  '0000000000111100000000000000000000000000', // 脚掌
  '0000000000111100000000000000000000000000'
]

// 绘制经典砖块：外圈方框 + 中心实心点，中间留缝，模拟砖块机方块。
function drawBrick(col, row, on = true) {
  const x = col * CELL
  const y = row * CELL
  const s = CELL
  if (on) {
    ctx.fillStyle = LCD_ON
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2) // 外实心方块
    ctx.fillStyle = LCD_BG
    ctx.fillRect(x + 3, y + 3, s - 6, s - 6) // 挖空形成外圈
    ctx.fillStyle = LCD_ON
    ctx.fillRect(x + 5, y + 5, s - 10, s - 10) // 中心点
  } else {
    // 熄灭像素：淡淡的轮廓，还原 LCD「未点亮段」的质感。
    ctx.strokeStyle = LCD_OFF
    ctx.lineWidth = 1
    ctx.strokeRect(x + 2.5, y + 2.5, s - 5, s - 5)
  }
}

// 用像素方块绘制位图（恐龙），px 为单个像素边长；flip 为真时水平镜像。
function drawBitmap(bitmap, originX, originY, px, flip = false) {
  ctx.fillStyle = LCD_ON
  for (let r = 0; r < bitmap.length; r++) {
    const w = bitmap[r].length
    for (let c = 0; c < w; c++) {
      if (bitmap[r][c] === '1') {
        const drawC = flip ? w - 1 - c : c
        ctx.fillRect(originX + drawC * px, originY + r * px, px, px)
      }
    }
  }
}

// 居中绘制文字
function drawText(text, y, size) {
  ctx.fillStyle = LCD_ON
  ctx.font = `bold ${size}px "Courier New", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, WIDTH / 2, y)
}

// 绘制全屏熄灭像素底纹（LCD 质感）
function drawOffLayer() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) drawBrick(c, r, false)
  }
}

// 待机（开机）画面：恐龙左右来回跳动 + TETRIS。
function drawSplash() {
  drawOffLayer()
  const px = 2 // 单像素边长（配合 40×43 官网点阵）
  const now = performance.now()
  const dinoW = DINO[0].length * px

  // 水平来回移动：用三角波在 [0,1] 之间往返（ping-pong），周期约 2.4s。
  const sweep = 2400
  const phase = (now % sweep) / sweep
  const pingpong = phase < 0.5 ? phase * 2 : (1 - phase) * 2
  const movingRight = phase < 0.5
  const travel = WIDTH - dinoW - 8 // 可移动的水平范围
  const x = 4 + pingpong * travel

  // 上下小跳：频率高于水平移动，营造蹦跳感。
  const hop = Math.abs(Math.sin(now / 150)) * (px * 2)
  const y = HEIGHT * 0.24 - hop

  // 向左移动时镜像，使恐龙始终朝向前进方向。
  drawBitmap(DINO, x, y, px, !movingRight)
  drawText('T E T R I S', HEIGHT * 0.62, 18)
}

// 逐帧渲染主入口。
function render() {
  rafId = requestAnimationFrame(render)
  const { board, current, clearing, status } = props.state

  ctx.fillStyle = LCD_BG
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // 待机画面
  if (status === 'idle') {
    drawSplash()
    return
  }

  // 先铺熄灭底纹，再绘制点亮方块
  drawOffLayer()

  // 已固化的堆叠方块
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawBrick(c, r, true)
    }
  }

  // 当前下落方块
  if (current) {
    for (let r = 0; r < current.matrix.length; r++) {
      for (let c = 0; c < current.matrix[r].length; c++) {
        if (current.matrix[r][c]) drawBrick(current.x + c, current.y + r, true)
      }
    }
  }

  // 消行闪烁动画：整行点亮像素随时间闪烁。
  if (clearing) {
    const t = (performance.now() - clearing.start) / CLEAR_ANIM_MS
    if (Math.floor(t * 6) % 2 === 0) {
      for (const row of clearing.rows) {
        for (let c = 0; c < COLS; c++) drawBrick(c, row, true)
      }
    }
  }

  // 暂停 / 结束文字覆盖
  if (status === 'paused') {
    ctx.fillStyle = 'rgba(154,169,122,0.75)'
    ctx.fillRect(0, HEIGHT / 2 - 18, WIDTH, 36)
    drawText('PAUSE', HEIGHT / 2, 18)
  } else if (status === 'gameover') {
    ctx.fillStyle = 'rgba(154,169,122,0.85)'
    ctx.fillRect(0, HEIGHT / 2 - 24, WIDTH, 48)
    drawText('GAME', HEIGHT / 2 - 10, 16)
    drawText('OVER', HEIGHT / 2 + 10, 16)
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
    class="block touch-none"
  ></canvas>
</template>
