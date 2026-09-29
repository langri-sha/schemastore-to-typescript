/** @type {import('beachball').BeachballConfig} */
module.exports = {
  branch: 'origin/main',
  gitTags: false,
  ignorePatterns: [
    '*.test.*',
    '.*/**',
    '__snapshots__/',
    'dist/',
    'node_modules/',
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
}
