// Preloaded into the upstream test process. test.js names three test points
// after Math.random(), +new Date() and new Date(), so pin both to make the
// recorded names deterministic. Explicit Date arguments and Date.now() keep
// their normal behaviour.
const FIXED_TIME = 1700000000000
const RealDate = Date
Math.random = () => 0.5
global.Date = class Date extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FIXED_TIME)
    else super(...args)
  }
}
