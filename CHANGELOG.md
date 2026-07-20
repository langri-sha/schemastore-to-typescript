# Change Log - @langri-sha/schemastore-to-typescript

<!-- This log was last generated on Mon, 20 Jul 2026 10:17:52 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.2.1

Mon, 20 Jul 2026 10:17:52 GMT

### Patches

- fix(schemastore-to-typescript): remove unused @ts-expect-error directive (TS2578) (email not defined)
- Force CLI exit so a lingering handle cannot hang the runtime on nested re-runs (filip.dupanovic@gmail.com)
- fix: attach { cause } to re-thrown errors (ESLint 10 preserve-caught-error) (filip.dupanovic@gmail.com)
- fix(deps): update dependency es-main to v1.4.0 (email not defined)
- fix(deps): update dependency keyv-file to v5.3.3 (email not defined)
- chore: publish from langri-sha/projen, which now owns this package and its history (filip.dupanovic@gmail.com)
- Drive the CLI through `.then`/`.catch` instead of a top-level await so a stalled cache request can no longer hang `prepare` as an unsettled top-level await (exit code 13) (filip.dupanovic@gmail.com)
- fix(deps): update dependency debug to v4.4.3 (email not defined)
- Bump @langri-sha/tsconfig to v0.10.2
- Bump @langri-sha/vitest to v0.1.2

## 0.2.0

Sun, 17 May 2026 20:22:40 GMT

### Minor changes

- Refactor schema fetching to use catalog API and improve tests (bot@langri-sha.com)
- fix(schemastore-to-typescript): stabilize generated type names by overriding schema title with catalog name (filip.dupanovic@gmail.com)

### Patches

- fix(deps): update dependency got to v14.4.7 (email not defined)

## 0.1.4

Tue, 10 Sep 2024 10:39:17 GMT

### Patches

- fix(schemastore-to-typescript): Supress `keyv-file` type errors (filip.dupanovic@gmail.com)
- fix(deps): update dependency keyv-file to v5 (email not defined)

## 0.1.3

Sat, 27 Jul 2024 15:50:17 GMT

### Patches

- chore(deps): fix(deps): update dependency debug to v4.3.6 (email not defined)

## 0.1.2

Fri, 26 Jul 2024 21:00:29 GMT

### Patches

- chore(deps): chore(deps): update dependency projen to v0.84.6 (email not defined)
- chore(deps): fix(deps): update dependency got to v14.4.2 (email not defined)
- chore(deps): fix(deps): update dependency json-schema-to-typescript to v15 (email not defined)

## 0.1.1

Wed, 17 Jul 2024 10:48:16 GMT

### Patches

- fix(workspace): Use correct GitHub directory (filip.dupanovic@gmail.com)

## 0.1.0

Mon, 08 Jul 2024 21:43:05 GMT

### Minor changes

- feat(schema2ts): Compile store schema (filip.dupanovic@gmail.com)

### Patches

- fix(projen): Use workspace `@langri-sha/tsconfig` (filip.dupanovic@gmail.com)
- fix(projen): Use correct output directory (filip.dupanovic@gmail.com)
