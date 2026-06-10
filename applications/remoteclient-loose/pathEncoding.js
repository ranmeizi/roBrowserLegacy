/**
 * Korean path encoding helpers for loose-files mode.
 * roBrowser HTTP URLs use UTF-8 Korean; extracted kRO folders use CP949 mojibake on disk.
 */
const iconv = require('iconv-lite');

function encodeMojibake(str) {
	try {
		return iconv.decode(iconv.encode(str, 'cp949'), 'iso-8859-1');
	} catch {
		return str;
	}
}

function decodeMojibake(str) {
	try {
		return iconv.decode(iconv.encode(str, 'iso-8859-1'), 'cp949');
	} catch {
		return str;
	}
}

/**
 * Build path variants for loose-file lookup (Unicode URL vs mojibake on disk).
 *
 * @param {string} filePath
 * @return {string[]}
 */
function resolveLoosePathVariants(filePath) {
	const variants = new Set();
	const normalized = filePath.replace(/\\/g, '/');
	variants.add(normalized);
	variants.add(normalized.replace(/\//g, '\\'));

	const segments = normalized.split('/');

	const mojibakePath = segments
		.map(seg => {
			if (/[\uac00-\ud7a3]/.test(seg)) {
				return encodeMojibake(seg);
			}
			return seg;
		})
		.join('/');

	if (mojibakePath !== normalized) {
		variants.add(mojibakePath);
		variants.add(mojibakePath.replace(/\//g, '\\'));
	}

	const unicodePath = segments
		.map(seg => {
			if (/[\u0080-\u00ff]/.test(seg) && !/[\uac00-\ud7a3]/.test(seg)) {
				const decoded = decodeMojibake(seg);
				return decoded !== seg ? decoded : seg;
			}
			return seg;
		})
		.join('/');

	if (unicodePath !== normalized) {
		variants.add(unicodePath);
		variants.add(unicodePath.replace(/\//g, '\\'));
	}

	return Array.from(variants);
}

module.exports = { encodeMojibake, decodeMojibake, resolveLoosePathVariants };
