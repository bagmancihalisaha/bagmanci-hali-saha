import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";

const BUCKET = "payment-proofs";

async function isAdminAtAal2(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return false;

  const authClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return false;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload.aal === "aal2";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAtAal2(request))) {
    return NextResponse.json({ error: "Admin girişi ve 2FA gerekli." }, { status: 403 });
  }

  try {
    const { bookingId } = await request.json();
    if (typeof bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      return NextResponse.json({ error: "Geçersiz rezervasyon." }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const { data: booking, error } = await client
      .from("booking_requests")
      .select("notes")
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!booking) return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });

    const path = String(booking.notes || "").match(/\[payment-proof:([^\]]+)\]/)?.[1];
    if (!path || !path.startsWith(`${bookingId}/`) || path.includes("..")) {
      return NextResponse.json({ error: "Bu rezervasyona ait dekont bulunamadı." }, { status: 404 });
    }

    const { data: signed, error: signedError } = await client.storage
      .from(BUCKET)
      .createSignedUrl(path, 300);
    if (signedError) throw signedError;

    return NextResponse.json({
      url: signed.signedUrl,
      type: path.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dekont açılamadı." },
      { status: 500 },
    );
  }
}
