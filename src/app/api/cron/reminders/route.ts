import { NextResponse, type NextRequest } from "next/server"
import { runDocumentReminders } from "@/lib/reminders"

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
    return NextResponse.json(await runDocumentReminders())
  } catch (e) {
    console.error("Reminder job failed:", e)
    return NextResponse.json({ error: "Reminder job failed" }, { status: 500 })
  }
}
