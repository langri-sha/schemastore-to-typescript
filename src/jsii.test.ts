import {
  afterEach,
  expect,
  nock,
  temporaryDirectory,
  test,
} from '@langri-sha/vitest'
import { vi } from 'vitest'

import { type CompileOptions, compile } from './index.js'

vi.mock('env-paths', () => {
  const cache = temporaryDirectory()

  return {
    default: () => ({ cache }),
  }
})

afterEach(() => {
  nock.cleanAll()
})

const compileForJsii = async (
  schema: object,
  options: CompileOptions = {},
): Promise<string> => {
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

  const ts = await compile('some', false, { jsii: true, ...options })

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

test('drops null from a type list', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      name: { type: ['string', 'null'] },
      level: { type: ['string', 'number', 'null'] },
      gone: { type: 'null' },
      cleared: { const: null },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly name?: string;
      readonly level?: string | number;
      readonly gone?: unknown;
      readonly cleared?: unknown;
    }
    "
  `)
})

test('drops null from the alternatives of anyOf and oneOf', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      target: { anyOf: [{ $ref: '#/definitions/target' }, { type: 'null' }] },
      mode: {
        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
      },
    },
    additionalProperties: false,
    definitions: {
      target: {
        type: 'object',
        properties: { path: { type: 'string' } },
        additionalProperties: false,
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly target?: Target;
      readonly mode?: string | number;
    }
    export interface Target {
      readonly path?: string;
    }
    "
  `)
})

test('keeps a reference to a definition whole when null is dropped beside it', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      first: {
        description: 'The first limit.',
        anyOf: [{ $ref: '#/definitions/limit' }, { type: 'null' }],
      },
      second: { $ref: '#/definitions/limit' },
    },
    additionalProperties: false,
    definitions: {
      limit: {
        description: 'A limit.',
        type: 'object',
        properties: { count: { type: 'number' } },
        additionalProperties: false,
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      /**
       * The first limit.
       */
      readonly first?: Limit;
      readonly second?: Limit;
    }
    /**
     * A limit.
     */
    export interface Limit {
      readonly count?: number;
    }
    "
  `)
})

test('leaves a definition alone when a node with members refers to it beside null', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      extra: {
        type: 'object',
        properties: { a: { type: 'string' } },
        anyOf: [{ $ref: '#/definitions/extra' }, { type: 'null' }],
        additionalProperties: false,
      },
      other: { $ref: '#/definitions/extra' },
    },
    additionalProperties: false,
    definitions: {
      extra: {
        type: 'object',
        properties: { b: { type: 'string' } },
        additionalProperties: false,
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly extra?: SomeExtra;
      readonly other?: Extra;
    }
    export interface SomeExtra {
      readonly a?: string;
      readonly b?: string;
    }
    export interface Extra {
      readonly b?: string;
    }
    "
  `)
})

test('drops null from an enum', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      format: { enum: ['full', 'concise', null] },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly format?: "full" | "concise";
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

test('names a closed object that has no members', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      ruby: { type: 'object', additionalProperties: false },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly ruby?: SomeRuby;
    }
    export interface SomeRuby {}
    "
  `)
})

test('writes a type name spelled in capitals in pascal case', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      runtime: { $ref: '#/definitions/SDK' },
      home: { $ref: '#/definitions/URL' },
      entry: { $ref: '#/definitions/SDKEntry' },
    },
    additionalProperties: false,
    definitions: {
      SDK: {
        type: 'object',
        properties: { source: { type: 'string' } },
        additionalProperties: false,
      },
      URL: { type: 'string', format: 'uri' },
      SDKEntry: {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false,
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export type Url = string;

    export interface Some {
      readonly runtime?: Sdk;
      readonly home?: Url;
      readonly entry?: SDKEntry;
    }
    export interface Sdk {
      readonly source?: string;
    }
    export interface SDKEntry {
      readonly name?: string;
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

test('writes a map-only definition inline where it is referenced', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      urls: { $ref: '#/definitions/urls' },
      scripts: { $ref: '#/definitions/urls', description: 'Entry points.' },
    },
    additionalProperties: false,
    definitions: {
      urls: {
        title: 'Project URLs',
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly urls?: {
        [k: string]: string;
      };
      /**
       * Entry points.
       */
      readonly scripts?: {
        [k: string]: string;
      };
    }
    "
  `)
})

test('keeps the values of a map that refers to a definition beside its type', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      catalog: { $ref: '#/definitions/dependency', type: 'object' },
      catalogs: {
        type: 'object',
        additionalProperties: { $ref: '#/definitions/catalog' },
      },
    },
    additionalProperties: false,
    definitions: {
      dependency: {
        type: 'object',
        additionalProperties: { type: 'string', minLength: 1 },
      },
      catalog: { $ref: '#/definitions/dependency', type: 'object' },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly catalog?: {
        [k: string]: string;
      };
      readonly catalogs?: {
        [k: string]: {
          [k: string]: string;
        };
      };
    }
    "
  `)
})

test('writes nested map-only definitions inline', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      groups: { $ref: '#/definitions/groups' },
    },
    additionalProperties: false,
    definitions: {
      groups: {
        type: 'object',
        additionalProperties: { $ref: '#/definitions/entries' },
      },
      entries: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly groups?: {
        [k: string]: {
          [k: string]: string;
        };
      };
    }
    "
  `)
})

test('writes pattern properties without members as a map', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      env: {
        type: 'object',
        patternProperties: { '^[A-Z_]+$': { type: 'string' } },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly env?: {
        [k: string]: string;
      };
    }
    "
  `)
})

test('keeps a map that reaches itself as a named interface', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      tree: { $ref: '#/definitions/tree' },
    },
    additionalProperties: false,
    definitions: {
      tree: {
        type: 'object',
        additionalProperties: {
          anyOf: [{ type: 'string' }, { $ref: '#/definitions/tree' }],
        },
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly tree?: {
        [k: string]: string | Tree;
      };
    }
    export interface Tree {
      /** @jsii ignore */
      [k: string]: string | Tree;
    }
    "
  `)
})

test('replaces a single-member allOf with its reference', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      policy: {
        description: 'How to authenticate.',
        type: 'string',
        allOf: [{ $ref: '#/definitions/policy' }],
      },
    },
    additionalProperties: false,
    definitions: {
      policy: { type: 'string', enum: ['auto', 'always', 'never'] },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      /**
       * How to authenticate.
       */
      readonly policy?: "auto" | "always" | "never";
    }
    "
  `)
})

test('merges the object members of an allOf into one interface', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      dependency: {
        allOf: [
          { $ref: '#/definitions/source' },
          {
            type: 'object',
            properties: { optional: { type: 'boolean' } },
            required: ['optional'],
          },
        ],
      },
    },
    additionalProperties: false,
    definitions: {
      source: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
    },
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly dependency?: SomeDependency;
    }
    export interface SomeDependency {
      readonly optional: boolean;
      readonly path: string;
      /** @jsii ignore */
      [k: string]: unknown;
    }
    "
  `)
})

test('drops allOf members that only constrain', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      dependency: {
        type: 'object',
        properties: {
          git: { type: 'string' },
          path: { type: 'string' },
        },
        allOf: [
          { not: { required: ['git', 'path'] } },
          { anyOf: [{ required: ['git'] }, { required: ['path'] }] },
        ],
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly dependency?: SomeDependency;
    }
    export interface SomeDependency {
      readonly git?: string;
      readonly path?: string;
    }
    "
  `)
})

test('merges alternatives written beside members into the interface', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      project: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        anyOf: [
          {
            properties: {
              dynamic: { type: 'array', items: { type: 'string' } },
            },
            required: ['dynamic'],
          },
          {
            properties: { version: { type: 'string' } },
            required: ['version'],
          },
        ],
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly project?: SomeProject;
    }
    export interface SomeProject {
      readonly name: string;
      readonly dynamic?: string[];
      readonly version?: string;
    }
    "
  `)
})

test('unions what several alternatives say about a member', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      source: {
        type: 'object',
        properties: { name: { type: 'string' } },
        anyOf: [
          {
            properties: { kind: { const: 'git' }, url: { type: 'string' } },
            required: ['kind'],
          },
          {
            properties: { kind: { const: 'path' }, path: { type: 'string' } },
            required: ['kind'],
          },
        ],
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly source?: SomeSource;
    }
    export interface SomeSource {
      readonly name?: string;
      readonly kind?: "git" | "path";
      readonly url?: string;
      readonly path?: string;
    }
    "
  `)
})

test('turns tuples into arrays', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      pair: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 2,
      },
      models: { type: 'array', items: { type: 'string' }, maxItems: 3 },
      mixed: { type: 'array', items: [{ type: 'string' }, { type: 'number' }] },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      /**
       * @minItems 2
       * @maxItems 2
       */
      readonly pair?: string[];
      /**
       * @maxItems 3
       */
      readonly models?: string[];
      readonly mixed?: (string | number)[];
    }
    "
  `)
})

test('lets the elements after a tuple be what the schema allows', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      typed: {
        type: 'array',
        items: [{ type: 'string' }],
        additionalItems: { type: 'boolean' },
      },
      open: {
        type: 'array',
        items: [{ type: 'string' }],
        additionalItems: true,
      },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly typed?: (string | boolean)[];
      readonly open?: unknown[];
    }
    "
  `)
})

test('hides members that are not camelCase from jsii', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      $schema: { type: 'string' },
      line_length: { type: 'number', description: 'Maximum line length.' },
      'target-version': { type: 'string' },
      lineWidth: { type: 'number' },
    },
    required: ['target-version'],
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      /** @jsii ignore */
      readonly $schema?: string;
      /**
       * Maximum line length.
       * @jsii ignore
       */
      readonly line_length?: number;
      /** @jsii ignore */
      readonly "target-version": string;
      readonly lineWidth?: number;
    }
    "
  `)
})

test('hides members named like methods generated for other languages from jsii', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      build: { type: 'string' },
      equals: { type: 'string' },
      hashCode: { type: 'string' },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      /** @jsii ignore */
      readonly build?: string;
      /** @jsii ignore */
      readonly equals?: string;
      /** @jsii ignore */
      readonly hashCode?: string;
    }
    "
  `)
})

test('hides an index signature from jsii and keeps it in the typings', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      model: { type: 'string' },
    },
    additionalProperties: true,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly model?: string;
      /** @jsii ignore */
      [k: string]: unknown;
    }
    "
  `)
})

test('gives a deprecation a reason', async () => {
  const ts = await compileForJsii({
    type: 'object',
    properties: {
      license: {
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            deprecated: true,
            properties: { file: { type: 'string' } },
            additionalProperties: false,
          },
        ],
      },
      legacy: { type: 'string', deprecated: true },
    },
    additionalProperties: false,
  })

  expect(ts).toMatchInlineSnapshot(`
    "export interface Some {
      readonly license?: string | SomeLicenseOption2;
      /**
       * @deprecated Deprecated by the schema.
       */
      readonly legacy?: string;
    }
    /**
     * @deprecated Deprecated by the schema.
     */
    export interface SomeLicenseOption2 {
      readonly file?: string;
    }
    "
  `)
})

test('names the root interface with the type name', async () => {
  const ts = await compileForJsii(
    {
      type: 'object',
      properties: { select: { type: 'array', items: { type: 'string' } } },
      additionalProperties: false,
    },
    { typeName: 'SomeSchema' },
  )

  expect(ts).toMatchInlineSnapshot(`
    "export interface SomeSchema {
      readonly select?: string[];
    }
    "
  `)
})
