import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// 注册 PWA Service Worker，实现离线缓存（自动更新）。
// 开发环境下该虚拟模块同样可用，注册失败不影响游戏运行。
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

createApp(App).mount('#app')
