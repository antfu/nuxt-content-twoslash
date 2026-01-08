export default defineNuxtConfig({
  compatibilityDate: '2024-06-01',
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
  typescript: {
    includeWorkspace: true,
  },
})
