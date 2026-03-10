/**
 * LinkedIn Employee Scraper — Node.js Example
 *
 * Extract employee profiles from any company. No login required.
 * Get your API token at: https://console.apify.com/settings/integrations
 */
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });

const run = await client.actor('george.the.developer/linkedin-employee-scraper').call({
    companies: ['https://www.linkedin.com/company/google/'],
    searchQuery: 'VP Sales',           // filter by job title
    location: 'United States',          // filter by location
    maxEmployees: 100,
    profileDepth: 'short',              // short ($3/1k), full ($6/1k), full-with-email ($10/1k)
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();

console.log(`Found ${items.length} employees\n`);
items.forEach(emp => {
    console.log(`${emp.fullName} — ${emp.headline}`);
    console.log(`  Profile: ${emp.profileUrl}`);
    console.log(`  Location: ${emp.location}\n`);
});
