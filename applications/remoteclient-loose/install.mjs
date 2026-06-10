/* eslint-disable */
/**
 * Patch RemoteClient-JS for loose-files mode (no GRF):
 *   - On-demand /search (no full data/ index)
 *   - UTF-8 Korean URL → CP949 mojibake path lookup for getFile
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

function markChanged() {
	changed = true;
}

// --- requires ---
if (!src.includes("require('../utils/looseFileIndex')")) {
	src = src.replace(
		"const iconv = require('iconv-lite');",
		"const iconv = require('iconv-lite');\nconst { searchLooseFiles } = require('../utils/looseFileIndex');\nconst { resolveLoosePathVariants } = require('../utils/pathEncoding');"
	);
	markChanged();
} else {
	src = src
		.replace(
			/const \{ buildLooseFileList(?:Async)? \} = require\('\.\.\/utils\/looseFileIndex'\);\n?/g,
			"const { searchLooseFiles } = require('../utils/looseFileIndex');\n"
		)
		.replace(
			"const { searchLooseFiles } = require('../utils/looseFileIndex');\nconst { searchLooseFiles }",
			"const { searchLooseFiles }"
		);
	if (!src.includes("require('../utils/pathEncoding')")) {
		src = src.replace(
			"const { searchLooseFiles } = require('../utils/looseFileIndex');",
			"const { searchLooseFiles } = require('../utils/looseFileIndex');\nconst { resolveLoosePathVariants } = require('../utils/pathEncoding');"
		);
	}
	markChanged();
}

// --- remove broken full-index helpers ---
src = src.replace(/\n  buildLooseFileIndex\(\) \{[\s\S]*?\n  \},\n/g, '\n');
src = src.replace(/\n  looseFiles: \[\],\n  looseIndexing: false,\n/g, '\n');
src = src.replace(/\n  looseFiles: \[\],\n/g, '\n');

if (!src.includes('looseMode:')) {
	src = src.replace('  missingFiles: [],', '  missingFiles: [],\n  looseMode: false,');
	markChanged();
}

// --- init: no GRF → loose mode, no indexing ---
const initOld =
	/if \(!dataIni\.data \|\| dataIni\.data\.length === 0\) \{[\s\S]*?return;\s*\}/;
const initNew = `if (!dataIni.data || dataIni.data.length === 0) {
      logger.warn('No GRF in DATA.INI — loose files mode (on-demand search, no full index)');
      this.grfs = [];
      this.looseMode = true;
      return;
    }`;

if (initOld.test(src) && !src.includes('on-demand search, no full index')) {
	src = src.replace(initOld, initNew);
	markChanged();
}

// --- search: on-demand walk, remove looseFiles array scan ---
src = src.replace(
	/  search\(regex\) \{\n    if \(this\.looseFiles[\s\S]*?return Array\.from\(matchingFiles\);\n    \}\n\n/g,
	'  search(regex) {\n'
);

if (!src.includes('if (this.looseMode)')) {
	src = src.replace(
		'  search(regex) {\n    if (!configs.CLIENT_ENABLESEARCH) {',
		`  search(regex) {
    if (this.looseMode) {
      const projectRoot = path.join(__dirname, '..', '..');
      return searchLooseFiles(projectRoot, regex);
    }

    if (!configs.CLIENT_ENABLESEARCH) {`
	);
	markChanged();
}

// --- listFiles: loose mode returns [] (never dump all of data/) ---
if (!src.includes('if (this.looseMode) {\n      return [];')) {
	src = src.replace(
		'  listFiles() {\n    // Use index if available for faster response',
		`  listFiles() {
    if (this.looseMode) {
      return [];
    }

    // Use index if available for faster response`
	);
	markChanged();
}

// --- getFile: Korean path encoding ---
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
	markChanged();
	console.log('Patched getFile() loose path encoding');
}

if (changed) {
	fs.writeFileSync(clientControllerPath, src, 'utf8');
	console.log('Patched clientController.js — restart RemoteClient-JS');
} else {
	console.log('Already fully patched.');
}
