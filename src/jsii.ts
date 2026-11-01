const property = /^ {2}(?:readonly )?("[^"]+"|'[^']+'|[A-Za-z_$][\w$]*)(\?)?:/

/**
 * jsii requires a struct's members to be `readonly` (JSII3008). Only the
 * members of exported interfaces are rewritten.
 */
export const jsiiTypings = (source: string): string => {
  const output: string[] = []
  let inInterface = false

  for (const line of source.split('\n')) {
    if (!inInterface) {
      inInterface = /^export interface .*\{$/.test(line)
      output.push(line)
      continue
    }

    if (line === '}') {
      inInterface = false
      output.push(line)
      continue
    }

    const match = property.exec(line)

    if (!match) {
      output.push(line)
      continue
    }

    output.push(line.replace(/^ {2}(?:readonly )?/, '  readonly '))
  }

  return output.join('\n')
}
