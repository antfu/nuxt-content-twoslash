import { defineConfig } from '@nuxtjs/mdc/config'

export default defineConfig({
  shiki: {
    async setup(shiki) {
      // Ensure necessary languages are loaded
      await shiki.loadLanguage(
        import('shiki/langs/javascript.mjs'),
        import('shiki/langs/typescript.mjs'),
      )
    },
    transformers: async (_code, _lang, _theme, options) => {
      // We only runs TwoSlash at build time
      // As Nuxt Content cache the result automatically, we don't need to ship twoslash in any production bundle
      if (import.meta.server && (import.meta.prerender || import.meta.dev)) {
        const typeFiles = await import('#twoslash-types').then(mod => mod.default)
        // TODO: read them from the local file system
        const prepend = [
          '/// <reference types="./.nuxt/nuxt.d.ts" />',
          '',
        ].join('\n')

        if (typeof options.meta === 'string' && options.meta?.includes('twoslash')) {
          // console.log('RENDERING TWOSLASH', _code)
          const { transformerTwoslash, rendererFloatingVue } = await import('@shikijs/vitepress-twoslash')
          return [
            transformerTwoslash({
              renderer: rendererFloatingVue({
                floatingVue: {
                  classMarkdown: 'prose prose-primary dark:prose-invert',
                },
              }),
              twoslashOptions: {
                extraFiles: {
                  ...typeFiles,
                  'index.ts': { prepend },
                  'index.tsx': { prepend },
                },
                compilerOptions: {
                  lib: ['esnext', 'dom'],
                },
              },
            }),
          ]
        }
        // TODO: we should fallback to a transformer that remove twoslash notations for plain text
      }
      return []
    },
  },
})
