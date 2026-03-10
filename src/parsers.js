/**
 * Parse LinkedIn profile data from Google SERP results and LinkedIn public pages.
 * Works with Google results accessed via Apify's GOOGLE_SERP proxy group.
 */
import * as cheerio from 'cheerio';

/**
 * Parse Google SERP results for LinkedIn profiles.
 * Google returns real HTML when accessed via SERP-specific proxies.
 */
export function parseSearchResults(html, companySlug) {
    const $ = cheerio.load(html);
    const profiles = [];
    const seenIds = new Set();

    // Strategy: find ALL links to linkedin.com/in/ profiles in the HTML.
    // Google results can be in various container formats depending on
    // the proxy/region, so we use a universal approach.

    // Collect all text blocks near LinkedIn links for context
    $('a').each((_, el) => {
        const $a = $(el);
        let href = $a.attr('href') || '';

        // Google wraps URLs in /url?q= redirects
        if (href.startsWith('/url?')) {
            const qMatch = href.match(/[?&]q=([^&]+)/);
            if (qMatch) {
                href = decodeURIComponent(qMatch[1]);
            }
        }

        // Only LinkedIn profile URLs
        const profileMatch = href.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]{3,100})(?:\/|$)/);
        if (!profileMatch) return;

        const publicIdentifier = profileMatch[1].toLowerCase();

        // Skip duplicates
        if (seenIds.has(publicIdentifier)) return;
        seenIds.add(publicIdentifier);

        // Skip obvious non-profile slugs
        if (['login', 'signup', 'company', 'jobs', 'feed', 'help', 'learning'].includes(publicIdentifier)) return;

        // Get surrounding text for context
        const linkText = $a.text().trim();

        // Walk up to find the enclosing result container
        const container = $a.closest('div.g, div.tF2Cxc, div[data-sokoban-container], div.MjjYud, li')
            || $a.parent().parent();

        // Get the title (usually in h3 or the link itself)
        const titleEl = container.find('h3').first();
        const titleText = titleEl.length ? titleEl.text().trim() : linkText;

        // Get the snippet
        const snippetEl = container.find('.VwiC3b, .IsZvec, .aCOpRe, span.st, [data-sncf], .lEBKkf').first();
        const snippet = snippetEl.length ? snippetEl.text().trim() : '';

        // Parse the title: "FirstName LastName - Title - Company | LinkedIn"
        const parsed = parseTitleText(titleText);
        const location = extractLocationFromSnippet(snippet);

        profiles.push({
            publicIdentifier,
            profileUrl: `https://www.linkedin.com/in/${publicIdentifier}/`,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            fullName: parsed.fullName,
            headline: parsed.headline,
            location,
            snippet: snippet.substring(0, 300),
            source: 'google-serp',
        });
    });

    return { profiles, totalCount: profiles.length };
}

/**
 * Parse a LinkedIn public profile page for full details.
 */
export function parseFullProfile(html) {
    const $ = cheerio.load(html);
    const result = {};

    // JSON-LD structured data (most reliable)
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const structured = JSON.parse($(el).html() || '{}');
            if (structured['@type'] === 'Person') {
                result.fullName = structured.name || '';
                result.headline = structured.jobTitle || '';
                result.location = structured.address?.addressLocality || '';
                result.description = structured.description || '';
                result.profileImage = structured.image?.contentUrl || '';

                if (structured.worksFor) {
                    const works = Array.isArray(structured.worksFor) ? structured.worksFor : [structured.worksFor];
                    result.currentCompany = works[0]?.name || '';
                    result.companyDomain = works[0]?.url ? extractDomain(works[0].url) : '';
                }

                if (structured.alumniOf) {
                    const schools = Array.isArray(structured.alumniOf) ? structured.alumniOf : [structured.alumniOf];
                    result.education = schools.map(s => ({
                        schoolName: s.name || '',
                        url: s.url || '',
                    }));
                }
            }
        } catch {
            // JSON-LD parsing failed
        }
    });

    // Experience
    const experience = [];
    $('section.experience li, [data-section="experience"] li, .experience-item').each((_, el) => {
        const item = $(el);
        const title = item.find('h3, .experience-item__title').first().text().trim();
        const company = item.find('h4, .experience-item__subtitle').first().text().trim();
        if (title || company) {
            experience.push({
                title,
                company,
                duration: item.find('.date-range, .experience-item__duration').first().text().trim(),
                location: item.find('.experience-item__location').first().text().trim(),
            });
        }
    });
    if (experience.length) result.experience = experience;

    // Skills
    const skills = [];
    $('section.skills li, [data-section="skills"] li').each((_, el) => {
        const skill = $(el).text().trim();
        if (skill && skill.length < 100 && !skill.includes('\n')) skills.push(skill);
    });
    if (skills.length) result.skills = [...new Set(skills)];

    // Education fallback
    if (!result.education) {
        const education = [];
        $('section.education li, [data-section="education"] li').each((_, el) => {
            const item = $(el);
            const schoolName = item.find('h3').first().text().trim();
            if (schoolName) {
                education.push({
                    schoolName,
                    degree: item.find('h4').first().text().trim(),
                    dates: item.find('.date-range').first().text().trim(),
                });
            }
        });
        if (education.length) result.education = education;
    }

    // About section
    const about = $('section.summary .summary, [data-section="summary"]').text().trim();
    if (about) result.about = about.substring(0, 1000);

    return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseTitleText(text) {
    if (!text) return { firstName: '', lastName: '', fullName: '', headline: '' };

    const cleaned = text
        .replace(/\s*[\|·-]\s*LinkedIn$/i, '')
        .trim();

    const dashParts = cleaned.split(/\s+-\s+/);
    const rawName = dashParts[0]?.trim() || '';
    const headline = dashParts.slice(1).join(' - ').trim();

    const name = rawName
        .replace(/,\s*(MBA|PhD|MD|CPA|PMP|CFA|PE|JD|Esq\.?|CISSP)$/gi, '')
        .trim();

    const nameParts = name.split(/\s+/);
    if (nameParts.length === 0) return { firstName: '', lastName: '', fullName: name, headline };
    if (nameParts.length === 1) return { firstName: nameParts[0], lastName: '', fullName: name, headline };

    return {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' '),
        fullName: name,
        headline,
    };
}

function extractLocationFromSnippet(snippet) {
    if (!snippet) return '';
    const patterns = [
        /(?:location|based\s+in|located?\s+in|from)[\s:]+([^.·|]+)/i,
        /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)*)\s*(?:area|metro|region)/i,
    ];
    for (const pattern of patterns) {
        const match = snippet.match(pattern);
        if (match) return match[1].trim().substring(0, 100);
    }
    return '';
}

function extractDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}
