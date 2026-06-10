/* eslint-disable */
/**
 * Patch RemoteClient-JS to index loose files (data/, BGM/, System/) when no GRF is configured.
 *
 * Usage:
 *   node applications/remoteclient-loose/install.mjs /path/to/roBrowserLegacy-RemoteClient-JS
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetRoot = process.argv[2];

if (!targetRoot) {
	console.error('Usage: node applications/remoteclient-loose/install.mjs <RemoteClient-JS-path>');
	process.exit(1);
}

const clientControllerPath = path.join(targetRoot, 'src/controllers/clientController.js');
const utilsDir = path.join(targetRoot, 'src/utils');
const looseIndexDest = path.join(utilsDir, 'looseFileIndex.js');
const looseIndexSrc = path.join(__dirname, 'looseFileIndex.js');

if (!fs.existsSync(clientControllerPath)) {
	console.error('clientController.js not found:', clientControllerPath);
	process.exit(1);
}

fs.mkdirSync(utilsDir, { recursive: true });
fs.copyFileSync(looseIndexSrc, looseIndexDest);
console.log('Copied looseFileIndex.js');

let src = fs.readFileSync(clientControllerPath, 'utf8');

if (src.includes('buildLooseFileList')) {
	console.log('clientController.js already patched, skipping.');
	process.exit(0);
}

src = src.replace(
	"const iconv = require('iconv-lite');",
	"const iconv = require('iconv-lite');\nconst { buildLooseFileList } = require('../utils/looseFileIndex');"
);

src = src.replace(
	'  missingFiles: [],',
	'  missingFiles: [],\n  looseFiles: [],'
);

src = src.replace(
	`    if (!dataIni.data || dataIni.data.length === 0) {
      logger.warn('No GRF files configured in DATA.INI. Add GRF files to [data] section.');
      this.grfs = [];
      return;
    }`,
	`    if (!dataIni.data || dataIni.data.length === 0) {
      logger.warn('No GRF in DATA.INI — indexing loose files from data/, BGM/, System/');
      this.grfs = [];
      this.buildLooseFileIndex();
      return;
    }`
);

src = src.replace(
	'  getIndexStats() {',
	`  buildLooseFileIndex() {
    const projectRoot = path.join(__dirname, '..', '..');
    const startTime = Date.now();
    this.looseFiles = buildLooseFileList(projectRoot);
    indexBuilt = true;
    logger.info(\`Loose files indexed in \${Date.now() - startTime}ms (\${this.looseFiles.length.toLocaleString()} files)\`);
  },

  getIndexStats() {`
);

src = src.replace(
	'  listFiles() {\n    // Use index if available for faster response',
	`  listFiles() {
    if (this.looseFiles && this.looseFiles.length) {
      return this.looseFiles.slice();
    }

    // Use index if available for faster response`
);

src = src.replace(
	'  search(regex) {\n    if (!configs.CLIENT_ENABLESEARCH) {',
	`  search(regex) {
    if (this.looseFiles && this.looseFiles.length) {
      const matchingFiles = new Set();
      for (const file of this.looseFiles) {
        if (regex.test(file)) {
          matchingFiles.add(file);
        }
      }
      return Array.from(matchingFiles);
    }

    if (!configs.CLIENT_ENABLESEARCH) {`
);

fs.writeFileSync(clientControllerPath, src, 'utf8');
console.log('Patched clientController.js — restart RemoteClient-JS');
