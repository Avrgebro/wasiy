import { describe, expect, it } from 'vitest'
import en from './locales/en/common.json'
import es from './locales/es/common.json'

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix]
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  )
}

describe('locale key parity', () => {
  it('en and es declare exactly the same keys', () => {
    const enKeys = flattenKeys(en).sort()
    const esKeys = flattenKeys(es).sort()

    expect(enKeys).toEqual(esKeys)
  })
})
