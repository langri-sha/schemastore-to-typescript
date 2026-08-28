import type { JSONSchema } from 'json-schema-to-typescript'

type Node = Record<string, unknown>

// Maps the JSON pointer of a schema node to the `definitions` name each of its
// `$defs` members moves to.
type Renames = Map<string, Map<string, string>>

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Hold literal instance data rather than nested schemas, so they must not be
// walked as if they were part of the schema shape.
const literalKeys = new Set(['const', 'default', 'enum', 'examples'])

// Keyed by name rather than by keyword: a member of one of these called
// `$defs` is a subschema that happens to be named `$defs`, not a definition
// block.
const namedSchemaKeys = new Set([
  '$defs',
  'definitions',
  'dependencies',
  'dependentSchemas',
  'patternProperties',
  'properties',
])

const escapeToken = (name: string) =>
  name.replaceAll('~', '~0').replaceAll('/', '~1')

const unescapeToken = (token: string) =>
  token.replaceAll('~1', '/').replaceAll('~0', '~')

const join = (path: string, token: string) =>
  path === '' ? token : `${path}/${token}`

const resolvePointer = (document: Node, ref: string): unknown => {
  if (ref === '#') {
    return document
  }

  if (!ref.startsWith('#/')) {
    return undefined
  }

  let node: unknown = document

  for (const token of ref.slice(2).split('/')) {
    if (Array.isArray(node)) {
      node = node[Number(token)]
    } else if (isObject(node)) {
      node = node[unescapeToken(token)]
    } else {
      return undefined
    }
  }

  return node
}

const collectRenames = (
  node: unknown,
  path: string,
  inSchema: boolean,
  renames: Renames,
): void => {
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) {
      collectRenames(item, join(path, String(index)), inSchema, renames)
    }

    return
  }

  if (!isObject(node)) {
    return
  }

  if (!inSchema) {
    for (const [name, value] of Object.entries(node)) {
      collectRenames(value, join(path, escapeToken(name)), true, renames)
    }

    return
  }

  if (isObject(node.$defs)) {
    const taken = new Set(
      isObject(node.definitions) ? Object.keys(node.definitions) : [],
    )
    const mapping = new Map<string, string>()

    for (const name of Object.keys(node.$defs)) {
      let target = name

      for (let suffix = 2; taken.has(target); suffix++) {
        target = `${name}_${suffix}`
      }

      taken.add(target)
      mapping.set(name, target)
    }

    renames.set(path, mapping)
  }

  for (const [key, value] of Object.entries(node)) {
    if (literalKeys.has(key)) {
      continue
    }

    collectRenames(
      value,
      join(path, escapeToken(key)),
      !namedSchemaKeys.has(key),
      renames,
    )
  }
}

const rewriteRef = (ref: string, renames: Renames): string => {
  if (!ref.startsWith('#/')) {
    return ref
  }

  const tokens = ref.slice(2).split('/')
  const rewritten: string[] = []
  let path = ''

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const name = tokens[index + 1]
    const mapping = token === '$defs' ? renames.get(path) : undefined
    const target =
      mapping && name !== undefined
        ? mapping.get(unescapeToken(name))
        : undefined

    if (target === undefined) {
      rewritten.push(token)
      path = join(path, token)
      continue
    }

    rewritten.push('definitions', escapeToken(target))
    path = join(join(path, token), name as string)
    index++
  }

  return `#/${rewritten.join('/')}`
}

const applyRenames = (
  node: unknown,
  path: string,
  inSchema: boolean,
  renames: Renames,
): unknown => {
  if (Array.isArray(node)) {
    return node.map((item, index) =>
      applyRenames(item, join(path, String(index)), inSchema, renames),
    )
  }

  if (!isObject(node)) {
    return node
  }

  if (!inSchema) {
    return Object.fromEntries(
      Object.entries(node).map(([name, value]) => [
        name,
        applyRenames(value, join(path, escapeToken(name)), true, renames),
      ]),
    )
  }

  const mapping = renames.get(path)
  const renamed: Node = {}

  for (const [key, value] of Object.entries(node)) {
    if (literalKeys.has(key)) {
      renamed[key] = value
      continue
    }

    if (key === '$ref' && typeof value === 'string') {
      renamed[key] = rewriteRef(value, renames)
      continue
    }

    if (key === '$defs' && mapping) {
      continue
    }

    renamed[key] = applyRenames(
      value,
      join(path, escapeToken(key)),
      !namedSchemaKeys.has(key),
      renames,
    )
  }

  if (mapping) {
    const defs = node.$defs as Node
    const definitions: Node = isObject(renamed.definitions)
      ? renamed.definitions
      : {}

    for (const [name, target] of mapping) {
      definitions[target] = applyRenames(
        defs[name],
        join(join(path, '$defs'), escapeToken(name)),
        true,
        renames,
      )
    }

    renamed.definitions = definitions
  }

  return renamed
}

/**
 * A document whose root is `{$ref}` describes the referenced definition, with
 * any sibling keyword layered on top of it — `title` above all, which is what
 * names the exported type. The definition stays where it is, so pointers into
 * it keep resolving; only a copy is hoisted.
 */
const inlineRootRef = (document: Node): Node => {
  let root = document
  const seen = new Set<string>()

  while (typeof root.$ref === 'string' && !seen.has(root.$ref)) {
    const target = resolvePointer(document, root.$ref)

    if (!isObject(target) || target === root) {
      break
    }

    seen.add(root.$ref)

    const siblings = { ...root }
    delete siblings.$ref

    root = { ...target, ...siblings }
  }

  return root
}

/**
 * `json-schema-to-typescript` resolves references against draft-07's
 * vocabulary: it only knows `definitions`, and it expects the root to be a
 * schema rather than a reference to one. Draft 2020-12 documents that spell
 * their definitions `$defs` or that point the root at one therefore fail to
 * resolve, with `Refs should have been resolved by the resolver!`.
 *
 * Restate them in the shape it does resolve, without disturbing documents that
 * are already in it.
 */
export const normalizeSchema = (schema: JSONSchema): JSONSchema => {
  if (!isObject(schema)) {
    return schema
  }

  const renames: Renames = new Map()
  collectRenames(schema, '', true, renames)

  return inlineRootRef(
    applyRenames(schema, '', true, renames) as Node,
  ) as JSONSchema
}
