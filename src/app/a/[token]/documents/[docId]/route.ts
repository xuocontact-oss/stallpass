import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { findSharedApplication } from "@/lib/share"

/** Opens one attached document from a market's email link (60-second link). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/a/[token]/documents/[docId]">) {
  const { token, docId } = await ctx.params
  if (!z.uuid().safeParse(docId).success) return new NextResponse("Not found", { status: 404 })
  const found = await findSharedApplication(token)
  if (!found || found.expired) return new NextResponse("This link has expired.", { status: 404 })

  const { data: doc } = await found.db
    .from("application_documents")
    .select("file_path")
    .eq("id", docId)
    .eq("application_id", found.app.id)
    .maybeSingle()
  if (!doc) return new NextResponse("Not found", { status: 404 })

  const { data } = await found.db.storage.from("vendor-documents").createSignedUrl(doc.file_path, 60)
  if (!data) return new NextResponse("File not found", { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
