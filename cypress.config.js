const { defineConfig } = require("cypress");

module.exports = defineConfig({
  defaultCommandTimeout: 10000,
  requestTimeout: 30000,
  screenshotOnRunFailure: true,
  video: true,
  videoUploadOnPasses: false,
  viewportHeight: 980,
  viewportWidth: 1920,
  chromeWebSecurity: false,
  pageLoadTimeout: 60000,
  trashAssetsBeforeRuns: true,
  e2e: {
    setupNodeEvents(on, config) {
      return require('./cypress/plugins/index.js')(on, config)
    },
    setupNodeEvents(on, config) {
      on('before:browser:launch', (browser = {}, launchOptions) => {
        /* ... */
      })
    },
    baseUrl: 'http://localhost:5002/',
  },
});

