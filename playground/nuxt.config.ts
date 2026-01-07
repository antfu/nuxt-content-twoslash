export default defineNuxtConfig({
  modules: [
    'nuxt-content-twoslash',
    '@nuxt/content',
  ],
  twoslash: {},
  content: {
    documentDriven: true,
    highlight: {
      theme: 'vitesse-light',
    },
  },
})
