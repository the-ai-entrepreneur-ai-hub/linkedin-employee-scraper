import { Actor } from 'apify';
import { HttpCrawler, log } from 'crawlee';
import { extractCompanyId, buildSearchUrl } from './linkedin-api.js';
import { findEmail } from './email-finder.js';

await Actor.init();

try {
    const input = await Actor.getInput() ?? {};
    const {
        companies = [],
        searchQuery = '',
        location = '',
        profileDepth = 'short',
        maxEmployees = 100,
        seniorityFilter = [],
        industryFilter = '',
        maxConcurrency = 3,
        proxyConfiguration,
    } = input;

    if (!companies.length) {
        throw new Error('No companies provided. Add at least one LinkedIn company URL or name.');
    }

    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info('  LinkedIn Company Employees Scraper');
    log.info('  No login required | PPE pricing');
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info('Config:', {
        companies: companies.length,
        profileDepth,
        maxEmployees,
        searchQuery: searchQuery || '(all)',
        location: location || '(any)',
        seniority: seniorityFilter.length ? seniorityFilter.join(', ') : '(any)',
    });

    // Determine PPE event name based on depth
    const chargeEventName = {
        short: 'short-profile',
        full: 'full-profile',
        'full-with-email': 'full-profile-with-email',
    }[profileDepth] || 'short-profile';

    // Check if PPE pricing is available
    let isPPE = false;
    try {
        const pricingInfo = Actor.getChargingManager().getPricingInfo();
        isPPE = pricingInfo.isPayPerEvent;
        if (isPPE) {
            log.info(`PPE mode active. Charge event: ${chargeEventName}`);
        }
    } catch {
        log.info('Running in free/test mode (no PPE billing)');
    }

    // Charge actor start
    if (isPPE) {
        try {
            await Actor.charge({ eventName: 'actor-start', count: 1 });
        } catch (e) {
            log.warning(`Actor start charge failed: ${e.message}`);
        }
    }

    // Force GOOGLE_SERP proxy group for reliable Google access
    const proxyConfig = await Actor.createProxyConfiguration({
        useApifyProxy: true,
        apifyProxyGroups: ['GOOGLE_SERP'],
    });

    // Stats tracking
    const stats = {
        totalProfiles: 0,
        totalCharges: 0,
        companiesProcessed: 0,
        errors: 0,
    };

    // Resume state
    const kvStore = await Actor.openKeyValueStore();
    const resumeState = await kvStore.getValue('RESUME_STATE') || {};
    const processedProfiles = new Set(resumeState.processedProfiles || []);

    // Collect all search URLs to crawl
    const requests = [];

    for (const company of companies) {
        const companySlug = extractCompanyId(company);
        if (!companySlug) {
            log.warning(`Could not parse company: ${company}`);
            continue;
        }

        const pagesNeeded = Math.ceil(maxEmployees / 10);
        for (let page = 0; page < pagesNeeded; page++) {
            const url = buildSearchUrl({
                companySlug,
                keywords: searchQuery,
                location,
                seniority: seniorityFilter,
                industry: industryFilter,
                start: page,
            });
            requests.push({
                url,
                userData: { companySlug, page },
            });
        }
    }

    log.info(`Phase 1: Crawling ${requests.length} Google SERP pages...`);

    const crawler = new HttpCrawler({
        proxyConfiguration: proxyConfig,
        maxConcurrency,
        maxRequestRetries: 3,
        requestHandlerTimeoutSecs: 60,
        async requestHandler({ request, body }) {
            const { companySlug, page } = request.userData;
            const html = typeof body === 'string' ? body : body.toString('utf-8');

            log.info(`SERP page ${page + 1} for ${companySlug}: ${html.length} chars`);

            // Save debug HTML for first page
            if (page === 0) {
                try {
                    await Actor.setValue('DEBUG_SERP_HTML', html, { contentType: 'text/html' });
                    log.info('Saved debug HTML to KV store');
                } catch (e) {
                    log.warning(`Failed to save debug HTML: ${e.message}`);
                }
            }

            // Check for CAPTCHA
            if (html.includes('captcha') || html.includes('CAPTCHA') || html.includes('unusual traffic')) {
                log.warning('CAPTCHA detected, retrying with new proxy session...');
                throw new Error('CAPTCHA detected');
            }

            // Parse LinkedIn profiles directly from HTML using regex
            // This is more robust than cheerio for varying Google HTML formats
            const profiles = extractProfilesFromSerp(html, companySlug);
            log.info(`Found ${profiles.length} LinkedIn profiles on page ${page + 1}`);

            for (const profile of profiles) {
                if (stats.totalProfiles >= maxEmployees) break;

                const profileKey = profile.profileUrl;
                if (processedProfiles.has(profileKey)) continue;

                await Actor.pushData(profile);
                processedProfiles.add(profileKey);
                stats.totalProfiles++;

                if (isPPE) {
                    try {
                        const chargeResult = await Actor.charge({ eventName: chargeEventName, count: 1 });
                        if (chargeResult.chargedCount > 0) stats.totalCharges++;
                    } catch { /* charge limit */ }
                }
            }

            if (page === 0) stats.companiesProcessed++;
        },
        async failedRequestHandler({ request }, error) {
            log.error(`Failed: ${request.url.substring(0, 100)} - ${error.message}`);
            stats.errors++;
        },
    });

    await crawler.run(requests);

    // Save resume state
    await kvStore.setValue('RESUME_STATE', {
        processedProfiles: [...processedProfiles],
    });

    if (profileDepth !== 'short') {
        log.info('Note: Full profile enrichment uses data from Google snippets in v1.');
    }

    await Actor.setValue('RUN_SUMMARY', {
        ...stats,
        profileDepth,
        chargeEventName,
        completedAt: new Date().toISOString(),
    });

    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info('  RUN COMPLETE');
    log.info(`  Profiles extracted: ${stats.totalProfiles}`);
    log.info(`  Companies processed: ${stats.companiesProcessed}`);
    log.info(`  PPE charges: ${stats.totalCharges}`);
    log.info(`  Errors: ${stats.errors}`);
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

} catch (error) {
    log.error(`Actor failed: ${error.message}`);
    log.error(error.stack);
} finally {
    await Actor.exit();
}

/**
 * Extract LinkedIn profiles from Google SERP HTML using regex.
 * More robust than DOM parsing since Google HTML structure varies.
 */
function extractProfilesFromSerp(html, companySlug) {
    const profiles = [];
    const seenIds = new Set();
    const skipSlugs = new Set(['login', 'signup', 'company', 'jobs', 'feed', 'help', 'learning', 'pub', 'dir', 'school']);

    // Strategy 1: Find all linkedin.com/in/ URLs including country subdomains (cz.linkedin.com, uk.linkedin.com, etc.)
    const urlRegex = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([a-zA-Z0-9_%.-]{3,100})(?:\/|"|&|<|\s)/gi;
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
        let slug = match[1].toLowerCase();
        // Clean URL encoding artifacts
        try { slug = decodeURIComponent(slug); } catch {}
        // Remove trailing language codes like /cs, /en
        slug = slug.replace(/\/[a-z]{2}$/, '');
        // Skip if contains search query artifacts
        if (slug.includes('%') || slug.includes('+') || slug.includes('=') || slug.length > 80) continue;
        if (seenIds.has(slug) || skipSlugs.has(slug)) continue;
        seenIds.add(slug);
    }

    // For each found slug, try to extract surrounding context
    for (const slug of seenIds) {
        const profileUrl = `https://www.linkedin.com/in/${slug}/`;

        // Try to find Google result title containing this slug
        // Google wraps results in various containers, but the URL and title are nearby
        // Escape special regex chars in slug
        const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Try to find the title from the <a> tag linking to this profile
        // Google uses both direct links and country-specific subdomains
        const titleRegex = new RegExp(
            `<a[^>]*href="[^"]*linkedin\\.com/in/${escapedSlug}[^"]*"[^>]*>([\\s\\S]*?)</a>`,
            'i'
        );
        const titleMatch = html.match(titleRegex);
        let titleText = '';
        if (titleMatch) {
            titleText = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        }

        // Parse name from title: "FirstName LastName - Title at Company | LinkedIn"
        const cleanTitle = titleText
            .replace(/\s*[\|·-]\s*LinkedIn$/i, '')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/LinkedIn\s*·\s*.+?followers?/gi, '')
            .replace(/\d+\.?\d*[KMB]?\+?\s*followers?/gi, '')
            .trim();

        const dashParts = cleanTitle.split(/\s+-\s+/);
        const rawName = dashParts[0]?.trim() || slug.replace(/-/g, ' ');
        const headline = dashParts.slice(1).join(' - ').trim();

        const name = rawName
            .replace(/,\s*(MBA|PhD|MD|CPA|PMP|CFA|PE|JD|Esq\.?|CISSP)$/gi, '')
            .trim();
        const nameParts = name.split(/\s+/);

        // Try to get snippet text near this result
        let snippet = '';
        const snippetIdx = html.indexOf(`linkedin.com/in/${slug}`);
        if (snippetIdx > -1) {
            // Get a window of text around the URL
            const window = html.substring(Math.max(0, snippetIdx - 500), Math.min(html.length, snippetIdx + 1000));
            // Extract text from nearby elements
            const textBlocks = window.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            snippet = textBlocks.substring(0, 300);
        }

        // Extract location from snippet
        let loc = '';
        const locMatch = snippet.match(/(?:location|based\s+in|located?\s+in|from)[\s:]+([^.·|]{3,50})/i);
        if (locMatch) loc = locMatch[1].trim();

        profiles.push({
            publicIdentifier: slug,
            profileUrl,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            fullName: name,
            headline,
            location: loc,
            snippet: snippet.substring(0, 300),
            company: companySlug,
            scrapedAt: new Date().toISOString(),
            profileDepth: 'short',
        });
    }

    return profiles;
}
