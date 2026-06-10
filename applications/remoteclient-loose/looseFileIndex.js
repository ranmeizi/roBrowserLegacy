/**
 * Loose-files index for RemoteClient-JS (no GRF).
 * Copy to RemoteClient-JS/src/utils/looseFileIndex.js
 * or run: node applications/remoteclient-loose/install.mjs /path/to/RemoteClient-JS
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_ROOTS = ['data', 'BGM', 'System'];

function walkDir(absDir, relPrefix, out) {
	if (!fs.existsSync(absDir)) {
		return;
	}

	for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
		if (entry.name.startsWith('.')) {
			continue;
		}

		const absPath = path.join(absDir, entry.name);
		const relPath = relPrefix + entry.name;

		if (entry.isDirectory()) {
			walkDir(absPath, `${relPath}\\`, out);
		} else if (entry.isFile()) {
			out.push(relPath);
		}
	}
}

function buildLooseFileList(projectRoot, roots = DEFAULT_ROOTS) {
	const files = [];

	for (const root of roots) {
		walkDir(path.join(projectRoot, root), `${root}\\`, files);
	}

	return files;
}

module.exports = { buildLooseFileList, DEFAULT_ROOTS };
