# Couple Planner Pro

Realtime couple planner built with React + Vite + Supabase (Auth, Postgres, Realtime).

## Local Development

Prerequisites:
- Node.js 18+

Steps:
1. Install dependencies:
   - `npm install`
2. Create `.env.local` from `.env.example` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Optional: `VITE_DEBUG_SYNC=false`
3. In Supabase SQL Editor, run [supabase-schema.sql](supabase-schema.sql).
4. Start app:
   - `npm run dev`

## Supabase Auth Configuration

In Supabase Dashboard:
- Authentication → Providers → enable `Google`.
- Authentication → URL Configuration:
  - Set **Site URL** to your frontend URL.
  - Add **Redirect URLs** for local and production.

Example URLs:
- Local: `http://localhost:5173`
- Vercel production: `https://your-project.vercel.app`
- (Optional) custom domain: `https://yourdomain.com`

## Vercel Deployment

1. Import this repo into Vercel.
2. Framework preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add Environment Variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Optional: `VITE_DEBUG_SYNC=false`
6. Deploy.

After deployment, add the Vercel URL(s) to Supabase Auth URL configuration.

## Google OAuth Console Checklist

In Google Cloud Console (OAuth client used by Supabase):
- Add authorized redirect URI from Supabase provider settings.
- Ensure your app domain(s) are listed in authorized JavaScript origins where required.
- If using custom domain on Vercel, add both Vercel and custom domain URLs to Supabase + Google config.

## Production Notes

- Debug sync logs are disabled by default (`VITE_DEBUG_SYNC=false`).
- Realtime sync is planner-scoped through `planner_state` and RLS-protected tables.
