import { createHash, randomInt } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

type ReadyReply = {
  keyword: string;
  response_text: string;
  active: boolean;
};

const defaultReplies: ReadyReply[] = [
  {
    keyword: "fiyat",
    response_text:
      "Gunduz tarifesi 1200 TL, gece tarifesi 1800 TL. Rezervasyon icin web sitemizden gun ve saat secebilirsiniz.",
    active: true,
  },
  {
    keyword: "rezervasyon",
    response_text:
      "Rezervasyon icin web sitesindeki takvimden musait gun ve saati secmeniz yeterli. Odeme/dekont sonrasi kaydiniz kesinlesir.",
    active: true,
  },
  {
    keyword: "adres",
    response_text:
      "Bagmanci Hali Saha Sanliurfa. Konum icin web sitemizdeki iletisim bolumunu acabilirsiniz.",
    active: true,
  },
];

const OTP_TTL_MINUTES = 10;

function getAutoReply(text: string) {
  if (["konum", "adres", "neresi"].some((word) => text.includes(word))) {
    return "Merhaba! Bağmancı Halı Saha Tesislerimize bekleriz. ⚽\n📍 Adres: Bağmancı Halı Saha Tesisleri, Şanlıurfa\n🗺️ Konum Linki: https://maps.google.com/?q=Bagmanci+Hali+Saha\nTesisimizde park yeri ve kafeterya mevcuttur!";
  }
  if (["fiyat", "ücret"].some((word) => text.includes(word))) {
    return "⚽ Güncel Saha Kiralama Tarifemiz:\n☀️ Gündüz Maçları: ₺1.200 / saat\n🌙 Gece (Işıklandırmalı): ₺1.800 / saat\nDüzenli haftalık aboneliklerde özel indirimler uygulanmaktadır!";
  }
  if (["boş saat", "rezervasyon"].some((word) => text.includes(word))) {
    return "📅 Canlı saha takvimini incelemek ve hemen boş saatleri ayırtmak için sitemizi ziyaret edebilirsiniz:\n👉 https://bagmancihalisaha.com.tr\nTakımını topla, sahanı hemen ayır!";
  }
  if (["abone", "sabit"].some((word) => text.includes(word))) {
    return "🏆 Sabit haftalık maç aboneliği talebiniz alınmıştır! Tesis yetkilimiz en kısa sürede sizinle iletişime geçecektir. Dilerseniz tercih ettiğiniz gün ve saat aralığını buradan iletebilirsiniz.";
  }
  return null;
}

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

    const client = getSupabaseServerClient();
    const { data } = await client
      .from("whatsapp_ready_replies")
      .select("keyword, response_text, active")
      .eq("active", true)
      .order("priority", { ascending: true });
    const replies = data?.length ? data : defaultReplies;

    await Promise.all(
      messages.map(async (message: any) => {
        const from = message.from;
        const incomingText = String(message.text?.body || "").toLocaleLowerCase("tr-TR");
        if (!from || !incomingText) return;

        if (incomingText.trim() === "kod" || incomingText.trim().startsWith("kod ")) {
          console.log("WhatsApp OTP isteği alındı:", { from });
          await sendOtpReply(from);
          return;
        }

        const autoReply = getAutoReply(incomingText);
        const matched = replies.find((reply) =>
          incomingText.includes(reply.keyword.toLocaleLowerCase("tr-TR")),
        );
        const responseText = autoReply || matched?.response_text;

        if (responseText) {
          const result = await sendWhatsAppTextMessage({ to: from, text: responseText });
          if (!result.ok) {
            console.error("WhatsApp otomatik yanıtı gönderilemedi:", {
              status: result.status,
              error: result.data?.error,
            });
          }
        }
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook işlenemedi." },
      { status: 500 },
    );
  }
}
