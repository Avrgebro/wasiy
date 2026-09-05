import { readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import surfaces from '../../surfaces.json'

/**
 * The portal import boundary in eslint.config.js lists staff features by
 * name (surfaces.json). A new feature folder must be classified there as
 * staff or as shared/portal, or this test fails.
 */

describe('surface boundary', () => {
  it('classifies every feature folder as staff or shared', () => {
    const folders = readdirSync(dirname(fileURLToPath(import.meta.url)), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    expect(folders).toEqual([...surfaces.staffFeatures, ...surfaces.sharedOrPortalFeatures].sort())
  })
})
