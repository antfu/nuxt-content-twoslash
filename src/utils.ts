import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import fg from 'fast-glob'
import { dirname, join, relative, resolve } from 'pathe'
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

export async function getNuxtCompilerOptions(dir: string) {
  const path = join(dir, 'tsconfig.json')
  if (existsSync(path)) {
    try {
      const tsconfig = await fs.readFile(path, 'utf-8')
      const config = JSON.parse(removeJSONComments(tsconfig)) || {}
      const json = ts.convertCompilerOptionsFromJson(config.compilerOptions, dir, '').options
      Object.entries(json.paths || {}).forEach(([key, value]) => {
        json.paths![key] = value.map((v: string) => `./${relative(dirname(dir), resolve(dir, v))}`)
        if (key === '#imports')
          json.paths![key] = ['./.nuxt/imports.d.ts']
      })
      return json
    }
    catch (e) {
      console.error('[nuxt-content-twoslash] Failed to parse .nuxt/tsconfig.json', e)
      return {}
    }
  }
  return {}
}

export function removeJSONComments(content: string) {
  return content.replace(/\/\/.*/g, '')
}
