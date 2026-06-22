# value_tweet.exe

Local Vite + React app for `value-tweet-gen`.

Try it:

```bash
cd "c:\\Users\\HP\\Downloads\\value-tweet-exe"
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

Notes:
- The UI calls the Anthropics API in `src/App.jsx` — add your API key and proxy as needed.
- If you prefer yarn: `yarn` then `yarn dev`.

Serverless proxy & deployment
This repo includes example serverless proxies for Anthropic and Polymarket for both Vercel (`/api/*.js`) and Netlify (`/netlify/functions/*.js`).
Set `ANTHROPIC_API_KEY` in your deployment environment variables (Netlify/Vercel) or in a local `.env` when testing locally.

Vercel deploy
1. Push to a Git provider and import the project in Vercel. Vercel will detect `vercel.json` and deploy static site + functions.
2. Set environment variable `ANTHROPIC_API_KEY` in your Vercel project settings.
3. (Optional) To protect the proxy, set `PROXY_KEY` in your Vercel env and set `VITE_PROXY_KEY` as a build-time variable with the same value so the client can call the proxy during dev/preview. For production, prefer not to expose `VITE_PROXY_KEY` publicly.

Netlify deploy
1. Push repository to Git provider and connect in Netlify.
2. In Netlify site settings add `ANTHROPIC_API_KEY` under build & deploy > Environment.
3. Netlify will build the site and publish functions from `netlify/functions`.
4. (Optional) Add `PROXY_KEY` to Netlify env and, for local dev, create a `.env` with `VITE_PROXY_KEY` set to the same value so the client can call functions during development.

Security
- Do NOT commit your real API key. Use environment variables.
- The serverless proxies forward requests to Anthropic; rate-limit or add access controls before public use.
- To enable basic access control, set `PROXY_KEY` in your deployment environment. The serverless functions will require the header `x-proxy-key` to match that secret. For local development, set `VITE_PROXY_KEY` (in `.env`) to allow the client to call the proxy during dev.

Deploy badges
- Vercel: replace REPO_URL with your git repo URL in the link below and use it to import the project quickly:

- https://vercel.com/new/clone?repository-url=REPO_URL

- Netlify: use the deploy button below after adjusting `REPO_URL`:

- https://app.netlify.com/start/deploy?repository=REPO_URL

Local verification checklist
- Ensure Node and npm are installed: `node -v` and `npm -v`.
- Install deps: `npm install`.
- Run dev site: `npm run dev`.
- To test functions locally:
	- Vercel: `vercel dev` (install `vercel` CLI)
	- Netlify: `netlify dev` (install `netlify-cli`)

