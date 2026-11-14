import { subject } from "../../../harness/subject.mjs"

export default subject.v1

export function updateV1State() {
  throw new Error("updateV1State is private to uuid and not part of the graded API")
}
