# Go-Live Guide — the last lap to reach real users

The site is deployed at **https://g-brodiei.github.io/floorplan-universe/** and
the technical SEO groundwork is already in the repo. This guide lists what has
been done for you, and the remaining steps **only you can do** (they need your
Google/Microsoft account or a decision from you).

## Already done (in this repo)

| Item | Where |
|---|---|
| Title, meta description (zh + en), canonical URL | `index.html` `<head>` |
| Open Graph + Twitter Card tags with a real preview image | `index.html`, `og-image.png` |
| Structured data (Schema.org `WebApplication`, JSON-LD) | `index.html` |
| Favicon + iOS home-screen icon | `favicon.svg`, `apple-touch-icon.png` |
| `robots.txt` welcoming search **and** AI crawlers (GPTBot, ClaudeBot, PerplexityBot, …) | `robots.txt` |
| XML sitemap | `sitemap.xml` |
| `llms.txt` — a summary written for AI assistants so they can recommend and explain the tool | `llms.txt` |
| Mobile-friendly viewport + `theme-color` | `index.html`, `css/app.css` |

## Your checklist (≈30 minutes total)

### 1. Google Search Console (most important)
1. Go to https://search.google.com/search-console and add a **URL-prefix**
   property for `https://g-brodiei.github.io/floorplan-universe/`.
2. Verify with the **HTML tag** method: Google gives you a
   `<meta name="google-site-verification" content="…">` tag — add it to
   `index.html` `<head>` and push (via PR).
3. After verification: **Sitemaps → submit** `sitemap.xml`.
4. **URL Inspection** → paste the site URL → **Request Indexing** to skip the
   crawl queue.

Expect the site to appear in Google within a few days; impressions data takes
about a week.

### 2. Bing Webmaster Tools (5 minutes, free traffic)
https://www.bing.com/webmasters — choose **Import from Google Search Console**
and everything (including the sitemap) carries over. Bing also feeds
DuckDuckGo and several AI search products.

### 3. Check the social/chat previews
Paste the URL into these validators once, so the first person who shares the
link sees the pretty card:
- Facebook: https://developers.facebook.com/tools/debug/
- LINE (big in the zh-Hant audience): share the link to yourself in LINE
- X/Twitter: https://cards-dev.twitter.com/validator

### 4. Decide on analytics (optional)
The footer promises "資料只存在你的瀏覽器" — keep that promise. If you want
visit counts, pick a cookie-less, privacy-first option:
- **GoatCounter** (free, one `<script>` line)
- **Cloudflare Web Analytics** (free)
- **Plausible** (paid)

Avoid Google Analytics here; it would contradict the site's privacy pitch.

### 5. Spread the word (this is what actually brings users)
Search engines mostly rank this kind of tool through links and mentions:
- Taiwanese communities where people measure their homes: Mobile01 居家版,
  PTT home-sale / Interior 板, Dcard 居家生活板, Facebook 裝潢/租屋社團
- Reddit: r/floorplan, r/InteriorDesign, r/HomeImprovement (the imperial-unit
  switcher makes it usable for this audience)
- Hacker News "Show HN" — open-source, no-backend tools do well there
- Product Hunt if you want a launch day

### 6. Optional: custom domain
A domain like `floorplan.example.tw` looks better in shares and survives a
GitHub username change:
1. Buy the domain; add a `CNAME` file to the repo root containing the domain.
2. In repo **Settings → Pages → Custom domain**, set it and enable
   **Enforce HTTPS**.
3. Update every absolute URL in: `index.html` (canonical, og:url, og:image,
   JSON-LD), `sitemap.xml`, `robots.txt`, `llms.txt`, `README.md`.

### 7. Keep it healthy
- Search Console → **Page indexing** report: should show 1 indexed page, no errors.
- After significant releases, bump `<lastmod>` in `sitemap.xml`.
- The e2e suite in CI guards against shipping a broken page (a blank page
  can get the site dropped from the index).

## If the URL ever changes

Grep for `g-brodiei.github.io/floorplan-universe` — every file that hardcodes
the URL will show up (`index.html`, `sitemap.xml`, `robots.txt`, `llms.txt`,
`README.md`, this guide) and must be updated together.
