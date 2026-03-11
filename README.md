# LinkedIn Employee Scraper — Extract Company Employee Data Without Login

Extract employee profiles from any company on LinkedIn. No cookies, no login, no LinkedIn account required. Built for sales prospecting, recruiting, competitive analysis, and B2B lead generation.

[![Run on Apify](https://img.shields.io/badge/Run%20on-Apify-blue?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTQgMjhDMjEuNzMyIDI4IDI4IDIxLjczMiAyOCAxNEMyOCA2LjI2OCAyMS43MzIgMCAxNCAwQzYuMjY4IDAgMCA2LjI2OCAwIDE0QzAgMjEuNzMyIDYuMjY4IDI4IDE0IDI4WiIgZmlsbD0iIzk3RDdGRiIvPjwvc3ZnPg==)](https://apify.com/george.the.developer/linkedin-employee-scraper)
[![Available on RapidAPI](https://img.shields.io/badge/Also%20on-RapidAPI-blue?logo=rapidapi)](https://rapidapi.com/georgethedeveloper3046/api/linkedin-employee-scraper-api)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)

## How It Works

Most LinkedIn scrapers require you to provide cookies or log in with your account (risking a ban). This scraper takes a completely different approach:

1. Searches Google with `site:linkedin.com/in/` queries targeted at specific companies
2. Parses LinkedIn profile data directly from Google search result snippets
3. Extracts name, title, location, and profile URL — all without touching LinkedIn's servers

**No LinkedIn cookies. No login. No account risk.**

## What Data You Get

```json
{
  "publicIdentifier": "john-smith-12345",
  "profileUrl": "https://www.linkedin.com/in/john-smith-12345/",
  "firstName": "John",
  "lastName": "Smith",
  "fullName": "John Smith",
  "headline": "VP of Engineering at Acme Corp",
  "location": "San Francisco Bay Area",
  "company": "acme-corp",
  "scrapedAt": "2026-03-10T15:00:00.000Z",
  "profileDepth": "short"
}
```

## Quick Start

### cURL

```bash
curl "https://api.apify.com/v2/acts/george.the.developer~linkedin-employee-scraper/run-sync-get-dataset-items?token=YOUR_API_TOKEN" \
  -X POST \
  -d '{
    "companies": ["https://www.linkedin.com/company/google/"],
    "searchQuery": "Software Engineer",
    "maxEmployees": 50,
    "profileDepth": "short"
  }' \
  -H 'Content-Type: application/json'
```

### Node.js

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });

const run = await client.actor('george.the.developer/linkedin-employee-scraper').call({
    companies: ['https://www.linkedin.com/company/google/'],
    searchQuery: 'VP Sales',
    location: 'United States',
    maxEmployees: 100,
    profileDepth: 'short',
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
console.log(`Found ${items.length} employees`);
items.forEach(emp => {
    console.log(`${emp.fullName} — ${emp.headline}`);
    console.log(`  ${emp.profileUrl}`);
});
```

### Python

```python
from apify_client import ApifyClient

client = ApifyClient("YOUR_API_TOKEN")

run = client.actor("george.the.developer/linkedin-employee-scraper").call(run_input={
    "companies": ["https://www.linkedin.com/company/google/"],
    "searchQuery": "Marketing Manager",
    "maxEmployees": 100,
    "profileDepth": "short",
})

for employee in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(f"{employee['fullName']} — {employee['headline']}")
```

## Use Cases

- **Sales Prospecting** — Find decision-makers (VP Sales, CTO, Head of Marketing) at target accounts
- **Recruiting** — Build candidate lists by company + job title + location
- **Competitive Analysis** — Map competitor org structures, track hiring trends
- **ABM (Account-Based Marketing)** — Enrich account data with employee-level contacts
- **Market Research** — Analyze workforce composition across companies or industries
- **Investor Due Diligence** — Research team composition before investing

## Input Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `companies` | string[] | *required* | LinkedIn company URLs or names |
| `searchQuery` | string | — | Filter by job title/keyword (e.g., "Software Engineer") |
| `location` | string | — | Filter by location (e.g., "San Francisco") |
| `profileDepth` | string | `short` | `short` ($3/1k), `full` ($6/1k), `full-with-email` ($10/1k) |
| `maxEmployees` | number | 100 | Max employees per company (1-1000) |
| `seniorityFilter` | string[] | — | Filter: owner, cxo, vp, director, manager, senior, entry |
| `maxConcurrency` | number | 3 | Concurrent requests (1-10) |

## Cost Comparison

| Method | Cost per 1,000 leads | Setup Time | Account Risk |
|--------|---------------------|------------|-------------|
| **This scraper** | **$3–$10** | **0 min** | **None** |
| LinkedIn Sales Navigator | $99/month (limited) | 30 min | High |
| Manual research | $200+ (labor) | Hours | None |
| Other LinkedIn scrapers | $10–$50 | 15 min | **High** (cookies) |

## Run on Apify

**[Run this actor on Apify](https://apify.com/george.the.developer/linkedin-employee-scraper)** — get results in minutes, not hours.

## Also Available on RapidAPI

Prefer a standard REST API? This scraper is also available on **[RapidAPI](https://rapidapi.com/georgethedeveloper3046/api/linkedin-employee-scraper-api)** with simple API key authentication:

- **Free tier**: 10 requests/month
- **Pro**: $49/month (500 requests)
- **Ultra**: $149/month (2,000 requests)
- **Mega**: $349/month (10,000 requests)

## Limitations

- Profile data comes from Google search snippets — not from LinkedIn's internal API. You get name, title, location, and URL. Full profile details (education, experience history) require LinkedIn access.
- Google limits search results to ~1,000 per query. For very large companies (100K+ employees), use specific filters (title, location, seniority) to narrow results.
- This tool does **not** access private LinkedIn profiles or bypass any LinkedIn security measures.

## Related Tools

- [Google News Scraper](https://github.com/the-ai-entrepreneur-ai-hub/google-news-scraper) — Monitor brand mentions across news sources
- [YouTube Transcript Extractor](https://github.com/the-ai-entrepreneur-ai-hub/youtube-transcript-extractor) — Get video transcripts for AI/RAG
- [Website Contact Scraper](https://github.com/the-ai-entrepreneur-ai-hub/website-contact-scraper) — Find emails & contacts from any website
- [US Tariff Lookup](https://github.com/the-ai-entrepreneur-ai-hub/us-tariff-lookup) — Look up import duty rates & HS codes

## License

ISC License. See [LICENSE](LICENSE) for details.

---

Built by [george.the.developer](https://apify.com/george.the.developer) on [Apify](https://apify.com).
