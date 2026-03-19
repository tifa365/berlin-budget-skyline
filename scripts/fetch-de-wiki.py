#!/usr/bin/env python3
"""
Fetch top German Wikipedia articles and generate wiki-data.js

1. Monthly top 1000 from de.wikipedia.org (last 24 months)
2. Deduplicate + sum views
3. Enrich top N with page byte-length via Action API
4. Output src/data/wiki-data.js as {t, w, v}
"""

import json
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime
from pathlib import Path

USER_AGENT = "WikiCityExplorer/1.0 (https://github.com/wikicity; contact@wikicity.app)"
TARGET_COUNT = 50000
MONTHS_BACK = 24
BATCH_SIZE = 50  # titles per Action API request
THROTTLE = 0.1   # seconds between requests

HEADERS = {
    "User-Agent": USER_AGENT,
    "Api-User-Agent": USER_AGENT,
    "Accept": "application/json",
}

# Filter out non-article pages
SKIP_PREFIXES = [
    "Special:", "Spezial:", "Wikipedia:", "Datei:", "File:",
    "Hilfe:", "Help:", "Kategorie:", "Category:", "Portal:",
    "Vorlage:", "Template:", "Modul:", "Module:", "MediaWiki:",
    "Benutzer:", "User:", "Diskussion:", "Talk:",
    "Wikipedia_Diskussion:", "Benutzer_Diskussion:",
]

SKIP_TITLES = {
    "Hauptseite", "Main_Page", "-", "Undefined",
    "Spezial:Suche", "Special:Search",
}


def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def should_skip(title):
    if title in SKIP_TITLES:
        return True
    for prefix in SKIP_PREFIXES:
        if title.startswith(prefix):
            return True
    return False


def fetch_monthly_top(year, month):
    url = (
        f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/"
        f"de.wikipedia.org/all-access/{year}/{month:02d}/all-days"
    )
    print(f"  Fetching {year}-{month:02d}...", end=" ", flush=True)
    try:
        data = fetch_json(url)
        articles = []
        for day in data.get("items", []):
            for article in day.get("articles", []):
                title = article.get("article", "")
                views = article.get("views", 0)
                if not should_skip(title):
                    articles.append((title, views))
        print(f"{len(articles)} entries")
        return articles
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}, skipping")
        return []


def fetch_page_lengths(titles):
    """Fetch byte lengths for a batch of titles via Action API."""
    titles_param = "|".join(titles)
    url = (
        f"https://de.wikipedia.org/w/api.php?"
        f"action=query&format=json&prop=info&titles="
        f"{urllib.parse.quote(titles_param, safe='|')}"
    )
    try:
        data = fetch_json(url)
        result = {}
        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if int(page_id) < 0:
                continue
            result[page["title"]] = page.get("length", 0)
        return result
    except Exception as e:
        print(f"  Warning: batch failed: {e}")
        return {}


def iter_recent_complete_months(months_back, now=None):
    """Yield completed calendar months from newest to oldest."""
    if now is None:
        now = datetime.utcnow()

    year = now.year
    month = now.month - 1
    if month == 0:
        year -= 1
        month = 12

    for _ in range(months_back):
        yield year, month
        month -= 1
        if month == 0:
            year -= 1
            month = 12


def main():
    print("=== Fetching German Wikipedia top pages ===\n")

    # Step 1: Collect monthly top pages
    views_by_title = {}

    for year, month in iter_recent_complete_months(MONTHS_BACK):
        articles = fetch_monthly_top(year, month)
        for title, views in articles:
            views_by_title[title] = views_by_title.get(title, 0) + views
        time.sleep(THROTTLE)

    print(f"\n{len(views_by_title)} unique articles collected")

    # Step 2: Sort by views, take top N
    sorted_articles = sorted(views_by_title.items(), key=lambda x: -x[1])
    top_articles = sorted_articles[:TARGET_COUNT]
    print(f"Keeping top {len(top_articles)} articles")

    # Step 3: Enrich with page lengths
    print(f"\nFetching page lengths ({len(top_articles)} articles)...")
    titles_list = [title for title, _ in top_articles]
    lengths = {}

    for i in range(0, len(titles_list), BATCH_SIZE):
        batch = titles_list[i:i + BATCH_SIZE]
        # Need to convert underscores to spaces for Action API
        batch_decoded = [t.replace("_", " ") for t in batch]
        result = fetch_page_lengths(batch_decoded)
        lengths.update(result)
        done = min(i + BATCH_SIZE, len(titles_list))
        if done % 500 == 0 or done == len(titles_list):
            print(f"  {done}/{len(titles_list)} done")
        time.sleep(THROTTLE)

    # Step 4: Build output
    print("\nBuilding wiki-data.js...")
    entries = []
    for title, views in top_articles:
        display_title = title.replace("_", " ")
        # Try both forms for length lookup
        length = lengths.get(display_title, 0) or lengths.get(title, 0)
        entries.append({"t": display_title, "w": length, "v": views})

    output_path = Path(__file__).parent.parent / "src" / "data" / "wiki-data.js"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("export const WIKI_DATA = ")
        json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    size_mb = output_path.stat().st_size / 1024 / 1024
    print(f"\nDone! {len(entries)} articles written to {output_path}")
    print(f"File size: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
