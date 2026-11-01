import type { JSONSchema, Options } from 'json-schema-to-typescript'

import {
  type Node,
  escapeToken,
  isObject,
  literalKeys,
  namedSchemaKeys,
  resolvePointer,
} from './normalize.js'

export const compilerOptions: Partial<Options> = {
  ignoreMinAndMaxItems: true,
}

type Visit = (node: Node) => Node

const mapSchema = (
  node: unknown,
  visit: Visit,
  inSchema: boolean = true,
): unknown => {
  if (Array.isArray(node)) {
    return node.map((item) => mapSchema(item, visit, inSchema))
  }

  if (!isObject(node)) {
    return node
  }

  if (!inSchema) {
    return Object.fromEntries(
      Object.entries(node).map(([name, value]) => [
        name,
        mapSchema(value, visit, true),
      ]),
    )
  }

  const mapped: Node = {}

  for (const [key, value] of Object.entries(node)) {
    mapped[key] = literalKeys.has(key)
      ? value
      : mapSchema(value, visit, !namedSchemaKeys.has(key))
  }

  return visit(mapped)
}

const hasMembers = (node: unknown): node is Node & { properties: Node } =>
  isObject(node) &&
  isObject(node.properties) &&
  Object.keys(node.properties).length > 0

const isNull = (node: unknown) =>
  isObject(node) && (node.type === 'null' || node.const === null)

/**
 * jsii rejects a union with `null` (JSII1001). Every member it applies to is
 * optional, so leaving `null` out loses nothing the schema's own optionality
 * doesn't already say.
 */
const stripNull: Visit = (node) => {
  if (Array.isArray(node.type) && node.type.includes('null')) {
    const types = node.type.filter((type) => type !== 'null')

    if (types.length === 0) {
      delete node.type
    } else {
      node.type = types.length === 1 ? types[0] : types
    }
  }

  if (Array.isArray(node.enum) && node.enum.includes(null)) {
    const values = node.enum.filter((value) => value !== null)

    if (values.length === 0) {
      delete node.enum
    } else {
      node.enum = values
    }
  }

  for (const keyword of ['anyOf', 'oneOf'] as const) {
    const alternatives = node[keyword]

    if (!Array.isArray(alternatives) || !alternatives.some(isNull)) {
      continue
    }

    const remaining = alternatives.filter((member) => !isNull(member))
    const { [keyword]: _, ...rest } = node

    if (remaining.length === 0) {
      return rest
    }

    if (
      remaining.length === 1 &&
      isObject(remaining[0]) &&
      remaining[0].$ref === undefined
    ) {
      return { ...remaining[0], ...rest }
    }

    return { ...rest, [keyword]: remaining }
  }

  return node
}

/**
 * Whatever `stripNull` left of a schema that only ever allowed `null`.
 */
const unnull: Visit = (node) => {
  if (node.type === 'null') {
    delete node.type
  }

  if (node.const === null) {
    delete node.const
  }

  return node
}

const mergeMembers = (target: Node, source: Node): Node => {
  const targetRequired = Array.isArray(target.required) ? target.required : []
  const sourceRequired = Array.isArray(source.required) ? source.required : []

  return {
    ...target,
    type: 'object',
    properties: {
      ...(source.properties as Node),
      ...(target.properties as Node),
    },
    ...(targetRequired.length + sourceRequired.length > 0 && {
      required: [...new Set([...targetRequired, ...sourceRequired])],
    }),
  }
}

/**
 * Members of alternatives are any of them, so a member that several
 * alternatives describe takes all of their schemas. The node's own members
 * stay as they are: they hold in every alternative.
 */
const mergeAlternative = (
  node: Node,
  alternative: Node,
  own: Set<string>,
): Node => {
  const properties = { ...(node.properties as Node) }

  for (const [name, schema] of Object.entries(alternative.properties as Node)) {
    const earlier = properties[name]

    if (own.has(name) || JSON.stringify(earlier) === JSON.stringify(schema)) {
      continue
    }

    properties[name] =
      earlier === undefined
        ? schema
        : {
            anyOf: [
              ...(isObject(earlier) && Array.isArray(earlier.anyOf)
                ? earlier.anyOf
                : [earlier]),
              schema,
            ],
          }
  }

  return { ...node, type: 'object', properties }
}

/**
 * jsii only accepts an intersection of interfaces (JSII1008), and a union
 * beside members compiles to one. The schemas use `allOf`, and `anyOf` beside
 * `properties`, to attach constraints: this restates what they say about
 * members in one object, and drops what only constrains.
 */
const flatten =
  (document: Node): Visit =>
  (node) => {
    let flattened = node

    if (Array.isArray(flattened.allOf)) {
      const { allOf, ...rest } = flattened
      const references: Node[] = []

      flattened = rest

      for (const member of allOf) {
        if (!isObject(member)) {
          continue
        }

        const target =
          typeof member.$ref === 'string'
            ? resolvePointer(document, member.$ref)
            : member

        if (hasMembers(target)) {
          flattened = mergeMembers(flattened, target)
        } else if (typeof member.$ref === 'string') {
          references.push(member)
        }
      }

      if (references.length === 1 && !hasMembers(flattened)) {
        const { type: _, ...siblings } = flattened
        flattened = { ...references[0], ...siblings }
      }
    }

    if (hasMembers(flattened)) {
      for (const keyword of ['anyOf', 'oneOf'] as const) {
        const alternatives = flattened[keyword]

        if (!Array.isArray(alternatives)) {
          continue
        }

        const targets = alternatives.map((member) =>
          isObject(member) && typeof member.$ref === 'string'
            ? resolvePointer(document, member.$ref)
            : member,
        )

        if (
          !targets.every(
            (target) =>
              hasMembers(target) ||
              (isObject(target) && Array.isArray(target.required)),
          )
        ) {
          continue
        }

        const { [keyword]: _, ...rest } = flattened
        const own = new Set(Object.keys(rest.properties as Node))

        flattened = rest

        for (const target of targets) {
          if (hasMembers(target)) {
            flattened = mergeAlternative(flattened, target, own)
          }
        }
      }
    }

    return flattened
  }

/**
 * Tuples cannot cross a jsii API (JSII1999); `ignoreMinAndMaxItems` covers
 * the ones spelled with `minItems` and `maxItems`. What follows the listed
 * items is one more alternative, or anything when it is `true`.
 */
const untuple: Visit = (node) => {
  if (!Array.isArray(node.items)) {
    return node
  }

  const { items, additionalItems, ...rest } = node
  const alternatives = isObject(additionalItems)
    ? [...items, additionalItems]
    : items

  return {
    ...rest,
    items:
      additionalItems === true || alternatives.length === 0
        ? {}
        : { anyOf: alternatives },
  }
}

const isMap = (node: unknown): node is Node =>
  isObject(node) &&
  !hasMembers(node) &&
  (node.type === 'object' ||
    (node.type === undefined &&
      (node.additionalProperties !== undefined ||
        isObject(node.patternProperties)))) &&
  (node.additionalProperties !== false || isObject(node.patternProperties))

/**
 * A named interface cannot be a map (JSII1999), but a map type can stand in
 * a member's type. Restate every member-less object as one, without the name
 * that would hoist it back into an interface, except a reference, whose
 * definition already gives the values.
 */
const mapify: Visit = (node) => {
  if (!isMap(node) || typeof node.$ref === 'string') {
    return node
  }

  const patterns = isObject(node.patternProperties)
    ? Object.values(node.patternProperties)
    : []

  const values = isObject(node.additionalProperties)
    ? [node.additionalProperties, ...patterns]
    : patterns

  const {
    $id: _id,
    title: _title,
    required: _required,
    patternProperties: _patterns,
    ...rest
  } = node

  return {
    ...rest,
    type: 'object',
    additionalProperties:
      values.length === 0 || node.additionalProperties === true
        ? true
        : values.length === 1
          ? values[0]
          : { anyOf: values },
  }
}

/**
 * A map that reaches itself keeps its `$ref` where it does, so that it stays
 * a named interface rather than expanding without end.
 */
const inlineMaps = (document: Node): Node => {
  const walk = (
    node: unknown,
    expanding: string[],
    inSchema: boolean,
  ): unknown => {
    if (Array.isArray(node)) {
      return node.map((item) => walk(item, expanding, inSchema))
    }

    if (!isObject(node)) {
      return node
    }

    if (!inSchema) {
      return Object.fromEntries(
        Object.entries(node).map(([name, value]) => [
          name,
          walk(value, expanding, true),
        ]),
      )
    }

    const target =
      typeof node.$ref === 'string'
        ? resolvePointer(document, node.$ref)
        : undefined

    if (
      typeof node.$ref === 'string' &&
      isMap(target) &&
      target !== document &&
      !expanding.includes(node.$ref)
    ) {
      const { $ref, title: _, ...siblings } = node

      return {
        ...(walk(structuredClone(target), [...expanding, $ref], true) as Node),
        ...siblings,
      }
    }

    const walked: Node = {}

    for (const [key, value] of Object.entries(node)) {
      if (literalKeys.has(key)) {
        walked[key] = value
      } else if (key === 'definitions' && isObject(value)) {
        walked[key] = Object.fromEntries(
          Object.entries(value).map(([name, definition]) => [
            name,
            walk(
              definition,
              [...expanding, `#/definitions/${escapeToken(name)}`],
              true,
            ),
          ]),
        )
      } else {
        walked[key] = walk(value, expanding, !namedSchemaKeys.has(key))
      }
    }

    return walked
  }

  return walk(document, [], true) as Node
}

/**
 * jsii rejects a type name `Case.pascal` would change (JSII8000), which is one
 * spelled in capitals alone, such as `SDK`.
 */
const isShouting = (name: string) =>
  /^[A-Z0-9]+$/.test(name) && /[A-Z].*[A-Z]/.test(name)

const isClosed = (node: Node) =>
  node.type === 'object' && node.additionalProperties === false

const pascal = (text: string) =>
  text
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('')

/**
 * jsii only accepts a struct for an object (JSII1003), so every object that
 * would otherwise be written inline gets a title, which names it and hoists it.
 */
const nameInlineObjects = (document: Node): Node => {
  const taken = new Set<string>()

  const collect = (node: unknown, inSchema: boolean) => {
    if (Array.isArray(node)) {
      node.forEach((item) => collect(item, inSchema))
    } else if (isObject(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (!inSchema) {
          collect(value, true)
        } else if (!literalKeys.has(key)) {
          if (key === 'title' && typeof value === 'string') {
            taken.add(pascal(value))
          }

          if (key === 'definitions' && isObject(value)) {
            Object.keys(value).forEach((name) => taken.add(pascal(name)))
          }

          collect(value, !namedSchemaKeys.has(key))
        }
      }
    }
  }

  collect(document, true)

  const unique = (name: string) => {
    let candidate = name

    for (let suffix = 2; taken.has(candidate); suffix++) {
      candidate = `${name}${suffix}`
    }

    taken.add(candidate)

    return candidate
  }

  const name = (node: Node, fallback: string) =>
    typeof node.title === 'string' ? pascal(node.title) : fallback

  const visit = (node: Node, fallback: string, hoisted: boolean): void => {
    const own =
      hoisted || typeof node.title === 'string'
        ? name(node, fallback)
        : undefined

    if (own !== undefined && isShouting(own)) {
      node.title = unique(own[0] + own.slice(1).toLowerCase())
    }

    if (
      !hoisted &&
      (hasMembers(node) || isClosed(node)) &&
      typeof node.title !== 'string' &&
      typeof node.$ref !== 'string'
    ) {
      node.title = unique(fallback)
    }

    const self = name(node, fallback)
    const child = (value: unknown, suffix: string, isHoisted = false) => {
      if (isObject(value)) {
        visit(value, `${self}${suffix}`, isHoisted)
      }
    }

    if (isObject(node.properties)) {
      for (const [key, value] of Object.entries(node.properties)) {
        child(value, pascal(key))
      }
    }

    if (isObject(node.definitions)) {
      for (const [key, value] of Object.entries(node.definitions)) {
        if (isObject(value)) {
          visit(value, pascal(key), true)
        }
      }
    }

    if (Array.isArray(node.items)) {
      node.items.forEach((item) => child(item, 'Item'))
    } else {
      child(node.items, 'Item')
    }

    child(node.additionalProperties, 'Value')

    for (const keyword of ['anyOf', 'oneOf'] as const) {
      if (Array.isArray(node[keyword])) {
        node[keyword].forEach((member: unknown, index: number) =>
          child(member, `Option${index + 1}`),
        )
      }
    }
  }

  visit(document, 'Root', true)

  return document
}

/**
 * Reshapes a schema so the typings `json-schema-to-typescript` writes for it
 * stay within what jsii accepts: no `null`, no intersections, no named maps
 * and no inline objects.
 */
export const jsiiSchema = (schema: JSONSchema): JSONSchema => {
  if (!isObject(schema)) {
    return schema
  }

  let document = structuredClone(schema) as Node

  document = mapSchema(document, stripNull) as Node
  document = mapSchema(document, unnull) as Node
  document = mapSchema(document, flatten(document)) as Node
  document = mapSchema(document, untuple) as Node
  document = mapSchema(document, mapify) as Node
  document = inlineMaps(document)

  return nameInlineObjects(document) as JSONSchema
}

const prohibited = new Set(['build', 'equals', 'hashcode'])

/**
 * jsii rejects any member whose name `Case.camel` would change (JSII8002), and
 * a few that clash with generated code (JSII5016). They stay in the typings, as
 * the wire format spells them, but outside the assembly.
 */
const isJsiiName = (name: string) =>
  /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/.test(name) &&
  !prohibited.has(name.toLowerCase())

const bareDeprecation = /^( *\* @deprecated)$/gm

const property = /^ {2}(?:readonly )?("[^"]+"|'[^']+'|[A-Za-z_$][\w$]*)(\?)?:/
const indexSignature = /^ {2}(?:readonly )?\[[^\]]+\]:/

const ignore = (lines: string[]) => {
  const last = lines.length - 1

  if (lines[last]?.trim() === '*/') {
    lines.splice(last, 0, '   * @jsii ignore')
  } else {
    lines.push('  /** @jsii ignore */')
  }
}

/**
 * jsii requires a struct's members to be `readonly` (JSII3008). Only the
 * members of exported interfaces are rewritten: after `jsiiSchema` there is no
 * object type left that is written inline.
 */
export const jsiiTypings = (source: string): string => {
  const output: string[] = []
  let inInterface = false

  for (const line of source
    .replaceAll(bareDeprecation, '$1 Deprecated by the schema.')
    .split('\n')) {
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

    if (indexSignature.test(line)) {
      ignore(output)
      output.push(line)
      continue
    }

    const match = property.exec(line)

    if (!match) {
      output.push(line)
      continue
    }

    if (!isJsiiName(match[1].replace(/^["']|["']$/g, ''))) {
      ignore(output)
    }

    output.push(line.replace(/^ {2}(?:readonly )?/, '  readonly '))
  }

  return output.join('\n')
}
