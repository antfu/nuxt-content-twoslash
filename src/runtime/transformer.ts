import type { VitePressPluginTwoslashOptions } from '@shikijs/vitepress-twoslash'
import type { ModuleOptions } from 'nuxt-content-twoslash'
import type { ShikiTransformer } from 'shiki/core'
import { join } from 'pathe'
import type { TwoslashExecuteOptions } from 'twoslash'

import type { NuxtCompilerOptions, TsConfigContext } from './utils'
import { detectTsConfigContext, getCompilerOptionsForContext } from './utils'

/**
 * Get the appropriate type reference and imports based on the TypeScript context.
 * - `node` context uses nuxt.node.d.ts (for nuxt.config.ts, modules)
 * - `server` context uses types/nitro-nuxt.d.ts (for server/ directory)
 * - `app` and `default` contexts use nuxt.d.ts (for components, pages, etc.)
 */
function getPrependForContext(rootDir: string, context: TsConfigContext): string {
  const buildDir = join(rootDir, '.nuxt')
  const lines: string[] = []

  switch (context) {
    case 'node':
      // For nuxt.config.ts and modules - need defineNuxtConfig from nuxt/config
      lines.push(`/// <reference path="${join(buildDir, 'nuxt.node.d.ts')}" />`)
      break
    case 'server':
      // For server/ directory - need h3 types for defineEventHandler etc.
      lines.push(`/// <reference path="${join(buildDir, 'types/nitro-nuxt.d.ts')}" />`)
      break
    case 'shared':
      lines.push(`/// <reference path="${join(buildDir, 'nuxt.shared.d.ts')}" />`)
      break
    case 'app':
    case 'default':
    default:
      lines.push(`/// <reference path="${join(buildDir, 'nuxt.d.ts')}" />`)
      break
  }

  lines.push('')
  return lines.join('\n')
}

export async function createTransformer(
  rootDir: string,
  moduleOptions: ModuleOptions,
  typeDecorations: Record<string, string>,
  compilerOptions?: NuxtCompilerOptions,
  extraOptions?: VitePressPluginTwoslashOptions,
): Promise<ShikiTransformer> {
  const [{ transformerTwoslash, rendererFloatingVue }, { createTwoslasher }] = await Promise.all([import('@shikijs/vitepress-twoslash'), import('twoslash')])

  let currentMeta: string | undefined

  const baseTwoslasher = createTwoslasher()
  const twoslasher = (code: string, lang?: string, options?: TwoslashExecuteOptions) => {
    const meta = (options as any)?.meta as string | undefined ?? currentMeta
    const context = detectTsConfigContext(meta, compilerOptions)
    const contextCompilerOptions = getCompilerOptionsForContext(compilerOptions, context)

    // Build extraFiles with context-specific type references
    const prepend = getPrependForContext(rootDir, context)

    const contextExtraFiles = moduleOptions.includeNuxtTypes
      ? {
          ...typeDecorations,
          'index.ts': { prepend },
          'index.tsx': { prepend },
        }
      : undefined

    const mergedOptions: TwoslashExecuteOptions = {
      ...options,
      extraFiles: contextExtraFiles,
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

  const twoslashTransformer = transformerTwoslash({
    throws: !!moduleOptions.throws,
    twoslasher,
    renderer: rendererFloatingVue({
      floatingVue: moduleOptions.floatingVueOptions,
      processHoverInfo(hover) {
        return hover.replace(/globalThis\./g, '')
      },
    }),
    twoslashOptions: {
      handbookOptions: moduleOptions.handbookOptions,
    },
    ...extraOptions,
  })

  return {
    ...twoslashTransformer,
    name: 'nuxt-content-twoslash',
    preprocess(code, options) {
      currentMeta = (options.meta as any)?.__raw ?? (typeof options.meta === 'string' ? options.meta : undefined)
      if (twoslashTransformer.preprocess) {
        return twoslashTransformer.preprocess.call(this, code, options)
      }
      return code
    },
  }
}
