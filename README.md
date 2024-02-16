# nuxt-content-twoslash

[TwoSlash](https://github.com/twoslashes/twoslash) integrations for Nuxt Content.

> [!IMPORTANT]
> Experimental.

```bash
npm install nuxt-content-twoslash
```

```ts
// nuxt.config.js
export default defineNuxtConfig({
  modules: [
    'nuxt-content-twoslash', // this needs to be before `@nuxt/content`
    '@nuxt/content'
  ],
  content: {
    // ...
  },
  twoslash: {
    // ...
  }
})
```

## CLI Usage

This module also provides a command-line interface to verify TwoSlash code snippets in your markdown files, where you can guard the type safety in continuous integration.

```bash
npx nuxt-content-twoslash verify
```
