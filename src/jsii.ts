import type { JSONSchema } from 'json-schema-to-typescript'

import {
  type Node,
  isObject,
  literalKeys,
  namedSchemaKeys,
} from './normalize.js'

const hasMembers = (node: unknown): node is Node & { properties: Node } =>
  isObject(node) &&
  isObject(node.properties) &&
  Object.keys(node.properties).length > 0

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
    if (
      !hoisted &&
      hasMembers(node) &&
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
 * stay within what jsii accepts: no inline objects.
 */
export const jsiiSchema = (schema: JSONSchema): JSONSchema => {
  if (!isObject(schema)) {
    return schema
  }

  const document = structuredClone(schema) as Node

  return nameInlineObjects(document) as JSONSchema
}

const property = /^ {2}(?:readonly )?("[^"]+"|'[^']+'|[A-Za-z_$][\w$]*)(\?)?:/

/**
 * jsii requires a struct's members to be `readonly` (JSII3008). Only the
 * members of exported interfaces are rewritten: after `jsiiSchema` there is no
 * object type left that is written inline.
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
