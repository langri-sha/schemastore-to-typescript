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

[`got`]: https://www.npmjs.com/package/got
[`json-schema-to-typescript`]:
  https://www.npmjs.com/package/json-schema-to-typescript
[json schema store]: https://www.schemastore.org/
[json schema store catalog api]:
  https://www.schemastore.org/api/json/catalog.json
[typescript typings]:
  https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-d-ts.html
