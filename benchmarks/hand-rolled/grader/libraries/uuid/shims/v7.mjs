import { subject } from "../../../harness/subject.mjs"

export default subject.v7

export function updateV7State() {
  throw new Error("updateV7State is private to uuid and not part of the graded API")
}
