# Hello

Basic twoslash example:

```ts twoslash
console.log('Hello, world!')
```

## Projects

### `nitro`

```ts twoslash [server/api/hello.ts]
import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return { status: 'ok' }
})

// @ts-expect-error should not exist in this context
const _config = defineNuxtConfig({})
```

### `node`

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxt/content'],
  devtools: { enabled: true }
})

// @ts-expect-error should not exist in this context
const _handler = defineEventHandler(() => 'foo')
```

### `app`

```ts twoslash [app/app.vue]
const count = ref(0)
//    ^?

const route = useRoute()

definePageMeta({
  title: 'Home'
})
```

### `shared`

```ts twoslash [shared/utils.ts]
// @ts-expect-error should not exist in this context
const count = ref(0)
```
