declare module '#twoslash-meta' {
  import type { ModuleOptions } from './module'

  const typeDecorations: Record<string, string>
  const compilerOptions: Record<string, any>
  const moduleOptions: ModuleOptions
  export {
    typeDecorations,
    moduleOptions,
    compilerOptions,
  }
}
