# ISC Prep

Practice exams for the SailPoint Identity Security Administrator and Identity Security Engineer certifications (DOMC format, question banks per exam, performance dashboard).

## Deploy

Static site served by Cloudflare Workers (`public/`). Set the custom domain in `wrangler.jsonc`, then:

    npx wrangler deploy

With Cloudflare Workers Builds connected to this repository, every push to `main` deploys automatically.
