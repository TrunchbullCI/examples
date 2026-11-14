// The integration tests load the package root and destructure the documented
// exports from it.
module.exports = { ...require("../../../harness/subject.cjs")() }
