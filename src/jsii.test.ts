import {
  afterEach,
  expect,
  nock,
  temporaryDirectory,
  test,
} from '@langri-sha/vitest'
import { vi } from 'vitest'

import { compile } from './index.js'

vi.mock('env-paths', () => {
  const cache = temporaryDirectory()

  return {
    default: () => ({ cache }),
  }
})

afterEach(() => {
  nock.cleanAll()
})

const compileForJsii = async (schema: object): Promise<string> => {
  nock('https://www.schemastore.org')
    .get('/api/json/catalog.json')
    .reply(200, {
      $schema: 'https://json.schemastore.org/schema-catalog.json',
      version: 1,
      schemas: [
        {
          name: 'Some',
          description: 'Some schema description',
          url: 'https://example.com/some.json',
        },
      ],
    })

  nock('https://example.com')
    .get('/some.json')
    .reply(200, {
      $schema: 'http://json-schema.org/draft-07/schema#',
      ...schema,
    })

  const ts = await compile('some', false, { jsii: true })

  return ts.replace(/^[\s\S]*?\*\/\n\n/, '')
}

test('marks interface members readonly', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      id: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['id'],
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly id: string;
      readonly tags?: string[];
    }
    "
  `)
})
