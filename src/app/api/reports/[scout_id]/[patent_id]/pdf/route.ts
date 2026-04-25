import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ scout_id: string; patent_id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { scout_id, patent_id } = await context.params;
  const { supabase, user } = await requireUser();

  const { data: report, error } = await supabase
    .from("opportunity_reports")
    .select("id, pdf_storage_path, scouts!inner(id, user_id)")
    .eq("scout_id", scout_id)
    .eq("patent_id", patent_id)
    .eq("scouts.user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to resolve report authorization." },
      { status: 500 },
    );
  }

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  if (!report.pdf_storage_path) {
    return NextResponse.json(
      { error: "PDF is not available for this report yet." },
      { status: 409 },
    );
  }

  const bucket = process.env.REPORT_BUCKET_NAME ?? "opportunity-reports";
  const normalizedPath = report.pdf_storage_path.replace(/^\/+/, "");

  const { data: signed, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(normalizedPath, 60 * 10);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Unable to generate an authorized PDF URL." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
