import TwoSlash from '@shikijs/vitepress-twoslash/client'
import { defineNuxtPlugin } from '#app'

import '@shikijs/vitepress-twoslash/style.css'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(TwoSlash)
})
