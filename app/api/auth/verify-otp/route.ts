import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^5\d{9}$/.test(digits)) return `0${digits}`;
  if (/^0\d{10}$/.test(digits)) return digits;
  if (/^90(5\d{9})$/.test(digits)) return `0${digits.slice(2)}`;
  return digits;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const code = String(body.code || "").replace(/\D/g, "");

    if (!/^0\d{10}$/.test(phone) || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Telefon ve 6 haneli doğrulama kodu gerekli." },
        { status: 400 },
      );
    }

    const client = getSupabaseServerClient();
    const { data: verification, error } = await client
      .from("phone_verifications")
      .select("id, code, expires_at, verified")
      .eq("phone", phone)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!verification) {
      return NextResponse.json(
        { error: "Aktif doğrulama kodu bulunamadı. Yeni kod isteyin." },
        { status: 404 },
      );
    }
    if (new Date(verification.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Doğrulama kodunun süresi dolmuş. Yeni kod isteyin." },
        { status: 400 },
      );
    }
    if (verification.code !== code) {
      return NextResponse.json(
        { error: "Hatalı veya süresi dolmuş kod." },
        { status: 400 },
      );
    }

    const { error: updateError } = await client
      .from("phone_verifications")
      .update({ verified: true })
      .eq("id", verification.id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kod doğrulanamadı." },
      { status: 500 },
    );
  }
}
