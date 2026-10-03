import { createHash, randomInt } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

const OTP_TTL_MINUTES = 10;

const WELCOME_REPLY =
  "Merhaba! ⚽ Bağmancı Halı Saha canlı rezervasyon sistemine hoş geldiniz.\nCanlı saha durumunu görmek ve hemen rezervasyon yapmak için:\n👉 https://bagmancihalisaha.com.tr";

function normalizeLocalPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (/^5\d{9}$/.test(digits)) return `0${digits}`;
  if (/^0\d{10}$/.test(digits)) return digits;
  if (/^90(5\d{9})$/.test(digits)) return `0${digits.slice(2)}`;
  return digits;
}

function hashCode(phone: string, code: string) {
  const secret =
    process.env.WHATSAPP_OTP_SECRET ||
    process.env.WHATSAPP_TOKEN ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    "local-dev-secret";
  return createHash("sha256").update(`${phone}:${code}:${secret}`).digest("hex");
}

async function sendOtpReply(from: string) {
  const localPhone = normalizeLocalPhone(from);
  const formattedPhone = from.replace(/\D/g, "");
  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  const client = getSupabaseServerClient();

  const { error } = await client.from("whatsapp_phone_verifications").insert({
    phone: localPhone,
    formatted_phone: formattedPhone,
    code_hash: hashCode(formattedPhone, code),
    expires_at: expiresAt,
  });

  if (error) throw error;

  const result = await sendWhatsAppTextMessage({
    to: formattedPhone,
    text: `Bagmanci Hali Saha dogrulama kodunuz: ${code}. Kod 10 dakika gecerlidir.`,
  });

  if (!result.ok) {
    console.error("WhatsApp OTP gönderimi başarısız:", {
      to: formattedPhone,
      status: result.status,
      error: result.data?.error,
    });
    throw new Error(result.data?.error?.message || "WhatsApp doğrulama kodu gönderilemedi.");
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    "bagmanci_halisaha_secret_verify_123";

  if (mode === "subscribe" && token && token === verifyToken) {
    return new Response(challenge || "", { status: 200 });
  }

  return NextResponse.json({ error: "Webhook doğrulanamadı." }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const messages =
      payload?.entry?.flatMap((entry: any) =>
        entry?.changes?.flatMap((change: any) => change?.value?.messages || []) || [],
      ) || [];

    if (!messages.length) {
      return NextResponse.json({ success: true });
    }

    await Promise.all(
      messages.map(async (message: any) => {
        if (message.type !== "text") return;
        const from = String(message.from || "").trim();
        const incomingText = String(message.text?.body || "").trim();
        if (!from || !incomingText) return;

        try {
          if (/^kod(?:\s|$)/i.test(incomingText)) {
            await sendOtpReply(from);
            return;
          }

          const result = await sendWhatsAppTextMessage({
            to: from,
            text: WELCOME_REPLY,
            apiVersion: "v21.0",
          });
          if (!result.ok) {
            console.error("WhatsApp karşılama yanıtı gönderilemedi:", {
              status: result.status,
              error: result.data?.error,
            });
          }
        } catch (error) {
          console.error("WhatsApp gelen mesajı yanıtlanamadı:", {
            error: error instanceof Error ? error.message : "Bilinmeyen hata",
          });
        }
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook payload işlenemedi:", error);
    return NextResponse.json({ success: true });
  }
}
