export default defineNuxtConfig({
  compatibilityDate: '2024-06-01',
  modules: [
    'nuxt-content-twoslash',
    '@nuxt/content',
  ],
  twoslash: {},
  content: {
    build: {
      markdown: {
        highlight: {
          theme: 'vitesse-light',
        },
      },
    },
    experimental: {
      sqliteConnector: 'native',
    },
  },
})
