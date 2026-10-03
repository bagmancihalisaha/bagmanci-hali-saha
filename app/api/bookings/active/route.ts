import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10) return `0${digits}`;
  return digits;
};

const phoneVariants = (phone: string) => {
  const national = phone.slice(1);
  const local = `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7, 9)} ${national.slice(9)}`;
  return Array.from(new Set([
    phone,
    national,
    `90${national}`,
    `+90${national}`,
    `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7, 9)} ${phone.slice(9)}`,
    `(${phone.slice(0, 4)}) ${phone.slice(4, 7)} ${phone.slice(7, 9)} ${phone.slice(9)}`,
    `${phone.slice(0, 4)}-${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`,
    `+90 ${local}`,
  ]));
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ref = (params.get("ref") || "").trim();
  const refPhone = /^\+?[\d\s()-]+$/.test(ref) ? ref : "";
  const phone = normalizePhone(refPhone || params.get("phone") || "");
  const isPhone = /^0\d{10}$/.test(phone);
  const isReference = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref);

  if (!isPhone && !isReference) {
    return NextResponse.json({ bookings: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const client = getSupabaseServerClient();
    let query = client
      .from("booking_requests")
      .select("id, payment_token, booking_date, booking_time, duration_hours, package_name, total_amount, deposit_amount, paid_amount, payment_status")
      .neq("payment_status", "rejected");

    query = isReference
      ? query.or(`id.eq.${ref},payment_token.eq.${ref}`)
      : query.in("phone", phoneVariants(phone));
    const { data, error } = await query.order("booking_date").order("booking_time").limit(100);
    if (error) throw error;

    const now = Date.now();
    const bookingStart = (booking: NonNullable<typeof data>[number]) =>
      new Date(`${booking.booking_date}T${booking.booking_time.slice(0, 5)}:00+03:00`).getTime();
    const bookings = (data || [])
      .map((booking) => ({ booking, startsAt: bookingStart(booking) }))
      .sort((a, b) => {
        const aUpcoming = a.startsAt > now;
        const bUpcoming = b.startsAt > now;
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
        return aUpcoming ? a.startsAt - b.startsAt : b.startsAt - a.startsAt;
      })
      .map(({ booking, startsAt }) => ({
        id: booking.id,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        duration_hours: booking.duration_hours,
        package_name: booking.package_name,
        total_amount: booking.total_amount,
        deposit_amount: booking.deposit_amount,
        paid_amount: booking.paid_amount,
        payment_status: booking.payment_status,
        isUpcoming: startsAt > now,
        paymentUrl: booking.payment_token
          ? `/odeme?booking=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(booking.payment_token)}`
          : null,
      }));

    return NextResponse.json({
      bookings,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rezervasyon kontrol edilemedi." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
