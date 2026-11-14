// uvu's runner reports only per-file totals, so the vendored tests register
// their uvu tests with node:test instead, which reports each one as a TAP
// point. Assertions keep using the real uvu/assert.
import { test as nodeTest } from "node:test"

export function suite(name) {
  const register = (title, handler) => {
    nodeTest(name ? `${name} › ${title}` : title, () => handler({}))
  }
  register.only = register
  register.skip = (title) => nodeTest(name ? `${name} › ${title}` : title, { skip: true }, () => {})
  register.before = register.after = () => {}
  register.before.each = register.after.each = () => {}
  register.run = () => {}
  return register
}

export const test = suite()
