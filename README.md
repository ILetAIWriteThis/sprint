# Book Sprint

A private, installable PWA for balancing a reading sprint with YouTube and TV/film. Book duration is estimated at two minutes per page; YouTube and TV share a media allowance that never exceeds the planned reading time.

## How it works

- One active sprint at a time, with an inclusive due date.
- Daily targets are recalculated from each category's remaining time.
- Item progress is entered as a percentage or completed with one tap.
- A finished sprint archives automatically; only the five newest archives are retained.
- All sprint data lives in IndexedDB in the current browser. There is no account, analytics, or remote data API.

Browser site-data clearing removes local sprint history, and data does not automatically follow you to another browser or device.

## Development

```sh
npm install
npm run dev
```

Run all checks with `npm run check`.

## GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push `main`. The included workflow tests, builds, and deploys the app.

The configured production path is `/sprint/`.
