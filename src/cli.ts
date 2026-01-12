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
import { createTransformer } from './runtime/transformer'
import type { NuxtCompilerOptions } from './runtime/utils'
import { getNuxtCompilerOptions, getTypeDecorations } from './runtime/utils'

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

async function runForFile(transformer: ShikiTransformer, filepath: string) {
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

  for (const block of codeBlocks) {
    currentLine = block.position?.start?.line || 0
    try {
      await codeToHast(block.value, {
        lang: block.lang as any,
        theme: 'min-dark',
        transformers: [transformer],
        meta: {
          __raw: block.meta as any,
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

  // Use the explicit buildDir option, or fallback to .nuxt
  // We don't use nuxt.options.buildDir because loadNuxt may point to a cache directory
  // without the generated type files (those are in the main .nuxt directory from nuxi prepare/build)
  const buildDir = resolve(root, options.buildDir || '.nuxt')
  const contentDir = resolve(root, options.contentDir || 'content')

  // Only include Nuxt types if the .nuxt directory exists
  const hasNuxtTypes = existsSync(buildDir) && existsSync(join(buildDir, 'nuxt.d.ts'))

  const twoslashOptions = {
    includeNuxtTypes: hasNuxtTypes,
    enableInDev: true,
    ...(nuxt?.options?.twoslash || {}),
  }

  const typeDecorations: Record<string, string> = {}
  let compilerOptions: NuxtCompilerOptions | undefined
  if (twoslashOptions.includeNuxtTypes) {
    await getTypeDecorations(buildDir, typeDecorations)
    compilerOptions = await getNuxtCompilerOptions(buildDir)
  }

  const markdownFiles = await fg('**/*.md', {
    ignore: ['**/node_modules/**', '**/dist/**'],
    dot: false,
    cwd: contentDir,
    onlyFiles: true,
    absolute: true,
    followSymbolicLinks: false,
  })

  const transformer = await createTransformer(
    root,
    twoslashOptions,
    typeDecorations,
    compilerOptions,
    {
      onShikiError: (error) => {
        errors.push({
          file: currentFile,
          line: currentLine,
          error,
        })
      },
      onTwoslashError: (error) => {
        errors.push({
          file: currentFile,
          line: currentLine,
          error,
        })
      },
    },
  )

  const additionalLanguages = options.languages?.split(',').map(l => l.trim()) || []
  const highlighter = await getSingletonHighlighter()
  await Promise.all([
    highlighter.loadLanguage('js'),
    ...additionalLanguages.map(lang => highlighter.loadLanguage(lang as BuiltinLanguage)),
  ])

  console.log('Verifying Twoslash in', markdownFiles.length, 'files...')
  console.log(markdownFiles.map(f => `  - ${relative(realCwd, f)}`).join('\n'))
  console.log('')

  for (const path of markdownFiles)
    await runForFile(transformer, path)

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
      await runForFile(transformer, path)
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
    .option('--resolve-nuxt', 'Resolve Nuxt project', { default: false })
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
