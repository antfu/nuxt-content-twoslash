import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('nuxt-content-twoslash', () => {
  test('renders code blocks with syntax highlighting', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    await expect(page.getByText('console.log(\'Hello, world!\')')).toBeVisible()

    const firstCodeBlock = page.locator('pre').first().locator('code')
    const consoleToken = firstCodeBlock.getByText('console', { exact: true })
    await expect(consoleToken).toBeVisible()

    const computedColor = await consoleToken.evaluate((el) => {
      return window.getComputedStyle(el).color
    })

    expect(computedColor).not.toBe('rgb(0, 0, 0)')
  })

  test('displays TypeScript type information on hover', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const typePopupText = page.getByText(/const definePageMeta.*PageMeta.*void/i)

    await expect(typePopupText).not.toBeVisible()

    const codeBlock = page.locator('pre').filter({ hasText: 'definePageMeta' })
    const definePageMetaText = codeBlock.getByText('definePageMeta').first()
    await definePageMetaText.hover()

    await expect(typePopupText).toBeVisible()

    const popupContent = await typePopupText.textContent()
    expect(popupContent).toBe('const definePageMeta: (meta: PageMeta) => void')
  })

  test.describe('TypeScript config contexts', () => {
    test('shows server context types for explicit context:server', async ({ page, goto }) => {
      await goto('/contexts', { waitUntil: 'hydration' })

      // Look for the server context code block
      const serverCodeBlock = page.locator('pre').filter({ hasText: 'export default defineEventHandler' }).first()
      
      // Hover over defineEventHandler in the server context
      const defineEventHandlerText = serverCodeBlock.getByText('defineEventHandler').first()
      await defineEventHandlerText.hover()

      // Should show server-specific type information
      const typePopup = page.getByText(/EventHandler/i)
      await expect(typePopup).toBeVisible()
    })

    test('shows node context types for explicit context:node', async ({ page, goto }) => {
      await goto('/contexts', { waitUntil: 'hydration' })

      // Look for the node context code block with defineNuxtConfig
      const nodeCodeBlock = page.locator('pre').filter({ hasText: "modules: ['@nuxt/content']" }).first()
      
      // Hover over defineNuxtConfig in the node context
      const defineNuxtConfigText = nodeCodeBlock.getByText('defineNuxtConfig').first()
      await defineNuxtConfigText.hover()

      // Should show NuxtConfig type information
      const typePopup = page.getByText(/NuxtConfig/i)
      await expect(typePopup).toBeVisible()
    })

    test('detects server context from [server/api/hello.ts] filename', async ({ page, goto }) => {
      await goto('/contexts', { waitUntil: 'hydration' })

      // Find the code block with [server/api/hello.ts] filename
      const serverApiBlock = page.locator('pre').filter({ hasText: "import { defineEventHandler } from 'h3'" })
      
      // Hover over defineEventHandler - should recognize it from server context
      const defineEventHandlerText = serverApiBlock.getByText('defineEventHandler').last()
      await defineEventHandlerText.hover()

      // Should show h3 EventHandler types
      const typePopup = page.getByText(/EventHandler/i)
      await expect(typePopup).toBeVisible()
    })

    test('detects node context from [nuxt.config.ts] filename', async ({ page, goto }) => {
      await goto('/contexts', { waitUntil: 'hydration' })

      // Find the code block with [nuxt.config.ts] filename
      const nuxtConfigBlock = page.locator('pre').filter({ hasText: "devtools: { enabled: true }" })
      
      // Hover over defineNuxtConfig - should recognize it from node context
      const defineNuxtConfigText = nuxtConfigBlock.getByText('defineNuxtConfig')
      await defineNuxtConfigText.hover()

      // Should show NuxtConfig type information
      const typePopup = page.getByText(/NuxtConfig/i)
      await expect(typePopup).toBeVisible()
    })

    test('shows app context types in fallback context', async ({ page, goto }) => {
      await goto('/contexts', { waitUntil: 'hydration' })

      // Find the fallback context code block (last one with ref and useRoute)
      const fallbackBlock = page.locator('pre').filter({ hasText: 'const count = ref(0)' }).first()
      
      // Hover over ref - should show app context types
      const refText = fallbackBlock.getByText('ref', { exact: true }).first()
      await refText.hover()

      // Should show Ref type from Vue
      const typePopup = page.getByText(/Ref/i)
      await expect(typePopup).toBeVisible()
    })

    test('shows useRoute type in fallback context', async ({ page, goto }) => {
      await goto('/contexts', { waitUntil: 'hydration' })

      // Find the fallback context code block
      const fallbackBlock = page.locator('pre').filter({ hasText: 'const route = useRoute()' }).first()
      
      // Hover over useRoute - should show Nuxt composable types
      const useRouteText = fallbackBlock.getByText('useRoute').first()
      await useRouteText.hover()

      // Should show route type information
      const typePopup = page.getByText(/RouteLocationNormalizedLoaded|useRoute/i)
      await expect(typePopup).toBeVisible()
    })

    test('displays quick info popups for variables', async ({ page, goto }) => {
      await goto('/contexts', { waitUntil: 'hydration' })

      // Find the code block with count variable that has the ^? annotation
      const fallbackBlock = page.locator('pre').filter({ hasText: 'const count = ref(0)' }).first()
      
      // Look for the quick info popup (the ^? shows type on hover)
      const countText = fallbackBlock.getByText('count').first()
      await countText.hover()

      // Should show Ref<number> or similar type information
      const typePopup = page.getByText(/Ref.*number/i)
      await expect(typePopup).toBeVisible()
    })
  })
})
