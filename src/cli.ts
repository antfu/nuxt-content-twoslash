import type { ModuleOptions } from '@nuxt/schema'
import type { Code } from 'mdast'
import type { BuiltinLanguage, ShikiTransformer } from 'shiki'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import process from 'node:process'
import { loadNuxt } from '@nuxt/kit'
import c from 'ansis'
import { cac } from 'cac'
import fg from 'fast-glob'
import { join, relative, resolve } from 'pathe'
import remarkParse from 'remark-parse'
import { codeToHast, getSingletonHighlighter } from 'shiki'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { createContextTransformer, createTransformer } from './runtime/transformer'
import { filterTypeDecorationsForContext, getNuxtCompilerOptions, getNuxtContextConfigs, getTypeDecorations, hasProjectReferences, parseFilenameFromMeta, resolveFileContext, stripFilenameFromMeta } from './utils'

interface TwoslashVerifyError {
  file: string
  line: number
  error: any
}

export interface VerifyOptions {
  resolveNuxt?: boolean
  rootDir?: string
  buildDir?: string
  contentDir?: string
  watch?: boolean
  languages?: string
}

let currentFile = ''
let currentLine = 0
const realCwd = process.cwd()

const errors: TwoslashVerifyError[] = []

async function runForFile(
  transformer: ShikiTransformer,
  filepath: string,
): Promise<void>
async function runForFile(
  transformer: Record<string, ShikiTransformer>,
  filepath: string,
  contextConfigs: Record<string, import('./utils').ContextConfig>,
): Promise<void>
async function runForFile(
  transformer: ShikiTransformer | Record<string, ShikiTransformer>,
  filepath: string,
  contextConfigs?: Record<string, import('./utils').ContextConfig>,
) {
  currentFile = filepath
  const content = await fs.readFile(filepath, 'utf-8')

  if (!content.includes('twoslash'))
    return

  const file = unified()
    .use(remarkParse)
    .parse(content)

  const codeBlocks: Code[] = []

  visit(file, 'code', (node) => {
    if (!node.meta?.match(/\btwoslash\b/))
      return
    codeBlocks.push(node)
  })

  if (!codeBlocks.length)
    return

  console.log(`Checking ${relative(realCwd, filepath)} (${codeBlocks.length} twoslash blocks)`)

  const isMultiContext = !!contextConfigs

  for (const block of codeBlocks) {
    currentLine = block.position?.start?.line || 0

    let selectedTransformer: ShikiTransformer
    let meta = block.meta || ''

    if (isMultiContext) {
      const transformers = transformer as Record<string, ShikiTransformer>
      const filename = parseFilenameFromMeta(meta)
      const context = resolveFileContext(filename, contextConfigs!)
      selectedTransformer = transformers[context || 'default'] || transformers.default
      // Strip the [filename] from meta so twoslash doesn't see it
      meta = stripFilenameFromMeta(meta)
    }
    else {
      selectedTransformer = transformer as ShikiTransformer
    }

    try {
      await codeToHast(block.value, {
        lang: block.lang!,
        theme: 'min-dark',
        transformers: [selectedTransformer],
        meta: {
          __raw: meta,
        },
      })
    }
    catch (error) {
      errors.push({
        file: currentFile,
        line: block.position?.start?.line || 0,
        error,
      })
    }
  }
}

export async function verify(options: VerifyOptions = {}) {
  errors.length = 0

  const root = options.rootDir || process.cwd()
  const {
    resolveNuxt = existsSync(join(root, 'nuxt.config.js')) || existsSync(join(root, 'nuxt.config.ts')),
  } = options

  if (resolveNuxt)
    console.log('Resolving Nuxt...')

  const nuxt = resolveNuxt
    ? await loadNuxt({ ready: true, cwd: root })
    : undefined

  const twoslashOptions = {
    includeNuxtTypes: resolveNuxt,
    enableInDev: true,
    ...((nuxt?.options as any)?.twoslash || {}) as ModuleOptions,
  }

  let buildDir = resolve(root, options.buildDir || nuxt?.options.buildDir || '.nuxt')
  // Nuxt 4 may report a cache path as buildDir that doesn't contain prepared types.
  // Fall back to the standard .nuxt/ directory if the reported path lacks a tsconfig.
  if (!existsSync(join(buildDir, 'tsconfig.json')) && existsSync(join(root, '.nuxt', 'tsconfig.json'))) {
    buildDir = join(root, '.nuxt')
  }
  const contentDir = resolve(root, options.contentDir || 'content')

  const typeDecorations: Record<string, string> = {}
  let compilerOptions: any = {}
  if (twoslashOptions.includeNuxtTypes) {
    await getTypeDecorations(buildDir, typeDecorations)
    compilerOptions = await getNuxtCompilerOptions(buildDir)
  }

  const errorHandlers = {
    onShikiError: (error: any) => {
      errors.push({
        file: currentFile,
        line: currentLine,
        error,
      })
    },
    onTwoslashError: (error: any) => {
      errors.push({
        file: currentFile,
        line: currentLine,
        error,
      })
    },
  }

  // Check for Nuxt v4 project references
  const useProjectReferences = twoslashOptions.includeNuxtTypes && hasProjectReferences(buildDir)
  let contextConfigs: Record<string, import('./utils').ContextConfig> | undefined
  let contextTransformers: Record<string, ShikiTransformer> | undefined
  let singleTransformer: ShikiTransformer | undefined

  if (useProjectReferences) {
    contextConfigs = await getNuxtContextConfigs(buildDir)
    contextTransformers = {}

    // Create a transformer for each context with filtered type decorations
    await Promise.all(
      Object.entries(contextConfigs).map(async ([name, config]) => {
        const filteredDecorations = filterTypeDecorationsForContext(typeDecorations, config)
        contextTransformers![name] = await createContextTransformer(
          root,
          twoslashOptions,
          filteredDecorations,
          config,
          errorHandlers,
        )
      }),
    )

    // Create a fallback transformer using legacy tsconfig.json (all decorations)
    contextTransformers.default = await createTransformer(
      root,
      twoslashOptions,
      typeDecorations,
      compilerOptions,
      errorHandlers,
    )
  }
  else {
    singleTransformer = await createTransformer(
      root,
      twoslashOptions,
      typeDecorations,
      compilerOptions,
      errorHandlers,
    )
  }

  const additionalLanguages = options.languages?.split(',').map(l => l.trim()) || []
  const highlighter = await getSingletonHighlighter()
  await Promise.all([
    highlighter.loadLanguage('js'),
    ...additionalLanguages.map(lang => highlighter.loadLanguage(lang as BuiltinLanguage)),
  ])

  const markdownFiles = await fg('**/*.md', {
    ignore: ['**/node_modules/**', '**/dist/**'],
    dot: false,
    cwd: contentDir,
    onlyFiles: true,
    absolute: true,
    followSymbolicLinks: false,
  })

  console.log('Verifying Twoslash in', markdownFiles.length, 'files...')
  console.log(markdownFiles.map(f => `  - ${relative(realCwd, f)}`).join('\n'))
  console.log('')

  for (const path of markdownFiles) {
    if (contextTransformers && contextConfigs) {
      await runForFile(contextTransformers, path, contextConfigs)
    }
    else {
      await runForFile(singleTransformer!, path)
    }
  }

  console.log()

  if (errors.length) {
    printErrors()
    process.exitCode = 1
  }
  else {
    console.log(c.green('Twoslash verification passed'))
  }

  if (options.watch) {
    console.log(c.cyan('Watching for file changes...'))
    const chokidar = await import('chokidar')
    const watcher = chokidar.watch(markdownFiles, {
      ignoreInitial: true,
      ignorePermissionErrors: true,
      persistent: true,
    })

    watcher.on('change', async (path) => {
      console.log(c.yellow('File changed'), relative(realCwd, path))
      errors.length = 0
      if (contextTransformers && contextConfigs) {
        await runForFile(contextTransformers, path, contextConfigs)
      }
      else {
        await runForFile(singleTransformer!, path)
      }
      if (errors.length)
        printErrors()
      else
        console.log(c.green('Twoslash verification passed for ') + relative(realCwd, path))
    })
  }
}

function printErrors() {
  console.error(c.red('Twoslash verification failed'))
  for (const error of errors) {
    console.error(c.yellow(`\n----------\nError in ${relative(realCwd, error.file)}:${error.line}`))
    console.error(c.red(String(error.error)))
  }
  console.error(c.yellow('----------'))
  console.error(c.red(`\nTwoslash verification failed with ${errors.length} errors.`))
  console.error(c.red(errors.map(e => `  - ${relative(realCwd, e.file)}:${e.line}`).join('\n')))
}

export function runCLI() {
  const cli = cac('nuxt-content-twoslash')

  cli.command('verify', 'Verify twoslash code blocks in markdown files')
    .option('--build-dir <dir>', 'The build directory of the Nuxt project')
    .option('--content-dir <dir>', 'The content directory of the Nuxt project')
    .option('--root-dir <dir>', 'The root directory of the Nuxt project')
    .option('--languages <langs>', 'Additional languages to load (comma-separated)')
    .option('--resolve-nuxt', 'Resolve Nuxt project')
    .option('-w, --watch', 'Watch files', { default: false })
    .action(args => verify(args))

  cli.command('')
    .action(() => {
      throw new Error('Unknown command, expected `verify` command.')
    })

  cli
    .help()
    .parse()
}
