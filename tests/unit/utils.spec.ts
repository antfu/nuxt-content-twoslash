import type { ContextConfig } from '../../src/utils'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import {
  filterTypeDecorationsForContext,
  getNuxtContextConfigs,
  hasProjectReferences,
  parseFilenameFromMeta,
  resolveFileContext,
  stripFilenameFromMeta,
} from '../../src/utils'

describe('parseFilenameFromMeta', () => {
  it('should extract filename from meta with [filename]', () => {
    expect(parseFilenameFromMeta('twoslash [server/api/hello.ts]')).toBe('server/api/hello.ts')
  })

  it('should extract filename from meta with spaces', () => {
    expect(parseFilenameFromMeta('twoslash  [app/app.vue]  ')).toBe('app/app.vue')
  })

  it('should return undefined when no filename present', () => {
    expect(parseFilenameFromMeta('twoslash')).toBeUndefined()
  })

  it('should return undefined for undefined meta', () => {
    expect(parseFilenameFromMeta(undefined)).toBeUndefined()
  })

  it('should return undefined for empty string', () => {
    expect(parseFilenameFromMeta('')).toBeUndefined()
  })

  it('should handle nuxt.config.ts filename', () => {
    expect(parseFilenameFromMeta('twoslash [nuxt.config.ts]')).toBe('nuxt.config.ts')
  })

  it('should handle nested paths', () => {
    expect(parseFilenameFromMeta('twoslash [server/routes/api/v1/users.ts]')).toBe('server/routes/api/v1/users.ts')
  })
})

describe('stripFilenameFromMeta', () => {
  it('should remove [filename] from meta', () => {
    expect(stripFilenameFromMeta('twoslash [server/api/hello.ts]')).toBe('twoslash')
  })

  it('should handle meta with only [filename]', () => {
    expect(stripFilenameFromMeta('[app/app.vue]')).toBe('')
  })

  it('should handle meta without [filename]', () => {
    expect(stripFilenameFromMeta('twoslash')).toBe('twoslash')
  })

  it('should preserve other meta content', () => {
    expect(stripFilenameFromMeta('twoslash [server/api/hello.ts] {1,3}')).toBe('twoslash {1,3}')
  })
})

describe('resolveFileContext', () => {
  const mockContextConfigs: Record<string, ContextConfig> = {
    node: {
      name: 'node',
      compilerOptions: {},
      referenceFile: 'nuxt.node.d.ts',
      include: ['../nuxt.config.*', '../.config/nuxt.*', '../modules/*.*'],
      exclude: [],
      internalIncludes: ['./nuxt.node.d.ts'],
    },
    app: {
      name: 'app',
      compilerOptions: {},
      referenceFile: 'nuxt.d.ts',
      include: ['../app/**/*', '../layers/*/app/**/*'],
      exclude: ['../modules/*/runtime/server/**/*'],
      internalIncludes: ['./nuxt.d.ts'],
    },
    shared: {
      name: 'shared',
      compilerOptions: {},
      referenceFile: 'nuxt.shared.d.ts',
      include: ['../shared/**/*', '../modules/*/shared/**/*'],
      exclude: [],
      internalIncludes: ['./nuxt.shared.d.ts'],
    },
    server: {
      name: 'server',
      compilerOptions: {},
      referenceFile: 'nuxt.d.ts',
      include: ['../server/**/*'],
      exclude: [],
      internalIncludes: ['./types/nitro-nuxt.d.ts'],
    },
  }

  it('should resolve server context', () => {
    expect(resolveFileContext('server/api/hello.ts', mockContextConfigs)).toBe('server')
  })

  it('should resolve node context for nuxt.config.ts', () => {
    expect(resolveFileContext('nuxt.config.ts', mockContextConfigs)).toBe('node')
  })

  it('should resolve app context', () => {
    expect(resolveFileContext('app/app.vue', mockContextConfigs)).toBe('app')
  })

  it('should resolve shared context', () => {
    expect(resolveFileContext('shared/utils.ts', mockContextConfigs)).toBe('shared')
  })

  it('should return undefined for undefined filename', () => {
    expect(resolveFileContext(undefined, mockContextConfigs)).toBeUndefined()
  })

  it('should return undefined for unmatched filename', () => {
    expect(resolveFileContext('random/file.ts', mockContextConfigs)).toBeUndefined()
  })

  it('should resolve deeply nested server files', () => {
    expect(resolveFileContext('server/routes/api/v1/users.ts', mockContextConfigs)).toBe('server')
  })

  it('should resolve deeply nested app files', () => {
    expect(resolveFileContext('app/components/deep/Button.vue', mockContextConfigs)).toBe('app')
  })

  it('should resolve .config/nuxt.* to node context', () => {
    expect(resolveFileContext('.config/nuxt.ts', mockContextConfigs)).toBe('node')
  })

  it('should prioritize node over other contexts', () => {
    // nuxt.config.ts should match node, not anything else
    expect(resolveFileContext('nuxt.config.ts', mockContextConfigs)).toBe('node')
  })
})

describe('filterTypeDecorationsForContext', () => {
  const allDecorations: Record<string, string> = {
    '.nuxt/nuxt.d.ts': 'app types',
    '.nuxt/nuxt.node.d.ts': 'node types',
    '.nuxt/nuxt.shared.d.ts': 'shared types',
    '.nuxt/imports.d.ts': 'imports',
    '.nuxt/types/nitro-nuxt.d.ts': 'nitro types',
    '.nuxt/types/nitro.d.ts': 'nitro config',
    '.nuxt/content/types.d.ts': 'content types',
    '.nuxt/components.d.ts': 'component types',
  }

  it('should filter to only app reference file', () => {
    const config: ContextConfig = {
      name: 'app',
      compilerOptions: {},
      referenceFile: 'nuxt.d.ts',
      include: [],
      exclude: [],
      internalIncludes: ['./nuxt.d.ts'],
    }
    const result = filterTypeDecorationsForContext(allDecorations, config)
    expect(Object.keys(result)).toEqual(['.nuxt/nuxt.d.ts'])
  })

  it('should filter to only node reference file', () => {
    const config: ContextConfig = {
      name: 'node',
      compilerOptions: {},
      referenceFile: 'nuxt.node.d.ts',
      include: [],
      exclude: [],
      internalIncludes: ['./nuxt.node.d.ts'],
    }
    const result = filterTypeDecorationsForContext(allDecorations, config)
    expect(Object.keys(result)).toEqual(['.nuxt/nuxt.node.d.ts'])
  })

  it('should filter to multiple files for server context', () => {
    const config: ContextConfig = {
      name: 'server',
      compilerOptions: {},
      referenceFile: 'nuxt.d.ts',
      include: [],
      exclude: [],
      internalIncludes: ['./content/types.d.ts', './types/nitro-nuxt.d.ts', './types/nitro.d.ts'],
    }
    const result = filterTypeDecorationsForContext(allDecorations, config)
    expect(Object.keys(result).sort()).toEqual([
      '.nuxt/content/types.d.ts',
      '.nuxt/types/nitro-nuxt.d.ts',
      '.nuxt/types/nitro.d.ts',
    ])
  })

  it('should return all decorations when no internal includes specified', () => {
    const config: ContextConfig = {
      name: 'fallback',
      compilerOptions: {},
      referenceFile: 'nuxt.d.ts',
      include: [],
      exclude: [],
      internalIncludes: [],
    }
    const result = filterTypeDecorationsForContext(allDecorations, config)
    expect(Object.keys(result)).toEqual(Object.keys(allDecorations))
  })

  it('should support glob patterns in internal includes', () => {
    const config: ContextConfig = {
      name: 'glob-test',
      compilerOptions: {},
      referenceFile: 'nuxt.d.ts',
      include: [],
      exclude: [],
      internalIncludes: ['./types/*.d.ts'],
    }
    const result = filterTypeDecorationsForContext(allDecorations, config)
    expect(Object.keys(result).sort()).toEqual([
      '.nuxt/types/nitro-nuxt.d.ts',
      '.nuxt/types/nitro.d.ts',
    ])
  })
})

describe('hasProjectReferences', () => {
  it('should return true for nuxt-v4 fixture', () => {
    const buildDir = join(process.cwd(), 'test/fixtures/nuxt-v4/.nuxt')
    if (existsSync(buildDir)) {
      expect(hasProjectReferences(buildDir)).toBe(true)
    }
  })

  it('should return false for content-v3 fixture', () => {
    const buildDir = join(process.cwd(), 'test/fixtures/content-v3/.nuxt')
    if (existsSync(buildDir)) {
      expect(hasProjectReferences(buildDir)).toBe(false)
    }
  })

  it('should return false for non-existent directory', () => {
    expect(hasProjectReferences('/non/existent/path')).toBe(false)
  })
})

describe('getNuxtContextConfigs', () => {
  it('should load all four contexts from nuxt-v4 fixture', async () => {
    const buildDir = join(process.cwd(), 'test/fixtures/nuxt-v4/.nuxt')
    if (!existsSync(buildDir))
      return

    const configs = await getNuxtContextConfigs(buildDir)

    expect(Object.keys(configs).sort()).toEqual(['app', 'node', 'server', 'shared'])
  })

  it('should populate reference files correctly', async () => {
    const buildDir = join(process.cwd(), 'test/fixtures/nuxt-v4/.nuxt')
    if (!existsSync(buildDir))
      return

    const configs = await getNuxtContextConfigs(buildDir)

    expect(configs.app.referenceFile).toBe('nuxt.d.ts')
    expect(configs.node.referenceFile).toBe('nuxt.node.d.ts')
    expect(configs.shared.referenceFile).toBe('nuxt.shared.d.ts')
    expect(configs.server.referenceFile).toBe('nuxt.d.ts')
  })

  it('should filter out catch-all ../**/* from server includes', async () => {
    const buildDir = join(process.cwd(), 'test/fixtures/nuxt-v4/.nuxt')
    if (!existsSync(buildDir))
      return

    const configs = await getNuxtContextConfigs(buildDir)

    expect(configs.server.include).not.toContain('../**/*')
  })

  it('should have non-empty include patterns for each context', async () => {
    const buildDir = join(process.cwd(), 'test/fixtures/nuxt-v4/.nuxt')
    if (!existsSync(buildDir))
      return

    const configs = await getNuxtContextConfigs(buildDir)

    for (const [name, config] of Object.entries(configs)) {
      expect(config.include.length, `${name} should have include patterns`).toBeGreaterThan(0)
    }
  })

  it('should return empty configs for non-existent directory', async () => {
    const configs = await getNuxtContextConfigs('/non/existent/path')
    expect(Object.keys(configs)).toEqual([])
  })

  it('should resolve file contexts correctly with real configs', async () => {
    const buildDir = join(process.cwd(), 'test/fixtures/nuxt-v4/.nuxt')
    if (!existsSync(buildDir))
      return

    const configs = await getNuxtContextConfigs(buildDir)

    expect(resolveFileContext('server/api/hello.ts', configs)).toBe('server')
    expect(resolveFileContext('nuxt.config.ts', configs)).toBe('node')
    expect(resolveFileContext('app/app.vue', configs)).toBe('app')
    expect(resolveFileContext('shared/utils.ts', configs)).toBe('shared')
    expect(resolveFileContext(undefined, configs)).toBeUndefined()
  })
})
