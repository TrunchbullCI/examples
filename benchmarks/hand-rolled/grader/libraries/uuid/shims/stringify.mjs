import { subject } from "../../../harness/subject.mjs"

export default subject.stringify

export function unsafeStringify() {
  throw new Error("unsafeStringify is private to uuid and not part of the graded API")
}
