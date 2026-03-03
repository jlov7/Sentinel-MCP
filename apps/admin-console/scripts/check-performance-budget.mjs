import fs from "node:fs";
import path from "node:path";

const chunksDir = path.resolve(".next/static/chunks");

if (!fs.existsSync(chunksDir)) {
  console.error("Performance budget check failed: build artifacts not found. Run `npm run build` first.");
  process.exit(1);
}

const files = fs
  .readdirSync(chunksDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => {
    const filePath = path.join(chunksDir, name);
    const stats = fs.statSync(filePath);
    return {
      name,
      bytes: stats.size,
    };
  })
  .sort((a, b) => b.bytes - a.bytes);

const totalBytes = files.reduce((sum, entry) => sum + entry.bytes, 0);
const largestChunk = files[0]?.bytes ?? 0;

const budgets = {
  totalBytes: 550_000,
  largestChunkBytes: 250_000,
};

console.log("Performance budget report");
console.log(`- Total JS chunk bytes: ${totalBytes}`);
console.log(`- Largest JS chunk bytes: ${largestChunk}`);
console.log("- Largest chunks:");
for (const entry of files.slice(0, 8)) {
  console.log(`  - ${entry.name}: ${entry.bytes}`);
}

const violations = [];
if (totalBytes > budgets.totalBytes) {
  violations.push(`total JS chunk bytes ${totalBytes} exceeds ${budgets.totalBytes}`);
}
if (largestChunk > budgets.largestChunkBytes) {
  violations.push(`largest chunk ${largestChunk} exceeds ${budgets.largestChunkBytes}`);
}

if (violations.length > 0) {
  console.error("Performance budget failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Performance budget passed.");
