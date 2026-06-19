// ============================================================
// 音效管理 Composable（基于 howler.js）
// 音频文件需后续放入 public/sounds/ 目录，文件名见 SOUND_FILES。
// 文件缺失时静默处理，不影响游戏运行；开关状态持久化到 localStorage。
// ============================================================
import { ref } from 'vue'
import { Howl } from 'howler'
import { STORAGE_KEYS } from '../game/constants.js'

// 逻辑事件名 → 音频文件名映射（统一放在 public/sounds/ 下）
const SOUND_FILES = {
  move: 'move.mp3', // 左右移动
  rotate: 'rotate.mp3', // 旋转
  drop: 'drop.mp3', // 硬降落底
  lock: 'lock.mp3', // 方块锁定
  clear: 'clear.mp3', // 消行
  levelUp: 'levelup.mp3', // 升级
  gameOver: 'gameover.mp3' // 游戏结束
}

export function useAudio() {
  // 开关状态：默认开启，读取本地持久化配置。
  const enabled = ref(localStorage.getItem(STORAGE_KEYS.sound) !== 'off')

  // 懒加载缓存的 Howl 实例。
  const cache = {}

  // 标记加载失败的音效，避免重复尝试与报错刷屏。
  const failed = new Set()

  function getHowl(name) {
    if (cache[name]) return cache[name]
    if (failed.has(name)) return null
    const file = SOUND_FILES[name]
    if (!file) return null
    const howl = new Howl({
      src: [`sounds/${file}`],
      volume: 0.5,
      // 文件缺失时静默标记失败，不抛出干扰性错误。
      onloaderror: () => failed.add(name)
    })
    cache[name] = howl
    return howl
  }

  // 播放指定事件音效（关闭或文件缺失时静默跳过）。
  function play(name) {
    if (!enabled.value) return
    const howl = getHowl(name)
    if (howl) howl.play()
  }

  // 切换音效开关并持久化。
  function toggle() {
    enabled.value = !enabled.value
    localStorage.setItem(STORAGE_KEYS.sound, enabled.value ? 'on' : 'off')
  }

  return { enabled, play, toggle }
}
