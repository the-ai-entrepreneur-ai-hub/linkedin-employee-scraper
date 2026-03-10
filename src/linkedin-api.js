/**
 * LinkedIn public API utilities.
 * Uses Google search with SERP proxies to discover LinkedIn profiles.
 */

/**
 * Extract company slug/ID from various input formats.
 */
export function extractCompanyId(input) {
    if (!input || typeof input !== 'string') return null;

    const trimmed = input.trim();

    // Full LinkedIn URL: https://www.linkedin.com/company/google/
    const urlMatch = trimmed.match(/linkedin\.com\/company\/([^/?&#]+)/i);
    if (urlMatch) return urlMatch[1].toLowerCase();

    // Numeric company ID
    if (/^\d+$/.test(trimmed)) return trimmed;

    // Plain company name - slugify it
    return trimmed
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Build Google search URL for LinkedIn profiles at a company.
 * Uses GOOGLE_SERP proxy group on Apify for reliable access.
 */
export function buildSearchUrl({ companySlug, keywords, location, seniority, industry, start = 0 }) {
    const parts = [];
    parts.push('site:linkedin.com/in/');

    if (companySlug) {
        // Use company name without strict quotes for better coverage
        const companyName = companySlug.replace(/-/g, ' ');
        parts.push(companyName);
    }

    if (keywords) {
        parts.push(`"${keywords}"`);
    }

    if (location) {
        parts.push(`"${location}"`);
    }

    if (seniority && seniority.length > 0) {
        const terms = seniority.map(s => {
            const mapping = {
                owner: '"Owner" OR "Founder"',
                partner: '"Partner"',
                cxo: '"CEO" OR "CTO" OR "CFO" OR "COO" OR "CMO"',
                vp: '"Vice President" OR "VP"',
                director: '"Director"',
                manager: '"Manager"',
                senior: '"Senior"',
                entry: '"Junior" OR "Associate"',
                training: '"Intern"',
                unpaid: '"Volunteer"',
            };
            return mapping[s] || `"${s}"`;
        });
        parts.push(`(${terms.join(' OR ')})`);
    }

    if (industry) {
        parts.push(`"${industry}"`);
    }

    const query = encodeURIComponent(parts.join(' '));
    // GOOGLE_SERP proxy requires HTTP, not HTTPS
    return `http://www.google.com/search?q=${query}&start=${start * 10}&num=10&hl=en`;
}

/**
 * Build a LinkedIn public profile URL.
 */
export function buildProfileUrl(publicIdentifier) {
    return `https://www.linkedin.com/in/${publicIdentifier}/`;
}
