import * as path from 'node:path'

export const isSchemaUrl = (schema: string): boolean =>
  /^https:\/\//i.test(schema)

export const urlName = (url: string): string =>
  path.posix.basename(new URL(url).pathname).replace(/\.[^.]*$/, '')
