#!/usr/bin/env node

/**
 * Simulates post-install behavior during development
 * This script mimics what would happen when the package is installed in production
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('\n🔧 Simulating post-install behavior for development...\n');

// Set environment variables to simulate npm install context
process.env.npm_lifecycle_event = 'postinstall';
process.env.npm_package_name = 'nexus-cli';
process.env.npm_package_version = require('../package.json').version;

// Simulate global installation
if (process.argv.includes('--global')) {
  process.env.npm_config_global = 'true';
  console.log('📦 Simulating GLOBAL installation\n');
} else {
  process.env.npm_config_global = 'false';
  console.log('📦 Simulating LOCAL installation\n');
}

// Run the built CLI as if it was just installed
try {
  console.log('Running built CLI with installation context...\n');
  console.log('=' .repeat(50));
  
  // Execute the CLI binary
  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js');
  execSync(`node ${cliPath} --version`, { stdio: 'inherit' });
  
  console.log('\n' + '=' .repeat(50));
  console.log('\n✅ Post-install simulation completed!');
  console.log('\nTo test different scenarios:');
  console.log('  npm run dev:postinstall           # Simulate local install');
  console.log('  npm run dev:postinstall -- --global  # Simulate global install\n');
  
} catch (error) {
  console.error('\n❌ Post-install simulation failed:', error.message);
  process.exit(1);
}