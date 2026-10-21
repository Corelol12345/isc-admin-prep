# ISC Admin Prep

Practice exam for the SailPoint Identity Security Administrator certification (DOMC format, 151-question bank, performance dashboard).

## Deploy

Static site served by Cloudflare Workers (`public/`). Set the custom domain in `wrangler.jsonc`, then:

    npx wrangler deploy

With Cloudflare Workers Builds connected to this repository, every push to `main` deploys automatically.
