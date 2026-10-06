# Folio Foundry

A responsive portfolio builder for creating, editing, previewing, generating, and publishing personal portfolio websites.

## Project documentation

- **Title:** Folio Foundry — Portfolio Template Generator
- **Description:** Enter personal information, profile photo, education, skills, projects, experience, and social links; select a design; preview and publish a shareable portfolio.
- **Technologies:** React, Vite, JavaScript, CSS, Lucide icons
- **Cloud database:** Supabase Postgres, Supabase Auth, and Supabase Storage
- **Hosting:** Vercel
- **Published website URL:** [https://folio-foundry-alpha.vercel.app](https://folio-foundry-alpha.vercel.app)
- **Portfolio designs:** Exactly three selectable templates — **Simple** (clean and professional), **Modern** (blue-accented project cards and structured sections), and **Creative** (warm colors, asymmetrical portrait, and offset project cards).
- **Database structure:** `public.folio_foundry_portfolios` stores the owner UUID, unique URL slug, full name, selected template, remaining portfolio information as JSONB, public profile photo URL, publish status, and creation/update timestamps. Row-level security lets a visitor read published portfolios and restricts editing/deletion to the portfolio owner. Profile images use the `folio-foundry-photos` Storage bucket.

### Screenshots

The following screenshots use fictional sample data:

**Home page and information builder**

![Home page and portfolio information builder](docs/screenshots/home-and-builder.png)

**Simple template**

![Generated Simple portfolio](docs/screenshots/template-simple.png)

**Modern template**

![Generated Modern portfolio](docs/screenshots/template-modern.png)

**Creative template**

![Generated Creative portfolio](docs/screenshots/template-creative.png)

**Manage portfolio**

![Manage, preview, edit, and delete portfolio screen](docs/screenshots/manage-portfolio.png)

## Run locally

```sh
npm install
npm run dev
```

Without Supabase configuration, the builder supports browser-local drafts and previews so you can try it. Configure Supabase before deployment to enable cloud saves, image uploads, data retrieval, editing/deletion, and public portfolio links.

## Configure Supabase

1. In your Supabase project, run `supabase/migrations/20261006000000_create_portfolios.sql` in its SQL Editor. The migration creates the app-prefixed table, row-level security policies, and profile-photo bucket without reusing generic table or bucket names from other projects.
2. In **Authentication → Providers → Anonymous Sign-Ins**, enable anonymous sign-ins.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**.
4. Restart the development server.

The app uses anonymous Supabase Auth sessions and row-level security. Visitors can read only published portfolio records; each builder session can manage only its own records. Never put a Supabase service-role key in frontend environment variables. Only use the project's public anon/publishable key in the frontend.

## Publish with Vercel

1. Push this project to a Git provider and import the repository in [Vercel](https://vercel.com/new).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Vercel project's environment variables.
3. Deploy. Vercel builds with `npm run build`; `vercel.json` routes `/p/:slug` to the app so public portfolio links load directly.
4. Redeploy after changing environment variables.

The public link for a portfolio is `https://folio-foundry-alpha.vercel.app/p/your-portfolio-slug`. Each user can save and manage their portfolio from the same browser session used to create it.
