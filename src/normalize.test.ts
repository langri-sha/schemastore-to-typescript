import { expect, test } from '@langri-sha/vitest'
import type { JSONSchema } from 'json-schema-to-typescript'

import { normalizeSchema } from './normalize.js'

test('leaves a draft-07 document alone', () => {
  const schema: JSONSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      id: { $ref: '#/definitions/id' },
    },
    definitions: {
      id: { type: 'string' },
    },
  }

  expect(normalizeSchema(schema)).toEqual(schema)
})

test('renames $defs and rewrites the pointers into it', () => {
  expect(
    normalizeSchema({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        sdk: { $ref: '#/$defs/SDK' },
        sdks: { items: { $ref: '#/$defs/SDK' }, type: 'array' },
      },
      $defs: {
        SDK: { type: 'string' },
      },
    }),
  ).toEqual({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      sdk: { $ref: '#/definitions/SDK' },
      sdks: { items: { $ref: '#/definitions/SDK' }, type: 'array' },
    },
    definitions: {
      SDK: { type: 'string' },
    },
  })
})

test('renames $defs nested inside a definition', () => {
  expect(
    normalizeSchema({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $ref: '#/$defs/outer',
      $defs: {
        outer: {
          type: 'object',
          properties: {
            inner: { $ref: '#/$defs/outer/$defs/inner' },
          },
          $defs: {
            inner: { type: 'string' },
          },
        },
      },
    }),
  ).toEqual({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      inner: { $ref: '#/definitions/outer/definitions/inner' },
    },
    definitions: {
      outer: {
        type: 'object',
        properties: {
          inner: { $ref: '#/definitions/outer/definitions/inner' },
        },
        definitions: {
          inner: { type: 'string' },
        },
      },
    },
  })
})

test('renames around a name that collides with an existing definition', () => {
  expect(
    normalizeSchema({
      properties: {
        old: { $ref: '#/definitions/SDK' },
        new: { $ref: '#/$defs/SDK' },
      },
      definitions: {
        SDK: { type: 'number' },
      },
      $defs: {
        SDK: { type: 'string' },
      },
    }),
  ).toEqual({
    properties: {
      old: { $ref: '#/definitions/SDK' },
      new: { $ref: '#/definitions/SDK_2' },
    },
    definitions: {
      SDK: { type: 'number' },
      SDK_2: { type: 'string' },
    },
  })
})

test('leaves strings that only look like pointers alone', () => {
  const schema: JSONSchema = {
    type: 'object',
    properties: {
      $defs: { type: 'string', default: '#/$defs/SDK' },
      note: { type: 'string', enum: ['#/$defs/SDK'], const: '#/$defs/SDK' },
      external: { $ref: 'https://example.com/other.json#/$defs/SDK' },
    },
  }

  expect(normalizeSchema(schema)).toEqual(schema)
})

test('inlines a root $ref while keeping the definition reachable', () => {
  expect(
    normalizeSchema({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/module',
      title: 'Some module',
      $ref: '#/definitions/Module',
      definitions: {
        Module: {
          type: 'object',
          title: 'Module',
          properties: {
            self: { $ref: '#/definitions/Module' },
          },
          required: ['self'],
        },
      },
    }),
  ).toEqual({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://example.com/module',
    title: 'Some module',
    type: 'object',
    properties: {
      self: { $ref: '#/definitions/Module' },
    },
    required: ['self'],
    definitions: {
      Module: {
        type: 'object',
        title: 'Module',
        properties: {
          self: { $ref: '#/definitions/Module' },
        },
        required: ['self'],
      },
    },
  })
})

test('leaves a root $ref that resolves to nothing alone', () => {
  const schema = {
    $ref: '#/$defs/Missing',
    $defs: {
      Present: { type: 'string' },
    },
  }

  expect(normalizeSchema(schema)).toEqual({
    $ref: '#/$defs/Missing',
    definitions: {
      Present: { type: 'string' },
    },
  })
})

test('leaves a root $ref to the document itself alone', () => {
  const schema: JSONSchema = {
    $ref: '#',
    type: 'object',
  }

  expect(normalizeSchema(schema)).toEqual(schema)
})

test('inlines a root $ref into $defs', () => {
  expect(
    normalizeSchema({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Some module',
      $ref: '#/$defs/Module',
      $defs: {
        Module: {
          type: 'object',
          properties: {
            sdk: { $ref: '#/$defs/SDK' },
          },
        },
        SDK: { type: 'string' },
      },
    }),
  ).toEqual({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Some module',
    type: 'object',
    properties: {
      sdk: { $ref: '#/definitions/SDK' },
    },
    definitions: {
      Module: {
        type: 'object',
        properties: {
          sdk: { $ref: '#/definitions/SDK' },
        },
      },
      SDK: { type: 'string' },
    },
  })
})
