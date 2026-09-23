/**
 * Runs once a day on Netlify (8am Los Angeles time in winter, 7am in summer)
 * and triggers the document-expiry reminder emails.
 */
export default async function dailyReminders() {
  const site = process.env.URL
  const secret = process.env.CRON_SECRET
  if (!site || !secret) {
    console.error("daily-reminders: URL or CRON_SECRET is missing")
    return
  }
  const res = await fetch(`${site}/api/cron/reminders`, { headers: { Authorization: `Bearer ${secret}` } })
  console.log("daily-reminders:", res.status, await res.text())
}

export const config = { schedule: "0 15 * * *" }
