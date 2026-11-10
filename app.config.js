// Extends app.json. EXPO_BASE_URL is set only when publishing the web test site
// to GitHub Pages (served from /Homemeals); phones and the preview are unaffected.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) },
});
