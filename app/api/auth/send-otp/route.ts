import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";
import { formatPhoneNumber, sendPhoneVerificationCode } from "@/lib/whatsapp";

const OTP_TTL_MS = 5 * 60 * 1000;

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

    if (!/^0\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: "Geçerli bir 11 haneli telefon numarası girin." },
        { status: 400 },
      );
    }

    const client = getSupabaseServerClient();
    const now = new Date();
    const { data: recent, error: recentError } = await client
      .from("phone_verifications")
      .select("created_at")
      .eq("phone", phone)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentError) throw recentError;

    if (recent) {
      return NextResponse.json(
        { error: "Yeni kod istemeden önce biraz bekleyin." },
        { status: 429 },
      );
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
    const { error: insertError } = await client
      .from("phone_verifications")
      .insert({ phone, code, expires_at: expiresAt, verified: false });

    if (insertError) throw insertError;

    const result = await sendPhoneVerificationCode(formatPhoneNumber(phone), code);
    if (!result.ok) {
      await client
        .from("phone_verifications")
        .delete()
        .eq("phone", phone)
        .eq("code", code);
      const metaCode = result.data?.error?.code;
      const errorMessage = metaCode === 132001
        ? "WhatsApp'ta telefon_dogrulama adlı onaylı Türkçe OTP şablonu bulunamadı. Meta Business Suite'te Authentication kategorisinde şablonu oluşturup onaylatın."
        : result.data?.error?.message || "WhatsApp doğrulama kodu gönderilemedi.";
      return NextResponse.json(
        {
          error: errorMessage,
          metaCode,
          details: result.data?.error,
        },
        { status: result.status || 502 },
      );
    }

    return NextResponse.json({
      success: true,
      expiresAt,
      messageId: (result.data as { messages?: { id?: string }[] } | null)?.messages?.[0]?.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Doğrulama kodu gönderilemedi." },
      { status: 500 },
    );
  }
}
