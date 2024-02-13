/* eslint-disable no-console */
import fs from 'node:fs/promises'
import process from 'node:process'
import { loadNuxt } from '@nuxt/kit'
import type { ModuleOptions } from '@nuxt/schema'
import fg from 'fast-glob'
import { unified } from 'unified'
import type { Code } from 'mdast'
import c from 'picocolors'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import { codeToHast, getSingletonHighlighter } from 'shiki'
import { createTransformer } from './runtime/transformer'
import { getTypeDecorations } from './utils'

interface TwoslashVerifyError {
  file: string
  line: number
  error: any
}

export async function verify() {
  const nuxt = await loadNuxt({})
  await nuxt.ready()
  const twoslashOptions = {
    includeNuxtTypes: true,
    ...((nuxt.options as any).twoslash || {}) as ModuleOptions,
  }

  const typeDecorations: Record<string, string> = {}
  if (twoslashOptions.includeNuxtTypes)
    await getTypeDecorations(nuxt.options.srcDir, typeDecorations)

  const markdownFiles = await fg('**/*.md', {
    ignore: ['**/node_modules/**', '**/dist/**'],
    dot: false,
    cwd: nuxt.options.srcDir,
    onlyFiles: true,
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

  console.log('Verifying twoslash in', markdownFiles.length, 'files...')
  console.log(markdownFiles.map(f => `  - ${f}`).join('\n'))
  console.log('')

  for (const path of markdownFiles) {
    currentFile = path
    const content = await fs.readFile(path, 'utf-8')
    const file = unified()
      .use(remarkParse)
      .parse(content)

    const codeBlocks: Code[] = []

    visit(file, 'code', (node) => {
      if (!node.meta?.match(/\btwoslash\b/))
        return
      codeBlocks.push(node)
    })

    console.log(`Verifying ${path} (${codeBlocks.length} twoslash code blocks)`)

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
      console.error(c.yellow(`\n----------\nError in ${error.file}:${error.line}`))
      console.error(c.red(String(error.error)))
    }
    console.error(c.yellow('----------'))
    console.error(c.red(`\nTwoslash verification failed with ${errors.length} errors.`))
    console.error(c.red(errors.map(e => `  - ${e.file}:${e.line}`).join('\n')))
    process.exit(1)
  }
  else {
    console.log(c.green('Twoslash verification passed'))
  }
}

const args = process.argv.slice(2)
if (args[0] === 'verify')
  verify()
else
  throw new Error(`Unknown command: ${args[0]}, expected "verify"`)
