// Preloaded (node --require) before the vendored test/test.js. It runs the
// upstream QUnit file the way `node test/test.js` does (qunitjs + qunit-extras,
// the stable lodash helper, the monolithic-build UI flags), but registers only
// the tests of one QUnit module (LODASH_QUNIT_MODULE) and reports them as TAP.
"use strict"
const { writeSync } = require("node:fs")

const selected = process.env.LODASH_QUNIT_MODULE
if (!selected) throw new Error("LODASH_QUNIT_MODULE is not set.")
const asyncRetries = Number(process.env.LODASH_QUNIT_ASYNC_RETRIES ?? 2)
const testTimeout = Number(process.env.LODASH_QUNIT_TEST_TIMEOUT_MS ?? 2000)

// TAP goes straight to fd 1; everything else written to stdout (qunit-extras'
// progress throbber and summaries, test.js logging) goes to stderr.
const out = (line) => writeSync(1, `${line}\n`)
process.stdout.write = process.stderr.write.bind(process.stderr)

const QUnit = require("qunitjs")
let count = 0
let group = null
let failures = []
const text = (value) => String(value).replace(/[\r\n]+/g, " ")
QUnit.log((details) => {
  if (!details.result) failures.push(details)
})
QUnit.testStart(() => {
  failures = []
})
QUnit.testDone((details) => {
  if (details.module !== group) {
    group = details.module
    out(`# ${text(group)}`)
  }
  count += 1
  out(`${details.failed ? "not ok" : "ok"} ${count} - ${text(details.name)}`)
  if (details.failed) {
    out("  ---")
    for (const failure of failures.slice(0, 5)) {
      out(`  message: ${JSON.stringify(text(failure.message ?? "failed")).slice(0, 300)}`)
      if ("expected" in failure) out(`  expected: ${JSON.stringify(QUnit.dump.parse(failure.expected)).slice(0, 300)}`)
      if ("actual" in failure) out(`  actual: ${JSON.stringify(QUnit.dump.parse(failure.actual)).slice(0, 300)}`)
    }
    out("  ...")
  }
})
QUnit.done(() => out(`1..${count}`))

// qunit-extras installs itself on the same qunitjs instance; test/test.js
// would load it the same way (`root.QUnit || require('qunit-extras')`).
require("qunit-extras")
out("TAP version 13")

// Register only the selected module's tests. test/test.js declares modules
// flat (`QUnit.module(name)` followed by `QUnit.test` calls).
let current = null
const registerModule = QUnit.module
const registerTest = QUnit.test
QUnit.module = function (name) {
  current = name
  if (name === selected) return registerModule.apply(this, arguments)
}
QUnit.test = function () {
  if (current === selected) return registerTest.apply(this, arguments)
}

// test/test.js sets asyncRetries to 10; real-timer tests that fail would then
// run eleven times and overrun the per-file timeout, so retries are capped.
Object.defineProperty(QUnit.config, "asyncRetries", {
  configurable: true,
  enumerable: true,
  get: () => asyncRetries,
  set: () => {},
})
QUnit.config.testTimeout = testTimeout

// An exception thrown from a timer callback fails the running test instead of
// killing the process; the test timeout then moves on.
process.on("uncaughtException", (error) => {
  if (QUnit.config.current) QUnit.pushFailure(`Uncaught ${error && error.name}: ${error && error.message}`, "")
  else throw error
})

global.QUnit = QUnit
// The stable lodash dev dependency test/test.js uses for helpers.
global.lodashStable = require("lodash")
// UI flags of `node test/test.js` testing the monolithic ../lodash.js build.
global.ui = { buildPath: "../lodash.js", loaderPath: "", isModularize: false, isStrict: false, urlParams: {} }
