/**
 * Email finder and validator.
 * Uses common email pattern generation + DNS MX validation.
 * No external API keys required.
 */
import { log } from 'crawlee';
import dns from 'dns';
import { promisify } from 'util';
import net from 'net';

const resolveMx = promisify(dns.resolveMx);

/**
 * Generate likely email addresses for a person at a company.
 * Tests common patterns and validates which ones have valid MX records.
 */
export async function findEmail(firstName, lastName, domain) {
    if (!firstName || !lastName || !domain) return null;

    const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const last = lastName.toLowerCase().replace(/[^a-z]/g, '');

    if (!first || !last) return null;

    // Common email patterns ordered by likelihood
    const patterns = [
        `${first}.${last}@${domain}`,           // john.doe@company.com (most common)
        `${first[0]}${last}@${domain}`,          // jdoe@company.com
        `${first}${last}@${domain}`,             // johndoe@company.com
        `${first}@${domain}`,                    // john@company.com
        `${first}_${last}@${domain}`,            // john_doe@company.com
        `${first[0]}.${last}@${domain}`,         // j.doe@company.com
        `${last}.${first}@${domain}`,            // doe.john@company.com
        `${first}${last[0]}@${domain}`,          // johnd@company.com
    ];

    // First check if the domain has MX records at all
    const hasMx = await checkMxRecords(domain);
    if (!hasMx) {
        return null;
    }

    // Return the most likely pattern with MX validation
    // We can't do full SMTP validation without sending emails,
    // so we return the most common pattern with domain-level confidence
    return {
        email: patterns[0], // first.last@domain is correct ~60% of the time
        confidence: 'medium',
        verified: false, // Domain MX exists but individual email not verified
        allPatterns: patterns.slice(0, 4), // Return top 4 patterns
    };
}

/**
 * Validate email with basic checks.
 */
export async function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;

    // Basic format check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return false;

    // Extract domain and check MX
    const domain = email.split('@')[1];
    return checkMxRecords(domain);
}

/**
 * Check if a domain has valid MX records.
 */
async function checkMxRecords(domain) {
    try {
        const records = await resolveMx(domain);
        return records && records.length > 0;
    } catch {
        return false;
    }
}
