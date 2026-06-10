/* eslint-disable */
/**
 * Patch RemoteClient-JS for loose-files mode (no GRF):
 *   - Index data/, BGM/, System/
 *   - Resolve UTF-8 Korean URLs to CP949 mojibake folder names on disk
 *
 * Usage:
 *   node applications/remoteclient-loose/install.mjs ~/roBrowserLegacy-RemoteClient-JS
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetRoot = process.argv[2];

if (!targetRoot) {
	console.error('Usage: node applications/remoteclient-loose/install.mjs <RemoteClient-JS-path>');
	console.error('Example: node applications/remoteclient-loose/install.mjs ~/roBrowserLegacy-RemoteClient-JS');
	process.exit(1);
}

const clientControllerPath = path.join(targetRoot, 'src/controllers/clientController.js');
const utilsDir = path.join(targetRoot, 'src/utils');

if (!fs.existsSync(clientControllerPath)) {
	console.error('clientController.js not found:', clientControllerPath);
	process.exit(1);
}

fs.mkdirSync(utilsDir, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'looseFileIndex.js'), path.join(utilsDir, 'looseFileIndex.js'));
fs.copyFileSync(path.join(__dirname, 'pathEncoding.js'), path.join(utilsDir, 'pathEncoding.js'));
console.log('Copied looseFileIndex.js, pathEncoding.js');

let src = fs.readFileSync(clientControllerPath, 'utf8');
let changed = false;

if (!src.includes("require('../utils/looseFileIndex')")) {
	src = src.replace(
		"const iconv = require('iconv-lite');",
		"const iconv = require('iconv-lite');\nconst { buildLooseFileList } = require('../utils/looseFileIndex');\nconst { resolveLoosePathVariants } = require('../utils/pathEncoding');"
	);
	changed = true;
} else if (!src.includes("require('../utils/pathEncoding')")) {
	src = src.replace(
		"const { buildLooseFileList } = require('../utils/looseFileIndex');",
		"const { buildLooseFileList } = require('../utils/looseFileIndex');\nconst { resolveLoosePathVariants } = require('../utils/pathEncoding');"
	);
	changed = true;
}

if (!src.includes('looseFiles:')) {
	src = src.replace('  missingFiles: [],', '  missingFiles: [],\n  looseFiles: [],');
	changed = true;
}

if (src.includes("logger.warn('No GRF files configured in DATA.INI. Add GRF files to [data] section.');")) {
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
	changed = true;
}

if (!src.includes('buildLooseFileIndex()')) {
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
	changed = true;
}

if (!src.includes('if (this.looseFiles && this.looseFiles.length) {\n      return this.looseFiles.slice();')) {
	src = src.replace(
		'  listFiles() {\n    // Use index if available for faster response',
		`  listFiles() {
    if (this.looseFiles && this.looseFiles.length) {
      return this.looseFiles.slice();
    }

    // Use index if available for faster response`
	);
	changed = true;
}

if (!src.includes('if (this.looseFiles && this.looseFiles.length) {\n      const matchingFiles = new Set();')) {
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
	changed = true;
}

const oldLocalLookup = `    let grfFilePath = filePath.replace(/\\//g, '\\\\');
    let localPath = path.join(__dirname, '..', '..', filePath);

    // Check local file system first
    if (fs.existsSync(localPath)) {
      try {
        const content = fs.readFileSync(localPath);
        fileCache.set(cacheKey, content);
        return content;
      } catch (e) {
        logger.error(\`Error reading local file: \${e.message}\`);
      }
    }`;

const newLocalLookup = `    let grfFilePath = filePath.replace(/\\//g, '\\\\');

    // Check local file system (UTF-8 Korean URL vs CP949 mojibake on disk)
    for (const tryPath of resolveLoosePathVariants(filePath)) {
      const localPath = path.join(__dirname, '..', '..', tryPath);
      if (fs.existsSync(localPath)) {
        try {
          const content = fs.readFileSync(localPath);
          fileCache.set(cacheKey, content);
          return content;
        } catch (e) {
          logger.error(\`Error reading local file: \${e.message}\`);
        }
      }
    }`;

if (src.includes(oldLocalLookup)) {
	src = src.replace(oldLocalLookup, newLocalLookup);
	changed = true;
	console.log('Patched getFile() loose path encoding');
} else if (!src.includes('resolveLoosePathVariants(filePath)')) {
	console.warn('Warning: could not patch getFile() — check clientController.js manually');
}

if (changed) {
	fs.writeFileSync(clientControllerPath, src, 'utf8');
	console.log('Patched clientController.js — restart RemoteClient-JS');
} else {
	console.log('Already fully patched.');
}
