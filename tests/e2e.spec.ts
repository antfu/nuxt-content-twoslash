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
})
