// @ts-check

import process from 'node:process'
import { defineConfig } from '@nuxtjs/mdc/config'

async function fallback() {
  const { removeTwoslashNotations } = await import('twoslash/fallback')
  return [{
    name: 'twoslash:fallback',
    /** @param {string} code */
    preprocess: code => removeTwoslashNotations(code),
  }]
}

export default defineConfig({
  shiki: {
    async setup(shiki) {
      await shiki.loadLanguage(
        import('shiki/langs/javascript.mjs'),
        import('shiki/langs/typescript.mjs'),
        import('shiki/langs/vue.mjs'),
      )
    },
    transformers: async (_code, _lang, _theme, options) => {
      if (typeof options.meta !== 'string' || !options.meta.match(/\btwoslash\b/))
        return []

      // Use typeof window instead of import.meta.server (works in Node.js)
      if (typeof globalThis.window !== 'undefined')
        return fallback()

      try {
        // @ts-expect-error this file will be written to .nuxt/
        const { rootDir, typeDecorations, moduleOptions, compilerOptions } = await import('./twoslash-meta.mjs')

        // Use process.env instead of import.meta.dev
        if ((process.env.NODE_ENV === 'development' || import.meta.dev) && !moduleOptions.enableInDev)
          return fallback()

        const { createTransformer } = await import('nuxt-content-twoslash/runtime/transformer')
        return [await createTransformer(rootDir, moduleOptions, typeDecorations, compilerOptions)]
      }
      catch (e) {
        console.warn('[nuxt-content-twoslash] Failed:', e instanceof Error ? e.message : e)
        return fallback()
      }
    },
  },
})
