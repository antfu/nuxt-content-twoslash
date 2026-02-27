import fs from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { verify } from '../../src/cli'

const fixturesDir = new URL('./fixtures/', import.meta.url)

describe('cli - verify command', () => {
  let originalCwd: string
  let originalExitCode: string | number | null | undefined
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let tempDirs: string[] = []

  async function createTempDir(name: string) {
    const tempDir = join(fileURLToPath(fixturesDir), name)
    await fs.rm(tempDir, { recursive: true, force: true })
    await fs.mkdir(tempDir, { recursive: true })
    tempDirs.push(tempDir)
    return tempDir
  }

  async function copyFixture(fixtureName: string, tempDir: string, targetName = 'test.md') {
    const sourcePath = join(fileURLToPath(fixturesDir), fixtureName)
    await fs.copyFile(sourcePath, join(tempDir, targetName))
  }

  async function runVerify(options: Parameters<typeof verify>[0]) {
    await verify(options)
    return {
      exitCode: process.exitCode,
      logs: consoleLogSpy.mock.calls.flat().join(' '),
      errors: consoleErrorSpy.mock.calls.flat().join(' '),
    }
  }

  beforeEach(() => {
    originalCwd = process.cwd()
    originalExitCode = process.exitCode
    process.exitCode = undefined
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    tempDirs = []
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    process.exitCode = originalExitCode
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()

    await Promise.all(tempDirs.map(dir => fs.rm(dir, { recursive: true, force: true })))
  })

  it('should verify valid twoslash code blocks without errors', async () => {
    const tempDir = await createTempDir('temp-valid')
    await copyFixture('valid.md', tempDir)

    const result = await runVerify({
      contentDir: tempDir,
      resolveNuxt: false,
    })

    expect(result.exitCode).not.toBe(1)
  })

  it('should detect type errors in invalid twoslash blocks', async () => {
    const tempDir = await createTempDir('temp-invalid')
    await copyFixture('invalid.md', tempDir)

    const result = await runVerify({
      contentDir: tempDir,
      resolveNuxt: false,
    })

    expect(result.exitCode).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('should handle multiple twoslash blocks in a single file', async () => {
    const tempDir = await createTempDir('temp-multiple')
    await copyFixture('multiple.md', tempDir)

    const result = await runVerify({
      contentDir: tempDir,
      resolveNuxt: false,
    })

    expect(result.exitCode).not.toBe(1)
    expect(result.logs).toContain('2 twoslash blocks')
  })

  it('should skip files without twoslash blocks', async () => {
    const tempDir = await createTempDir('temp-no-twoslash')
    await copyFixture('no-twoslash.md', tempDir)

    const result = await runVerify({
      contentDir: tempDir,
      resolveNuxt: false,
    })

    expect(result.exitCode).not.toBe(1)
  })

  it('should accept custom content directory', async () => {
    const tempDir = await createTempDir('temp-custom')
    await copyFixture('valid.md', tempDir)

    const result = await runVerify({
      contentDir: tempDir,
      resolveNuxt: false,
    })

    expect(result.logs).toContain('Verifying Twoslash')
  })

  it('should handle empty content directory', async () => {
    const emptyDir = await createTempDir('temp-empty')

    const result = await runVerify({
      contentDir: emptyDir,
      resolveNuxt: false,
    })

    expect(result.exitCode).not.toBe(1)
    expect(result.logs).toContain('Verifying Twoslash in 0 files')
  })

  it('should use current working directory by default', async () => {
    const testDir = await createTempDir('temp-cwd-test')
    const contentDir = join(testDir, 'content')
    await fs.mkdir(contentDir, { recursive: true })
    await copyFixture('valid.md', contentDir)

    process.chdir(testDir)
    const result = await runVerify({ resolveNuxt: false })
    process.chdir(originalCwd)

    expect(result.exitCode).not.toBe(1)
  })

  it('should load additional languages when specified', async () => {
    const tempDir = await createTempDir('temp-lang')
    await fs.writeFile(
      join(tempDir, 'test.md'),
      '```js twoslash\nconst x = 42\n```',
    )

    const result = await runVerify({
      contentDir: tempDir,
      resolveNuxt: false,
      languages: 'python,rust',
    })

    expect(result.exitCode).not.toBe(1)
  })

  it('should verify Nuxt auto-imports with resolveNuxt enabled', async () => {
    const tempDir = await createTempDir('temp-nuxt-imports')
    await copyFixture('nuxt-imports.md', tempDir)

    const result = await runVerify({
      contentDir: tempDir,
      rootDir: join(process.cwd(), 'test', 'fixtures', 'content-v3'),
      resolveNuxt: true,
    })

    expect(result.exitCode).not.toBe(1)
    expect(result.logs).toContain('Resolving Nuxt...')
  }, 30000)

  it('should verify content-v3 fixture with Nuxt types', async () => {
    const result = await runVerify({
      contentDir: join(process.cwd(), 'test', 'fixtures', 'content-v3', 'content'),
      rootDir: join(process.cwd(), 'test', 'fixtures', 'content-v3'),
      resolveNuxt: true,
    })

    expect(result.exitCode).not.toBe(1)
    expect(result.logs).toContain('Resolving Nuxt...')
    expect(result.logs).toContain('content-v3/content/index.md')
  }, 30000)

  it.fails('should verify nuxt-v4 fixture with Nuxt types', async () => {
    const result = await runVerify({
      contentDir: join(process.cwd(), 'test', 'fixtures', 'nuxt-v4', 'content'),
      rootDir: join(process.cwd(), 'test', 'fixtures', 'nuxt-v4'),
      resolveNuxt: true,
    })

    expect(result.exitCode).not.toBe(1)
    expect(result.logs).toContain('Resolving Nuxt...')
    expect(result.logs).toContain('nuxt-v4/content/index.md')
  }, 30000)

  it('should fail without Nuxt types when auto-imports are used', async () => {
    const tempDir = await createTempDir('temp-no-nuxt')
    await copyFixture('nuxt-imports.md', tempDir)

    const result = await runVerify({
      contentDir: tempDir,
      resolveNuxt: false,
    })

    expect(result.exitCode).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(result.errors).toMatch(/Cannot find name|not found/)
  })
})
