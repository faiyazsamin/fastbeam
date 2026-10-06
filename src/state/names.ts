// Friendly device names: "Brave Otter". Names describe devices, not people.

export const ADJECTIVES = [
  'Brave', 'Quiet', 'Sunny', 'Mellow', 'Calm', 'Swift', 'Gentle', 'Bright', 'Clever', 'Cozy',
  'Daring', 'Eager', 'Fancy', 'Happy', 'Jolly', 'Kind', 'Lively', 'Lucky', 'Merry', 'Nimble',
  'Noble', 'Peppy', 'Plucky', 'Proud', 'Quick', 'Rosy', 'Shy', 'Silly', 'Sleepy', 'Snug',
  'Spry', 'Steady', 'Sturdy', 'Tidy', 'Tiny', 'Warm', 'Wild', 'Witty', 'Zesty', 'Breezy',
  'Chirpy', 'Dapper', 'Humble', 'Jaunty', 'Keen', 'Loyal', 'Perky', 'Rusty',
] as const

export const ANIMALS = [
  'Otter', 'Heron', 'Finch', 'Yak', 'Lynx', 'Badger', 'Bison', 'Crane', 'Dolphin', 'Falcon',
  'Fox', 'Gecko', 'Hare', 'Ibis', 'Jay', 'Koala', 'Lemur', 'Marten', 'Newt', 'Orca',
  'Panda', 'Quail', 'Raven', 'Seal', 'Tapir', 'Vole', 'Walrus', 'Wren', 'Zebra', 'Alpaca',
  'Beaver', 'Camel', 'Donkey', 'Eagle', 'Ferret', 'Goose', 'Hedgehog', 'Iguana', 'Jackal', 'Kiwi',
  'Llama', 'Moose', 'Narwhal', 'Ocelot', 'Parrot', 'Puffin', 'Rabbit', 'Robin', 'Sparrow', 'Stoat',
  'Swan', 'Toucan', 'Turtle', 'Weasel', 'Wombat',
] as const

/** Maximum length of a device name after trimming. */
export const NAME_MAX = 24

function pick<T>(list: readonly T[], rng: () => number): T {
  const i = Math.min(list.length - 1, Math.floor(rng() * list.length))
  return list[i] as T
}

export function randomName(rng: () => number = Math.random): string {
  return `${pick(ADJECTIVES, rng)} ${pick(ANIMALS, rng)}`
}

/** Collapse whitespace, strip control characters and clamp length. Returns '' when nothing usable is left. */
export function normalizeName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim()
}
