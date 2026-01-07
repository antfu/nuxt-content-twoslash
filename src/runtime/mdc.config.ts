import { defineConfig } from '@nuxtjs/mdc/config'

export default defineConfig({
  shiki: {
    async setup(shiki) {
      // Ensure necessary languages are loaded
      await shiki.loadLanguage(
        import('shiki/langs/javascript.mjs'),
        import('shiki/langs/typescript.mjs'),
        import('shiki/langs/vue.mjs'),
      )
    },
    transformers: async (_code, _lang, _theme, options) => {
      if (typeof options.meta !== 'string' || !options.meta?.match(/\btwoslash\b/))
        return []

      // We only runs TwoSlash at build time
      // As Nuxt Content cache the result automatically, we don't need to ship twoslash in any production bundle
      if (import.meta.server && (import.meta.prerender || import.meta.dev)) {
        const {
          rootDir,
          typeDecorations,
          moduleOptions,
          compilerOptions,
        } = await import('#twoslash-meta')

        if (import.meta.dev && !moduleOptions.enableInDev) {
          const { removeTwoslashNotations } = await import('twoslash/fallback')
          return [
            {
              name: 'twoslash:fallback',
              preprocess(code) {
                return removeTwoslashNotations(code)
              },
            },
          ]
        }

        return [
          await import('./transformer').then(({ createTransformer }) =>
            createTransformer(rootDir, moduleOptions, typeDecorations, compilerOptions),
          ),
        ]
      }
      // Fallback to remove twoslash notations
      else {
        const { removeTwoslashNotations } = await import('twoslash/fallback')
        return [
          {
            name: 'twoslash:fallback',
            preprocess(code) {
              return removeTwoslashNotations(code)
            },
          },
        ]
      }
    },
  },
})
