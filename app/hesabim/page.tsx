"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  Crown,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase";

const subscriptionDays = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
const subscriptionHours = [
  "17:00 - 18:00",
  "18:00 - 19:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
  "21:00 - 22:00",
  "22:00 - 23:00",
  "23:00 - 00:00",
  "00:00 - 01:00",
  "01:00 - 02:00",
];
type AccountProfile = {
  phone: string;
  subscriber: boolean;
  subscription_package: string;
  preferred_subscription_day: string;
  preferred_subscription_time: string;
};
type UserBooking = {
  id: string;
  booking_date: string;
  booking_time: string;
  package_name: string;
  total_amount: number;
  payment_status: string;
};
type SubscriptionSlot = {
  id: string;
  subscription_day: string;
  subscription_time: string;
  field_name: string;
  remaining_weeks: number;
  active: boolean;
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [profile, setProfile] = useState<AccountProfile>({
    phone: "",
    subscriber: false,
    subscription_package: "",
    preferred_subscription_day: "",
    preferred_subscription_time: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionSlot | null>(
    null,
  );

  useEffect(() => {
    const load = async () => {
      const client = getSupabaseClient();
      const { data } = await client.auth.getUser();
      if (!data.user) {
        setLoading(false);
        window.location.href = "/musteri";
        return;
      }
      setEmail(data.user.email || "");
      setFullName(data.user.user_metadata?.full_name || "");
      const { data: saved, error } = await client
        .from("profiles")
        .select(
          "phone, subscriber, subscription_package, preferred_subscription_day, preferred_subscription_time",
        )
        .eq("id", data.user.id)
        .maybeSingle();
      if (!error && saved)
        setProfile({
          phone: saved.phone || data.user.user_metadata?.phone || "",
          subscriber: Boolean(saved.subscriber),
          subscription_package: saved.subscription_package || "",
          preferred_subscription_day: saved.preferred_subscription_day || "",
          preferred_subscription_time: saved.preferred_subscription_time || "",
        });
      const { data: savedSubscription } = await client
        .from("subscription_slots")
        .select(
          "id, subscription_day, subscription_time, field_name, remaining_weeks, active",
        )
        .eq("user_id", data.user.id)
        .eq("active", true)
        .maybeSingle();
      setSubscription(savedSubscription || null);
      const { data: userBookings } = await client
        .from("booking_requests")
        .select(
          "id, booking_date, booking_time, package_name, total_amount, payment_status",
        )
        .eq("user_id", data.user.id)
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false });
      setBookings(userBookings || []);
      setLoading(false);
    };
    load().catch(() => {
      setMessage("Hesap bilgileri yüklenemedi.");
      setLoading(false);
    });
  }, []);

  const updateField = (field: keyof AccountProfile, value: string | boolean) =>
    setProfile((current) => ({ ...current, [field]: value }));
  const save = async () => {
    setSaving(true);
    setMessage("");
    const client = getSupabaseClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return;
    const phone = profile.phone.replace(/\D/g, "").slice(0, 11);
    const normalizedName = fullName.trim();
    const { error: authError } = await client.auth.updateUser({
      data: { full_name: normalizedName, phone },
    });
    if (authError) {
      setSaving(false);
      setMessage(`Telefon bilgisi güncellenemedi: ${authError.message}`);
      return;
    }
    if (!profile.subscriber || !subscription?.active) {
      const { error } = await client
        .from("profiles")
        .upsert({
          id: data.user.id,
          email: data.user.email || "",
          full_name: normalizedName,
          phone,
          subscriber: false,
        });
      setSaving(false);
      setMessage(error ? error.message : "Başarıyla güncellendi");
      return;
    }
    if (
      !profile.preferred_subscription_day ||
      !profile.preferred_subscription_time
    ) {
      setSaving(false);
      setMessage("Abonelik günü ve saati seçmelisin.");
      return;
    }
    const { data: occupiedSlot } = await client
      .from("subscription_slots")
      .select("user_id")
      .eq("subscription_day", profile.preferred_subscription_day)
      .eq("subscription_time", profile.preferred_subscription_time)
      .eq("active", true)
      .maybeSingle();
    if (occupiedSlot && occupiedSlot.user_id !== data.user.id) {
      setSaving(false);
      setMessage("Bu gün ve saat başka bir Gold üyeye ait.");
      return;
    }
    await client
      .from("subscription_slots")
      .update({ active: false })
      .eq("user_id", data.user.id)
      .eq("active", true);
    const { data: previousSlot } = await client
      .from("subscription_slots")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("subscription_day", profile.preferred_subscription_day)
      .eq("subscription_time", profile.preferred_subscription_time)
      .maybeSingle();
    const slotQuery = previousSlot
      ? client
          .from("subscription_slots")
          .update({ active: true })
          .eq("id", previousSlot.id)
      : client.from("subscription_slots").insert({
          user_id: data.user.id,
          subscription_day: profile.preferred_subscription_day,
          subscription_time: profile.preferred_subscription_time,
          active: true,
        });
    const { data: savedSlot, error: slotError } = await slotQuery
      .select(
        "id, subscription_day, subscription_time, field_name, remaining_weeks, active",
      )
      .single();
    if (slotError) {
      setSaving(false);
      setMessage(
        slotError.code === "23505"
          ? "Bu gün ve saat başka bir Gold üyeye ait."
          : slotError.message,
      );
      return;
    }
    const { error } = await client.from("profiles").upsert({
      id: data.user.id,
      email: data.user.email || "",
      full_name: normalizedName,
      phone,
      subscriber: profile.subscriber,
      subscription_package:
        profile.subscription_package || "Haftalık Sabit Saha Aboneliği",
      preferred_subscription_day: profile.preferred_subscription_day,
      preferred_subscription_time: profile.preferred_subscription_time,
    });
    setSubscription({
      id: savedSlot?.id || "local",
      subscription_day: profile.preferred_subscription_day,
      subscription_time: profile.preferred_subscription_time,
      field_name: "Bağmancı Halı Saha",
      remaining_weeks: 12,
      active: true,
    });
    setSaving(false);
    setMessage(error ? error.message : "Başarıyla güncellendi");
  };
  const signOut = async () => {
    await getSupabaseClient().auth.signOut();
    window.location.href = "/";
  };
  const toggleSubscription = async () => {
    if (!subscription) return;
    const nextActive = !subscription.active;
    const { error } = await getSupabaseClient()
      .from("subscription_slots")
      .update({ active: nextActive })
      .eq("id", subscription.id);
    if (!error) {
      setSubscription({ ...subscription, active: nextActive });
      setProfile({ ...profile, subscriber: nextActive });
      setMessage(
        nextActive
          ? "Abonelik yeniden aktifleştirildi."
          : "Abonelik donduruldu.",
      );
    }
  };

  const isGold = Boolean(profile.subscriber && subscription?.active);
  const canManageSubscription = isGold;

  if (loading)
    return (
      <main className="account-page flex min-h-screen items-center justify-center">
        <p>Hesap yükleniyor...</p>
      </main>
    );
  return (
    <main
      className={`account-page min-h-screen px-5 py-28 text-[var(--ink)] sm:px-8 ${isGold ? "account-page-gold" : ""}`}
    >
      <div className="mx-auto max-w-5xl">
        <a href="/" className="account-back">
          <ArrowLeft size={16} /> Siteye dön
        </a>
        <div className="account-heading">
          <div>
            <p className="account-eyebrow">HESAP MERKEZİ</p>
            <h1>{fullName ? `Merhaba, ${fullName}` : "Hesabım"}</h1>
            <p>
              Profilini, iletişim bilgilerini ve saha aboneliğini buradan yönet.
            </p>
          </div>
          <button type="button" onClick={signOut} className="account-signout">
            <LogOut size={16} /> Çıkış Yap
          </button>
        </div>
        <div className="account-layout">
          <section className="account-card">
            <div className="account-card-heading">
              <span className="account-icon">
                <UserRound size={20} />
              </span>
              <div>
                <h2>Google bilgileri</h2>
                <p>Güvenli hesap bilgilerin</p>
              </div>
            </div>
            <label>
              E-posta
              <input value={email} disabled />
              <small>
                <ShieldCheck size={13} /> Google ile doğrulandı, değiştirilemez
              </small>
            </label>
            <label>
              Ad Soyad
              <input value={fullName} disabled />
              <small>Google hesabından otomatik alınır.</small>
            </label>
          </section>
          <section className="account-card">
            <div className="account-card-heading">
              <span className="account-icon">
                <Clock3 size={20} />
              </span>
              <div>
                <h2>İletişim ve üyelik</h2>
                <p>Rezervasyon tercihlerini güncel tut</p>
              </div>
            </div>
            <label>
              Cep Telefonu
              <input
                value={profile.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="05xx xxx xx xx"
              />
            </label>
            <div className={`account-membership ${isGold ? "active" : ""}`}>
              <div>
                <span>Abonelik durumu</span>
                <strong>{isGold ? "★ GOLD ÜYELİK" : "Standart üyelik"}</strong>
              </div>
              {isGold ? <Crown size={20} /> : <Check size={20} />}
            </div>
            <div className="account-subscription-grid">
              <label>
                Abonelik Günü
                <select
                  disabled={!canManageSubscription}
                  value={profile.preferred_subscription_day}
                  onChange={(event) =>
                    updateField(
                      "preferred_subscription_day",
                      event.target.value,
                    )
                  }
                >
                  <option value="">Gün seçin</option>
                  {subscriptionDays.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Abonelik Saati
                <select
                  disabled={!canManageSubscription}
                  value={profile.preferred_subscription_time}
                  onChange={(event) =>
                    updateField(
                      "preferred_subscription_time",
                      event.target.value,
                    )
                  }
                >
                  <option value="">Saat seçin</option>
                  {subscriptionHours.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!canManageSubscription && (
              <p className="account-membership-note">
                Abonelik günü ve saati yalnızca aktif aboneler tarafından
                düzenlenebilir.
              </p>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="account-save"
            >
              <Save size={17} />{" "}
              {saving ? "Kaydediliyor..." : "Bilgileri Güncelle"}
            </button>
            {message && (
              <p
                className={`account-message ${message === "Başarıyla güncellendi" ? "success" : ""}`}
              >
                {message}
              </p>
            )}
          </section>
        </div>
        <section
          id="abonelik"
          className={`account-card account-subscription-card ${subscription?.active ? "gold" : ""}`}
        >
          <div className="account-card-heading">
            <span className="account-icon">
              <Crown size={20} />
            </span>
            <div>
              <h2>Aboneliklerim</h2>
              <p>Haftalık sabit saha üyeliğin</p>
            </div>
          </div>
          {subscription ? (
            <div className="account-subscription-detail">
              <div>
                <span>GÜN / SAAT</span>
                <strong>
                  {subscription.subscription_day} ·{" "}
                  {subscription.subscription_time}
                </strong>
              </div>
              <div>
                <span>HALI SAHA</span>
                <strong>{subscription.field_name}</strong>
              </div>
              <div>
                <span>KALAN HAFTA</span>
                <strong>{subscription.remaining_weeks} hafta</strong>
              </div>
              <button type="button" onClick={toggleSubscription}>
                {subscription.active ? "Aboneliği Dondur" : "Aboneliği Yönet"}
              </button>
            </div>
          ) : (
            <p className="account-empty">
              Henüz aktif bir haftalık sabit aboneliğiniz bulunmuyor. Yukarıdan
              gün ve saat seçerek hemen abone olabilirsiniz.
            </p>
          )}
        </section>
        <section id="rezervasyonlar" className="account-card account-bookings">
          <div className="account-card-heading">
            <span className="account-icon">
              <Clock3 size={20} />
            </span>
            <div>
              <h2>Rezervasyonlarım</h2>
              <p>Hesabına bağlı son rezervasyonların</p>
            </div>
          </div>
          {bookings.length ? (
            <div className="account-booking-list">
              {bookings.map((booking) => (
                <div className="account-booking-row" key={booking.id}>
                  <div>
                    <strong>
                      {new Intl.DateTimeFormat("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                      }).format(new Date(`${booking.booking_date}T12:00:00`))}
                    </strong>
                    <span>{booking.booking_time}</span>
                  </div>
                  <div>
                    <b>{booking.package_name}</b>
                    <small>{booking.payment_status}</small>
                  </div>
                  <strong>
                    ₺{Number(booking.total_amount).toLocaleString("tr-TR")}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="account-empty">
              Henüz hesabına bağlı bir rezervasyon bulunmuyor.
            </p>
          )}
        </section>
        <div className="account-links">
          <a href="#rezervasyonlar">Rezervasyonlarım</a>
          <a href="#abonelik">Aboneliklerim</a>
        </div>
      </div>
    </main>
  );
}
