"use client";

import { useEffect, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import FieldHero from "./components/FieldHero";
import WelcomeIntro from "./components/WelcomeIntro";
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
  Phone,
  Play,
  Users,
} from "lucide-react";
import SiteHeader from "./components/SiteHeader";
import SiteImageSync from "./components/SiteImageSync";
import MatchArchive from "./components/MatchArchive";
import AppleButton from "./components/AppleButton";
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
  const [slotFeedback, setSlotFeedback] = useState(0);
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
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [subscriberVerified, setSubscriberVerified] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileDefaults, setProfileDefaults] = useState({
    name: "",
    phone: "",
  });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (otpSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setOtpSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpSeconds]);

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
  const selectedWeekday = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
  })
    .format(new Date(`${selectedDay}T12:00:00`))
    .toLocaleLowerCase("tr-TR");
  const selectedSubscriptionPrice =
    subscriberVerified &&
    Boolean(
      selectedSlot &&
        subscriptionSlots.some(
          (item) =>
            item.user_id === currentUserId &&
            item.subscription_day.toLocaleLowerCase("tr-TR") === selectedWeekday &&
            item.subscription_time.startsWith(selectedSlot) &&
            item.active,
        ),
    );
  const price =
    selectedSubscriptionPrice && tariffPrice
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

  const sendOtp = async () => {
    const phone = form.phone.replace(/\s/g, "");
    if (!form.name.trim() || !/^0\d{10}$/.test(phone)) {
      setOtpError("Önce ad soyad ve geçerli telefon numaranızı girin.");
      return;
    }
    setOtpBusy(true);
    setOtpError("");
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Kod gönderilemedi.");
      setOtpSent(true);
      setPhoneVerified(false);
      setOtpCode("");
      setOtpSeconds(60);
      setNotice("Doğrulama kodu WhatsApp üzerinden gönderildi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kod gönderilemedi.";
      setOtpError(message);
      setNotice(message);
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyOtp = async (value = otpCode) => {
    const code = value.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) return false;
    setOtpBusy(true);
    setOtpError("");
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, code }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Hatalı veya süresi dolmuş kod.");
      setPhoneVerified(true);
      setOtpError("");
      setNotice("Telefon numaranız doğrulandı. Rezervasyonunuzu tamamlayabilirsiniz.");
      return true;
    } catch (error) {
      setPhoneVerified(false);
      setOtpError(error instanceof Error ? error.message : "Hatalı veya süresi dolmuş kod.");
      return false;
    } finally {
      setOtpBusy(false);
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
    if (!phoneVerified) {
      if (!otpSent) {
        await sendOtp();
        return;
      }
      const verified = await verifyOtp();
      if (!verified) return;
    }
    setNotice("Maç kaydı oluşturuluyor...");
    try {
      const client = getSupabaseClient();
      if (await refreshSlotAvailability()) {
        setNotice("Seçtiğiniz saat artık müsait değil. Lütfen başka bir saat seçin.");
        return;
      }
      const { data: sessionData } = await client.auth.getSession();
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token
            ? { Authorization: `Bearer ${sessionData.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          date: selectedDay,
          time: selectedSlot,
          duration: selectedDuration,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Rezervasyon oluşturulamadı.");
      }
      const data = result.booking;

      setBooked((current) => [
        ...current,
        { date: selectedDay, time: selectedSlot, duration: selectedDuration },
      ]);
      setSelectedSlot(null);
      setForm({ name: "", phone: "", subscriber: false });
      setOtpCode("");
      setOtpSent(false);
      setPhoneVerified(false);
      setOtpSeconds(0);
      window.location.href = `/odeme?booking=${data.id}&token=${data.payment_token}`;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Maç kaydı oluşturulamadı: ${error.message}`
          : "Maç kaydı oluşturulamadı.",
      );
    }
  };

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
      <motion.button
        key={slot}
        type="button"
        disabled={isLocked}
        aria-pressed={!isLocked && selectedSlot === slot}
        whileHover={isLocked ? undefined : { scale: 1.02 }}
        whileTap={isLocked ? undefined : { scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onClick={() => {
          setSlotFeedback((value) => value + 1);
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
        {!isLocked && selectedSlot === slot && (
          <span key={slotFeedback} className="slot-feedback" aria-hidden="true">
            <span className="slot-selection-wave" />
            <Check className="slot-selection-check" size={13} strokeWidth={3} />
          </span>
        )}
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
      </motion.button>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
    <WelcomeIntro />
    <main id="top" className="home-page field-design flex flex-col min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <SiteHeader />
      <SiteImageSync />

      <FieldHero />

      {/* 3. KESİN SIRALAMA: TARİFELER (order-3) */}
      <motion.section
        id="paketler"
        className="order-3 home-section scroll-mt-32 px-5 py-20 lg:px-8 lg:py-28"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
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
              <motion.article
                key={pack.title}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
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
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => choosePackage(pack)}
                  className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition ${index === 1 ? "bg-amber-400 text-black hover:bg-amber-300" : "home-ghost-button"}`}
                >
                  Paketi seç <ArrowRight size={16} />
                </motion.button>
              </motion.article>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 2. KESİN SIRALAMA: REZERVASYON TAKVİMİ (order-2) */}
      <motion.section
        id="rezervasyon"
        className="order-2 home-section scroll-mt-32 px-5 pb-20 pt-4 lg:px-8 lg:pb-24 lg:pt-8"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
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
          <div className="home-booking-shell grid min-w-0 overflow-visible rounded-3xl lg:grid-cols-[1.4fr_.8fr]">
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
              <div className="schedule-days">
                {days.map((item) => (
                  <motion.button
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
                    whileHover={weekOffset === 0 && item.date < new Date().toISOString().slice(0, 10) ? undefined : { scale: 1.02 }}
                    whileTap={weekOffset === 0 && item.date < new Date().toISOString().slice(0, 10) ? undefined : { scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`relative min-w-0 rounded-2xl border px-2 py-3 text-center transition ${weekOffset === 0 && item.date < new Date().toISOString().slice(0, 10) ? "home-chip-disabled pointer-events-none opacity-40" : selectedDay === item.date ? "home-chip-active" : "home-chip hover:border-amber-400/50"}`}
                  >
                    {selectedDay === item.date && <motion.span layoutId="day-activeIndicator" className="absolute inset-0 -z-0 rounded-2xl bg-white/[0.12] shadow-[0_0_24px_rgba(52,211,153,0.2)]" />}
                    <span className="relative z-10 block text-xs font-medium text-[var(--text-secondary)]">
                      {item.day}
                    </span>
                    <span className="relative z-10 mt-1 block text-base font-bold text-[var(--text-primary)] sm:text-lg">
                      {item.dayNumber}
                    </span>
                  </motion.button>
                ))}
              </div>
              <div className="schedule-row schedule-daytime">
                <div className="schedule-row-label"><Clock3 size={15} /> Gündüz Tarifesi</div>
                <div className="schedule-row-scroll touch-pan-x scrollbar-none">
                  {daytimeSlots.map(renderSlot)}
                </div>
              </div>
              <div className="schedule-row schedule-nighttime">
                <div className="schedule-row-label"><Crown size={15} /> Gece Tarifesi</div>
                <div className="schedule-row-scroll touch-pan-x scrollbar-none">
                  {nighttimeSlots.map(renderSlot)}
                </div>
              </div>
            </div>
            <div className="booking-form-card mx-0 box-border w-full min-w-0 rounded-3xl border border-[var(--border)] p-6 shadow-2xl lg:rounded-l-none lg:border-l lg:p-8">
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
                    <motion.button
                      key={duration}
                      type="button"
                      onClick={() => selectDuration(duration)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={`relative rounded-xl border px-3 py-3 text-sm font-extrabold transition ${selectedDuration === duration ? "home-chip-active" : "home-chip hover:border-emerald-400/40"}`}
                    >
                      {selectedDuration === duration && <motion.span layoutId="duration-activeIndicator" className="absolute inset-0 -z-0 rounded-xl bg-emerald-400/15 shadow-[0_0_20px_rgba(52,211,153,0.18)]" />}
                      {duration === 1.5 ? "1,5 saat" : `${duration} saat`}
                    </motion.button>
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
                  disabled={otpSent && !phoneVerified}
                  onChange={(event) =>
                    (() => {
                      setForm({
                        ...form,
                        phone: event.target.value.replace(/\D/g, "").slice(0, 11),
                      });
                      setOtpSent(false);
                      setPhoneVerified(false);
                      setOtpCode("");
                      setOtpError("");
                    })()
                  }
                  className="home-input mt-2 w-full rounded-xl px-4 py-3 outline-none focus:border-amber-400"
                  placeholder="05xx xxx xx xx"
                />
              </label>
              {!otpSent && !phoneVerified && (
                <>
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={otpBusy}
                    className="otp-send-button mb-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition disabled:cursor-wait disabled:opacity-60"
                  >
                    {otpBusy ? "Kod gönderiliyor..." : "Doğrulama Kodu Gönder"}
                  </button>
                  {otpError && <p role="alert" className="otp-error-text mb-4 text-xs font-bold">{otpError}</p>}
                </>
              )}
              {otpSent && !phoneVerified && (
                <div className="otp-panel mb-5 rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold">WhatsApp kodunu girin</p>
                      <p className="mt-1 text-xs opacity-70">Kod telefonunuza gönderildi.</p>
                    </div>
                    <span className="otp-countdown text-xs font-bold">
                      {otpSeconds > 0
                        ? `Yeniden kod iste: 00:${String(otpSeconds).padStart(2, "0")}`
                        : "Yeni kod iste"}
                    </span>
                  </div>
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtpCode(value);
                      setOtpError("");
                      if (value.length === 6) void verifyOtp(value);
                    }}
                    className={`otp-code-input mt-3 w-full rounded-xl px-4 py-3 text-center text-xl font-black tracking-[.45em] outline-none ${otpError ? "otp-input-error" : ""}`}
                    placeholder="000000"
                    aria-label="6 haneli WhatsApp doğrulama kodu"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className={`min-h-5 text-xs font-bold ${otpError ? "otp-error-text" : "opacity-0"}`}>
                      {otpError || "Kod hazır"}
                    </p>
                    <button
                      type="button"
                      onClick={sendOtp}
                      disabled={otpBusy || otpSeconds > 0}
                      className="otp-resend-button text-xs font-bold underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Yeniden gönder
                    </button>
                  </div>
                </div>
              )}
              {phoneVerified && (
                <div className="otp-verified mb-5 rounded-xl border px-4 py-3 text-sm font-bold">
                  <Check size={16} /> Telefon numarası doğrulandı
                </div>
              )}
              {ownSubscriptionSlot(selectedSlot || "") && (
                <div className="mb-4 inline-flex rounded-full border border-amber-400 bg-amber-500/20 px-4 py-2 text-xs font-black text-amber-800 dark:text-amber-300">
                  ★ Sizin Sabit Abonelik Saatiniz
                </div>
              )}
              {selectedSubscriptionPrice && (
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
              <div className="mb-5 flex items-center justify-between border-t border-[var(--border)] pt-5">
                <span className="home-muted text-sm">Ödenecek tutar</span>
                <strong className="text-3xl font-black text-[var(--accent-gold)]">
                  {price ? `${price.toFixed(0)} TL` : "Ücretsiz"}
                </strong>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={submitBooking}
                className="apple-booking-cta flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold transition hover:opacity-95"
              >
                {phoneVerified ? "Rezervasyonu Onayla" : otpSent ? "Kodu Doğrula" : "Doğrulama Kodu Gönder"} <ArrowRight size={17} />
              </motion.button>

              {notice && (
                <p className="home-card mt-4 rounded-xl p-3 text-sm">
                  {notice}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.section>

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
    </MotionConfig>
  );
}
