import { join } from 'pathe'

/**
 * @typedef {import('@shikijs/vitepress-twoslash').VitePressPluginTwoslashOptions} VitePressPluginTwoslashOptions
 * @typedef {import('nuxt-content-twoslash').ModuleOptions} ModuleOptions
 * @typedef {import('shiki/core').ShikiTransformer} ShikiTransformer
 */

/**
 * Create a twoslash transformer for shiki
 * @param {string} rootDir
 * @param {ModuleOptions} moduleOptions
 * @param {Record<string, string>} typeDecorations
 * @param {Record<string, any>} [compilerOptions]
 * @param {VitePressPluginTwoslashOptions} [extraOptions]
 * @returns {Promise<ShikiTransformer>}
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
