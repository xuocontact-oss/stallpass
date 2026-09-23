# Stallpass

Vendor-first platform for pop-up food vendors, food trucks and markets.
Next.js + Supabase + (later) Stripe Connect + Resend. Deploys to Vercel.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the app at http://localhost:3000 |
| `npm run seed` | Rebuilds the SAMPLE vendors and markets (never touches real data) |
| `npm run make-admin -- you@email.com` | Makes that account the super admin |
| `npm run db:sql` | Copies the newest database update so you can paste it into Supabase |
| `npm test` | Logic tests + security-rule tests |

## Sample logins

Password for all: `stallpass-demo-2026` (use "Sign in with a password instead")

- `demo-tacos@example.com`: taco truck with valid, expiring and expired documents
- `demo-bakery@example.com`: everything valid
- `demo-coffee@example.com`: only a health permit (expiring soon)

## How it's organized

- `supabase/migrations/`: database tables and security rules (Row Level Security on every table)
- `src/app/`: pages (`/dashboard`, `/documents`, `/profile`, `/markets`, `/admin`)
- `src/actions/`: server code that saves things (every action re-checks permissions)
- `src/lib/`: shared logic (document status, market filters, reminders, email)
- `tests/`: `security.test.mjs` runs the real migrations in a throwaway database and tries to break the rules

## Secrets

Real keys live in `.env.local`, which is never committed. See `.env.example` for the list.

## Reminder emails

`/api/cron/reminders` runs daily on Vercel (see `vercel.json`) and needs `CRON_SECRET`.
Locally, use **Admin → Run reminders now**.
