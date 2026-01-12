import type { VitePressPluginTwoslashOptions } from '@shikijs/vitepress-twoslash'
import type { ModuleOptions } from 'nuxt-content-twoslash'
import type { ShikiTransformer } from 'shiki/core'
import { join } from 'pathe'
import type { TwoslashExecuteOptions } from 'twoslash'

import type { NuxtCompilerOptions } from './utils'
import { detectTsConfigContext, getCompilerOptionsForContext } from './utils'

export async function createTransformer(
  rootDir: string,
  moduleOptions: ModuleOptions,
  typeDecorations: Record<string, string>,
  compilerOptions?: NuxtCompilerOptions,
  extraOptions?: VitePressPluginTwoslashOptions,
): Promise<ShikiTransformer> {
  const prepend = [
    `/// <reference path="${join(rootDir, '.nuxt/nuxt.d.ts')}" />`,
    '',
  ].join('\n')

  const [{ transformerTwoslash, rendererFloatingVue }, { createTwoslasher }] = await Promise.all([import('@shikijs/vitepress-twoslash'), import('twoslash')])

  const baseTwoslasher = createTwoslasher()
  const twoslasher = (code: string, lang?: string, options?: TwoslashExecuteOptions) => {
    const meta = (options as any)?.meta as string | undefined
    const context = detectTsConfigContext(meta, compilerOptions)
    const contextCompilerOptions = getCompilerOptionsForContext(compilerOptions, context)

    const mergedOptions: TwoslashExecuteOptions = {
      ...options,
      compilerOptions: {
        lib: ['esnext', 'dom'],
        jsx: 1, // Preserve
        jsxImportSource: 'vue',
        ...contextCompilerOptions,
        ...moduleOptions.compilerOptions,
        ...options?.compilerOptions,
      },
    }

    return baseTwoslasher(code, lang, mergedOptions)
  }

  return transformerTwoslash({
    throws: !!moduleOptions.throws,
    twoslasher,
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
      handbookOptions: moduleOptions.handbookOptions,
    },
    ...extraOptions,
  })
}
