// v35.test.ts builds its (excluded) md5/sha1 fixtures with the private
// stringToBytes helper at load time, so provide a UTF-8 encoder for them.
export function stringToBytes(text) {
  return new TextEncoder().encode(text)
}
