import type { VitePressPluginTwoslashOptions } from '@shikijs/vitepress-twoslash'
import type { ModuleOptions } from 'nuxt-content-twoslash'
import type { ShikiTransformer } from 'shiki/core'

export async function createTransformer(
  moduleOptions: ModuleOptions,
  typeDecorations: Record<string, string>,
  compilerOptions?: Record<string, any>,
  extraOptions?: VitePressPluginTwoslashOptions,
): Promise<ShikiTransformer> {
  const prepend = [
    '/// <reference types="./.nuxt/nuxt.d.ts" />',
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
