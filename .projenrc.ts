import { Project, TypeScriptConfig } from '@langri-sha/projen-project'

const project = new Project({
  name: '@langri-sha/schemastore-to-typescript',
  package: {
    authorEmail: 'filip.dupanovic@gmail.com',
    authorName: 'Filip Dupanović',
    authorOrganization: false,
    authorUrl: 'https://langri-sha.com',
    bugsUrl: 'https://github.com/langri-sha/schemastore-to-typescript/issues',
    copyrightYear: '2024',
    description:
      'Fetch JSON schemas from the JSON Schema Store catalog and compile them to TypeScript typings',
    homepage: 'https://github.com/langri-sha/schemastore-to-typescript#readme',
    keywords: ['cli', 'json-schema', 'schemastore', 'typescript'],
    license: 'MIT',
    licensed: true,
    minNodeVersion: '24.16.0',
    repository:
      'git+https://github.com/langri-sha/schemastore-to-typescript.git',
    type: 'module',

    bin: {
      'schemastore-to-typescript': 'src/cli.ts',
    },
    deps: [
      'commander@15.0.0',
      'debug@4.4.3',
      'env-paths@4.0.0',
      'es-main@1.4.0',
      'got@16.0.0',
      'json-schema-to-typescript@16.0.0',
      'keyv-file@5.3.5',
      'keyv@5.6.0',
    ],
    devDeps: [
      '@langri-sha/eslint-config@0.9.15',
      '@langri-sha/lint-staged@0.9.7',
      '@langri-sha/prettier@0.4.7',
      '@langri-sha/projen-project@*',
      '@langri-sha/tsconfig@1.0.1',
      '@langri-sha/vitest@0.2.0',
      '@types/debug@4.1.13',
      '@types/node@24.13.6',
      'vitest@5.0.1',
    ],
  },
  beachball: {
    config: {
      // The package is the repository root, so these would otherwise demand a
      // release for changes that never reach the tarball.
      ignorePatterns: [
        '.projenrc.ts',
        'AGENTS.md',
        'CODEOWNERS',
        'beachball.config.cjs',
        'eslint.config.js',
        'lint-staged.config.js',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'prettier.config.js',
        'renovate.json5',
        'tsconfig.json',
      ],
    },
  },
  codeowners: {
    '*': '@langri-sha',
  },
  editorConfig: {},
  eslint: {},
  husky: {
    'pre-commit': 'lint-staged',
  },
  lintStaged: {},
  lintSynthesized: {},
  npmIgnore: {
    ignorePatterns: [
      '*.test.*',
      '__snapshots__/',
      '/*.config.*',
      '/*.json5',
      '/*.yaml',
      '/AGENTS.md',
      '/CODEOWNERS',
      '/change/',
    ],
  },
  pnpmWorkspace: {
    minimumReleaseAgeExclude: ['@langri-sha/*'],
  },
  prettier: {},
  readme: {
    filename: 'readme.md',
  },
  renovate: {
    packageRules: [
      {
        description: 'Packages published from the langri-sha/projen monorepo',
        groupName: 'langri-sha projen toolchain',
        groupSlug: 'langri-sha-projen',
        matchSourceUrls: ['https://github.com/langri-sha/projen'],
      },
      {
        description:
          'got caches through its bundled cacheable-request, which only accepts a Keyv of its own major, so move them together',
        groupName: 'got and keyv',
        groupSlug: 'got-keyv',
        matchPackageNames: ['got', 'keyv', 'keyv-file'],
      },
      {
        description: 'Install our own packages without waiting them out',
        matchPackageNames: ['@langri-sha/**'],
        minimumReleaseAge: null,
      },
      {
        description:
          'Install our own GitHub Actions and Terraform modules without waiting them out',
        matchPackageNames: ['langri-sha/**'],
        minimumReleaseAge: null,
      },
    ],
  },
  typeScriptConfig: {
    config: {
      compilerOptions: {
        noEmit: true,
      },
      include: ['src'],
    },
  },
})

project.package?.addField('packageManager', 'pnpm@12.6.0')
project.package?.addField('publishConfig', {
  access: 'public',
  bin: {
    'schemastore-to-typescript': 'dist/cli.js',
  },
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
})

// Published from the root, so `engines` would bind every consumer to the Node.js
// release this repository is developed on. `actions/setup-node` reads the same
// version from `devEngines`, which the registry leaves to the maintainers.
project.package?.file.addDeletionOverride('engines')
project.package?.addField('devEngines', {
  runtime: {
    name: 'node',
    version: `>= ${project.package.minNodeVersion}`,
  },
})

project.package?.setScript(
  'prepublishOnly',
  'rm -rf dist; tsc --project tsconfig.build.json',
)
project.package?.setScript('test', 'vitest')

new TypeScriptConfig(project, {
  fileName: 'tsconfig.build.json',
  config: {
    extends: '@langri-sha/tsconfig/build',
    include: ['src'],
    exclude: ['**/*.test.*'],
  },
})

project.synth()
