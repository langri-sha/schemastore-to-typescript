# @langri-sha/schemastore-to-typescript

Fetch [JSON Schema] from the [JSON Schema Store] catalog and compile [TypeScript
typings].

The tool first fetches the schema catalog from the JSON Schema Store API,
searches for the requested schema by name (case-insensitive), and then downloads
and compiles the schema to TypeScript definitions.

## Features

- uses [`json-schema-to-typescript`] for TypeScript generation
- fetches schemas from the [JSON Schema Store catalog API]
- case-insensitive schema name matching
- offline cache using [`got`] for both catalog and schema requests

## Usage

```sh
npm install -D @langri-sha/schemastore-to-typescript
```

Name a schema as it appears in the catalog, and optionally where to write its
typings — `<schema>.d.ts` in the working directory by default:

```sh
schemastore-to-typescript renovate src/renovate.ts
schemastore-to-typescript 'cargo manifest' src/cargo.ts
```

Requests are cached in the user cache directory, such as
`~/.cache/schemastore-to-typescript-nodejs` on Linux. Pass `--no-cache` to skip
it.

The same is available as a function, which resolves to the compiled module and
takes `false` as its second argument to skip the cache:

```ts
import { compile } from '@langri-sha/schemastore-to-typescript'

const typings = await compile('swcrc')
```

[`got`]: https://www.npmjs.com/package/got
[`json-schema-to-typescript`]:
  https://www.npmjs.com/package/json-schema-to-typescript
[json schema store]: https://www.schemastore.org/
[json schema store catalog api]:
  https://www.schemastore.org/api/json/catalog.json
[json schema]: https://json-schema.org/
[typescript typings]:
  https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-d-ts.html
