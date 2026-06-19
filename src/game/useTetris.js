// ============================================================
// 俄罗斯方块核心逻辑 Composable
// 职责：游戏状态管理 + 主循环（重力/消行/计分/等级）+ 操作动作
// 不涉及任何 DOM / Canvas 渲染，实现逻辑层与渲染层完全解耦。
// ============================================================
import { reactive, onMounted, onUnmounted } from 'vue'
import {
  createBoard,
  createBag,
  spawnPiece,
  isValid,
  merge,
  getFullRows,
  removeRows,
  getGhostY as calcGhostY,
  rotatePiece
} from './board.js'
import {
  LINE_SCORES,
  SOFT_DROP_SCORE,
  HARD_DROP_SCORE,
  LINES_PER_LEVEL,
  CLEAR_ANIM_MS,
  MIN_START_LEVEL,
  MAX_START_LEVEL,
  dropInterval,
  STORAGE_KEYS
} from './constants.js'

export function useTetris(audio) {
  // 起始等级（界面中的 Start Line），从本地配置读取。
  const savedStartLevel = Number(localStorage.getItem(STORAGE_KEYS.startLevel) || 0)

  // ---------------- 响应式状态 ----------------
  const state = reactive({
    board: createBoard(), // 已堆叠的棋盘
    current: null, // 当前下落方块 {type, matrix, x, y, rotation}
    next: null, // 下一个方块类型（预览）
    status: 'idle', // idle | playing | paused | gameover
    score: 0,
    level: savedStartLevel, // 当前等级（待机时等于起始等级）
    lines: 0,
    startLevel: savedStartLevel, // 可在未开始时调整并持久化
    clearing: null, // 消行动画状态 {rows:[], start:时间戳}
    highScore: Number(localStorage.getItem(STORAGE_KEYS.highScore) || 0)
  })

  // ---------------- 内部变量（非响应式，避免无谓的视图更新）----------------
  let queue = [] // 出块队列（基于 7-bag 补充）
  let accumulator = 0 // 重力时间累加器
  let lastTime = 0 // 上一帧时间戳
  let rafId = 0 // 主循环句柄

  // 保证队列至少有 1 个待出方块
  function ensureQueue() {
    while (queue.length < 1) queue.push(...createBag())
  }

  // 从队列取出方块作为当前方块，并刷新预览；出生位置非法则游戏结束。
  function spawn() {
    ensureQueue()
    const type = queue.shift()
    ensureQueue()
    state.next = queue[0]
    const piece = spawnPiece(type)
    if (!isValid(state.board, piece.matrix, piece.x, piece.y)) {
      gameOver()
      return
    }
    state.current = piece
  }

  // 游戏结束处理：更新状态、刷新并持久化最高分。
  function gameOver() {
    state.current = null
    state.status = 'gameover'
    if (state.score > state.highScore) {
      state.highScore = state.score
      localStorage.setItem(STORAGE_KEYS.highScore, String(state.score))
    }
    audio.play('gameOver')
  }

  // 累加消行得分并按累计行数提升等级。
  function applyClearScore(count) {
    state.score += LINE_SCORES[count] * state.level
    state.lines += count
    const newLevel = state.startLevel + Math.floor(state.lines / LINES_PER_LEVEL)
    if (newLevel > state.level) {
      state.level = newLevel
      audio.play('levelUp')
    }
  }

  // 方块落地固化：合并入盘，检测满行。有满行则进入消行动画，否则直接出下一块。
  function lock() {
    state.board = merge(state.board, state.current)
    audio.play('lock')
    state.current = null
    const fullRows = getFullRows(state.board)
    if (fullRows.length > 0) {
      applyClearScore(fullRows.length)
      audio.play('clear')
      // 进入消行闪烁动画，实际移除延迟到动画结束（finalizeClear）。
      state.clearing = { rows: fullRows, start: performance.now() }
    } else {
      spawn()
    }
  }

  // 消行动画结束：真正移除满行并出下一块。
  function finalizeClear() {
    state.board = removeRows(state.board, state.clearing.rows)
    state.clearing = null
    spawn()
  }

  // 重力步进：能下移则下移，否则锁定。
  function gravityStep() {
    if (isValid(state.board, state.current.matrix, state.current.x, state.current.y + 1)) {
      state.current.y++
    } else {
      lock()
    }
  }

  // ---------------- 主循环（requestAnimationFrame）----------------
  function tick(now) {
    rafId = requestAnimationFrame(tick)
    const dt = now - lastTime
    lastTime = now

    if (state.status !== 'playing') return

    // 消行动画期间冻结重力，到时后结算。
    if (state.clearing) {
      if (now - state.clearing.start >= CLEAR_ANIM_MS) finalizeClear()
      return
    }

    accumulator += dt
    const interval = dropInterval(state.level)
    while (accumulator >= interval) {
      accumulator -= interval
      gravityStep()
      if (state.status !== 'playing' || state.clearing) break
    }
  }

  // 操作前置校验：仅在游戏中且非消行动画期间允许操作。
  function canControl() {
    return state.status === 'playing' && !state.clearing && state.current
  }

  // ---------------- 对外操作动作 ----------------
  function moveLeft() {
    if (!canControl()) return
    if (isValid(state.board, state.current.matrix, state.current.x - 1, state.current.y)) {
      state.current.x--
      audio.play('move')
    }
  }

  function moveRight() {
    if (!canControl()) return
    if (isValid(state.board, state.current.matrix, state.current.x + 1, state.current.y)) {
      state.current.x++
      audio.play('move')
    }
  }

  // 旋转（dir=1 顺时针，dir=-1 逆时针），含墙踢修正。
  function rotate(dir = 1) {
    if (!canControl()) return
    const result = rotatePiece(state.board, state.current, dir)
    if (result) {
      Object.assign(state.current, result)
      audio.play('rotate')
    }
  }

  // 软降：手动加速下落一格并计分，重置重力累加避免叠加自动下落。
  function softDrop() {
    if (!canControl()) return
    if (isValid(state.board, state.current.matrix, state.current.x, state.current.y + 1)) {
      state.current.y++
      state.score += SOFT_DROP_SCORE
      accumulator = 0
    } else {
      lock()
    }
  }

  // 硬降：直接落到底部，按下落格数计分后立即锁定。
  function hardDrop() {
    if (!canControl()) return
    const ghostY = calcGhostY(state.board, state.current)
    const distance = ghostY - state.current.y
    state.current.y = ghostY
    state.score += distance * HARD_DROP_SCORE
    audio.play('drop')
    lock()
  }

  // 开始 / 重新开始游戏（startLevel 即界面的 Start Line）。
  function start(startLevel = state.startLevel) {
    state.startLevel = startLevel
    localStorage.setItem(STORAGE_KEYS.startLevel, String(startLevel))
    state.board = createBoard()
    state.score = 0
    state.lines = 0
    state.level = startLevel
    state.clearing = null
    queue = createBag()
    accumulator = 0
    lastTime = performance.now()
    state.status = 'playing'
    spawn()
  }

  // 调整起始等级（仅在未开始 / 已结束时可改），并持久化。
  function changeStartLevel(delta) {
    if (state.status === 'playing' || state.status === 'paused') return
    const next = Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, state.startLevel + delta))
    state.startLevel = next
    state.level = next
    localStorage.setItem(STORAGE_KEYS.startLevel, String(next))
  }

  // 暂停 / 继续切换。
  function togglePause() {
    if (state.status === 'playing') {
      state.status = 'paused'
    } else if (state.status === 'paused') {
      lastTime = performance.now()
      state.status = 'playing'
    }
  }

  function restart() {
    start(state.startLevel)
  }

  // 复位：回到待机（开机）画面，保留起始等级设置。
  function reset() {
    state.status = 'idle'
    state.board = createBoard()
    state.current = null
    state.next = null
    state.score = 0
    state.lines = 0
    state.level = state.startLevel
    state.clearing = null
  }

  // ---------------- 生命周期 ----------------
  onMounted(() => {
    lastTime = performance.now()
    rafId = requestAnimationFrame(tick)
  })
  onUnmounted(() => cancelAnimationFrame(rafId))

  return {
    state,
    start,
    reset,
    changeStartLevel,
    togglePause,
    restart,
    moveLeft,
    moveRight,
    rotate,
    softDrop,
    hardDrop
  }
}
