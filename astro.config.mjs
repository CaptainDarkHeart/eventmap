// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Creates dist/sitemap.xml as an alias of dist/sitemap-index.xml
 * so bots requesting either URL receive the XML sitemap.
 */
function sitemapAlias() {
	return {
		name: 'sitemap-alias',
		hooks: {
			'astro:build:done': async ({ dir }) => {
				const outDir = fileURLToPath(dir);
				const indexPath = path.join(outDir, 'sitemap-index.xml');
				const aliasPath = path.join(outDir, 'sitemap.xml');
				if (fs.existsSync(indexPath)) {
					fs.copyFileSync(indexPath, aliasPath);
				}
			},
		},
	};
}

// https://astro.build/config
export default defineConfig({
	site: 'https://techeventsmap.com',
	integrations: [sitemap(), sitemapAlias()],
	devToolbar: { enabled: false },
});
