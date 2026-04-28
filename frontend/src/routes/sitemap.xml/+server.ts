import type { RequestHandler } from './$types';

// URL ที่อนุญาตให้ search engine index
// admin/* และ student/* มี noindex ที่ layout แล้ว ไม่ต้องใส่ที่นี่
const PUBLIC_PATHS = [
	{ path: '/', priority: 1.0, changefreq: 'weekly' },
	{ path: '/login', priority: 0.8, changefreq: 'monthly' },
	{ path: '/register', priority: 0.8, changefreq: 'monthly' },
	{ path: '/forgot-password', priority: 0.3, changefreq: 'yearly' }
];

export const GET: RequestHandler = ({ url }) => {
	const origin = url.origin;
	const today = new Date().toISOString().split('T')[0];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_PATHS.map(
	(p) => `	<url>
		<loc>${origin}${p.path}</loc>
		<lastmod>${today}</lastmod>
		<changefreq>${p.changefreq}</changefreq>
		<priority>${p.priority}</priority>
	</url>`
).join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
