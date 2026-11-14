exports.assign = function assign(target, source) {
  return Object.keys(source).reduce(function (acc, key) {
    acc[key] = source[key]
    return acc
  }, target)
}
