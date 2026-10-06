import { describe, expect, it } from 'vitest'
import { ADJECTIVES, ANIMALS, NAME_MAX, normalizeName, randomName } from './names'

describe('randomName', () => {
  it('builds "Adjective Animal" from the bundled lists', () => {
    for (let i = 0; i < 50; i++) {
      const [adj, animal, extra] = randomName().split(' ')
      expect(extra).toBeUndefined()
      expect(ADJECTIVES).toContain(adj)
      expect(ANIMALS).toContain(animal)
    }
  })

  it('is deterministic for a given rng', () => {
    expect(randomName(() => 0)).toBe('Brave Otter')
    expect(randomName(() => 0.999999)).toBe(`${ADJECTIVES[ADJECTIVES.length - 1]} ${ANIMALS[ANIMALS.length - 1]}`)
  })

  it('never exceeds the name limit', () => {
    const longest = Math.max(...ADJECTIVES.map((a) => a.length)) + 1 + Math.max(...ANIMALS.map((a) => a.length))
    expect(longest).toBeLessThanOrEqual(NAME_MAX)
  })
})

describe('normalizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeName('  Quiet   Heron \n')).toBe('Quiet Heron')
  })
  it('strips control characters', () => {
    expect(normalizeName('Qu\u0007iet\u001f Heron')).toBe('Quiet Heron')
  })
  it('clamps to NAME_MAX', () => {
    expect(normalizeName('a'.repeat(100))).toHaveLength(NAME_MAX)
  })
  it('returns empty for unusable input', () => {
    expect(normalizeName('   ')).toBe('')
    expect(normalizeName('\u0000')).toBe('')
  })
})
