import { defineNuxtPlugin } from '#app'
import TwoSlash from '@shikijs/vitepress-twoslash/client'

import '@shikijs/vitepress-twoslash/style.css'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(TwoSlash)
})
