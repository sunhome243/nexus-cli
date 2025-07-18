#!/usr/bin/env node

/**
 * Build script to copy MCP server files to dist directory
 * This ensures MCP servers are available in the published NPM package
 */

const fs = require('fs');
const path = require('path');

const MCP_SERVERS = [
  'mcp-permission-server.cjs',
  'mcp-crossprovider-server.cjs'
];

const SOURCE_DIR = path.join(__dirname, '../src/services/providers/claude');
const DEST_DIR = path.join(__dirname, '../dist/services/providers/claude');

// Ensure destination directory exists
if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  console.log(`Created directory: ${DEST_DIR}`);
}

// Copy each MCP server file
for (const serverFile of MCP_SERVERS) {
  const sourcePath = path.join(SOURCE_DIR, serverFile);
  const destPath = path.join(DEST_DIR, serverFile);
  
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      // Ensure executable permissions
      fs.chmodSync(destPath, 0o755);
      console.log(`✓ Copied ${serverFile} to dist`);
    } else {
      console.warn(`⚠ Source file not found: ${sourcePath}`);
    }
  } catch (error) {
    console.error(`✗ Failed to copy ${serverFile}:`, error.message);
  }
}

console.log('\nMCP server files copy completed!');