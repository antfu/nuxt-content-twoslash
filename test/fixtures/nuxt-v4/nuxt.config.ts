export default defineNuxtConfig({
  compatibilityDate: 'latest',
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
