import { join } from 'pathe'

/**
 * @typedef {import('@shikijs/vitepress-twoslash').VitePressPluginTwoslashOptions} VitePressPluginTwoslashOptions
 * @typedef {import('nuxt-content-twoslash').ModuleOptions} ModuleOptions
 * @typedef {import('shiki/core').ShikiTransformer} ShikiTransformer
 */

/**
 * @typedef {object} ContextConfig
 * @property {string} name - Context name (e.g., 'app', 'server', 'node', 'shared')
 * @property {Record<string, any>} compilerOptions - TypeScript compiler options for this context
 * @property {string} referenceFile - The reference .d.ts file to prepend
 * @property {string[]} include - Include glob patterns for matching files
 * @property {string[]} exclude - Exclude glob patterns for matching files
 */

/**
 * Create a twoslash transformer for shiki
 * @param {string} rootDir
 * @param {ModuleOptions} moduleOptions
 * @param {Record<string, string>} typeDecorations
 * @param {Record<string, any>} [compilerOptions]
 * @param {VitePressPluginTwoslashOptions} [extraOptions]
 * @returns {Promise<ShikiTransformer>} The created shiki transformer
 */
export async function createTransformer(
  rootDir,
  moduleOptions,
  typeDecorations,
  compilerOptions,
  extraOptions,
) {
  const prepend = [
    `/// <reference path="${join(rootDir, '.nuxt/nuxt.d.ts')}" />`,
    '',
  ].join('\n')

  const { transformerTwoslash, rendererFloatingVue } = await import('@shikijs/vitepress-twoslash')
  return transformerTwoslash({
    throws: !!moduleOptions.throws,
    renderer: rendererFloatingVue({
      floatingVue: moduleOptions.floatingVueOptions,
      processHoverInfo(hover) {
        return hover.replace(/globalThis\./g, '')
      },
    }),
    twoslashOptions: {
      extraFiles: moduleOptions.includeNuxtTypes
        ? {
            ...typeDecorations,
            'index.ts': { prepend },
            'index.tsx': { prepend },
          }
        : undefined,
      compilerOptions: {
        lib: ['esnext', 'dom'],
        jsx: 1, // Preserve
        jsxImportSource: 'vue',
        ...compilerOptions,
        ...moduleOptions.compilerOptions,
      },
      handbookOptions: moduleOptions.handbookOptions,
    },
    ...extraOptions,
  })
}

/**
 * Create a transformer for a specific type context (app, server, node, shared).
 * Uses context-specific compiler options and reference .d.ts file.
 * @param {string} rootDir
 * @param {ModuleOptions} moduleOptions
 * @param {Record<string, string>} typeDecorations
 * @param {ContextConfig} contextConfig
 * @param {VitePressPluginTwoslashOptions} [extraOptions]
 * @returns {Promise<ShikiTransformer>} The created context-specific shiki transformer
 */
export async function createContextTransformer(
  rootDir,
  moduleOptions,
  typeDecorations,
  contextConfig,
  extraOptions,
) {
  const prepend = [
    `/// <reference path="${join(rootDir, `.nuxt/${contextConfig.referenceFile}`)}" />`,
    '',
  ].join('\n')

  const { transformerTwoslash, rendererFloatingVue } = await import('@shikijs/vitepress-twoslash')
  return transformerTwoslash({
    throws: !!moduleOptions.throws,
    renderer: rendererFloatingVue({
      floatingVue: moduleOptions.floatingVueOptions,
      processHoverInfo(hover) {
        return hover.replace(/globalThis\./g, '')
      },
    }),
    twoslashOptions: {
      extraFiles: moduleOptions.includeNuxtTypes
        ? {
            ...typeDecorations,
            'index.ts': { prepend },
            'index.tsx': { prepend },
          }
        : undefined,
      compilerOptions: {
        lib: ['esnext', 'dom'],
        jsx: 1, // Preserve
        jsxImportSource: 'vue',
        ...contextConfig.compilerOptions,
        ...moduleOptions.compilerOptions,
      },
      handbookOptions: moduleOptions.handbookOptions,
    },
    ...extraOptions,
  })
}

/**
 * Create transformers for all available type contexts.
 * Also includes a 'default' transformer using the legacy tsconfig.json as fallback.
 * @param {string} rootDir
 * @param {ModuleOptions} moduleOptions
 * @param {Record<string, string>} typeDecorations
 * @param {Record<string, ContextConfig>} contextConfigs
 * @param {Record<string, any>} fallbackCompilerOptions - compiler options from legacy .nuxt/tsconfig.json
 * @param {VitePressPluginTwoslashOptions} [extraOptions]
 * @returns {Promise<Record<string, ShikiTransformer>>} Map of context name to transformer
 */
export async function createContextTransformers(
  rootDir,
  moduleOptions,
  typeDecorations,
  contextConfigs,
  fallbackCompilerOptions,
  extraOptions,
) {
  /** @type {Record<string, ShikiTransformer>} */
  const transformers = {}

  // Create a transformer for each context
  await Promise.all(
    Object.entries(contextConfigs).map(async ([name, config]) => {
      transformers[name] = await createContextTransformer(
        rootDir,
        moduleOptions,
        typeDecorations,
        config,
        extraOptions,
      )
    }),
  )

  // Create a fallback transformer using the legacy .nuxt/tsconfig.json
  transformers.default = await createTransformer(
    rootDir,
    moduleOptions,
    typeDecorations,
    fallbackCompilerOptions,
    extraOptions,
  )

  return transformers
}
