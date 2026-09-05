import type { APIRoute } from 'astro';
import { SITE, isCanonicalProduction } from '../site';

/**
 * robots.txt is generated per deployment so that staging never advertises
 * production's sitemap.
 *
 * Note the non-production body still ALLOWS crawling. That looks backwards,
 * but it is deliberate: `Disallow: /` stops crawling, and a crawler that
 * cannot fetch the page can never see the `noindex` on it — so a linked
 * staging URL can still end up indexed as a bare result. Letting crawlers in
 * to read the noindex (served both as a meta tag and, via vercel.json, as an
 * X-Robots-Tag header) is the combination Google documents as reliable for
 * keeping a URL out of the index.
 *
 * For a hard guarantee, enable Vercel Deployment Protection on the staging
 * project so crawlers get a 401 and there is nothing to index at all.
 */
export const GET: APIRoute = () => {
  const canonical = isCanonicalProduction();

  const body = canonical
    ? `User-agent: *
Allow: /

Sitemap: ${SITE.url}/sitemap-index.xml
`
    : `# Non-production deployment. Crawling is permitted so that the
# noindex directive on every page is discoverable; nothing here
# should ever be indexed.
User-agent: *
Allow: /
`;

  // This is a static build, so only the body is written to disk — response
  // headers here would be discarded. X-Robots-Tag is set in vercel.json.
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
