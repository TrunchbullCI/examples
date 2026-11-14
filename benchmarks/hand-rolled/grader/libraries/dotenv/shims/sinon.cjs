// Upstream tests stub Node built-ins (fs.readFileSync, os.homedir) on their
// CommonJS objects. The module under test is ESM, whose named imports of
// built-ins only see such stubs after module.syncBuiltinESMExports(). This
// wrapper runs it whenever a stub is installed or restored, so the stubs reach
// the module whether it imports `fs`, `* as fs` or `{ readFileSync }`.
const { join } = require("node:path")
const { syncBuiltinESMExports } = require("node:module")
const sinon = require(join(__dirname, "..", "node_modules", "sinon"))

const stub = sinon.stub
sinon.stub = function (...args) {
  const created = stub.apply(this, args)
  if (typeof created.restore === "function") {
    const restore = created.restore
    created.restore = function (...rest) {
      const result = restore.apply(this, rest)
      syncBuiltinESMExports()
      return result
    }
  }
  syncBuiltinESMExports()
  return created
}

module.exports = sinon
