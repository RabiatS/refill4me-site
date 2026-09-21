# refill4me.com

The public site and the web app for Refill Me, served by GitHub Pages at
refill4me.com. Static files, no build step.

```
index.html           landing page: what it is, how it works, pilot sign up
privacy.html         privacy policy (pilot version)
terms.html           terms of service (pilot version)
support.html         help and contact
app/                 the web app: sign in, shop, refills, orders, store counter
config.js            public config: Supabase URL and anon key, App Store link, contact email
assets/              styles, icons, screenshots
```

## The web app

`app/` is a hash-routed single page app on supabase-js, sharing the backend
in the `refill4me` repo with the iPhone app. Same accounts, same orders.

With empty keys in `config.js`, or with `?demo` on the URL, it runs on an
in-browser twin of the backend with the pilot catalogue: sign in as
`amaka@example.com` (shopper) or `owner@example.com` (store) with the password
`password`. Nothing leaves the browser. `app/pilot-catalogue.js` is generated
from the seed migration by `refill4me/scripts/sync-pilot-catalogue.py`.

## Local preview

```
python3 -m http.server 8787
```

then open http://localhost:8787/ and http://localhost:8787/app/?demo.

## Going live

1. Fill `config.js` with the Supabase project URL and anon key (the
   `refill4me` repo's `scripts/backend-up.sh` prints them).
2. Push to `main`; GitHub Pages serves it.
3. Point the domain at GitHub Pages (records in the `refill4me` repo's
   docs/domain.md).
