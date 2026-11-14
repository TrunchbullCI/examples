// Preloaded (--require) into every upstream tape file. Plain tape lets an
// exception thrown synchronously inside a test callback escape and end the
// whole process, so one throwing call in a submission would forfeit every
// later test in the file. This wraps each test callback so a throw is
// reported as a failed assertion and the test ends; tests that pass are
// unaffected, so the recorded expectations are the same as with plain tape.
var Test = require("tape/lib/test")

var run = Test.prototype.run
Test.prototype.run = function isolatedRun() {
  var callback = this._cb
  if (typeof callback === "function") {
    this._cb = function isolatedCallback(t) {
      try {
        return callback.apply(this, arguments)
      } catch (error) {
        t.fail("the test threw: " + (error && error.message ? error.message : String(error)))
        if (!t.calledEnd) t.end()
        return undefined
      }
    }
  }
  return run.call(this)
}
