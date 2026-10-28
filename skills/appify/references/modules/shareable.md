# Step: shareable

Goal: a link to any page shows a rich preview (title, image) in iMessage, WhatsApp, Slack and X; the app has a native share button; every screen has a URL that reopens it.

## 1. Preview tags, per page
Crawlers don't run JavaScript, so these tags must be in the HTML the server sends for that URL:
```html
<title>Harbor at 6am · Lumen</title>
<meta name="description" content="Two critiques: lower the horizon, the sky is doing the work.">
<meta property="og:title" content="Harbor at 6am">
<meta property="og:description" content="Two critiques on composition and light.">
<meta property="og:url" content="https://example.com/photos/harbor-at-6am">
<meta property="og:site_name" content="Lumen">
<meta property="og:image" content="https://example.com/og/harbor-at-6am.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Harbor at sunrise, orange sky over dark water">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://example.com/photos/harbor-at-6am">
```
- `og:title` without the site name (iMessage shows `og:site_name` separately). Description ≤ ~80 characters.
- Image: 1200×630 JPEG under ~300 KB, absolute `https://` URL, little or no text in the image.
- Keep `<head>` early and small: WhatsApp reads only the first 300 KB of HTML.
- Pages behind a login should still return real preview tags for the public part (title, generic image).
- Where the stack can't render tags per URL (client-only SPA), use one strong site-wide card and say so (`stacks.md`).
- Use the production origin for `og:url` and `og:image`, from config or an env variable; never `localhost`.

## 2. Preview images
- Best: the page's own content (the photo, the product), cropped to 1200×630.
- Otherwise a template: title and brand on a clean background, rendered per page. Next.js has `opengraph-image.tsx`; elsewhere render an HTML template at 1200×630 with a headless browser at build time.
- Check each image by opening it.

## 3. Share button
```js
async function share({ title, text, url = location.href }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; }   // fallback: copy the link
  catch { return 'failed'; }
}
```
- Call it from a tap. Show "Link copied" only when it really copied; on `failed` show the URL to copy by hand.
- Use the platform's share icon on iOS and Android (both recognize a box with an up arrow), labeled "Share".
- Put it where sharing is natural: item detail pages, results, profiles.

## 4. Deep links
- Every screen and meaningful state has a URL: tabs, filters (`?filter=street`), the selected item (`/photos/harbor-at-6am`), the open sheet only if it's content (not a menu).
- On load, restore that state from the URL. A shared link must open the same view on a phone that has never seen the app.

## 5. Receiving shares (Android, installed)
For apps where people bring in photos or links, add to the manifest:
```json
"share_target": {
  "action": "/share-target", "method": "POST", "enctype": "multipart/form-data",
  "params": { "title": "title", "text": "text", "url": "url", "files": [{ "name": "photos", "accept": ["image/*"] }] }
}
```
`/share-target` must accept the POST (server route, or the service worker's `fetch` handler) and open the right screen with the shared content. iOS doesn't support this; don't promise it there.

## Done when
`head` in the facts shows og:title, og:description, an absolute og:image and twitter:card on every main page. `curl -s <page-url> | grep -E 'og:|twitter:'` shows them without JavaScript. The share button shares on phones and copies on desktop. Checkpoint "Shareable".
