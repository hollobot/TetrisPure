// ============================================================
// 棋盘与方块的纯函数工具集（无状态、无副作用，便于复用与测试）
// ============================================================
import { COLS, ROWS, SHAPES, TYPES, getKicks } from './constants.js'

// 创建空棋盘：ROWS×COLS 的二维数组，每格为 null（空）或方块类型字符串。
export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

// 深拷贝一个矩阵（旋转时避免污染原始 SHAPES 数据）。
export function cloneMatrix(matrix) {
  return matrix.map((row) => [...row])
}

// 将方阵顺时针旋转 90°。result[i][j] = matrix[N-1-j][i]
export function rotateCW(matrix) {
  const n = matrix.length
  const result = Array.from({ length: n }, () => Array(n).fill(0))
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      result[x][n - 1 - y] = matrix[y][x]
    }
  }
  return result
}

// 将方阵逆时针旋转 90°。result[i][j] = matrix[j][N-1-i]
export function rotateCCW(matrix) {
  const n = matrix.length
  const result = Array.from({ length: n }, () => Array(n).fill(0))
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      result[n - 1 - x][y] = matrix[y][x]
    }
  }
  return result
}

// 碰撞检测：判断给定矩阵在棋盘 (x,y) 位置是否合法。
// 允许方块顶部超出盘面上沿（row < 0），用于出生与旋转缓冲。
export function isValid(board, matrix, x, y) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue
      const boardRow = y + r
      const boardCol = x + c
      // 左右、底部边界越界
      if (boardCol < 0 || boardCol >= COLS || boardRow >= ROWS) return false
      // 与已堆叠方块重叠
      if (boardRow >= 0 && board[boardRow][boardCol]) return false
    }
  }
  return true
}

// 将当前方块固化合并进棋盘，返回新棋盘（不修改原棋盘）。
export function merge(board, piece) {
  const next = board.map((row) => [...row])
  const { matrix, x, y, type } = piece
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue
      const boardRow = y + r
      const boardCol = x + c
      if (boardRow >= 0) next[boardRow][boardCol] = type
    }
  }
  return next
}

// 找出所有已填满的行的索引。
export function getFullRows(board) {
  const rows = []
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every((cell) => cell !== null)) rows.push(r)
  }
  return rows
}

// 移除指定行并在顶部补充等量空行，返回新棋盘。
export function removeRows(board, rowsToRemove) {
  const removeSet = new Set(rowsToRemove)
  const remaining = board.filter((_, idx) => !removeSet.has(idx))
  const emptyRows = Array.from({ length: rowsToRemove.length }, () =>
    Array(COLS).fill(null)
  )
  return [...emptyRows, ...remaining]
}

// 计算方块的「幽灵」落点（硬降目标行），用于落地阴影预览。
export function getGhostY(board, piece) {
  let y = piece.y
  while (isValid(board, piece.matrix, piece.x, y + 1)) y++
  return y
}

// 旋转方块并应用 SRS 墙踢：成功返回新的 {matrix, x, y, rotation}，失败返回 null。
// dir = 1 顺时针，dir = -1 逆时针。
export function rotatePiece(board, piece, dir) {
  const from = piece.rotation
  const to = (from + dir + 4) % 4
  const rotated = dir === 1 ? rotateCW(piece.matrix) : rotateCCW(piece.matrix)
  const kicks = getKicks(piece.type)[`${from}-${to}`] || [[0, 0]]
  for (const [dx, dy] of kicks) {
    const nx = piece.x + dx
    const ny = piece.y + dy
    if (isValid(board, rotated, nx, ny)) {
      return { matrix: rotated, x: nx, y: ny, rotation: to }
    }
  }
  return null
}

// Fisher–Yates 洗牌，生成一袋随机方块（7-bag 随机算法，保证出块均衡）。
export function createBag() {
  const bag = [...TYPES]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

// 根据方块类型生成出生方块对象（居中放置于盘面顶部）。
export function spawnPiece(type) {
  const matrix = cloneMatrix(SHAPES[type])
  const x = Math.floor((COLS - matrix.length) / 2)
  return { type, matrix, x, y: 0, rotation: 0 }
}
