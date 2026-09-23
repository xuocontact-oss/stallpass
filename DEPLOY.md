# Putting Stallpass live (Netlify)

Plain-English checklist. Do the steps in order. Budget about 1–2 hours the first time.
Anything marked **SECRET** must never be shared, posted, or committed to GitHub.

You'll end up with:

- **Test project** (what you have now): your laptop, sample data. Keep it for trying things.
- **Live project**: a brand-new, empty Supabase project + Netlify website. Real users only. Sample data can never go here.

---

## 1. Put the code on GitHub (10 min)

1. Create a free account at **github.com**.
2. Click **+ → New repository**. Name it `stallpass`, choose **Private**, don't add a README. Click **Create**.
3. GitHub shows a box "…or push an existing repository from the command line". In Terminal, run:
   ```
   cd ~/Desktop/stallpass
   git remote add origin https://github.com/YOUR-USERNAME/stallpass.git
   git push -u origin main
   ```
   (GitHub may ask you to sign in; follow its prompts.)

## 2. Create the live database (15 min)

1. **supabase.com** → **New project**. Name `stallpass-live`, region **West US**, save the password.
   - Recommended: upgrade this project to **Pro ($25/mo)** before launch. Free projects pause after a week without visitors and have no daily backups.
2. In Terminal: `npm run db:all`. This copies the **whole** database setup.
3. Supabase → **SQL Editor → New query → Cmd+V → Run** → "Success".
4. **Project Settings → API Keys**: copy the **Project URL**, **Publishable key** and **Secret key** (SECRET). You'll paste them into Netlify in step 4.

## 3. Email that reaches everyone (15 min)

Without this, only you can receive sign-in links. Free option: a Gmail account.

1. Make (or use) a Gmail account for the business, e.g. `stallpass.app@gmail.com`.
2. Google Account → **Security** → turn on **2-Step Verification**.
3. Google Account → search **"App passwords"** → create one called `Stallpass`. Copy the 16-letter password (SECRET).
4. **Sign-in emails** (sent by Supabase): live Supabase project → **Authentication → Emails → SMTP Settings** → enable **Custom SMTP**:
   - Sender email: your Gmail address · Sender name: `Stallpass`
   - Host: `smtp.gmail.com` · Port: `465`
   - Username: your Gmail address · Password: the app password
5. **App emails** (reminders, applications, receipts) use the same Gmail. Its settings go into Netlify in step 4.

Gmail sends up to about 500 emails a day. When you buy your own domain later, switch to Resend (see "Later" below).

## 4. Create the website on Netlify (15 min)

1. **netlify.com** → sign up with your GitHub account.
2. **Add new site → Import an existing project → GitHub → stallpass**.
3. Build settings are read from `netlify.toml`; leave them as they are.
4. Before the first deploy, open **Site configuration → Environment variables** and add:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | your Netlify address, e.g. `https://stallpass.netlify.app` (no slash at the end) |
   | `NEXT_PUBLIC_SUPABASE_URL` | live project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | live publishable key |
   | `SUPABASE_SECRET_KEY` | live secret key (SECRET) |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | your Gmail address |
   | `SMTP_PASS` | the Gmail app password (SECRET) |
   | `EMAIL_FROM` | `Stallpass <your Gmail address>` |
   | `CRON_SECRET` | a long random string (run `openssl rand -hex 32` in Terminal) (SECRET) |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | the email people can contact you at |
   | `NEXT_PUBLIC_LEGAL_NAME` | your business's legal name (e.g. your LLC) |

   **Do NOT add** `EMAIL_TEST_RECIPIENT` (that's only for testing; it would send every email to you).

5. **Deploy**. When it's done, Netlify shows your address. To change the name: **Site configuration → Change site name** (then update `NEXT_PUBLIC_SITE_URL` and redeploy).

## 5. Connect the website and database (5 min)

Live Supabase → **Authentication → URL Configuration**:

- **Site URL**: your Netlify address
- **Redirect URLs**: add `https://YOUR-SITE.netlify.app/**`

## 6. Make yourself the admin (2 min)

1. On the live site, sign up with your email and pick any option.
2. Live Supabase → **SQL Editor**:
   ```sql
   update public.profiles set is_super_admin = true where email = 'you@example.com';
   ```
3. Refresh the site: you'll see **Admin**.

## 7. "I'm not a robot" check (10 min, recommended)

1. **dash.cloudflare.com** (free account) → **Turnstile → Add widget**. Hostname: your Netlify address (without https://). Mode: **Managed**.
2. Copy the **Site key** → Netlify env var `NEXT_PUBLIC_TURNSTILE_SITE_KEY` → redeploy.
3. Copy the **Secret key** (SECRET) → live Supabase → **Authentication → Attack Protection** → enable **Captcha**, choose **Turnstile**, paste it.
   Do step 2 before step 3, or sign-in will stop working until the site key is live.

## 8. Fill the directory

- Add markets in **Admin → Markets**, and/or import the USDA list (needs the free USDA key):
  in `.env.local`, temporarily set the live project's `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` and your `USDA_API_KEY`, then run
  `npm run import:usda -- --state=CA` (put your test keys back afterwards).
- **Admin → Start hub**: re-check every link, replace sample kitchens with real ones, add partners.

## 9. Card payments (optional; you can launch with payment links only)

1. Stripe dashboard → switch to **Live mode** → complete account activation (business details, bank account).
2. **Connect → Settings**: make sure Connect is enabled for your platform.
3. **Developers → API keys** → Secret key (`sk_live_…`, SECRET) → Netlify env var `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-SITE.netlify.app/api/stripe/webhook`
   - **Listen to: Events on Connected accounts**
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `account.updated`
   - Copy the **Signing secret** (`whsec_…`, SECRET) → Netlify env var `STRIPE_WEBHOOK_SECRET` → redeploy.

## 10. Before announcing

- [ ] Have a lawyer read `/terms` and `/privacy` (they're drafts). Update `LEGAL_UPDATED` in `src/lib/site.ts` if anything changes.
- [ ] Test on your phone: sign up as a vendor (all 4 steps), upload a document, apply to a market.
- [ ] Test as an organizer: claim a market (approve it in Admin), accept an application.
- [ ] Check an email arrives in a *non-Gmail* inbox (and not in spam).
- [ ] Netlify → **Functions** → `daily-reminders` shows as scheduled.
- [ ] Invite 5–10 real vendors for a quiet beta.

---

## Later

- **Your own domain** (~$12/yr): buy it, then Netlify → **Domain management → Add a domain**. Update `NEXT_PUBLIC_SITE_URL` and the Supabase URLs. For better email, verify the domain in **Resend** and use Resend's SMTP details in both places instead of Gmail.
- **Updating the site**: every `git push` redeploys automatically. Database changes (new files in `supabase/migrations`) must be pasted into the **live** SQL Editor too, in order.
