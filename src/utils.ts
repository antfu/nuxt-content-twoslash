import type { TSConfig } from 'pkg-types'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import fg from 'fast-glob'
import { dirname, join, relative, resolve } from 'pathe'
import picomatch from 'picomatch'
import ts from 'typescript'

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

export async function getNuxtCompilerOptions(dir: string, tsconfigName = 'tsconfig.json') {
  const path = join(dir, tsconfigName)
  if (existsSync(path)) {
    try {
      const tsconfig = await fs.readFile(path, 'utf-8')
      const config = JSON.parse(removeJSONComments(tsconfig)) || {}
      const json = ts.convertCompilerOptionsFromJson(config.compilerOptions, dir, '').options
      Object.entries(json.paths || {}).forEach(([key, value]) => {
        json.paths![key] = value.map((v: string) => `./${relative(dirname(dir), resolve(dir, v))}`)
        if (key === '#imports') {
          const rawImportsPath = config.compilerOptions?.paths?.['#imports']?.[0] || 'imports.d.ts'
          // Strip leading ./ if present to avoid double .nuxt/ prefix
          const cleanPath = rawImportsPath.replace(/^\.\//, '')
          json.paths![key] = [`./.nuxt/${cleanPath}`]
        }
      })
      return json
    }
    catch (e) {
      console.error(`[nuxt-content-twoslash] Failed to parse .nuxt/${tsconfigName}`, e)
      return {}
    }
  }
  return {}
}

export function removeJSONComments(content: string) {
  return content.replace(/\/\/.*/g, '')
}

/**
 * Check if the build directory uses Nuxt v4-style project references
 * (indicated by the presence of tsconfig.app.json)
 */
export function hasProjectReferences(buildDir: string): boolean {
  return existsSync(join(buildDir, 'tsconfig.app.json'))
}

export interface ContextConfig {
  name: string
  compilerOptions: Record<string, any>
  /** The reference .d.ts file to prepend (e.g., 'nuxt.d.ts', 'nuxt.node.d.ts') */
  referenceFile: string
  /** picomatch matcher for include patterns (relative to project root, prefixed with ../) */
  include: string[]
  /** picomatch matcher for exclude patterns */
  exclude: string[]
  /** Include patterns for .nuxt/ internal files (starting with ./) */
  internalIncludes: string[]
}

/** Known context tsconfig filenames and their reference .d.ts files */
const CONTEXT_TSCONFIGS: Record<string, { tsconfig: string, referenceFile: string }> = {
  node: { tsconfig: 'tsconfig.node.json', referenceFile: 'nuxt.node.d.ts' },
  app: { tsconfig: 'tsconfig.app.json', referenceFile: 'nuxt.d.ts' },
  shared: { tsconfig: 'tsconfig.shared.json', referenceFile: 'nuxt.shared.d.ts' },
  server: { tsconfig: 'tsconfig.server.json', referenceFile: 'nuxt.d.ts' },
}

/**
 * Priority order for context matching. When a file matches multiple contexts,
 * the first match wins. node is most specific, server is least specific
 * (it has a catch-all `../**\/*` include pattern that's a Nuxt bug).
 */
const CONTEXT_PRIORITY = ['node', 'app', 'shared', 'server'] as const

/**
 * Load all context-specific configs from the build directory.
 * Returns a map of context name → ContextConfig.
 */
export async function getNuxtContextConfigs(buildDir: string): Promise<Record<string, ContextConfig>> {
  const configs: Record<string, ContextConfig> = {}

  await Promise.all(
    Object.entries(CONTEXT_TSCONFIGS).map(async ([name, { tsconfig, referenceFile }]) => {
      const path = join(buildDir, tsconfig)
      if (!existsSync(path))
        return

      try {
        const raw = await fs.readFile(path, 'utf-8')
        const parsed: TSConfig = JSON.parse(removeJSONComments(raw)) || {}

        const compilerOptions = await getNuxtCompilerOptions(buildDir, tsconfig)

        // Extract include/exclude patterns, keeping only project-relative ones (../)
        // and filtering out overly broad catch-all patterns like ../**/*
        const include = (parsed.include || [])
          .filter(p => p.startsWith('../'))
          .filter(p => p !== '../**/*')
        const exclude = (parsed.exclude || [])
          .filter(p => p.startsWith('../'))

        // Extract .nuxt/ internal include patterns (starting with ./)
        // These determine which .d.ts files to include for this context
        const internalIncludes = (parsed.include || [])
          .filter(p => p.startsWith('./'))

        configs[name] = {
          name,
          compilerOptions,
          referenceFile,
          include,
          exclude,
          internalIncludes,
        }
      }
      catch (e) {
        console.error(`[nuxt-content-twoslash] Failed to parse .nuxt/${tsconfig}`, e)
      }
    }),
  )

  return configs
}

/**
 * Resolve which type context a filename belongs to by matching against
 * the include/exclude patterns from each context's tsconfig.
 *
 * @param filename - The filename from the code block meta (e.g., 'server/api/hello.ts')
 * @param contextConfigs - The context configs from getNuxtContextConfigs()
 * @returns The context name (e.g., 'app', 'server', 'node', 'shared') or undefined for fallback
 */
export function resolveFileContext(
  filename: string | undefined,
  contextConfigs: Record<string, ContextConfig>,
): string | undefined {
  if (!filename)
    return undefined

  // Prefix with ../ to match the tsconfig patterns (which are relative to .nuxt/)
  const relativePath = `../${filename}`

  for (const contextName of CONTEXT_PRIORITY) {
    const config = contextConfigs[contextName]
    if (!config || config.include.length === 0)
      continue

    const included = picomatch.isMatch(relativePath, config.include)
    const excluded = config.exclude.length > 0 && picomatch.isMatch(relativePath, config.exclude)

    if (included && !excluded)
      return contextName
  }

  return undefined
}

/**
 * Filter type decorations to only include files relevant to a specific context.
 * Uses the context's internal include patterns (from tsconfig) to determine which
 * .d.ts files should be loaded. The reference file (e.g., nuxt.d.ts) and its
 * transitive references will pull in the right types.
 *
 * @param allTypeDecorations - All .d.ts files from .nuxt/ (keyed like `.nuxt/imports.d.ts`)
 * @param contextConfig - The context config with internalIncludes
 * @returns Filtered type decorations for this context
 */
export function filterTypeDecorationsForContext(
  allTypeDecorations: Record<string, string>,
  contextConfig: ContextConfig,
): Record<string, string> {
  const { internalIncludes } = contextConfig
  if (!internalIncludes.length) {
    // No internal includes specified - return all decorations (safe fallback)
    return allTypeDecorations
  }

  // Convert internal includes from ./ relative paths to .nuxt/ prefixed paths
  // e.g., './nuxt.d.ts' -> '.nuxt/nuxt.d.ts', './types/*.d.ts' -> '.nuxt/types/*.d.ts'
  const patterns = internalIncludes.map(p => `.nuxt/${p.slice(2)}`)

  const filtered: Record<string, string> = {}
  for (const [key, value] of Object.entries(allTypeDecorations)) {
    if (picomatch.isMatch(key, patterns)) {
      filtered[key] = value
    }
  }
  return filtered
}

/**
 * Parse the [filename] from a code block's meta string.
 * e.g., 'twoslash [server/api/hello.ts]' → 'server/api/hello.ts'
 */
export function parseFilenameFromMeta(meta: string | undefined): string | undefined {
  if (!meta)
    return undefined
  const match = meta.match(/\[([^\]]+)\]/)
  return match?.[1]
}

/**
 * Remove the [filename] portion from a meta string.
 * e.g., 'twoslash [server/api/hello.ts]' → 'twoslash'
 */
export function stripFilenameFromMeta(meta: string): string {
  return meta.replace(/\s*\[[^\]]+\]\s*/g, ' ').trim()
}
