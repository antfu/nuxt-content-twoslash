import type { ModuleOptions } from '../module'

export async function createTransformer(
  moduleOptions: ModuleOptions,
  typeDecorations: Record<string, string>,
) {
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
        ...moduleOptions.compilerOptions,
      },
      handbookOptions: moduleOptions.handbookOptions,
    },
  })
}
