"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Users,
} from "lucide-react";
import SiteHeader from "./components/SiteHeader";
import SiteImageSync from "./components/SiteImageSync";
import MatchArchive from "./components/MatchArchive";
import { getSupabaseClient } from "../lib/supabase";

const getWeekDays = (offset: number) => {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      day: new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(date),
      date: date.toISOString().slice(0, 10),
      year: date.getFullYear(),
      dayNumber: date.getDate(),
      full: new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
      }).format(date),
    };
  });
};

const getIsoWeek = (date: Date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const slots = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
  "00:00",
  "01:00",
];

const daytimeSlots = slots.filter(
  (slot) => Number(slot.slice(0, 2)) >= 9 && Number(slot.slice(0, 2)) <= 17,
);
const nighttimeSlots = slots.filter(
  (slot) => Number(slot.slice(0, 2)) >= 18 || Number(slot.slice(0, 2)) < 2,
);

const packages = [
  {
    title: "Gündüz Tarifesi",
    price: 1200,
    note: "12:00 - 18:00 arası",
    detail: "1 saat saha kullanımı",
    duration: 1,
  },
  {
    title: "Gece Tarifesi",
    price: 1800,
    note: "18:00 - 02:00 arası",
    detail: "1 saat saha kullanımı",
    duration: 1,
  },
  {
    title: "Maç Kaydı",
    price: 0,
    note: "Abonelere ücretsiz",
    detail: "Maçınızı tekrar izleyin",
    duration: 1,
  },
];

const mapUrl =
  "https://www.google.com/maps/search/?api=1&query=Bagmanci+Hali+Saha+Sanliurfa";

type SubscriptionSlot = {
  user_id: string;
  subscription_day: string;
  subscription_time: string;
  active: boolean;
  created_at: string;
};

export default function Home() {
  const [weekOffset, setWeekOffset] = useState(0);
  const days = getWeekDays(weekOffset);
  const [selectedDay, setSelectedDay] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState(packages[0]);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [durationNotice, setDurationNotice] = useState("");
  const [booked, setBooked] = useState<
    { date: string; time: string; duration: number }[]
  >([]);
  const [subscriptionSlots, setSubscriptionSlots] = useState<
    SubscriptionSlot[]
  >([]);
  const [form, setForm] = useState({ name: "", phone: "", subscriber: false });
  const [subscriberVerified, setSubscriberVerified] = useState(false);
  const [discountEligible, setDiscountEligible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileDefaults, setProfileDefaults] = useState({
    name: "",
    phone: "",
  });
  const [notice, setNotice] = useState("");
  const [waLoading, setWaLoading] = useState(false);

  const selectedLabel =
    days.find((day) => day.date === selectedDay)?.full ?? selectedDay;
  const weekTitleDate = new Date(`${days[0].date}T12:00:00`);
  const weekTitle = `${new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(weekTitleDate)} • ${getIsoWeek(weekTitleDate)}. Hafta`;
  const isNightSlot = selectedSlot
    ? Number(selectedSlot.slice(0, 2)) >= 18 ||
      Number(selectedSlot.slice(0, 2)) < 2
    : selectedPackage.title === "Gece Tarifesi";
  const tariffPrice =
    selectedPackage.title === "Maç Kaydı" ? 0 : isNightSlot ? 1800 : 1200;
  const bookingPackageTitle =
    selectedPackage.title === "Maç Kaydı"
      ? selectedPackage.title
      : `${isNightSlot ? "Gece" : "Gündüz"} Tarifesi`;
  const price =
    discountEligible && tariffPrice
      ? 1700 * selectedDuration
      : tariffPrice * selectedDuration;

  useEffect(() => {
    const currentDay = days.find(
      (day) => day.date >= new Date().toISOString().slice(0, 10),
    );
    if (!days.some((day) => day.date === selectedDay))
      setSelectedDay(currentDay?.date || days[0].date);

    const loadBookings = async () => {
      const start = days[0].date;
      const end = days[days.length - 1].date;
      const { data } = await getSupabaseClient()
        .from("booking_requests")
        .select("booking_date, booking_time, duration_hours")
        .gte("booking_date", start)
        .lte("booking_date", end)
        .neq("payment_status", "rejected");

      setBooked(
        (data || []).map((item) => ({
          date: item.booking_date,
          time: item.booking_time,
          duration: Number(item.duration_hours || 1),
        })),
      );

      const { data: lockedSlots } = await getSupabaseClient()
        .from("subscription_slots")
        .select(
          "user_id, subscription_day, subscription_time, active, created_at",
        )
        .eq("active", true);

      setSubscriptionSlots(lockedSlots || []);
    };
    loadBookings();
  }, [weekOffset]);

  useEffect(() => {
    getSupabaseClient()
      .auth.getUser()
      .then(async ({ data }) => {
        if (!data.user) return;
        setCurrentUserId(data.user.id);
        const client = getSupabaseClient();
        const { data: profile } = await client
          .from("profiles")
          .select(
            "subscriber, preferred_subscription_day, preferred_subscription_time, full_name, phone",
          )
          .eq("id", data.user.id)
          .maybeSingle();

        const { data: ownSlot } = await client
          .from("subscription_slots")
          .select("subscription_day, subscription_time, active, created_at")
          .eq("user_id", data.user.id)
          .eq("active", true)
          .maybeSingle();

        const isActiveSubscriber = Boolean(profile?.subscriber && ownSlot);
        setSubscriberVerified(isActiveSubscriber);
        setProfileDefaults({
          name: profile?.full_name || data.user.user_metadata?.full_name || "",
          phone: profile?.phone || data.user.user_metadata?.phone || "",
        });

        const { count } = await client
          .from("booking_requests")
          .select("id", { count: "exact", head: true })
          .eq("user_id", data.user.id)
          .in("payment_status", ["paid", "approved"]);

        const subscriptionAge = ownSlot?.created_at
          ? Date.now() - new Date(ownSlot.created_at).getTime()
          : 0;

        setDiscountEligible(
          Boolean(
            isActiveSubscriber &&
              subscriptionAge >= 7 * 86400000 &&
              (count || 0) >= 1,
          ),
        );

        setForm((current) => ({
          ...current,
          name:
            profile?.full_name ||
            data.user.user_metadata?.full_name ||
            current.name,
          phone: profile?.phone || data.user.user_metadata?.phone || current.phone,
          subscriber: Boolean(profile?.subscriber),
        }));
      });
  }, []);

  const choosePackage = (pack: (typeof packages)[number]) => {
    setSelectedPackage(pack);
    setNotice(`${pack.title} seçildi. Şimdi gün ve saatini belirleyebilirsin.`);
    document
      .getElementById("rezervasyon")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  // DOĞRUDAN METADAN TEST MESAJI TETİKLEYEN FONKSİYON
  const sendTestWhatsApp = async () => {
    let targetPhone = form.phone.replace(/\D/g, "");
    if (!targetPhone) {
      targetPhone = "905431005063";
    } else if (targetPhone.startsWith("0")) {
      targetPhone = "9" + targetPhone;
    } else if (!targetPhone.startsWith("90")) {
      targetPhone = "90" + targetPhone;
    }

    setWaLoading(true);
    setNotice(`0414 247 51 51 hattından ${targetPhone} numarasına test mesajı gönderiliyor...`);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: targetPhone,
          type: "template",
          templateName: "3p_direct_integration_test_template",
          languageCode: "en_US",
        }),
      });

      const responseData = await res.json();

      if (res.ok && responseData.success) {
        setNotice(`✅ Tebrikler! WhatsApp test mesajı ${targetPhone} numarasına başarıyla gönderildi!`);
      } else {
        console.error("Meta WhatsApp Hatası:", responseData);
        setNotice(`WhatsApp Gönderim Hatası: ${responseData.error || "Bilinmeyen hata"}`);
      }
    } catch (err: any) {
      setNotice(`Bağlantı hatası: ${err.message}`);
    } finally {
      setWaLoading(false);
    }
  };

  const submitBooking = async () => {
    if (
      !selectedSlot ||
      !form.name ||
      !/^0\d{10}$/.test(form.phone.replace(/\s/g, ""))
    ) {
      setNotice("Lütfen saat, ad soyad ve 11 haneli telefon numarasını girin.");
      return;
    }
    setNotice("Maç kaydı oluşturuluyor...");
    try {
      const client = getSupabaseClient();
      if (await refreshSlotAvailability()) {
        setNotice("Seçtiğiniz saat artık müsait değil. Lütfen başka bir saat seçin.");
        return;
      }
      const { data: authData } = await client.auth.getUser();
      const { data, error } = await client
        .from("booking_requests")
        .insert({
          user_id: authData.user?.id || null,
          customer_name: form.name.trim(),
          phone: form.phone.replace(/\s/g, ""),
          booking_date: selectedDay,
          booking_time: selectedSlot,
          duration_hours: selectedDuration,
          subscriber: subscriberVerified,
          package_name: bookingPackageTitle,
          total_amount: price,
          deposit_amount: 600,
          payment_choice: "deposit",
          payment_status: "pending",
        })
        .select("id, payment_token")
        .single();

      if (error) throw error;

      const whatsappResponse = await fetch("/api/whatsapp/booking-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: data.id }),
      });
      const whatsappResult = await whatsappResponse.json();
      if (!whatsappResponse.ok || !whatsappResult.success) {
        console.error("Rezervasyon WhatsApp onayı gönderilemedi:", whatsappResult);
      }

      setBooked((current) => [
        ...current,
        { date: selectedDay, time: selectedSlot, duration: selectedDuration },
      ]);
      setSelectedSlot(null);
      setForm({ name: "", phone: "", subscriber: false });
      window.location.href = `/odeme?booking=${data.id}&token=${data.payment_token}`;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Maç kaydı oluşturulamadı: ${error.message}`
          : "Maç kaydı oluşturulamadı.",
      );
    }
  };

  const selectedWeekday = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
  }).format(new Date(`${selectedDay}T12:00:00`)).toLocaleLowerCase("tr-TR");

  const subscriptionLocked = (slot: string) =>
    subscriptionSlots.some(
      (item) =>
        item.user_id !== currentUserId &&
        item.subscription_day.toLocaleLowerCase("tr-TR") === selectedWeekday &&
        item.subscription_time.startsWith(slot) &&
        item.active,
    );

  const ownSubscriptionSlot = (slot: string) =>
    subscriptionSlots.some(
      (item) =>
        item.user_id === currentUserId &&
        item.subscription_day.toLocaleLowerCase("tr-TR") === selectedWeekday &&
        item.subscription_time.startsWith(slot) &&
        item.active,
    );

  const isSlotUnavailable = (slot: string, duration: number) => {
    const startHour = Number(slot.slice(0, 2));
    const requestedEnd = startHour + duration;
    return booked.some((booking) => {
      if (booking.date !== selectedDay) return false;
      const bookingStart = Number(booking.time.slice(0, 2));
      const bookingEnd = bookingStart + booking.duration;
      return startHour < bookingEnd && requestedEnd > bookingStart;
    });
  };

  const isDurationUnavailable = (slot: string, duration: number) => {
    const startHour = Number(slot.slice(0, 2));
    const lockedBySubscription = Array.from(
      { length: Math.ceil(duration) },
      (_, index) => `${(startHour + index) % 24}`.padStart(2, "0") + ":00",
    ).some((hour) => subscriptionLocked(hour));
    return isSlotUnavailable(slot, duration) || lockedBySubscription;
  };

  const refreshSlotAvailability = async () => {
    if (!selectedSlot) return false;
    
    if (ownSubscriptionSlot(selectedSlot)) {
      return false;
    }

    const { data, error } = await getSupabaseClient()
      .from("booking_requests")
      .select("booking_time, duration_hours")
      .eq("booking_date", selectedDay)
      .neq("payment_status", "rejected");
    if (error) throw error;
    return (data || []).some((item) => {
      const start = Number(selectedSlot.slice(0, 2));
      const bookingStart = Number(item.booking_time.slice(0, 2));
      const bookingDuration = Number(item.duration_hours || 1);
      return start < bookingStart + bookingDuration &&
        start + selectedDuration > bookingStart;
    });
  };

  const selectDuration = (duration: number) => {
    if (!selectedSlot) {
      setSelectedDuration(duration);
      setDurationNotice("Önce bir saat seçin.");
      return;
    }
    if (isDurationUnavailable(selectedSlot, duration)) {
      setDurationNotice(
        duration === 1.5
          ? "Seçtiğiniz saatin arkasındaki saat dolu olduğu için yarım saat uzatma eklenemez. Lütfen 1 saati seçin veya ardışık boş saat aralığı bulun."
          : "Seçilen saat aralığı müsait değil.",
      );
      if (duration !== 1) setSelectedDuration(1);
      return;
    }
    setSelectedDuration(duration);
    setDurationNotice(
      duration === 1.5
        ? "✓ Sonraki saat müsait olduğu için 1.5 saatlik maç süresi tanımlandı."
        : "",
    );
  };

  const renderSlot = (slot: string) => {
    const slotHour = Number(slot.slice(0, 2));
    const isBooked = booked.some((booking) => {
      if (booking.date !== selectedDay) return false;
      const startHour = Number(booking.time.slice(0, 2));
      return slotHour >= startHour && slotHour < startHour + booking.duration;
    });
    const isSubscriptionLocked = subscriptionLocked(slot);
    const isOwnSubscription = ownSubscriptionSlot(slot);
    const isSubscriptionSlot = isSubscriptionLocked || isOwnSubscription;
    const exceedsClosing = selectedDuration > 1 && slot === "01:00";
    const isLocked =
      (isBooked && !isOwnSubscription) ||
      (isSubscriptionLocked && !isOwnSubscription) ||
      exceedsClosing;
    const endSlot = `${String((slotHour + 1) % 24).padStart(2, "0")}:00`;

    return (
      <button
        key={slot}
        type="button"
        disabled={isLocked}
        onClick={() => {
          setSelectedSlot(slot);
          if (
            selectedDuration > 1 &&
            isDurationUnavailable(slot, selectedDuration)
          ) {
            setSelectedDuration(1);
            setDurationNotice(
              "Seçilen saatin devamında yeterli boşluk olmadığı için maç süresi 1 saate ayarlandı.",
            );
          } else {
            setDurationNotice("");
          }
          if (isOwnSubscription)
            setForm((current) => ({
              ...current,
              name: profileDefaults.name,
              phone: profileDefaults.phone,
              subscriber: true,
            }));
          setNotice("");
        }}
        className={`schedule-slot ${isSubscriptionSlot ? "schedule-slot-vip" : ""} ${isLocked ? "schedule-slot-locked" : selectedSlot === slot ? "schedule-slot-selected" : ""}`}
      >
        {isSubscriptionSlot && <Crown className="schedule-slot-crown text-amber-400" size={15} />}
        {isSubscriptionLocked && !isOwnSubscription ? (
          <>
            <span>{slot}</span>
            <i aria-hidden="true">•</i>
            <span>{endSlot}</span>
            <small>DOLU / ABONE</small>
          </>
        ) : isBooked && !isOwnSubscription ? (
          <>
            <span>{slot}</span>
            <small>DOLU</small>
          </>
        ) : (
          <>
            <span className="font-semibold">{slot}</span>
            <i aria-hidden="true">•</i>
            <span className="font-semibold">{endSlot}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <main id="top" className="home-page flex flex-col min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <SiteHeader />
      <SiteImageSync />

      {/* 1. KESİN SIRALAMA: EN TEPEDE HERO VİTRİNİ (order-1) */}
      <section className="order-1 home-section noise field-lines relative flex min-h-[720px] items-center overflow-hidden bg-[#051811] px-5 pb-16 pt-36 lg:min-h-[820px] lg:px-8">
        <div className="mx-auto grid w-full max-w-[1240px] items-end gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div className="relative z-10 max-w-[680px]">
            <div className="mb-6 flex items-center gap-2.5 rounded-full border border-emerald-700/60 bg-emerald-950/80 px-4 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md w-fit">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />{" "}
              Bağmancı Halı Saha · Şanlıurfa
            </div>
            <h1 className="display max-w-[680px] text-[clamp(3.8rem,8vw,7.5rem)] font-extrabold leading-[.9] text-white">
              Maçın adresi <span className="text-emerald-400">belli.</span>
            </h1>
            <p className="mt-8 max-w-[470px] text-lg font-medium leading-8 text-white/90">
              Takımını topla, paketi seç, sahanı ayırt. Gündüz tarifesi 1200 TL,
              gece tarifesi 1800 TL.
            </p>
            <div className="mt-9 flex items-center gap-4">
              <a
                href="#paketler"
                className="inline-flex items-center gap-3 rounded-full bg-amber-400 px-7 py-4 text-sm font-extrabold text-black shadow-lg shadow-amber-400/20 transition hover:bg-amber-300"
              >
                Paket seç <ArrowRight size={18} />
              </a>
              <a
                href="#rezervasyon"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-4 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20"
              >
                Hemen Randevu Al
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[500px] lg:mb-[-55px]">
            <div className="home-photo-card relative aspect-[4/5] overflow-hidden rounded-[180px_180px_18px_18px] border-[10px] border-emerald-900/40 shadow-2xl">
              <img
                className="h-full w-full object-cover"
                src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=85"
                alt="Bağmancı Halı Saha"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#051811]/90 via-transparent to-transparent" />
            </div>
            <div className="home-stat-card absolute -bottom-7 -left-5 flex items-center gap-3.5 rounded-2xl border border-emerald-700/50 bg-[#07241a]/95 p-4 shadow-2xl backdrop-blur-md sm:-left-10">
              <div className="flex -space-x-2">
                <span className="h-9 w-9 rounded-full border-2 border-amber-400 bg-cover" style={{ backgroundImage: "url('https://i.pravatar.cc/80?img=12')" }} />
                <span className="h-9 w-9 rounded-full border-2 border-amber-400 bg-cover" style={{ backgroundImage: "url('https://i.pravatar.cc/80?img=32')" }} />
                <span className="h-9 w-9 rounded-full border-2 border-amber-400 bg-cover" style={{ backgroundImage: "url('https://i.pravatar.cc/80?img=13')" }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/70">Bu hafta sahada</p>
                <p className="font-extrabold text-amber-400">120+ oyuncu</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-7 left-5 hidden items-center gap-3 text-xs font-semibold text-white/60 lg:flex">
          <span className="h-px w-10 bg-amber-400/40" /> Şanlıurfa · Bağmancı
        </div>
      </section>

      {/* 2. KESİN SIRALAMA: TARİFELER (order-2) */}
      <section
        id="paketler"
        className="order-2 home-section scroll-mt-32 px-5 py-20 lg:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="home-kicker mb-4 text-sm font-bold uppercase tracking-[.18em]">
                Tarifeler
              </p>
              <h2 className="home-title display text-4xl font-extrabold leading-none sm:text-5xl">
                İhtiyacına uygun{" "}
                <span>paketi seç.</span>
              </h2>
            </div>
            <p className="home-muted max-w-[290px] text-sm leading-6">
              Gündüz 1200 TL, gece 1800 TL. Tamamlanmış ilk haftadan sonra aktif
              abonelere sabit 1.700 TL fiyat uygulanır.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {packages.map((pack, index) => (
              <article
                key={pack.title}
                className={`pricing-card relative rounded-3xl border p-7 transition ${index === 1 ? "pricing-card-featured md:-translate-y-3" : ""}`}
              >
                <p
                  className={`pricing-card-accent text-sm font-bold ${index === 1 ? "text-amber-600 dark:text-amber-300" : ""}`}
                >
                  {pack.title}
                </p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="display pricing-card-title text-5xl font-extrabold">
                    {pack.price ? `₺${pack.price}` : "Ücretsiz"}
                  </span>
                  {pack.price ? (
                    <span className="home-muted">/saat</span>
                  ) : null}
                </div>
                <p className="pricing-card-note mt-2 text-sm">
                  {pack.note}
                </p>
                <div className="my-7 h-px bg-[var(--line)]" />
                <p className="mb-5 flex items-center gap-3 text-sm">
                  <Check
                    size={17}
                    className={index === 1 ? "text-amber-500" : "text-[var(--green)]"}
                  />{" "}
                  {pack.detail}
                </p>
                <button
                  onClick={() => choosePackage(pack)}
                  className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition ${index === 1 ? "bg-amber-400 text-black hover:bg-amber-300" : "home-ghost-button"}`}
                >
                  Paketi seç <ArrowRight size={16} />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3. KESİN SIRALAMA: REZERVASYON TAKVİMİ (order-3) */}
      <section
        id="rezervasyon"
        className="order-3 home-section scroll-mt-32 px-5 py-20 lg:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-10">
            <div className="subscriber-summary-badge inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold">
              ★ Sabit Abone Olun, 2. Haftadan İtibaren Maç Başı 100 TL Tasarruf Edin
            </div>
            <p className="home-kicker mb-4 mt-4 text-sm font-bold uppercase tracking-[.18em]">
              Canlı takvim
            </p>
            <h2 className="home-title display text-4xl font-extrabold leading-none sm:text-5xl">
              Sahanı ayır,{" "}
              <span>maça başla.</span>
            </h2>
          </div>
          <div className="home-booking-shell grid min-w-0 overflow-visible rounded-[28px] lg:grid-cols-[1.4fr_.8fr]">
            <div className="min-w-0 p-5 sm:p-8">
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <p className="home-muted text-sm">{weekTitle}</p>
                  <p className="home-title display text-xl font-extrabold">Müsaitlikler</p>
                </div>
                <div className="flex gap-2">
                  <button
                    aria-label="Önceki hafta"
                    className="home-ghost-button rounded-full p-2"
                    onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    aria-label="Sonraki hafta"
                    className="home-ghost-button rounded-full p-2"
                    onClick={() => setWeekOffset(weekOffset + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <div className="schedule-days touch-pan-x scrollbar-none mb-6">
                {days.map((item) => (
                  <button
                    key={item.date}
                    disabled={
                      weekOffset === 0 &&
                      item.date < new Date().toISOString().slice(0, 10)
                    }
                    onClick={() => {
                      setSelectedDay(item.date);
                      setSelectedSlot(null);
                      setNotice("");
                    }}
                    className={`min-w-[68px] flex-shrink-0 rounded-2xl border p-3 text-center transition ${weekOffset === 0 && item.date < new Date().toISOString().slice(0, 10) ? "home-chip-disabled cursor-not-allowed" : selectedDay === item.date ? "border-amber-400 bg-amber-400 text-black font-extrabold shadow-[0_0_15px_rgba(251,191,36,0.3)]" : "home-chip hover:border-amber-400/50"}`}
                  >
                    <span className="mt-1 block text-xs font-semibold opacity-60">
                      {item.day}
                    </span>
                    <span className="mt-1 block text-lg font-extrabold">
                      {item.dayNumber}
                    </span>
                  </button>
                ))}
              </div>
              <div className="schedule-row">
                <div className="schedule-row-label">GÜNDÜZ</div>
                <div className="schedule-row-scroll touch-pan-x scrollbar-none">
                  {daytimeSlots.map(renderSlot)}
                </div>
              </div>
              <div className="schedule-row">
                <div className="schedule-row-label">GECE</div>
                <div className="schedule-row-scroll touch-pan-x scrollbar-none">
                  {nighttimeSlots.map(renderSlot)}
                </div>
              </div>
            </div>
            <div className="booking-form-card mx-0 box-border w-full min-w-0 rounded-2xl border-t border-[var(--line)] p-4 sm:rounded-none sm:border-l sm:border-t-0 sm:p-8">
              <div className="mb-8 flex items-center gap-3">
                <CalendarDays className="text-amber-500" />
                <div>
                  <p className="home-muted text-xs">Seçimin</p>
                  <p className="font-bold text-amber-700 dark:text-amber-300">
                    {selectedLabel} {selectedSlot ?? "· saat seç"}
                  </p>
                </div>
              </div>
              <div className="mb-5">
                <p className="mb-2 text-sm font-semibold">Maç süresi</p>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 1.5, 2].map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => selectDuration(duration)}
                      className={`rounded-xl border px-3 py-3 text-sm font-extrabold transition ${selectedDuration === duration ? "border-amber-400 bg-amber-400 text-black" : "home-chip hover:border-amber-400/40"}`}
                    >
                      {duration === 1.5 ? "1,5 saat" : `${duration} saat`}
                    </button>
                  ))}
                </div>
                {durationNotice && (
                  <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {durationNotice}
                  </p>
                )}
              </div>
              <label className="mb-3 block text-sm font-semibold">
                Ad soyad
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  className="home-input mt-2 w-full rounded-xl px-4 py-3 outline-none focus:border-amber-400"
                  placeholder="Takım kaptanı"
                />
              </label>
              <label className="mb-4 block text-sm font-semibold">
                Telefon
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value.replace(/\D/g, "").slice(0, 11),
                    })
                  }
                  className="home-input mt-2 w-full rounded-xl px-4 py-3 outline-none focus:border-amber-400"
                  placeholder="05xx xxx xx xx"
                />
              </label>
              {ownSubscriptionSlot(selectedSlot || "") && (
                <div className="mb-4 inline-flex rounded-full border border-amber-400 bg-amber-500/20 px-4 py-2 text-xs font-black text-amber-800 dark:text-amber-300">
                  ★ Sizin Sabit Abonelik Saatiniz
                </div>
              )}
              {discountEligible && (
                <div className="mb-6 rounded-xl border border-amber-400 bg-amber-500/20 px-4 py-3 text-amber-800 dark:text-amber-300">
                  <div className="text-sm font-black">
                    <span className="mr-2 text-xl line-through opacity-60">
                      1.800 TL
                    </span>
                    <span className="text-xl text-amber-600 dark:text-amber-400">1.700 TL</span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold">
                    ★ Bağmancı Sadık Abone İndirimi Uygulandı
                  </p>
                </div>
              )}
              <div className="mb-5 flex items-center justify-between border-t border-[var(--line)] pt-5">
                <span className="home-muted text-sm">Ödenecek tutar</span>
                <strong className="text-2xl text-amber-600 dark:text-amber-400">
                  {price ? `${price.toFixed(0)} TL` : "Ücretsiz"}
                </strong>
              </div>
              <button
                onClick={submitBooking}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-4 text-sm font-extrabold text-black transition hover:bg-amber-300"
              >
                Maç kaydı oluştur <ArrowRight size={17} />
              </button>

              {/* SABİT HATTAN DOĞRUDAN TEST BUTONU */}
              <button
                type="button"
                disabled={waLoading}
                onClick={sendTestWhatsApp}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-emerald-600 bg-emerald-950/80 px-4 py-3 text-xs font-bold text-emerald-400 transition hover:bg-emerald-900 disabled:opacity-50"
              >
                <MessageCircle size={16} />
                {waLoading ? "Mesaj Gönderiliyor..." : "Sabit Hattan WhatsApp Testi Gönder (0414 247 51 51)"}
              </button>

              {notice && (
                <p className="home-card mt-4 rounded-xl p-3 text-sm">
                  {notice}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. KESİN SIRALAMA: GERÇEK MAÇ KAYITLARI & ARŞİV (order-4) */}
      <section id="kayitlar" className="order-4 scroll-mt-32">
        <MatchArchive />
      </section>

      {/* 5. KESİN SIRALAMA: İLETİŞİM & HARİTA (order-5) */}
      <section
        id="iletisim"
        className="order-5 home-section scroll-mt-32 px-5 py-20 lg:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="home-kicker mb-4 text-sm font-bold uppercase tracking-[.18em]">
                Bize ulaş
              </p>
              <h2 className="home-title display max-w-[500px] text-5xl font-extrabold leading-none">
                Takımın hazırsa,{" "}
                <span>biz de hazırız.</span>
              </h2>
              <p className="home-muted mt-6 max-w-[430px]">
                Bağmancı Halı Saha, Şanlıurfa. Adresimizi haritada açabilir,
                doğrudan bizi arayabilirsin.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="tel:05452237878"
                  className="flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-black hover:bg-amber-300"
                >
                  <Phone size={16} /> 0545 223 78 78
                </a>
                <a
                  href="tel:04142475151"
                  className="home-ghost-button flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
                >
                  <Phone size={16} /> 0414 247 51 51
                </a>
                <a
                  href="mailto:info@bagmancihalisaha.com.tr"
                  className="home-ghost-button flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
                >
                  <Mail size={16} /> info@bagmancihalisaha.com.tr
                </a>
              </div>
              <div className="mt-5 flex gap-3">
                <a
                  aria-label="Instagram hesabımız"
                  href="https://www.instagram.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="home-ghost-button rounded-full p-3"
                >
                  <Instagram size={18} />
                </a>
                <a
                  aria-label="Konumu Google Haritalar'da aç"
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="home-ghost-button rounded-full p-3"
                >
                  <MapPin size={18} />
                </a>
              </div>
            </div>
            <div className="map-frame overflow-hidden rounded-3xl p-2">
              <iframe
                title="Bağmancı Halı Saha konumu"
                src="https://www.google.com/maps?q=Bağmancı+Halı+Saha+Şanlıurfa&output=embed"
                className="h-[360px] w-full rounded-2xl border-0"
                loading="lazy"
              />
            </div>
          </div>
          <div className="mt-16 grid gap-5 border-t border-[var(--line)] pt-8 sm:grid-cols-3">
            <div className="home-card rounded-2xl p-5">
              <Clock3 className="mb-3 text-amber-500" size={24} />
              <p className="text-lg font-bold">Gündüz tarifesi</p>
              <p className="home-muted mt-1 text-sm font-medium">
                12:00 - 18:00 · 1200 TL
              </p>
            </div>
            <div className="home-card rounded-2xl p-5">
              <Clock3 className="mb-3 text-amber-500" size={24} />
              <p className="text-lg font-bold">Gece tarifesi</p>
              <p className="home-muted mt-1 text-sm font-medium">
                18:00 sonrası · 1800 TL
              </p>
            </div>
            <div className="home-card rounded-2xl p-5">
              <Users className="mb-3 text-amber-500" size={24} />
              <p className="text-lg font-bold">Abone avantajı</p>
              <p className="home-muted mt-1 text-sm font-medium">
                İlk tamamlanmış haftadan sonra 1.700 TL abone fiyatı
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="order-6 site-footer border-t px-5 py-8 text-sm lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-4 sm:flex-row">
          <span>© 2026 Bağmancı Halı Saha</span>
          <div className="flex gap-5">
            <a href="/musteri" className="transition hover:text-amber-600 dark:hover:text-amber-400">
              Müşteri girişi
            </a>
            <a href="/gizlilik" className="transition hover:text-amber-600 dark:hover:text-amber-400">
              Gizlilik
            </a>
            <a href="/guvenlik" className="transition hover:text-amber-600 dark:hover:text-amber-400">
              Güvenlik
            </a>
            <a href="mailto:info@bagmancihalisaha.com.tr" className="transition hover:text-amber-600 dark:hover:text-amber-400">
              info@bagmancihalisaha.com.tr
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
