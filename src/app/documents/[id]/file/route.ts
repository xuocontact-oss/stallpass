import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

/**
 * Opens a document file. The file itself is private; this makes a link that
 * works for 60 seconds, and only if the security rules say you may see it.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/documents/[id]/file">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 })

  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("vendor_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle()
  if (!doc) return new NextResponse("Not found", { status: 404 })

  const { data, error } = await supabase.storage
    .from("vendor-documents")
    .createSignedUrl(doc.file_path, 60)
  if (error || !data) return new NextResponse("File not found", { status: 404 })

  return NextResponse.redirect(data.signedUrl)
}
