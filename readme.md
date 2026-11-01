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

- members are `readonly`
- objects written inline become named interfaces, and named maps are written
  inline as `{ [k: string]: T }`
- intersections become a single interface, and tuples become arrays
- names that aren't camelCase, names jsii reserves and index signatures stay in
  the typings as they are, tagged `@jsii ignore`, so the assembly leaves them
  out

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
