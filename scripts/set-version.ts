import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Sets one version on the root and every package, so all packages release together. */
const version = process.argv[2]?.replace(/^v/, '');

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`"${process.argv[2] ?? ''}" is not a semantic version`);
  process.exit(1);
}

const files = ['package.json', ...readdirSync('packages').map((dir) => join('packages', dir, 'package.json'))];

for (const file of files) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));

  pkg.version = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}

console.log(`Set ${files.length} package.json files to ${version}`);
