"""
LinkedIn Employee Scraper — Python Example

Extract employee profiles from any company. No login required.
Get your API token at: https://console.apify.com/settings/integrations

pip install apify-client
"""
from apify_client import ApifyClient

client = ApifyClient("YOUR_API_TOKEN")

run = client.actor("george.the.developer/linkedin-employee-scraper").call(run_input={
    "companies": ["https://www.linkedin.com/company/google/"],
    "searchQuery": "Marketing Manager",
    "location": "United States",
    "maxEmployees": 100,
    "profileDepth": "short",
})

for employee in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(f"{employee['fullName']} — {employee['headline']}")
    print(f"  Profile: {employee['profileUrl']}")
    print(f"  Location: {employee.get('location', 'N/A')}")
    print()
