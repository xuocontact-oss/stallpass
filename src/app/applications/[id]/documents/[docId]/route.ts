import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createAdminClient, createClient } from "@/lib/supabase/server"

/**
 * Opens a document attached to an application. The security rules decide
 * whether you may see the application (the vendor, the market's organizer or
 * the admin). Only then is a 60-second link made.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/applications/[id]/documents/[docId]">) {
  const { id, docId } = await ctx.params
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(docId).success) {
    return new NextResponse("Not found", { status: 404 })
  }
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("application_documents")
    .select("file_path")
    .eq("id", docId)
    .eq("application_id", id)
    .maybeSingle()
  if (!doc) return new NextResponse("Not found", { status: 404 })

  // Organizers can't read the vendor's storage folder directly, so the signed
  // link is made with full access, after the check above.
  const { data } = await createAdminClient().storage.from("vendor-documents").createSignedUrl(doc.file_path, 60)
  if (!data) return new NextResponse("File not found", { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
