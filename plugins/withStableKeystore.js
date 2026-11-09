// Keeps the same Android signing key for every build, so a new APK always
// installs over the old one and the family's data is never lost.
// (Android refuses an update signed with a different key; the only way
// around that is uninstalling, which deletes the app's data.)
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withStableKeystore(config) {
  return withDangerousMod(config, ['android', async (cfg) => {
    const src = path.join(cfg.modRequest.projectRoot, 'keystore', 'homemeal.keystore');
    const dest = path.join(cfg.modRequest.platformProjectRoot, 'app', 'debug.keystore');
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    return cfg;
  }]);
};
