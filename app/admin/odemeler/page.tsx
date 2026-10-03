"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CreditCard, Save, ShieldCheck, Trash2 } from "lucide-react";
import { getSupabaseClient } from "../../../lib/supabase";

type Booking = {
  id: string;
  customer_name: string;
  phone: string;
  booking_date: string;
  booking_time: string;
  duration_hours: number;
  package_name: string;
  total_amount: number;
  paid_amount?: number;
  payment_status: string;
};
const labels: Record<string, string> = {
  paid: "Ödendi",
  approved: "Onaylandı",
  deposit: "Kapora alındı",
  proof_submitted: "Dekont gönderildi · Onay bekliyor",
  unpaid: "Ödenmedi",
  pending: "Ödenmedi",
  rejected: "Reddedildi",
};

export default function AdminPaymentsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [items, setItems] = useState<Booking[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [bank, setBank] = useState({ name: "", iban: "", holder: "" });
  const [message, setMessage] = useState("Kontrol ediliyor...");
  const proofReviewCount = items.filter((item) => item.payment_status === "proof_submitted").length;

  const load = async () => {
    try {
      const client = getSupabaseClient();
      const { data: assurance } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") {
        setMessage("Admin girişi ve 2FA gerekli.");
        return;
      }
      setAuthorized(true);
      const [{ data: bookings, error }, { data: settings }] = await Promise.all(
        [
          client
            .from("booking_requests")
            .select(
              "id, customer_name, phone, booking_date, booking_time, duration_hours, package_name, total_amount, paid_amount, payment_status",
            )
            .order("booking_date", { ascending: false })
            .order("booking_time"),
          client
            .from("site_settings")
            .select("bank_name, iban, iban_holder")
            .eq("id", "main")
            .maybeSingle(),
        ],
      );
      if (error) throw error;
      setItems(bookings || []);
      setAmounts(
        Object.fromEntries(
          (bookings || []).map((item) => [
            item.id,
            String(item.paid_amount || 0),
          ]),
        ),
      );
      setBank({
        name: settings?.bank_name || "",
        iban: settings?.iban || "",
        holder: settings?.iban_holder || "",
      });
      setMessage(bookings?.length ? "" : "Henüz ödeme kaydı yok.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Ödeme verileri yüklenemedi.",
      );
    }
  };
  useEffect(() => {
    load();
  }, []);

  const saveBank = async () => {
    const { error } = await getSupabaseClient()
      .from("site_settings")
      .upsert({
        id: "main",
        bank_name: bank.name,
        iban: bank.iban,
        iban_holder: bank.holder,
        updated_at: new Date().toISOString(),
      });
    setMessage(error?.message || "Ödeme bilgileri kaydedildi.");
  };
  const savePayment = async (item: Booking, forcedStatus?: string) => {
    const paid = Number(amounts[item.id] || 0);
    const status = forcedStatus || (paid <= 0 ? "unpaid" : paid >= Number(item.total_amount) ? "paid" : "deposit");
    const { error } = await getSupabaseClient()
      .from("booking_requests")
      .update({ paid_amount: paid, payment_status: status })
      .eq("id", item.id);
    if (error) setMessage(error.message);
    else {
      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? { ...row, paid_amount: paid, payment_status: status }
            : row,
        ),
      );
      setMessage(`Durum güncellendi: ${labels[status]}.`);
    }
  };
  const removeBooking = async (id: string) => {
    if (!window.confirm("Bu rezervasyon silinsin mi?")) return;
    const { error } = await getSupabaseClient()
      .from("booking_requests")
      .delete()
      .eq("id", id);
    if (error) setMessage(error.message);
    else setItems((current) => current.filter((item) => item.id !== id));
  };

  if (!authorized)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--green)] px-5">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <ShieldCheck className="mx-auto mb-5 text-[var(--green)]" size={36} />
          <h1 className="display text-2xl font-extrabold">
            Yetkili admin girişi gerekli
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Ödeme yönetimi için admin girişi ve 2FA gerekir.
          </p>
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
    <main className="admin-page admin-payments-page min-h-screen bg-[#f5f7f3] px-5 py-8 text-[var(--ink)] lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <a
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--green)]"
          >
            <ArrowLeft size={16} /> Admin paneline dön
          </a>
          <a
            href="/admin/arsiv"
            className="rounded-full border bg-white px-4 py-2 text-sm font-bold"
          >
            Arşivi aç
          </a>
        </div>
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--green)]">
            Ödeme yönetimi
          </p>
          <h1 className="display mt-2 text-4xl font-extrabold">
            Ödeme sistemi
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Banka bilgilerini ve rezervasyonların ödenen tutarlarını yönet.
          </p>
        </div>
        <section className="mb-8 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="text-[var(--green)]" />
            <div>
              <h2 className="font-extrabold">Ödeme bilgileri</h2>
              <p className="text-xs text-[var(--muted)]">
                Müşterinin ödeme ekranında göreceği bilgiler.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              value={bank.name}
              onChange={(event) =>
                setBank({ ...bank, name: event.target.value })
              }
              className="rounded-xl border p-3 text-sm"
              placeholder="Banka adı"
            />
            <input
              value={bank.holder}
              onChange={(event) =>
                setBank({ ...bank, holder: event.target.value })
              }
              className="rounded-xl border p-3 text-sm"
              placeholder="Hesap sahibi"
            />
            <input
              value={bank.iban}
              onChange={(event) =>
                setBank({ ...bank, iban: event.target.value })
              }
              className="rounded-xl border p-3 text-sm"
              placeholder="IBAN"
            />
          </div>
          <button
            type="button"
            onClick={saveBank}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--green)] px-5 py-3 text-sm font-extrabold text-white"
          >
            <Save size={16} /> Ödeme bilgilerini kaydet
          </button>
        </section>
        {message && (
          <p className="mb-5 rounded-xl bg-white p-4 text-sm font-semibold text-[var(--green)]">
            {message}
          </p>
        )}
        {proofReviewCount > 0 && (
          <p role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
            {proofReviewCount} dekont admin onayı bekliyor. İlgili rezervasyon satırını buradan, maç defterinde ise adına tıklayarak açabilirsin.
          </p>
        )}
        <section className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-extrabold">
                    {item.customer_name} · {item.phone}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--green)]">
                    {item.booking_date} · {item.booking_time} ·{" "}
                    {item.package_name} · {item.duration_hours || 1} saat
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Toplam ₺{item.total_amount} · Durum:{" "}
                    <strong>
                      {labels[item.payment_status] || item.payment_status}
                    </strong>
                  </p>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={amounts[item.id] || "0"}
                      onChange={(event) =>
                        setAmounts({ ...amounts, [item.id]: event.target.value })
                      }
                      className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm md:w-28 md:flex-none"
                      aria-label="Ödenen tutar"
                    />
                    <button
                      type="button"
                      onClick={() => savePayment(item)}
                      className="shrink-0 rounded-full bg-[var(--green)] px-3 py-2 text-xs font-bold leading-tight text-white"
                    >
                      Tutarı kaydet
                    </button>
                  </div>
                  <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-2 md:flex">
                    <button type="button" onClick={() => savePayment(item, "paid")} className="min-w-0 rounded-full bg-[var(--green)] px-2 py-2 text-xs font-bold leading-tight text-white">Tamamı</button>
                    <button type="button" onClick={() => savePayment(item, "deposit")} className="min-w-0 rounded-full bg-[#fff1c9] px-2 py-2 text-xs font-bold leading-tight text-[#8a5a00]">Kapora</button>
                    <button type="button" onClick={() => savePayment(item, "unpaid")} className="min-w-0 rounded-full border px-2 py-2 text-xs font-bold leading-tight">Ödenmedi</button>
                    <button
                      type="button"
                      onClick={() => removeBooking(item.id)}
                      className="rounded-full p-2 text-red-600"
                      aria-label="Rezervasyonu sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
