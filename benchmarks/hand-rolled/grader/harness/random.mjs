// A small deterministic generator for fuzz inputs. The same seed gives the
// same inputs in the reference and the submission processes.
export function createRandom(seedText) {
  let seed = 2166136261
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0
  const next = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const random = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    bool: (probability = 0.5) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
    float: (min, max) => min + next() * (max - min),
    string: (alphabet, minLength, maxLength) => {
      const length = random.int(minLength, maxLength)
      let value = ""
      for (let index = 0; index < length; index += 1) value += alphabet[Math.floor(next() * alphabet.length)]
      return value
    },
    array: (minLength, maxLength, item) =>
      Array.from({ length: random.int(minLength, maxLength) }, (_, index) => item(index)),
  }
  return random
}
