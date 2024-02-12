export default defineNuxtConfig({
  modules: [
    '../src/module',
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
