import fs from 'node:fs/promises'
import { join } from 'pathe'
import { addPlugin, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import fg from 'fast-glob'

// Module options TypeScript interface definition
export interface ModuleOptions {

}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-module-content-twoslash',
    configKey: 'twoslash',
  },
  // Default configuration options of the Nuxt module
  defaults: {},
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    addPlugin(resolver.resolve('./runtime/plugin'))

    const types: Record<string, string> = {}

    const path = addTemplate({
      filename: 'twoslash-types.mjs',
      write: true,
      getContents: () => {
        return `export default ${JSON.stringify(types, null, 2)}`
      },
    })
    nuxt.options.alias ||= {}
    nuxt.options.alias['#twoslash-types'] = path.dst
    nuxt.options.nitro.alias ||= {}
    nuxt.options.nitro.alias['#twoslash-types'] = path.dst

    nuxt.hook('mdc:configSources', async (sources: string[]) => {
      sources.push(resolver.resolve('./runtime/mdc.config'))
    })

    ;(async () => {
      const files = await fg('**/*.d.ts', {
        cwd: nuxt.options.buildDir,
        onlyFiles: true,
      })
      await Promise.all(
        files.map(async (file) => {
          types[`.nuxt/${file}`] = await fs.readFile(join(nuxt.options.buildDir, file), 'utf-8')
        }),
      )
    })()
  },
})
