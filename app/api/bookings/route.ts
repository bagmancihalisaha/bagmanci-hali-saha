import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";

const VALID_DURATIONS = [1, 1.5, 2];
const PHONE_PATTERN = /^0\d{10}$/;

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\s/g, "");
}

function hourOf(value: string) {
  const [hourValue, minuteValue] = value.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue || 0);
  return hour * 60 + minute;
}

function timeRange(start: string, duration: number) {
  const end = (hourOf(start) + duration * 60) % (24 * 60);
  return `${start} - ${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

async function getAuthenticatedUserId(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await client.auth.getUser(token);
  return data.user?.id || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerName = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    const bookingDate = String(body.date || "");
    const bookingTime = String(body.time || "");
    const duration = Number(body.duration);

    if (!customerName || !PHONE_PATTERN.test(phone)) {
      return NextResponse.json({ error: "Ad soyad ve geçerli telefon zorunludur." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(bookingTime)) {
      return NextResponse.json({ error: "Geçersiz tarih veya saat." }, { status: 400 });
    }
    if (!VALID_DURATIONS.includes(duration)) {
      return NextResponse.json({ error: "Geçersiz rezervasyon süresi." }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const userId = await getAuthenticatedUserId(request);
    const start = hourOf(bookingTime);
    const requestedEnd = start + duration * 60;
    const occupiedSlotCount = Math.ceil(duration);
    const { data: existing, error: existingError } = await client
      .from("booking_requests")
      .select("booking_time, duration_hours")
      .eq("booking_date", bookingDate)
      .neq("payment_status", "rejected");
    if (existingError) throw existingError;

    const overlaps = (existing || []).some((booking) => {
      const bookingStart = hourOf(booking.booking_time);
      const bookingEnd = bookingStart + Number(booking.duration_hours || 1) * 60;
      return start < bookingEnd && requestedEnd > bookingStart;
    });
    if (overlaps) {
      return NextResponse.json({ error: "Seçtiğiniz saat aralığı artık müsait değil." }, { status: 409 });
    }

    const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long" })
      .format(new Date(`${bookingDate}T12:00:00`))
      .toLocaleLowerCase("tr-TR");
    const { data: lockedSubscriptions } = await client
      .from("subscription_slots")
      .select("user_id, subscription_time")
      .eq("subscription_day", weekday)
      .eq("active", true);
    const lockedBySubscription = (lockedSubscriptions || []).some((slot) => {
      if (slot.user_id === userId) return false;
      const lockedStart = hourOf(slot.subscription_time.slice(0, 5));
      return start < lockedStart + 60 && requestedEnd > lockedStart;
    });
    if (lockedBySubscription) {
      return NextResponse.json({ error: "Seçtiğiniz saat abonelik nedeniyle dolu." }, { status: 409 });
    }
    const { data: subscription } = userId
      ? await client
          .from("subscription_slots")
          .select("subscription_day, subscription_time, active")
          .eq("user_id", userId)
          .eq("active", true)
          .maybeSingle()
      : { data: null };
    const subscriberPriceEligible = Boolean(
      subscription &&
        subscription.subscription_day.toLocaleLowerCase("tr-TR") === weekday &&
        subscription.subscription_time.startsWith(bookingTime),
    );

    const { data: settings } = await client
      .from("site_settings")
      .select("day_price, night_price, subscriber_price")
      .eq("id", "main")
      .maybeSingle();
    const dayPrice = Number(settings?.day_price || 1200);
    const nightPrice = Number(settings?.night_price || 1800);
    const subscriberPrice = Number(settings?.subscriber_price || 1700);
    const isNight = Number(bookingTime.slice(0, 2)) >= 18 || Number(bookingTime.slice(0, 2)) < 2;
    const hourlyPrice = subscriberPriceEligible ? subscriberPrice : isNight ? nightPrice : dayPrice;
    const totalAmount = hourlyPrice * duration;

    const { data, error } = await client
      .from("booking_requests")
      .insert({
        user_id: userId,
        customer_name: customerName,
        phone,
        booking_date: bookingDate,
        booking_time: bookingTime,
        duration_hours: duration,
        subscriber: subscriberPriceEligible,
        package_name: `${isNight ? "Gece" : "Gündüz"} Tarifesi`,
        total_amount: totalAmount,
        deposit_amount: 600,
        payment_choice: "deposit",
        payment_status: "pending",
        notes: `Aralık: ${timeRange(bookingTime, duration)}; ${occupiedSlotCount} saat bloğu`,
      })
      .select("id, payment_token")
      .single();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      booking: data,
      totalAmount,
      timeRange: timeRange(bookingTime, duration),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rezervasyon oluşturulamadı." },
      { status: 500 },
    );
  }
}
