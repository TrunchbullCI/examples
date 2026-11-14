// Shims call this to load the module under test (a compiled submission or
// the reference wrapper), named by HR_SUBJECT.
module.exports = function subject() {
  const path = process.env.HR_SUBJECT
  if (!path) throw new Error("HR_SUBJECT is not set.")
  return require(path)
}
