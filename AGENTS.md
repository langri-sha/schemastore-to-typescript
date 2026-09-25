# Agents orientation — `langri-sha/schemastore-to-typescript`

`schemastore-to-typescript` compiles a JSON Schema Store schema to TypeScript,
as a CLI and as a `compile` function. The package is the repository root.

## Who owns which file

| Owner                                   | Files                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projen (`.projenrc.ts` → `pnpm projen`) | `package.json`, `.projen/`, `tsconfig*.json`, `pnpm-workspace.yaml`, `renovate.json5`, `beachball.config.cjs`, the ESLint, Prettier and lint-staged configs, `.husky/`, the ignore and attribute files, `CODEOWNERS`, `license` |
| Beachball                               | `CHANGELOG.md`, `CHANGELOG.json` and the `version` field                                                                                                                                                                        |
| You                                     | `src/**`, `readme.md`, `.github/workflows/`, this file                                                                                                                                                                          |

Synthesized files are read-only; change them in `.projenrc.ts`. Repository
settings, branch protection and the Actions secrets are managed by
`langri-sha/github-repos`.

## Common tasks

```sh
pnpm install
pnpm projen                             # re-synthesize from .projenrc.ts
pnpm vitest                             # tests
pnpm tsc --build .                      # typecheck
pnpm eslint . && pnpm prettier --check .
pnpm change                             # write a change file
```

## Release

Beachball versions the package and the Release workflow publishes it through npm
trusted publishing. Anything that reaches the tarball or builds it — `src/`,
`readme.md`, `package.json`, `tsconfig.build.json` — needs a change file in the
same pull request. Root tooling does not: `beachball.config.cjs` lists what is
exempt, so lock file maintenance never cuts a release.

`main`, `types` and `bin` point at `src/` in the repository, and `publishConfig`
swaps them for `dist/`, which `prepublishOnly` builds. The tarball still ships
`src/`: the langri-sha/projen packages run `src/cli.ts` through `tsx` in their
`prepare` scripts.

There is deliberately no `engines` field. Published from the root, it would bind
consumers to the Node.js release this repository is developed on, so that lives
in `devEngines`, where `actions/setup-node` reads it.

## Dependencies

`got` hands our `Keyv` to its bundled `cacheable-request`, which checks it with
`instanceof` against its own `keyv` dependency. Move `got`, `keyv` and
`keyv-file` together; Renovate groups them. `keyv-file` drops a write that
coalesces onto an in-flight save, which `flushCache` in `src/index.ts` works
around.

## Provenance

Extracted from `langri-sha/projen` at `39587c9d` on 2026-09-24 with
`git filter-repo --subdirectory-filter packages/schemastore-to-typescript`. All
102 commits that touched the package keep their trees, authorship, dates and
messages. The history reaches back to 2024-06-24, when the package started in
`langri-sha/langri-sha.com`, which handed it to projen on 2026-07-20. Issue and
pull request numbers in those older messages refer to the two source
repositories.

Up to 0.2.12 it was published as `@langri-sha/schemastore-to-typescript`, which
is deprecated in favour of this name.
