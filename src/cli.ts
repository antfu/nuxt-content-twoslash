/* eslint-disable no-console */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { loadNuxt } from '@nuxt/kit'
import type { ModuleOptions } from '@nuxt/schema'
import fg from 'fast-glob'
import { unified } from 'unified'
import type { Code } from 'mdast'
import { join, relative, resolve } from 'pathe'
import c from 'picocolors'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import { codeToHast, getSingletonHighlighter } from 'shiki'
import { cac } from 'cac'
import { createTransformer } from './runtime/transformer'
import { getTypeDecorations } from './utils'

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
}

export async function verify(options: VerifyOptions = {}) {
  const realCwd = process.cwd()
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
    includeNuxtTypes: true,
    ...((nuxt?.options as any)?.twoslash || {}) as ModuleOptions,
  }

  const buildDir = resolve(root, options.buildDir || nuxt?.options.buildDir || '.nuxt')
  const contentDir = resolve(root, options.contentDir || 'content')

  const typeDecorations: Record<string, string> = {}
  if (twoslashOptions.includeNuxtTypes)
    await getTypeDecorations(buildDir, typeDecorations)

  const markdownFiles = await fg('**/*.md', {
    ignore: ['**/node_modules/**', '**/dist/**'],
    dot: false,
    cwd: contentDir,
    onlyFiles: true,
    absolute: true,
    followSymbolicLinks: false,
  })

  let currentFile = ''
  let currnetLine = 0
  const errors: TwoslashVerifyError[] = []

  const transformer = await createTransformer(
    twoslashOptions,
    typeDecorations,
    {
      onShikiError: (error) => {
        errors.push({
          file: currentFile,
          line: currnetLine,
          error,
        })
      },
      onTwoslashError: (error) => {
        errors.push({
          file: currentFile,
          line: currnetLine,
          error,
        })
      },
    },
  )

  const highlighter = await getSingletonHighlighter()
  await highlighter.loadLanguage('js')

  console.log('Verifying Twoslash in', markdownFiles.length, 'files...')
  console.log(markdownFiles.map(f => `  - ${relative(realCwd, f)}`).join('\n'))
  console.log('')

  for (const path of markdownFiles) {
    currentFile = path
    const content = await fs.readFile(path, 'utf-8')

    if (!content.includes('twoslash'))
      continue

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
      continue

    console.log(`Checking ${relative(realCwd, path)} (${codeBlocks.length} twoslash blocks)`)

    for (const block of codeBlocks) {
      currnetLine = block.position?.start?.line || 0
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

  console.log()

  if (errors.length) {
    console.error(c.red('Twoslash verification failed'))
    for (const error of errors) {
      console.error(c.yellow(`\n----------\nError in ${relative(realCwd, error.file)}:${error.line}`))
      console.error(c.red(String(error.error)))
    }
    console.error(c.yellow('----------'))
    console.error(c.red(`\nTwoslash verification failed with ${errors.length} errors.`))
    console.error(c.red(errors.map(e => `  - ${relative(realCwd, e.file)}:${e.line}`).join('\n')))
    process.exit(1)
  }
  else {
    console.log(c.green('Twoslash verification passed'))
  }
}

const cli = cac('nuxt-content-twoslash')

cli.command('verify', 'Verify twoslash code blocks in markdown files')
  .option('--build-dir <dir>', 'The build directory of the Nuxt project')
  .option('--content-dir <dir>', 'The content directory of the Nuxt project')
  .option('--root-dir <dir>', 'The root directory of the Nuxt project')
  .option('--resolve-nuxt', 'Resolve Nuxt project', { default: false })
  .action(args => verify(args))

cli.command('')
  .action(() => {
    throw new Error('Unknown command, expected `verify` command.')
  })

cli
  .help()
  .parse()
