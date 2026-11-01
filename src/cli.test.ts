import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { beforeAll, temporaryDirectory, test } from '@langri-sha/vitest'
import { expect, vi } from 'vitest'

import { program } from './cli.js'

import { compile } from './index.js'

vi.mock('./index', () => ({ compile: vi.fn(() => 'export {}') }))

beforeAll(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(temporaryDirectory())
  await fs.mkdir(process.cwd(), { recursive: true })

  return () => {
    vi.restoreAllMocks()
  }
})

test('compiles schema to TypeScript', async () => {
  await program.parseAsync(['node', 'cli.ts', 'swcrc'])

  expect(compile).toHaveBeenCalledWith('swcrc', true, {
    jsii: undefined,
    typeName: undefined,
  })
})

test('saves output to default definition module path when not specified', async () => {
  await program.parseAsync(['node', 'cli.ts', 'swcrc'])

  await expect(
    fs.stat(path.join(process.cwd(), 'swcrc.d.ts')),
  ).resolves.toBeTruthy()
})

test('saves compiled contents', async () => {
  await program.parseAsync(['node', 'cli.ts', 'swcrc'])

  expect(
    (await fs.readFile(path.join(process.cwd(), 'swcrc.d.ts'))).toString(),
  ).toMatchInlineSnapshot(`"export {}"`)
})

test('saves module to specified output path', async () => {
  const output = path.join(temporaryDirectory(), 'swcrc.ts')
  await program.parseAsync(['node', 'cli.ts', 'swcrc', output])

  await expect(fs.stat(output)).resolves.toBeTruthy()
})

test('disables cache with `--no-cache`', async () => {
  await program.parseAsync(['node', 'cli.ts', 'swcrc', '--no-cache'])

  expect(compile).toHaveBeenCalledWith('swcrc', false, {
    jsii: undefined,
    typeName: undefined,
  })
})

test('compiles for jsii with `--jsii`', async () => {
  await program.parseAsync(['node', 'cli.ts', 'swcrc', '--jsii'])

  expect(compile).toHaveBeenCalledWith('swcrc', true, {
    jsii: true,
    typeName: undefined,
  })
})

test('names the root interface with `--type-name`', async () => {
  await program.parseAsync([
    'node',
    'cli.ts',
    'swcrc',
    '--type-name',
    'SwcrcSchema',
  ])

  expect(compile).toHaveBeenCalledWith('swcrc', true, {
    jsii: undefined,
    typeName: 'SwcrcSchema',
  })
})
