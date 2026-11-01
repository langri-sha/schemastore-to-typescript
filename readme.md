# schemastore-to-typescript

Generate [TypeScript typings] for any schema in the [JSON Schema Store] catalog,
by name.

## Features

- uses [`json-schema-to-typescript`] for TypeScript generation
- fetches schemas from the [JSON Schema Store catalog API]
- case-insensitive schema name matching
- offline cache using [`got`] for both catalog and schema requests

## Usage

```sh
npm install -D schemastore-to-typescript
```

Name a schema as it appears in the catalog, in any case, and optionally where to
write its typings — `<schema>.d.ts` in the working directory by default:

```sh
schemastore-to-typescript renovate src/renovate.ts
schemastore-to-typescript 'cargo manifest' src/cargo.ts
```

Downloads are cached; pass `--no-cache` to skip the cache.

The same is available as a function, which resolves to the generated module and
takes `false` as its second argument to skip the cache:

```ts
import { compile } from 'schemastore-to-typescript'

const typings = await compile('swcrc')
```

## Usage with jsii

Typings exported from the API of a [jsii] package have to fit what jsii can
represent. Pass `--jsii` for typings that do, and `--type-name` when the root
interface would share its name with the class that wraps it:

```sh
schemastore-to-typescript --jsii --type-name RuffSchema ruff src/ruff.ts
```

```ts
const typings = await compile('ruff', true, {
  jsii: true,
  typeName: 'RuffSchema',
})
```

The mode changes the shape of types only as far as jsii requires:

- members are `readonly` and `null` is left out of unions
- objects written inline become named interfaces, and named maps are written
  inline as `{ [k: string]: T }`
- intersections become a single interface, and tuples become arrays
- type names spelled in capitals alone, such as `SDK`, become `Sdk`, and so does
  a `--type-name` spelled that way
- names that aren't camelCase, names jsii reserves and index signatures stay in
  the typings as they are, tagged `@jsii ignore`, so the assembly leaves them
  out

Pass `--keep-null` (`keepNull: true`), which implies `--jsii`, when `null` means
something in the schema, such as Renovate's use of it to clear an inherited
value. Types keep their `| null`, as in the default output, and `unknown` is
written `any`. jsii rejects such a type unless the jsii build sets
`strictNullChecks: false` in its own tsconfig (`jsii.tsconfig`), with
`jsii.validateTsconfig` set to `minimal`, since jsii's generated tsconfig and
its stricter checks require `true`. jsii then reads `T | null` as `T`, and would
read `unknown` as a JSON object, which is why the option writes `any`. A member
that can only be `null`, and `type: ['object', 'null']` with members, still fail
jsii.

## Contributing

See [CONTRIBUTING.md] in `langri-sha/github`.

[contributing.md]:
  https://github.com/langri-sha/github/blob/main/CONTRIBUTING.md
[`got`]: https://www.npmjs.com/package/got
[`json-schema-to-typescript`]:
  https://www.npmjs.com/package/json-schema-to-typescript
[jsii]: https://aws.github.io/jsii/
[json schema store]: https://www.schemastore.org/
[json schema store catalog api]:
  https://www.schemastore.org/api/json/catalog.json
[typescript typings]:
  https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-d-ts.html
