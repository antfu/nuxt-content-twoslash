import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import fg from 'fast-glob'
import { minimatch } from 'minimatch'
import { dirname, join, relative, resolve } from 'pathe'
import ts from 'typescript'

export type TsConfigContext = 'app' | 'node' | 'server' | 'shared' | 'default'

interface TsConfigWithPatterns {
  compilerOptions: Record<string, any>
  include?: string[]
  exclude?: string[]
}

export interface NuxtCompilerOptions {
  /** `app/` directory (tsconfig.app.json) - for components, pages, plugins */
  app?: TsConfigWithPatterns
  /** `nuxt.config` file, modules and configuration (tsconfig.node.json) */
  node?: TsConfigWithPatterns
  /** `server/` directory (tsconfig.server.json) */
  server?: TsConfigWithPatterns
  /** `shared/` directory (tsconfig.shared.json) */
  shared?: TsConfigWithPatterns
  /** fallback compilerOptions merging others together (from tsconfig.json) */
  default?: Record<string, any>
}

export async function getTypeDecorations(dir: string, filesMap: Record<string, string> = {}) {
  const files = await fg('**/*.d.ts', {
    cwd: dir,
    onlyFiles: true,
  })
  await Promise.all(
    files.map(async (file) => {
      filesMap[`.nuxt/${file}`] = await fs.readFile(join(dir, file), 'utf-8')
    }),
  )
  return filesMap
}

async function parseTsConfig(path: string, dir: string): Promise<TsConfigWithPatterns> {
  if (!existsSync(path)) {
    return { compilerOptions: {} }
  }

  try {
    const tsconfig = await fs.readFile(path, 'utf-8')
    const config = JSON.parse(removeJSONComments(tsconfig)) || {}
    const json = ts.convertCompilerOptionsFromJson(config.compilerOptions, dir, '').options

    Object.entries(json.paths || {}).forEach(([key, value]) => {
        json.paths![key] = value.map((v: string) => `./${relative(dirname(dir), resolve(dir, v))}`)
      if (key === '#imports')
        json.paths![key] = ['./.nuxt/imports.d.ts']
    })

    return {
      compilerOptions: json,
      include: config.include,
      exclude: config.exclude,
    }
  }
  catch (e) {
    console.error(`[nuxt-content-twoslash] Failed to parse \`${path}\``, e)
    return { compilerOptions: {} }
  }
}

export async function getNuxtCompilerOptions(dir: string): Promise<NuxtCompilerOptions> {
  const configs: NuxtCompilerOptions = {
    default: {},
  }

  const [defaultConfig, appConfig, nodeConfig, serverConfig, sharedConfig] = await Promise.all([
    parseTsConfig(join(dir, 'tsconfig.json'), dir),
    parseTsConfig(join(dir, 'tsconfig.app.json'), dir),
    parseTsConfig(join(dir, 'tsconfig.node.json'), dir),
    parseTsConfig(join(dir, 'tsconfig.server.json'), dir),
    parseTsConfig(join(dir, 'tsconfig.shared.json'), dir),
  ])

  configs.default = defaultConfig.compilerOptions
  if (Object.keys(appConfig.compilerOptions).length > 0)
    configs.app = appConfig
  if (Object.keys(nodeConfig.compilerOptions).length > 0)
    configs.node = nodeConfig
  if (Object.keys(serverConfig.compilerOptions).length > 0)
    configs.server = serverConfig
  if (Object.keys(sharedConfig.compilerOptions).length > 0)
    configs.shared = sharedConfig

  return configs
}

/**
 * Detect which TypeScript config context to use based on filename in metadata
 */
export function detectTsConfigContext(meta?: string, configs?: NuxtCompilerOptions): TsConfigContext {
  if (!meta) {
    return 'default'
  }

  // Check for explicit context in metadata ("context:server")
  const contextMatch = meta.match(/\bcontext:(app|node|server|shared)\b/)
  if (contextMatch) {
    return contextMatch[1] as TsConfigContext
  }

  // Extract filename from metadata ("ts twoslash [nuxt.config.ts]")
  const filenameMatch = meta.match(/\[([^\]]+)\]/)
  if (!filenameMatch || !configs) {
    return 'default'
  }

  const filename = filenameMatch[1]

  const contexts: Array<{ name: TsConfigContext, config?: TsConfigWithPatterns }> = [
    { name: 'server', config: configs.server },
    { name: 'node', config: configs.node },
    { name: 'app', config: configs.app },
    { name: 'shared', config: configs.shared },
  ]

  for (const { name, config } of contexts) {
    if (config && matchesGlobPatterns(filename, config.include, config.exclude)) {
      return name
    }
  }

  return 'default'
}

/**
 * Check if a filename matches the include/exclude glob patterns
 */
function matchesGlobPatterns(
  filename?: string,
  include?: string[],
  exclude?: string[],
): boolean {
  if (!filename || !include || include.length === 0) {
    return false
  }

  // we use `minimatch` as it is also used internally by `typescript`
  const matchesInclude = include.some(pattern =>
    minimatch(filename, pattern, { dot: true }),
  )

  if (!matchesInclude) {
    return false
  }

  // Check exclude patterns
  if (exclude && exclude.length > 0) {
    const matchesExclude = exclude.some(pattern =>
      minimatch(filename, pattern, { dot: true }),
    )
    if (matchesExclude) {
      return false
    }
  }

  return true
}

/**
 * Get the appropriate compiler options for a given context
 * Falls back to default if the specific context config doesn't exist
 */
export function getCompilerOptionsForContext(
  configs: NuxtCompilerOptions | undefined,
  context: TsConfigContext,
): Record<string, any> {
  if (!configs) {
    return {}
  }
  if (context !== 'default' && configs[context]) {
    return configs[context]!.compilerOptions
  }
  return configs.default || {}
}

export function removeJSONComments(content: string) {
  return content.replace(/\/\/.*/g, '')
}
