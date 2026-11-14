// The string helpers upstream tests import from the private build module are
// the parser's public camelCase, decamelize and looksLikeNumber properties.
import { subject } from "../../../harness/subject.mjs"

const parser = subject.default
export const camelCase = (...args) => parser.camelCase(...args)
export const decamelize = (...args) => parser.decamelize(...args)
export const looksLikeNumber = (...args) => parser.looksLikeNumber(...args)
