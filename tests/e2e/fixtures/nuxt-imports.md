# Nuxt Auto-imports Test

```ts twoslash
// Test Nuxt auto-imports
const count = ref(0)
const doubled = computed(() => count.value * 2)

// Test Nuxt composables
const route = useRoute()
const router = useRouter()

// Test Nuxt config
const config = defineNuxtConfig({
  modules: ['@nuxt/content']
})

// Test page meta
definePageMeta({
  layout: 'default'
})
```
