declare module '#twoslash-meta' {
  import type { ModuleOptions } from './module'

  const typeDecorations: Record<string, string>
  const moduleOptions: ModuleOptions
  export {
    typeDecorations,
    moduleOptions,
  }
}
