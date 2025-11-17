# Welcome to your Lovable project

## Project info

**URL**: (https://tittooin.github.io/cine-dreamer-forge/)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Tittoos Project](https://tittooin.github.io/cine-dreamer-forge/) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Tittoos](https://tittooin.github.io/cine-dreamer-forge/) and click on Share -> Publish.


## Poster Editor Cloud Setup (Phase 3)

This section documents the cloud integration for `/poster` using Supabase and Cloudflare R2.

### Prerequisites
- Supabase project with URL and anon key
- Cloudflare R2 account, buckets for `assets` and `previews`
- GitHub Actions set up for deploying Supabase Edge Functions (already present in `.github/workflows/deploy-supabase-functions.yml`)

### Environment Variables
Create a `.env` (local dev) based on the provided `.env.example`:

Client (Vite):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Supabase Edge Functions secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_ASSETS`
- `R2_BUCKET_PREVIEWS`
- `R2_PUBLIC_BASE_URL`

### Database Migrations
Run the SQL migration `supabase/migrations/20251117_poster_editor_cloud.sql` to create tables and RLS policies:
- `projects` (per-user)
- `assets` (public read, per-user write)
- `templates` (public read, per-user write)

### Edge Functions
New functions under `supabase/functions/`:
- `get-upload-url`: returns presigned PUT URL to upload to R2
- `generate-thumbnail`: fetches image, generates a small JPEG, uploads to R2
- `list-assets`: lists assets with optional `category`, paginated

Deploy via Supabase CLI or GitHub Actions. Ensure function secrets are set in Supabase.

### Routes and Pages
- `/poster`: Fabric.js editor with cloud login, save, assets/templates cloud mode
- `/poster/my-projects`: dashboard to list, search, rename, duplicate, delete projects

### Notes
- LocalStorage is used as fallback when logged out
- Bundle size remains minimal; Fabric loads only on `/poster`


