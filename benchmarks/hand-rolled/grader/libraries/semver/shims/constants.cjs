// Upstream fixtures and tests read these limits from the private
// internal/constants module. They are data, not behaviour under test, so the
// shim supplies semver's published values rather than loading the subject.
module.exports = {
  SEMVER_SPEC_VERSION: "2.0.0",
  MAX_LENGTH: 256,
  MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
  MAX_SAFE_COMPONENT_LENGTH: 16,
  MAX_SAFE_BUILD_LENGTH: 256 - 6,
  RELEASE_TYPES: ["major", "premajor", "minor", "preminor", "patch", "prepatch", "prerelease"],
}
