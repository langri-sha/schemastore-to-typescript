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

test('names objects written inline so they become interfaces', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      permissions: {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
          limits: {
            type: 'object',
            properties: { depth: { type: 'number' } },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      hooks: {
        type: 'array',
        items: {
          type: 'object',
          properties: { command: { type: 'string' } },
          additionalProperties: false,
        },
      },
      source: {
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: { url: { type: 'string' } },
            additionalProperties: false,
          },
        ],
      },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly permissions?: SomePermissions;
      readonly hooks?: SomeHooksItem[];
      readonly source?: string | SomeSourceOption2;
    }
    export interface SomePermissions {
      readonly allow?: string[];
      readonly limits?: SomePermissionsLimits;
    }
    export interface SomePermissionsLimits {
      readonly depth?: number;
    }
    export interface SomeHooksItem {
      readonly command?: string;
    }
    export interface SomeSourceOption2 {
      readonly url?: string;
    }
    "
  `)
})

test('keeps a name already taken by a definition free', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      permissions: {
        type: 'object',
        properties: { allow: { type: 'string' } },
        additionalProperties: false,
      },
      overrides: { $ref: '#/definitions/SomePermissions' },
    },
    additionalProperties: false,
    definitions: {
      SomePermissions: {
        type: 'object',
        properties: { deny: { type: 'string' } },
        additionalProperties: false,
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly permissions?: SomePermissions2;
      readonly overrides?: SomePermissions;
    }
    export interface SomePermissions2 {
      readonly allow?: string;
    }
    export interface SomePermissions {
      readonly deny?: string;
    }
    "
  `)
})
