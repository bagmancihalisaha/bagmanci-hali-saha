import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10) return `0${digits}`;
  return digits;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ref = (params.get("ref") || "").trim();
  const refPhone = /^\+?[\d\s()-]+$/.test(ref) ? ref : "";
  const phone = normalizePhone(refPhone || params.get("phone") || "");
  const isPhone = /^0\d{10}$/.test(phone);
  const isReference = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref);

  if (!isPhone && !isReference) {
    return NextResponse.json({ booking: null }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const client = getSupabaseServerClient();
    const todayParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const today = `${todayParts.find((part) => part.type === "year")?.value}-${todayParts.find((part) => part.type === "month")?.value}-${todayParts.find((part) => part.type === "day")?.value}`;
    let query = client
      .from("booking_requests")
      .select("id, payment_token, booking_date, booking_time, duration_hours, package_name, total_amount, deposit_amount, paid_amount, payment_status")
      .gte("booking_date", today)
      .neq("payment_status", "rejected");

    query = isReference
      ? query.or(`id.eq.${ref},payment_token.eq.${ref}`)
      : query.eq("phone", phone);
    const { data, error } = await query.order("booking_date").order("booking_time").limit(20);
    if (error) throw error;

    const now = Date.now();
    const booking = (data || []).find((item) =>
      new Date(`${item.booking_date}T${item.booking_time}:00+03:00`).getTime() > now,
    );
    if (!booking) {
      return NextResponse.json({ booking: null }, { headers: { "Cache-Control": "no-store" } });
    }

    const paymentUrl = `/odeme?booking=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(booking.payment_token)}`;
    return NextResponse.json({
      booking: {
        id: booking.id,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        duration_hours: booking.duration_hours,
        package_name: booking.package_name,
        total_amount: booking.total_amount,
        deposit_amount: booking.deposit_amount,
        paid_amount: booking.paid_amount,
        payment_status: booking.payment_status,
        paymentUrl,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rezervasyon kontrol edilemedi." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
