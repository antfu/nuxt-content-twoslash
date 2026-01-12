import type { NuxtCompilerOptions } from '../src/runtime/utils'
import { describe, expect, it } from 'vitest'
import { detectTsConfigContext, getCompilerOptionsForContext } from '../src/runtime/utils'

describe('detectTsConfigContext', () => {
  const mockConfigs: NuxtCompilerOptions = {
    default: { strict: true },
    app: {
      compilerOptions: { jsx: 'preserve' },
      include: ['**/*.vue', 'components/**/*', 'pages/**/*', 'composables/**/*', 'plugins/**/*'],
      exclude: ['server/**'],
    },
    node: {
      compilerOptions: { module: 'ESNext' },
      include: ['*.config.ts', '**/*.config.ts'],
      exclude: [],
    },
    server: {
      compilerOptions: { lib: ['esnext'] },
      include: ['server/**/*', 'api/**/*'],
      exclude: [],
    },
    shared: {
      compilerOptions: { composite: true },
      include: ['shared/**/*'],
      exclude: [],
    },
  }

  describe('explicit context', () => {
    it('should detect explicit context:server', () => {
      expect(detectTsConfigContext('ts twoslash context:server', mockConfigs)).toBe('server')
    })

    it('should detect explicit context:node', () => {
      expect(detectTsConfigContext('ts twoslash context:node', mockConfigs)).toBe('node')
    })

    it('should detect explicit context:app', () => {
      expect(detectTsConfigContext('ts twoslash context:app', mockConfigs)).toBe('app')
    })

    it('should detect explicit context:shared', () => {
      expect(detectTsConfigContext('ts twoslash context:shared', mockConfigs)).toBe('shared')
    })
  })

  describe('filename-based detection', () => {
    it('should detect server context from server/ path', () => {
      expect(detectTsConfigContext('ts twoslash [server/api/hello.ts]', mockConfigs)).toBe('server')
    })

    it('should detect server context from api/ path', () => {
      expect(detectTsConfigContext('ts twoslash [api/users.ts]', mockConfigs)).toBe('server')
    })

    it('should detect node context from nuxt.config.ts', () => {
      expect(detectTsConfigContext('ts twoslash [nuxt.config.ts]', mockConfigs)).toBe('node')
    })

    it('should detect node context from any .config.ts file', () => {
      expect(detectTsConfigContext('ts twoslash [vite.config.ts]', mockConfigs)).toBe('node')
    })

    it('should detect app context from components/', () => {
      expect(detectTsConfigContext('ts twoslash [components/MyButton.vue]', mockConfigs)).toBe('app')
    })

    it('should detect app context from pages/', () => {
      expect(detectTsConfigContext('ts twoslash [pages/index.vue]', mockConfigs)).toBe('app')
    })

    it('should detect app context from composables/', () => {
      expect(detectTsConfigContext('ts twoslash [composables/useAuth.ts]', mockConfigs)).toBe('app')
    })

    it('should detect app context from plugins/', () => {
      expect(detectTsConfigContext('ts twoslash [plugins/init.ts]', mockConfigs)).toBe('app')
    })

    it('should detect app context from .vue files', () => {
      expect(detectTsConfigContext('ts twoslash [App.vue]', mockConfigs)).toBe('app')
    })

    it('should detect shared context from shared/ directory', () => {
      expect(detectTsConfigContext('ts twoslash [shared/utils.ts]', mockConfigs)).toBe('shared')
    })
  })

  describe('priority order', () => {
    it('should prioritize server over app for matching patterns', () => {
      // If a file matches both server and app patterns, server should win
      expect(detectTsConfigContext('ts twoslash [server/utils/helper.ts]', mockConfigs)).toBe('server')
    })

    it('should prioritize explicit context over filename detection', () => {
      expect(detectTsConfigContext('ts twoslash [server/api/hello.ts] context:app', mockConfigs)).toBe('app')
    })
  })

  describe('fallback behavior', () => {
    it('should return default when no meta is provided', () => {
      expect(detectTsConfigContext(undefined, mockConfigs)).toBe('default')
    })

    it('should return default when no filename is in brackets', () => {
      expect(detectTsConfigContext('ts twoslash', mockConfigs)).toBe('default')
    })

    it('should return default when no configs are provided', () => {
      expect(detectTsConfigContext('ts twoslash [some-file.ts]')).toBe('default')
    })

    it('should return default when filename does not match any pattern', () => {
      expect(detectTsConfigContext('ts twoslash [unknown/path/file.ts]', mockConfigs)).toBe('default')
    })
  })

  describe('without project-based configs', () => {
    const simpleConfigs: NuxtCompilerOptions = {
      default: { strict: true },
    }

    it('should return default when no project configs exist', () => {
      expect(detectTsConfigContext('ts twoslash [server/api/hello.ts]', simpleConfigs)).toBe('default')
    })

    it('should respect explicit context even without project configs', () => {
      expect(detectTsConfigContext('ts twoslash context:server', simpleConfigs)).toBe('server')
    })
  })
})

describe('getCompilerOptionsForContext', () => {
  const mockConfigs: NuxtCompilerOptions = {
    default: { strict: true, lib: ['dom'] },
    app: {
      compilerOptions: { jsx: 'preserve', strict: false },
      include: ['**/*.vue'],
    },
    server: {
      compilerOptions: { lib: ['esnext'], noEmit: true },
      include: ['server/**/*'],
    },
  }

  it('should return default config for default context', () => {
    const options = getCompilerOptionsForContext(mockConfigs, 'default')
    expect(options).toEqual({ strict: true, lib: ['dom'] })
  })

  it('should return app config for app context', () => {
    const options = getCompilerOptionsForContext(mockConfigs, 'app')
    expect(options).toEqual({ jsx: 'preserve', strict: false })
  })

  it('should return server config for server context', () => {
    const options = getCompilerOptionsForContext(mockConfigs, 'server')
    expect(options).toEqual({ lib: ['esnext'], noEmit: true })
  })

  it('should fallback to default when requested context does not exist', () => {
    const options = getCompilerOptionsForContext(mockConfigs, 'node')
    expect(options).toEqual({ strict: true, lib: ['dom'] })
  })

  it('should fallback to default when shared context does not exist', () => {
    const options = getCompilerOptionsForContext(mockConfigs, 'shared')
    expect(options).toEqual({ strict: true, lib: ['dom'] })
  })
})
