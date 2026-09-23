import { NextResponse, type NextRequest } from "next/server"
import { MAX_EMAILS_PER_RUN, runDocumentReminders } from "@/lib/reminders"
import { runSalesReminders } from "@/lib/sales-reminders"
import { runSetupNudges } from "@/lib/setup-nudges"

/**
 * The daily reminder job. Vercel Cron calls this address once a day (see
 * vercel.json) and proves it's allowed by sending CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 })
  }
  try {
    const documents = await runDocumentReminders()
    // Setup reminders use whatever is left of the day's email budget.
    let left = MAX_EMAILS_PER_RUN - documents.emailsSent
    const sales = await runSalesReminders(Math.max(0, Math.min(150, left)))
    left -= sales.sent
    const setup = await runSetupNudges(Math.max(0, Math.min(100, left)))
    return NextResponse.json({ ...documents, salesReminders: sales, setupNudges: setup })
  } catch (e) {
    console.error("Reminder job failed:", e)
    return NextResponse.json({ error: "Reminder job failed" }, { status: 500 })
  }
}
