module.exports = {
  projects: [
    {
      // Node environment test configuration
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/index.test.js'],
    },
    {
      // Browser environment test configuration
      displayName: 'browser',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/test/**/browser.test.js'],
    }
  ]
};