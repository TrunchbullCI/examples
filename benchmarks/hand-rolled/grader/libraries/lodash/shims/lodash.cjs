// test/test.js loads the build under test as `_` from "../lodash.js" (once
// normally and once more with bizarro built-ins). It evaluates every QUnit
// module's definitions while loading, and those use many lodash methods, so
// `_` is a fresh lodash context whose debounce, throttle and cloneDeep are
// replaced by the subject's exports (and removed when the subject lacks them).
// The selected tests call only these three methods on `_`.
const api = require("../../../harness/subject.cjs")()
const lodash = require("lodash").runInContext()
for (const name of ["debounce", "throttle", "cloneDeep"]) {
  if (typeof api[name] === "function") lodash[name] = api[name]
  else delete lodash[name]
}
module.exports = lodash
