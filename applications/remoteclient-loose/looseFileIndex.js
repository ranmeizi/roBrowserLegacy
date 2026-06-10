/**
 * Loose-files mode (no GRF): on-demand search only — never full-index data/.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_RESULTS = 20000;
const searchCache = new Map();

function realpathSafe(absPath) {
	try {
		return fs.realpathSync(absPath);
	} catch {
		return null;
	}
}

/**
 * Guess file extension from regex source to skip unrelated files during walk.
 * e.g. "data\\([^\0]+\.rsw)" → ".rsw"
 *
 * @param {string} source
 * @return {string|null}
 */
function inferExtensionFilter(source) {
	const match = source.match(/\\\.([a-z0-9]+)(?:\$|\)|\|)/i);
	return match ? `.${match[1].toLowerCase()}` : null;
}

/**
 * Pick roots to walk based on regex (avoid scanning all of data/ for BGM-only queries).
 *
 * @param {string} source
 * @return {string[]}
 */
function inferSearchRoots(source) {
	if (/\.mp3|\.wav/i.test(source)) {
		return ['BGM'];
	}
	if (/\\system\\/i.test(source) || /\.(lub|lua|xml|txt)$/i.test(source)) {
		return ['System', 'data'];
	}
	return ['data'];
}

/**
 * Walk disk and return paths matching regex. Results are cached per regex source.
 * Uses extension pre-filter — does NOT enumerate every file into memory first.
 *
 * @param {string} projectRoot
 * @param {RegExp} regex
 * @param {{ maxResults?: number }} [options]
 * @return {string[]}
 */
function searchLooseFiles(projectRoot, regex, options = {}) {
	const cacheKey = `${regex.source}|${regex.flags}`;
	if (searchCache.has(cacheKey)) {
		return searchCache.get(cacheKey);
	}

	const maxResults = options.maxResults || DEFAULT_MAX_RESULTS;
	const extFilter = inferExtensionFilter(regex.source);
	const roots = inferSearchRoots(regex.source);
	const results = [];
	const visited = new Set();
	const stack = [];

	for (const root of roots) {
		stack.push({ abs: path.join(projectRoot, root), rel: `${root}\\` });
	}

	const matcher = new RegExp(regex.source, regex.flags.replace('g', '') || 'i');

	while (stack.length && results.length < maxResults) {
		const { abs, rel } = stack.pop();
		const realDir = realpathSafe(abs);

		if (!realDir || visited.has(realDir)) {
			continue;
		}

		visited.add(realDir);

		let entries;
		try {
			entries = fs.readdirSync(abs, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
			if (entry.name.startsWith('.')) {
				continue;
			}

			const absPath = path.join(abs, entry.name);
			const relPath = rel + entry.name;

			if (entry.isDirectory()) {
				stack.push({ abs: absPath, rel: `${relPath}\\` });
			} else if (entry.isFile()) {
				if (extFilter) {
					const lower = entry.name.toLowerCase();
					if (!lower.endsWith(extFilter)) {
						continue;
					}
				}

				if (matcher.test(relPath)) {
					results.push(relPath);
					if (results.length >= maxResults) {
						break;
					}
				}
			}
		}
	}

	searchCache.set(cacheKey, results);
	return results;
}

function clearSearchCache() {
	searchCache.clear();
}

module.exports = { searchLooseFiles, clearSearchCache, inferExtensionFilter, inferSearchRoots };
