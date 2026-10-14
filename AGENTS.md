# Agents orientation — `langri-sha/schemastore-to-typescript`

`schemastore-to-typescript` compiles a JSON Schema Store schema to TypeScript,
as a CLI and as a `compile` function. The package is the repository root.

## Who owns which file

Projen writes `package.json` and every file listed in `.projen/files.json`; they
are read-only. Change them in `.projenrc.ts`, then run `pnpm exec projen`.
Beachball owns `CHANGELOG.md`, `CHANGELOG.json` and the `version` field.
Everything else — `src/`, `readme.md`, `.github/workflows/`, this file — is
edited by hand. Repository settings, branch protection and the Actions secrets
are managed by `langri-sha/github-repos`.

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

The Release workflow calls the shared Packages workflow with
`tag-template: v{version}`, which tags each published version, e.g. `v1.0.0`,
and `github-releases: true`, which creates a GitHub release with generated notes
for it. Beachball's own `gitTags` stays off, since it would name the tags
`schemastore-to-typescript_v1.0.0`. A tag that already has a release is skipped,
so the workflow is safe to rerun.

`main`, `types` and `bin` point at `src/` in the repository, and `publishConfig`
swaps them for `dist/`, which `prepublishOnly` builds. The tarball leaves `src/`
out, but a local `npm pack` still lists it: `main` and `bin` pull it in until
beachball applies `publishConfig` at publish time.

There is deliberately no `engines` field. Published from the root, it would bind
consumers to the Node.js release this repository is developed on, so that lives
in `devEngines`, where `actions/setup-node` reads it.

## Dependencies

`got` hands our `Keyv` to its bundled `cacheable-request`, which checks it with
`instanceof` against its own `keyv` dependency. Move `got`, `keyv` and
`keyv-file` together; Renovate groups them. `keyv-file` drops a write that
coalesces onto an in-flight save, which `flushCache` in `src/index.ts` works
around.
