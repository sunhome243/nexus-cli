import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary package
console.log("Creating temporary package to measure size...");
try {
  execSync("npm pack --quiet", { stdio: ["ignore", "ignore", "pipe"] });
} catch (error) {
  console.error("Error creating package:", error.message);
  process.exit(1);
}

// Get the package filename
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageName = packageJson.name.replace("@", "").replace("/", "-");
const packageFilename = `${packageName}-${packageJson.version}.tgz`;

// Check if the package file exists
if (!fs.existsSync(packageFilename)) {
  console.error(`Package file ${packageFilename} not found!`);
  process.exit(1);
}

// Get the size
const stats = fs.statSync(packageFilename);
const fileSizeInBytes = stats.size;
const fileSizeInKilobytes = fileSizeInBytes / 1024;
const fileSizeInMegabytes = fileSizeInKilobytes / 1024;

console.log(`Package size: ${fileSizeInKilobytes.toFixed(2)} KB (${fileSizeInMegabytes.toFixed(2)} MB)`);

// Define size limit (adjust as needed)
const SIZE_LIMIT_MB = 10;

// Clean up
try {
  fs.unlinkSync(packageFilename);
  console.log(`Removed temporary package file: ${packageFilename}`);
} catch (error) {
  console.error(`Error removing temporary package file: ${error.message}`);
}

// Check if size exceeds limit
if (fileSizeInMegabytes > SIZE_LIMIT_MB) {
  console.error(
    `\x1b[31mERROR: Package size (${fileSizeInMegabytes.toFixed(2)} MB) exceeds limit of ${SIZE_LIMIT_MB} MB\x1b[0m`
  );
  console.error("Consider optimizing your package or adjusting the size limit if necessary.");
  process.exit(1);
} else {
  console.log(`\x1b[32mPackage size is within the limit of ${SIZE_LIMIT_MB} MB\x1b[0m`);
}

// Record the size for historical tracking
const sizeHistoryDir = path.join(__dirname, "../.package-size-history");
if (!fs.existsSync(sizeHistoryDir)) {
  fs.mkdirSync(sizeHistoryDir, { recursive: true });
}

const sizeHistoryPath = path.join(sizeHistoryDir, "size-history.json");
let sizeHistory = {};

if (fs.existsSync(sizeHistoryPath)) {
  try {
    sizeHistory = JSON.parse(fs.readFileSync(sizeHistoryPath, "utf8"));
  } catch (error) {
    console.warn(`Warning: Could not parse size history file: ${error.message}`);
  }
}

// Record new size
const timestamp = new Date().toISOString();
sizeHistory[packageJson.version] = {
  size: fileSizeInMegabytes,
  timestamp,
};

// Save updated history
try {
  fs.writeFileSync(sizeHistoryPath, JSON.stringify(sizeHistory, null, 2));
  console.log(`Recorded size ${fileSizeInMegabytes.toFixed(2)} MB for version ${packageJson.version}`);
} catch (error) {
  console.warn(`Warning: Could not save size history: ${error.message}`);
}
