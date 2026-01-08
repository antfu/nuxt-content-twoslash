declare module '#twoslash-meta' {
  import type { ModuleOptions } from './module'

  const rootDir: string
  const typeDecorations: Record<string, string>
  const compilerOptions: Record<string, any>
  const moduleOptions: ModuleOptions
  export {
    compilerOptions,
    moduleOptions,
    rootDir,
    typeDecorations,
  }
}
