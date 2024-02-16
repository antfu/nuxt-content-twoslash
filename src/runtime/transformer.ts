import type { ShikiTransformer } from 'shiki/core'
import type { VitePressPluginTwoslashOptions } from '@shikijs/vitepress-twoslash'
import type { ModuleOptions } from '../module'

export async function createTransformer(
  moduleOptions: ModuleOptions,
  typeDecorations: Record<string, string>,
  extraOptions?: VitePressPluginTwoslashOptions,
): Promise<ShikiTransformer> {
  const prepend = [
    '/// <reference types="./.nuxt/nuxt.d.ts" />',
    '',
  ].join('\n')

  const { transformerTwoslash, rendererFloatingVue } = await import('@shikijs/vitepress-twoslash')
  return transformerTwoslash({
    throws: false,
    renderer: rendererFloatingVue({
      floatingVue: moduleOptions.floatingVueOptions,
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
        ...moduleOptions.compilerOptions,
      },
      handbookOptions: moduleOptions.handbookOptions,
    },
    ...extraOptions,
  })
}
