# TypeScript Config Contexts

This demonstrates the different TypeScript configuration contexts for Nuxt v4+.

## Explicit `context:` configuration

```ts twoslash context:server
export default defineEventHandler((event) => {
  return { message: 'Hello from server!' }
})
```

```ts twoslash context:node
export default defineNuxtConfig({
  modules: ['@nuxt/content']
})
```

## Project-based detection

```ts twoslash [server/api/hello.ts]
import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return { status: 'ok' }
})
```

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxt/content'],
  devtools: { enabled: true }
})
```

## Fallback context

Default app context for components and composables:

```ts twoslash
const count = ref(0)
//    ^?

const route = useRoute()

defineEventHandler(() => {
  return { status: 'ok' }
})

defineNuxtConfig({
  modules: ['@nuxt/content']
})
```
