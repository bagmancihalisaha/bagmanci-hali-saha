import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";
import { sendBookingReminderMessage } from "@/lib/whatsapp";

async function isAdminAtAal2(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return false;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return false;

  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload.aal === "aal2";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let approved = false;
  try {
    if (!(await isAdminAtAal2(req))) {
      return NextResponse.json({ error: "Admin girişi ve 2FA gerekli." }, { status: 403 });
    }

    const { bookingId, action } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId gerekli." }, { status: 400 });
    }
    if (action !== "approve" && action !== "reminder") {
      return NextResponse.json({ error: "Geçersiz rezervasyon işlemi." }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    if (action === "approve") {
      const { error: updateError } = await client
        .from("booking_requests")
        .update({ payment_status: "approved" })
        .eq("id", bookingId);
      if (updateError) throw updateError;
      approved = true;
    }

    const { data: booking, error } = await client
      .from("booking_requests")
      .select("customer_name, phone, booking_date, booking_time, duration_hours, total_amount, deposit_amount, paid_amount, payment_status")
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw error;
    if (!booking) {
      return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
    }

    const result = await sendBookingReminderMessage(booking);
    if (!result.ok) {
      const metaError = result.data?.error;
      return NextResponse.json(
        {
          error: metaError?.message || "WhatsApp rezervasyon mesajı gönderilemedi.",
          metaCode: metaError?.code,
          details: metaError,
          approved: action === "approve",
        },
        { status: result.status },
      );
    }

    const { error: trackingError } = await client
      .from("booking_requests")
      .update(action === "approve" ? { whatsapp_confirmed: true } : { reminder_sent: true })
      .eq("id", bookingId);
    const trackingWarning = trackingError
      ? "WhatsApp gönderildi ancak takip alanları Supabase'de bulunamadı; supabase/migrations/20261003000000_booking_whatsapp_tracking.sql dosyasını uygulayın."
      : undefined;

    return NextResponse.json({ success: true, data: result.data, approved: action === "approve", reminderSent: action === "reminder", trackingWarning });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Rezervasyon mesajı gönderilemedi.",
        approved,
      },
      { status: 500 },
    );
  }
}
