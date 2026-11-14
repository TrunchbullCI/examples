// The upstream tests load the library from lib/main. Give them a plain object
// with the four documented functions of the module under test, so sinon can
// stub its properties as it does on the real CommonJS export. A function the
// module does not export throws when called.
const subject = require("../../../harness/subject.cjs")()

const api = {}
for (const name of ["config", "configDotenv", "parse", "populate"]) {
  api[name] =
    typeof subject[name] === "function"
      ? subject[name]
      : () => {
          throw new Error(`${name} is not exported by the module`)
        }
}
module.exports = api
