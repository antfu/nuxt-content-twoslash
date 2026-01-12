import type { NuxtCompilerOptions } from '../src/runtime/utils'
import { describe, expect, it } from 'vitest'
import { getNuxtCompilerOptions, getTypeDecorations } from '../src/runtime/utils'

describe('getNuxtCompilerOptions', () => {
  it('should read tsconfig.json and return default config', async () => {
    // Create a mock .nuxt directory structure
    const mockDir = './test/fixtures/nuxt-v3/.nuxt'
    const configs = await getNuxtCompilerOptions(mockDir)

    expect(configs).toHaveProperty('default')
    expect(typeof configs.default).toBe('object')
  })

  it('should read all project-based tsconfigs when available', async () => {
    const mockDir = './test/fixtures/nuxt-v4/.nuxt'
    const configs = await getNuxtCompilerOptions(mockDir)

    expect(configs).toHaveProperty('default')
    expect(configs.app).toBeDefined()
    expect(configs.server).toBeDefined()
    expect(configs.node).toBeDefined()

    // Verify they have the expected structure
    if (configs.app) {
      expect(configs.app).toHaveProperty('compilerOptions')
      expect(configs.app).toHaveProperty('include')
    }

    if (configs.server) {
      expect(configs.server).toHaveProperty('compilerOptions')
      expect(configs.server).toHaveProperty('include')
    }
  })

  it('should handle missing tsconfig gracefully', async () => {
    const mockDir = './test/fixtures/non-existent'
    const configs = await getNuxtCompilerOptions(mockDir)

    expect(configs).toHaveProperty('default')
    expect(configs.default).toEqual({})
  })
})

describe('getTypeDecorations', () => {
  it('should read .d.ts files from directory', async () => {
    const mockDir = './test/fixtures/nuxt-v3/.nuxt'
    const filesMap: Record<string, string> = {}
    await getTypeDecorations(mockDir, filesMap)

    // Should have some .d.ts files mapped
    expect(typeof filesMap).toBe('object')
  })

  it('should prefix files with .nuxt/', async () => {
    const mockDir = './test/fixtures/nuxt-v3/.nuxt'
    const filesMap: Record<string, string> = {}
    await getTypeDecorations(mockDir, filesMap)

    // All keys should start with .nuxt/
    for (const key of Object.keys(filesMap)) {
      expect(key).toMatch(/^\.nuxt\//)
    }
  })
})

describe('integration with transformer', () => {
  it('should use correct config for server file', async () => {
    const mockConfigs: NuxtCompilerOptions = {
      default: {},
      server: {
        compilerOptions: { module: 99 as any, target: 99 as any },
        include: ['server/**/*'],
        exclude: [],
      },
    }

    const { detectTsConfigContext, getCompilerOptionsForContext } = await import('../src/runtime/utils')

    const context = detectTsConfigContext('[server/api/hello.ts]', mockConfigs)
    expect(context).toBe('server')

    const options = getCompilerOptionsForContext(mockConfigs, context)
    expect(options.module).toBe(99)
  })

  it('should use correct config for component file', async () => {
    const mockConfigs: NuxtCompilerOptions = {
      default: {},
      app: {
        compilerOptions: { jsx: 1 as any },
        include: ['components/**/*'],
        exclude: [],
      },
    }

    const { detectTsConfigContext, getCompilerOptionsForContext } = await import('../src/runtime/utils')

    const context = detectTsConfigContext('[components/Button.vue]', mockConfigs)
    expect(context).toBe('app')

    const options = getCompilerOptionsForContext(mockConfigs, context)
    expect(options.jsx).toBe(1)
  })

  it('should use correct config for shared file', async () => {
    const mockConfigs: NuxtCompilerOptions = {
      default: {},
      shared: {
        compilerOptions: { composite: true },
        include: ['shared/**/*'],
        exclude: [],
      },
    }

    const { detectTsConfigContext, getCompilerOptionsForContext } = await import('../src/runtime/utils')

    const context = detectTsConfigContext('[shared/types.ts]', mockConfigs)
    expect(context).toBe('shared')

    const options = getCompilerOptionsForContext(mockConfigs, context)
    expect(options.composite).toBe(true)
  })

  it('should fallback to default for unknown file', async () => {
    const mockConfigs: NuxtCompilerOptions = {
      default: { strict: true },
      app: {
        compilerOptions: {},
        include: ['components/**/*'],
        exclude: [],
      },
    }

    const { detectTsConfigContext, getCompilerOptionsForContext } = await import('../src/runtime/utils')

    const context = detectTsConfigContext('[random/file.ts]', mockConfigs)
    expect(context).toBe('default')

    const options = getCompilerOptionsForContext(mockConfigs, context)
    expect(options.strict).toBe(true)
  })
})
