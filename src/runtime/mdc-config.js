// @ts-check

import process from 'node:process'
import { defineConfig } from '@nuxtjs/mdc/config'
import picomatch from 'picomatch'
import { visit } from 'unist-util-visit'

async function fallback() {
  const { removeTwoslashNotations } = await import('twoslash/fallback')
  return [{
    name: 'twoslash:fallback',
    /** @param {string} code */
    preprocess: code => removeTwoslashNotations(code),
  }]
}

/**
 * Context matching priority order: node (most specific) → app → shared → server (catch-all).
 */
const CONTEXT_PRIORITY = ['node', 'app', 'shared', 'server']

/**
 * Resolve which type context a filename belongs to.
 * @param {string | undefined} filename
 * @param {Record<string, { include: string[], exclude: string[] }>} contextConfigs
 * @returns {string | undefined} The resolved context name
 */
function resolveFileContext(filename, contextConfigs) {
  if (!filename)
    return undefined

  const relativePath = `../${filename}`

  for (const contextName of CONTEXT_PRIORITY) {
    const config = contextConfigs[contextName]
    if (!config || !config.include || config.include.length === 0)
      continue

    const included = picomatch.isMatch(relativePath, config.include)
    const excluded = config.exclude && config.exclude.length > 0 && picomatch.isMatch(relativePath, config.exclude)

    if (included && !excluded)
      return contextName
  }

  return undefined
}

/** @type {Record<string, import('shiki/core').ShikiTransformer>} */
const transformerCache = {}

export default defineConfig({
  unified: {
    rehype(processor) {
      // Add a rehype plugin that runs before the highlight plugin.
      // It encodes [filename] (already parsed by MDC into properties.filename)
      // back into the meta string so the shiki transformer can access it.
      return processor.use(() => (/** @type {any} */ tree) => {
        visit(tree, 'element', (/** @type {any} */ node) => {
          if (node.tagName === 'pre' && node.properties?.filename) {
            const filename = node.properties.filename
            const meta = node.properties.meta || ''
            node.properties.meta = `${meta} __twoslash_filename=${filename}`.trim()
          }
        })
      })
    },
  },
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
        const { rootDir, typeDecorations, moduleOptions, compilerOptions, hasProjectReferences: hasProjectRefs, contextConfigs } = await import('./twoslash-meta.mjs')

        // Use process.env instead of import.meta.dev
        if ((process.env.NODE_ENV === 'development' || import.meta.dev) && !moduleOptions.enableInDev)
          return fallback()

        // Parse __twoslash_filename from meta (injected by our rehype plugin above)
        let filename
        let cleanMeta = options.meta
        const filenameMatch = options.meta.match(/__twoslash_filename=(\S+)/)
        if (filenameMatch) {
          filename = filenameMatch[1]
          cleanMeta = options.meta.replace(filenameMatch[0], '').trim()
        }

        // Determine which context to use
        let cacheKey = 'default'
        if (hasProjectRefs && filename && contextConfigs) {
          const context = resolveFileContext(filename, contextConfigs)
          if (context)
            cacheKey = context
        }

        // Return cached transformer if available
        if (transformerCache[cacheKey]) {
          // We need a wrapper to inject the cleaned meta
          if (filename) {
            return [wrapTransformerWithCleanMeta(transformerCache[cacheKey], cleanMeta)]
          }
          return [transformerCache[cacheKey]]
        }

        const { createTransformer, createContextTransformer } = await import('nuxt-content-twoslash/runtime/transformer')

        if (hasProjectRefs && cacheKey !== 'default' && contextConfigs[cacheKey]) {
          const transformer = await createContextTransformer(rootDir, moduleOptions, typeDecorations, contextConfigs[cacheKey])
          transformerCache[cacheKey] = transformer
          if (filename) {
            return [wrapTransformerWithCleanMeta(transformer, cleanMeta)]
          }
          return [transformer]
        }

        // Fallback: use legacy single transformer
        const transformer = await createTransformer(rootDir, moduleOptions, typeDecorations, compilerOptions)
        transformerCache.default = transformer
        if (filename) {
          return [wrapTransformerWithCleanMeta(transformer, cleanMeta)]
        }
        return [transformer]
      }
      catch (e) {
        console.warn('[nuxt-content-twoslash] Failed:', e instanceof Error ? e.message : e)
        return fallback()
      }
    },
  },
})

/**
 * Wrap a transformer to strip __twoslash_filename from the meta before twoslash processes it.
 * @param {import('shiki/core').ShikiTransformer} transformer
 * @param {string} cleanMeta
 * @returns {import('shiki/core').ShikiTransformer} Wrapped transformer with cleaned meta
 */
function wrapTransformerWithCleanMeta(transformer, cleanMeta) {
  return {
    ...transformer,
    preprocess(code, options) {
      // Override the meta to remove __twoslash_filename before twoslash sees it
      if (options.meta) {
        options.meta.__raw = cleanMeta
      }
      return transformer.preprocess?.call(this, code, options)
    },
  }
}
