"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  MessageCircle,
  Check,
  Copy,
  Crown,
  Phone,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { getSupabaseClient } from "../../../lib/supabase";

type Booking = {
  id: string;
  customer_name: string;
  phone: string;
  booking_date: string;
  booking_time: string;
  duration_hours: number;
  total_amount: number;
  deposit_amount: number;
  paid_amount: number;
  payment_status: string;
  subscriber: boolean;
};
type SubscriptionSlot = {
  id?: string;
  user_id: string;
  subscription_day: string;
  subscription_time: string;
  active: boolean;
  profile?: { email: string; full_name: string; phone: string; created_at: string } | null;
  completedWeeks?: number;
};
type ManualBooking = { booking_date: string; booking_time: string; customer_name: string; phone: string; total_amount: string; payment_status: string; notes: string };
const hours = Array.from({ length: 15 }, (_, index) => {
  const start = (index + 11) % 24;
  return `${String(start).padStart(2, "0")}.00-${String((start + 1) % 24).padStart(2, "0")}.00`;
});
const days = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
const statusLabels: Record<string, string> = {
  paid: "Tamamı Ödendi",
  approved: "Tamamı Ödendi",
  deposit: "Kapora",
  proof_submitted: "Kapora",
  unpaid: "Ödenmedi",
  pending: "Ödenmedi",
  rejected: "Reddedildi",
};
const mondayOf = (date: Date) => {
  const value = new Date(date);
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
};
const iso = (date: Date) => date.toISOString().slice(0, 10);
const dateText = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(
    date,
  );

export default function AdminBookingsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [subscriptionSlots, setSubscriptionSlots] = useState<
    SubscriptionSlot[]
  >([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingAmount, setBookingAmount] = useState("");
  const [bookingPaymentStatus, setBookingPaymentStatus] = useState("unpaid");
  const [bookingDeposit, setBookingDeposit] = useState("");
  const [savingBooking, setSavingBooking] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [manualBooking, setManualBooking] = useState<ManualBooking>({ booking_date: "", booking_time: "", customer_name: "", phone: "", total_amount: "1800", payment_status: "unpaid", notes: "" });
  const [savingManual, setSavingManual] = useState(false);
  const [message, setMessage] = useState("Kontrol ediliyor...");
  const [now, setNow] = useState(() => new Date());
  const weekStart = useMemo(() => {
    const value = mondayOf(new Date());
    value.setDate(value.getDate() + weekOffset * 7);
    return value;
  }, [weekOffset]);
  const dates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const value = new Date(weekStart);
        value.setDate(value.getDate() + index);
        return iso(value);
      }),
    [weekStart],
  );
  const monthStart = useMemo(
    () => iso(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1, 12)),
    [weekStart],
  );
  const monthEnd = useMemo(
    () => iso(new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0, 12)),
    [weekStart],
  );

  const load = async () => {
    const client = getSupabaseClient();
    const { data: assurance } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") {
      setMessage("Admin girişi ve 2FA gerekli.");
      return;
    }
    setAuthorized(true);
    const { data, error } = await client
      .from("booking_requests")
      .select(
        "id, customer_name, phone, booking_date, booking_time, duration_hours, total_amount, deposit_amount, paid_amount, payment_status, subscriber",
      )
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd)
      .order("booking_date")
      .order("booking_time");
    if (error) setMessage(error.message);
    else {
      setBookings(data || []);
      const { data: slots } = await client
        .from("subscription_slots")
        .select("id, user_id, subscription_day, subscription_time, active");
      const detailedSlots = await Promise.all((slots || []).map(async (slot) => {
        const { data: profile } = await client.from("profiles").select("email, full_name, phone, created_at").eq("id", slot.user_id).maybeSingle();
        const { count } = await client.from("booking_requests").select("id", { count: "exact", head: true }).eq("user_id", slot.user_id).in("payment_status", ["paid", "approved"]);
        return { ...slot, profile, completedWeeks: count || 0 };
      }));
      setSubscriptionSlots(detailedSlots);
      setMessage("");
    }
  };
  useEffect(() => {
    load().catch((error) =>
      setMessage(
        error instanceof Error ? error.message : "Rezervasyonlar yüklenemedi.",
      ),
    );
  }, [dates, monthStart, monthEnd]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sendWhatsAppConfirmation = async (booking: Booking) => {
    try {
      const res = await fetch("/api/whatsapp/booking-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const result = await res.json();
      setMessage(
        res.ok
          ? `${booking.customer_name} için WhatsApp rezervasyon mesajı gönderildi.`
          : `WhatsApp gönderilemedi: ${result.error || "Bilinmeyen hata"}`,
      );
    } catch (error) {
      setMessage(
        `WhatsApp gönderilemedi: ${
          error instanceof Error ? error.message : "Bağlantı hatası"
        }`,
      );
    }
  };

  const openBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setBookingAmount(String(booking.total_amount ?? 0));
    setBookingDeposit(String(booking.deposit_amount ?? 0));
    setBookingPaymentStatus(booking.payment_status);
    setCopiedPhone(false);
  };

  const openSubscriptionDetails = (slot: SubscriptionSlot, date: string, time: string) => {
    openBookingDetails({
      id: `subscription-${slot.id || slot.user_id}`,
      customer_name: slot.profile?.full_name || "Abone profili",
      phone: slot.profile?.phone || "",
      booking_date: date,
      booking_time: time,
      duration_hours: 1,
      total_amount: 1700,
      deposit_amount: 0,
      paid_amount: 0,
      payment_status: "paid",
      subscriber: true,
    });
  };

  const updateBookingPayment = async () => {
    if (!selectedBooking || !bookingAmount.trim()) return;
    setSavingBooking(true);
    const amount = Number(bookingAmount);
    const deposit = bookingPaymentStatus === "paid"
      ? amount
      : bookingPaymentStatus === "deposit"
        ? Math.max(0, Number(bookingDeposit) || 0)
        : 0;
    if (selectedBooking.id.startsWith("subscription-")) {
      setSavingBooking(false);
      setMessage("Abonelik saatlerinin ödemesi abonelik yönetiminden düzenlenir.");
      return;
    }
    const { data, error } = await getSupabaseClient()
      .from("booking_requests")
      .update({ total_amount: amount, deposit_amount: deposit, paid_amount: deposit, payment_status: bookingPaymentStatus })
      .eq("id", selectedBooking.id)
      .select("id, customer_name, phone, booking_date, booking_time, duration_hours, total_amount, deposit_amount, paid_amount, payment_status, subscriber")
      .single();
    setSavingBooking(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setBookings((current) => current.map((booking) => booking.id === data.id ? data : booking));
    setSelectedBooking(data);
    setMessage("Ödeme ve ücret bilgisi güncellendi.");
  };

  const deleteBooking = async () => {
    if (!selectedBooking || !window.confirm(`${selectedBooking.customer_name} rezervasyonu silinsin mi?`)) return;
    setSavingBooking(true);
    const { error } = await getSupabaseClient().from("booking_requests").delete().eq("id", selectedBooking.id);
    setSavingBooking(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setBookings((current) => current.filter((booking) => booking.id !== selectedBooking.id));
    setSelectedBooking(null);
    setMessage("Rezervasyon silindi.");
  };

  const copyPhone = async () => {
    if (!selectedBooking) return;
    await navigator.clipboard.writeText(selectedBooking.phone);
    setCopiedPhone(true);
    window.setTimeout(() => setCopiedPhone(false), 1800);
  };

  const bookingEndTime = (booking: Booking) => {
    const [hoursPart, minutesPart] = booking.booking_time.split(":").map(Number);
    const end = new Date(2000, 0, 1, hoursPart, minutesPart || 0);
    end.setMinutes(end.getMinutes() + Number(booking.duration_hours || 1) * 60);
    return end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  const bookingAt = (date: string, hour: string) =>
    bookings.find((item) => {
      if (item.booking_date !== date) return false;
      const start = Number(item.booking_time.slice(0, 2));
      const current = Number(hour.slice(0, 2));
      const duration = Math.max(Number(item.duration_hours || 1), 1);
      return current >= start && current < start + duration;
    });
  const subscriptionAt = (date: string, hour: string) => {
    const weekday = new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
    }).format(new Date(`${date}T12:00:00`));
    const startTime = hour.slice(0, 5).replace(".", ":");
    return subscriptionSlots.some(
      (slot) =>
        slot.active &&
        slot.subscription_day === weekday &&
        slot.subscription_time.startsWith(startTime),
    );
  };
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentHour = `${String(now.getHours()).padStart(2, "0")}.00-${String((now.getHours() + 1) % 24).padStart(2, "0")}.00`;
  const summaryDate = dates.includes(localDate) ? localDate : dates[0];
  const weekBookings = bookings.filter((booking) => dates.includes(booking.booking_date));
  const summaryBookings = weekBookings.filter(
    (booking) => booking.booking_date === summaryDate,
  );
  const daytimeMatches = summaryBookings.filter((booking) => {
    const hour = Number(booking.booking_time.slice(0, 2));
    return hour >= 2 && hour < 18;
  }).length;
  const nighttimeMatches = summaryBookings.length - daytimeMatches;
  const dailyRevenue = summaryBookings.reduce(
    (total, booking) => total + Number(booking.total_amount || 0),
    0,
  );
  const pendingBookings = weekBookings.filter((booking) =>
    ["pending", "proof_submitted", "deposit", "unpaid"].includes(booking.payment_status),
  ).length;
  const weeklyRevenue = weekBookings.reduce(
    (total, booking) => total + Number(booking.total_amount || 0),
    0,
  );
  const monthlyRevenue = bookings.reduce(
    (total, booking) => total + Number(booking.total_amount || 0),
    0,
  );
  const cancelledSubscribers = subscriptionSlots.filter((slot) => !slot.active).length;
  const activeSubscribers = subscriptionSlots.filter((slot) => slot.active).length;
  const dayTotal = (date: string) =>
    bookings
      .filter((booking) => booking.booking_date === date)
      .reduce((total, booking) => total + Number(booking.total_amount || 0), 0);
  const clock = now.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const openManual = (date = dates[0], hour = "18:00") => {
    setManualBooking({ booking_date: date, booking_time: hour, customer_name: "", phone: "", total_amount: Number(hour.slice(0, 2)) >= 18 || Number(hour.slice(0, 2)) < 2 ? "1800" : "1200", payment_status: "unpaid", notes: "" });
    setManualOpen(true);
  };
  const saveManual = async () => {
    if (!manualBooking.customer_name.trim() || !/^0\d{10}$/.test(manualBooking.phone.replace(/\s/g, ""))) { setMessage("Ad soyad ve 11 haneli telefon zorunlu."); return; }
    setSavingManual(true);
    const { data, error } = await getSupabaseClient().from("booking_requests").insert({ customer_name: manualBooking.customer_name.trim(), phone: manualBooking.phone.replace(/\s/g, ""), booking_date: manualBooking.booking_date, booking_time: manualBooking.booking_time, duration_hours: 1, package_name: "Manuel Rezervasyon", total_amount: Number(manualBooking.total_amount), deposit_amount: 0, paid_amount: 0, payment_choice: "full", payment_status: manualBooking.payment_status, notes: manualBooking.notes }).select("id, customer_name, phone, booking_date, booking_time, duration_hours, total_amount, deposit_amount, paid_amount, payment_status, subscriber").single();
    setSavingManual(false);
    if (error) { setMessage(error.message); return; }
    setBookings((current) => [...current, data]);
    setManualOpen(false);
    if (["paid", "approved", "deposit"].includes(data.payment_status)) {
      try {
        const res = await fetch("/api/whatsapp/booking-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: data.id }),
        });
        const result = await res.json();
        setMessage(res.ok ? "Manuel rezervasyon kaydedildi ve WhatsApp onay mesajı gönderildi." : `Manuel rezervasyon kaydedildi. WhatsApp gönderilemedi: ${result.error || "Bilinmeyen hata"}`);
      } catch (error) {
        setMessage(`Manuel rezervasyon kaydedildi. WhatsApp gönderilemedi: ${error instanceof Error ? error.message : "Bağlantı hatası"}`);
      }
    }
  };

  if (!authorized)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--green)] px-5">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <ShieldCheck className="mx-auto mb-5 text-[var(--green)]" size={36} />
          <h1 className="display text-2xl font-extrabold">
            Yetkili admin girişi gerekli
          </h1>
          <a
            href="/admin"
            className="mt-6 inline-flex rounded-full bg-[var(--green)] px-5 py-3 text-sm font-bold text-white"
          >
            Admin girişine git
          </a>
          <p className="mt-4 text-xs text-[var(--muted)]">{message}</p>
        </div>
      </main>
    );

  return (
    <main className="reservation-page min-h-screen bg-[#f5f7f3] px-2 pt-1 pb-6 text-[var(--ink)] sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        {/* Üst Kısım: Başlık, Saat ve Ok Kontrolleri Hizalandı */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--green)]">
              Haftalık rezervasyon defteri
            </p>
            <h1 className="display mt-0.5 text-2xl font-extrabold sm:text-3xl">
              Rezervasyonlar
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <span className="rounded-lg bg-white/80 px-2.5 py-1 text-xs font-semibold text-[var(--muted)] shadow-sm">
              {dateText(weekStart)} - {dateText(new Date(weekStart.getTime() + 6 * 86400000))}
            </span>
            <div className="flex items-center gap-2">
              <strong className="reservation-clock">{clock}</strong>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setWeekOffset((value) => value - 1)}
                  className="rounded-full border bg-white p-2 shadow-sm transition hover:bg-stone-50"
                  aria-label="Önceki hafta"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((value) => value + 1)}
                  className="rounded-full border bg-white p-2 shadow-sm transition hover:bg-stone-50"
                  aria-label="Sonraki hafta"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={load}
                  className="rounded-full border bg-white p-2 shadow-sm transition hover:bg-stone-50"
                  aria-label="Yenile"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <button type="button" className="manual-booking-button mb-4" onClick={() => openManual()}><Plus size={17} /> Manuel Maç Ekle</button>
        
        <div className="reservation-summary mb-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="reservation-summary-card">
            <span>GÜNÜN HASILATI</span>
            <strong>₺{dailyRevenue.toLocaleString("tr-TR")}</strong>
            <small>{dateText(new Date(`${summaryDate}T12:00:00`))}</small>
          </div>
          <div className="reservation-summary-card">
            <span>TOPLAM HASILAT</span>
            <strong>₺{weeklyRevenue.toLocaleString("tr-TR")}</strong>
            <small>Seçilen haftanın toplamı</small>
          </div>
          <div className="reservation-summary-card">
            <span>AKTİF ABONE</span>
            <strong>{activeSubscribers}</strong>
            <small>Sistemdeki aktif sabit saat</small>
          </div>
          <div className="reservation-summary-card">
            <span>BEKLEYEN KAYIT</span>
            <strong>{pendingBookings}</strong>
            <small>Onay veya kapora bekleyen</small>
          </div>
          <div className="reservation-summary-card reservation-match-split">
            <div>
              <span>GÜNLÜK MAÇ</span>
              <strong>{summaryBookings.length}</strong>
            </div>
            <div>
              <span>GÜNDÜZ</span>
              <b>{daytimeMatches}</b>
            </div>
            <div>
              <span>GECE</span>
              <b>{nighttimeMatches}</b>
            </div>
          </div>
          <div className="reservation-summary-card">
            <span>TOPLAM MAÇ</span>
            <strong>{weekBookings.length}</strong>
            <small>Seçilen haftadaki toplam</small>
          </div>
        </div>

        {message && (
          <p className="mb-3 rounded-lg bg-white p-3 text-xs font-semibold text-[var(--green)]">
            {message}
          </p>
        )}

        <div className="reservation-scroll overflow-x-auto rounded-xl border border-[var(--line)] bg-white shadow-sm">
          <div className="reservation-grid min-w-[1280px]">
            <div className="reservation-corner">Gün / Saat</div>
            {hours.map((hour) => (
              <div
                key={hour}
                className={`reservation-hour ${localDate >= dates[0] && localDate <= dates[6] && hour === currentHour ? "reservation-hour-current" : ""}`}
              >
                {hour}
              </div>
            ))}
            <div className="reservation-hour reservation-total-heading">
              Toplam
            </div>
            {dates.map((date, dayIndex) => (
              <div className="contents" key={date}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedDate((current) => current === date ? null : date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedDate((current) => current === date ? null : date);
                    }
                  }}
                  className={`reservation-day ${date === localDate ? "reservation-day-current" : ""} ${expandedDate === date ? "reservation-day-expanded" : ""}`}
                >
                  <strong>{days[dayIndex]}</strong>
                  <span>
                    {date.slice(8, 10)}.{date.slice(5, 7)}
                  </span>
                </div>
                {hours.map((hour) => {
                  const booking = bookingAt(date, hour);
                  const subscription = subscriptionAt(date, hour);
                  const subscriptionInfo = subscriptionSlots.find((slot) => {
                    const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(new Date(`${date}T12:00:00`));
                    return slot.active && slot.subscription_day === weekday && slot.subscription_time.startsWith(hour.slice(0, 5).replace(".", ":"));
                  });
                  const current = date === localDate && hour === currentHour;
                  return (
                    <div
                      key={`${date}-${hour}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        const locked = subscriptionSlots.find((slot) => subscriptionAt(date, hour) && slot.subscription_day === new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(new Date(`${date}T12:00:00`)) && slot.subscription_time.startsWith(hour.slice(0, 5).replace(".", ":")));
                        if (booking) openBookingDetails(booking);
                        else if (locked) openSubscriptionDetails(locked, date, hour.slice(0, 5).replace(".", ":"));
                        else if (!booking) openManual(date, hour.slice(0, 5).replace(".", ":"));
                      }}
                      className={`reservation-cell relative group ${current ? "reservation-cell-current" : ""} ${booking ? "reservation-cell-booked" : ""} ${booking?.subscriber || (subscription && !booking) ? "reservation-cell-subscriber" : ""}`}
                    >
                      {booking && (
                        <>
                          <strong>{booking.customer_name}</strong>
                          <span className="reservation-cell-phone">{booking.phone}</span>
                        </>
                      )}
                      {subscription && !booking && (
                        <>
                          <strong>{subscriptionInfo?.profile?.full_name || "KİLİTLİ"}</strong>
                          <span className="reservation-cell-phone">{subscriptionInfo?.profile?.phone || ""}</span>
                          <Crown className="reservation-cell-crown" size={13} aria-label="Abone" />
                        </>
                      )}
                    </div>
                  );
                })}
                <div className="reservation-total-cell">
                  ₺{dayTotal(date).toLocaleString("tr-TR")}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-[var(--muted)]">
          Canlı saat sarı renkle işaretlenir. Dolu hücreye tıklayarak rezervasyon detaylarını ve ödeme yönetimini açabilirsiniz.
        </p>

        {expandedDate && (
          <section className="admin-day-records">
            <div>
              <span>SEÇİLEN GÜN</span>
              <strong>{new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${expandedDate}T12:00:00`))}</strong>
            </div>
            {bookings.filter((booking) => booking.booking_date === expandedDate).length ? bookings.filter((booking) => booking.booking_date === expandedDate).map((booking) => (
              <div className="admin-day-record flex items-center justify-between" key={booking.id}>
                <div>
                  <b>{booking.booking_time}</b>
                  <span>{booking.customer_name}</span>
                  <small>{booking.phone} · ₺{booking.total_amount} · {statusLabels[booking.payment_status] || booking.payment_status}</small>
                </div>
                <button
                  type="button"
                  onClick={() => sendWhatsAppConfirmation(booking)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
              </div>
            )) : <p className="admin-day-record-empty">Bu gün için kayıt bulunmuyor.</p>}
          </section>
        )}

        <section className="weekly-field-summary">
          <div className="weekly-field-summary-heading">
            <span>HAFTALIK SAHA ÖZETİ</span>
            <strong>
              {dateText(weekStart)} - {dateText(new Date(weekStart.getTime() + 6 * 86400000))}
            </strong>
          </div>
          <div><small>Toplam maç</small><b>{weekBookings.length}</b></div>
          <div><small>Toplam hasılat</small><b>₺{weeklyRevenue.toLocaleString("tr-TR")}</b></div>
          <div><small>Aktif abone</small><b>{activeSubscribers}</b></div>
        </section>

        <section className="weekly-field-summary monthly-field-summary">
          <div className="weekly-field-summary-heading">
            <span>AYLIK SAHA ÖZETİ</span>
            <strong>{new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(weekStart)}</strong>
          </div>
          <div><small>Toplam maç</small><b>{bookings.length}</b></div>
          <div><small>Toplam hasılat</small><b>₺{monthlyRevenue.toLocaleString("tr-TR")}</b></div>
          <div><small>Aktif abone</small><b>{activeSubscribers}</b></div>
          <div><small>İptal edilen abone</small><b>{cancelledSubscribers}</b></div>
        </section>

        {manualOpen && <div className="admin-modal-backdrop" onClick={() => setManualOpen(false)}><div className="admin-modal" onClick={(event) => event.stopPropagation()}><div className="admin-modal-heading"><div><p>YENİ KAYIT</p><h2>Manuel Rezervasyon Ekle</h2></div><button type="button" onClick={() => setManualOpen(false)}>×</button></div><div className="admin-modal-grid"><label>Gün<input type="date" value={manualBooking.booking_date} onChange={(event) => setManualBooking({ ...manualBooking, booking_date: event.target.value })} /></label><label>Saat<input type="time" value={manualBooking.booking_time} onChange={(event) => setManualBooking({ ...manualBooking, booking_time: event.target.value })} /></label><label className="admin-modal-wide">Takım Kaptanı / Müşteri<input value={manualBooking.customer_name} onChange={(event) => setManualBooking({ ...manualBooking, customer_name: event.target.value })} /></label><label>Telefon<input value={manualBooking.phone} onChange={(event) => setManualBooking({ ...manualBooking, phone: event.target.value.replace(/\D/g, "").slice(0, 11) })} placeholder="05xxxxxxxxx" /></label><label>Ücret<input type="number" value={manualBooking.total_amount} onChange={(event) => setManualBooking({ ...manualBooking, total_amount: event.target.value })} /></label><label>Ödeme Durumu<select value={manualBooking.payment_status} onChange={(event) => setManualBooking({ ...manualBooking, payment_status: event.target.value })}><option value="paid">Ödendi</option><option value="deposit">Kapora Alındı</option><option value="unpaid">Ödenmedi / Maç Sonu</option></select></label><label className="admin-modal-wide">Not / Açıklama<textarea value={manualBooking.notes} onChange={(event) => setManualBooking({ ...manualBooking, notes: event.target.value })} /></label></div><button type="button" className="admin-modal-save" onClick={saveManual} disabled={savingManual}>{savingManual ? "Kaydediliyor..." : "Kaydet"}</button></div></div>}

        {selectedBooking && <div className="admin-modal-backdrop" onClick={() => setSelectedBooking(null)}><div className={`booking-detail-modal ${selectedBooking.subscriber ? "booking-detail-modal-subscriber" : ""}`} onClick={(event) => event.stopPropagation()}>
          <div className="booking-detail-heading"><div><p>{selectedBooking.subscriber ? "GOLD ABONELİK" : "REZERVASYON DETAYI"}</p><h2>{new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(new Date(`${selectedBooking.booking_date}T12:00:00`))}, {selectedBooking.booking_time} - {bookingEndTime(selectedBooking)}</h2></div><button type="button" onClick={() => setSelectedBooking(null)} aria-label="Detayı kapat"><X size={20} /></button></div>
          <div className="booking-detail-status"><span className={`booking-status booking-status-${selectedBooking.payment_status}`}>{statusLabels[selectedBooking.payment_status] || selectedBooking.payment_status}</span><span>{selectedBooking.booking_date}</span></div>
          <section className="booking-detail-section"><h3>Müşteri bilgileri</h3><div className="booking-customer"><div className="booking-avatar">{selectedBooking.customer_name.slice(0, 1).toUpperCase()}</div><div><strong>{selectedBooking.customer_name}</strong><span>{selectedBooking.subscriber ? "Abone" : "Tek Seferlik"}</span></div></div><div className="booking-phone-row"><a href={`tel:${selectedBooking.phone}`}><Phone size={16} /> {selectedBooking.phone}</a><button type="button" onClick={copyPhone}>{copiedPhone ? <Check size={16} /> : <Copy size={16} />} {copiedPhone ? "Kopyalandı" : "Kopyala"}</button></div></section>
          <section className="booking-detail-section"><h3>Ödeme yönetimi</h3><div className="booking-detail-fields"><label>Toplam ücret<input type="number" min="0" value={bookingAmount} onChange={(event) => setBookingAmount(event.target.value)} /></label><label>Ödeme durumu<select value={bookingPaymentStatus} onChange={(event) => setBookingPaymentStatus(event.target.value)}><option value="paid">Tamamı Ödendi</option><option value="unpaid">Ödenmedi</option><option value="deposit">Kapora Alındı</option></select></label>{bookingPaymentStatus === "deposit" && <label className="booking-detail-field-wide">Alınan kapora tutarı<input type="number" min="0" max={bookingAmount || undefined} value={bookingDeposit} onChange={(event) => setBookingDeposit(event.target.value)} /></label>}</div><div className={`booking-remaining ${bookingPaymentStatus === "paid" ? "booking-remaining-paid" : ""}`}>{bookingPaymentStatus === "paid" ? <>Kalan: ₺0 <span>(Tamamlandı)</span></> : <>Kalan Tutar: ₺{Math.max(0, Number(bookingAmount || 0) - (bookingPaymentStatus === "deposit" ? Number(bookingDeposit || 0) : 0)).toLocaleString("tr-TR")} <span>({bookingPaymentStatus === "deposit" ? "Ödenmedi" : "Tamamı Ödenmedi"})</span></>}</div><button type="button" className="booking-primary-button" onClick={updateBookingPayment} disabled={savingBooking || selectedBooking.id.startsWith("subscription-")}><Save size={16} /> {selectedBooking.id.startsWith("subscription-") ? "Abonelik kaydı" : savingBooking ? "Kaydediliyor..." : "Ödemeyi Güncelle"}</button></section>
          <section className="booking-detail-actions"><button type="button" className="booking-whatsapp-button" onClick={() => sendWhatsAppConfirmation(selectedBooking)}><MessageCircle size={17} /> WhatsApp Onay / Hatırlatma Gönder</button><button type="button" className="booking-delete-button" onClick={deleteBooking} disabled={savingBooking}><Trash2 size={16} /> Rezervasyonu İptal Et / Sil</button></section>
        </div></div>}
        
      </div>
    </main>
  );
}
