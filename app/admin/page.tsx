"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CreditCard,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase";
import AdminBookingsPage from "./rezervasyonlar/page";

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaMode, setMfaMode] = useState<"verify" | "enroll" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return;
    }

    const syncAssurance = async () => {
      const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      setLoggedIn(Boolean(data && data.currentLevel === "aal2"));
    };
    syncAssurance();
    const now = new Date();
    const nextLogout = new Date(now);
    nextLogout.setHours(3, 0, 0, 0);
    if (nextLogout <= now) nextLogout.setDate(nextLogout.getDate() + 1);
    const logoutTimer = window.setTimeout(async () => {
      await client.auth.signOut();
      setLoggedIn(false);
      setMfaMode(null);
      setLoginError(
        "Güvenlik nedeniyle admin oturumunuz saat 03:00'te kapatıldı.",
      );
    }, nextLogout.getTime() - now.getTime());
    const { data: listener } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) setLoggedIn(false);
      },
    );
    return () => {
      window.clearTimeout(logoutTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      setLoginError("Kullanıcı adı ve şifre zorunludur.");
      return;
    }
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signInWithPassword({
        email: loginForm.username.trim(),
        password: loginForm.password,
      });
      if (error) {
        setLoginError(`Supabase: ${error.message}`);
        return;
      }
      const { data: factors } = await client.auth.mfa.listFactors();
      const factor = factors?.totp.find((item) => item.status === "verified");
      if (factor) {
        const { data: challenge, error: challengeError } =
          await client.auth.mfa.challenge({ factorId: factor.id });
        if (challengeError) throw challengeError;
        setMfaFactorId(factor.id);
        setMfaChallengeId(challenge.id);
        setMfaMode("verify");
        setLoginError("");
        return;
      }
      const { data: enrollment, error: enrollmentError } =
        await client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Bağmancı Admin",
        });
      if (enrollmentError) throw enrollmentError;
      setMfaFactorId(enrollment.id);
      setMfaQrCode(enrollment.totp.qr_code);
      setMfaSecret(enrollment.totp.secret);
      setMfaMode("enroll");
      setLoginError("");
    } catch {
      setLoginError(
        "MFA kurulamadı. Supabase Auth ayarlarını ve Vercel değişkenlerini kontrol edin.",
      );
    }
  };

  const verifyMfa = async () => {
    if (!mfaCode || !mfaFactorId) {
      setLoginError("6 haneli doğrulama kodunu girin.");
      return;
    }
    try {
      const client = getSupabaseClient();
      const { data: challenge, error: challengeError } =
        await client.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;
      setMfaChallengeId(challenge.id);
      const { error } = await client.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      });
      if (error) throw error;
      setLoggedIn(true);
      setMfaMode(null);
      setMfaCode("");
      setLoginError("");
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? `Doğrulama başarısız: ${error.message}`
          : "Kod hatalı veya süresi doldu. Yeni bir kod deneyin.",
      );
    }
  };

  const refreshMfaChallenge = async () => {
    if (!mfaFactorId) return;
    try {
      const { data, error } = await getSupabaseClient().auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (error) throw error;
      setMfaChallengeId(data.id);
      setMfaCode("");
      setLoginError("Yeni doğrulama isteği hazır. Authenticator kodunu girin.");
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Yeni doğrulama isteği alınamadı.",
      );
    }
  };

  const signOut = async () => {
    await getSupabaseClient().auth.signOut();
    setLoggedIn(false);
    setMfaMode(null);
  };

  if (!loggedIn && mfaMode)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--green)] px-5 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lime)] text-[var(--green)]">
            <ShieldCheck size={26} />
          </div>
          <h1 className="display text-3xl font-extrabold">
            İki aşamalı doğrulama
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {mfaMode === "enroll"
              ? "Authenticator uygulamasını açıp QR kodu okutun, sonra 6 haneli kodu girin."
              : "Authenticator uygulamanızdaki 6 haneli kodu girin."}
          </p>
          {mfaQrCode && (
            <img
              src={mfaQrCode}
              alt="MFA QR kodu"
              className="mx-auto my-6 h-48 w-48 rounded-xl"
            />
          )}
          {mfaSecret && (
            <p className="break-all rounded-xl bg-[#f5f7f3] p-3 text-xs text-[var(--muted)]">
              Kurulum anahtarı: {mfaSecret}
            </p>
          )}
          <input
            inputMode="numeric"
            maxLength={6}
            value={mfaCode}
            onChange={(event) =>
              setMfaCode(event.target.value.replace(/\D/g, ""))
            }
            className="mt-6 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-center text-xl tracking-[.4em] outline-none focus:border-[var(--green)]"
            placeholder="000000"
          />
          <button
            onClick={verifyMfa}
            className="mt-5 w-full rounded-full bg-[var(--green)] px-5 py-4 text-sm font-extrabold text-white"
          >
            Kodu doğrula
          </button>
          <button
            type="button"
            onClick={refreshMfaChallenge}
            className="mt-3 w-full rounded-full border border-[var(--line)] px-5 py-3 text-sm font-bold text-[var(--green)]"
          >
            Yeni doğrulama iste
          </button>
          {loginError && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {loginError}
            </p>
          )}
        </div>
      </main>
    );

  if (!loggedIn)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--green)] px-5 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
          <a
            href="/"
            className="mb-10 flex items-center gap-2 text-sm font-bold text-[var(--green)]"
          >
            <ArrowLeft size={16} /> Siteye dön
          </a>
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lime)] text-[var(--green)]">
            <LockKeyhole size={26} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--green)]">
            Bağmancı Halı Saha
          </p>
          <h1 className="display mt-3 text-4xl font-extrabold">Admin girişi</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Rezervasyonları ve saha ayarlarını yönetmek için giriş yap.
          </p>
          <label className="mt-8 block text-sm font-bold">
            E-posta
            <input
              type="email"
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm({ ...loginForm, username: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--green)]"
              placeholder="admin@ornek.com"
            />
          </label>
          <label className="mt-4 block text-sm font-bold">
            Şifre
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm({ ...loginForm, password: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--green)]"
              placeholder="Şifreniz"
            />
          </label>
          <button
            onClick={handleLogin}
            className="mt-6 w-full rounded-full bg-[var(--green)] px-5 py-4 text-sm font-extrabold text-white"
          >
            Giriş yap
          </button>
          {loginError && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {loginError}
            </p>
          )}
        </div>
      </main>
    );

  return (
    <main className="admin-dashboard min-h-screen bg-[#f5f7f3] text-[var(--ink)]">
      <header className="admin-luxury-header sticky top-0 z-40 px-5 py-5 text-white lg:px-10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <a href="/" className="admin-luxury-brand"><span><Trophy size={18} /></span> BAĞMANCI <b>ADMIN</b></a>
          <div className="hidden items-center gap-2 md:flex">
            <a href="/admin/odemeler" className="admin-vip-pill"><CreditCard size={14} /> Ödeme</a>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <a href="/admin/odemeler" aria-label="Ödeme" className="admin-vip-pill">Ödeme</a>
            <button aria-label="Menüyü aç" className="admin-menu-button" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
          </div>
          <nav
            className={`${menuOpen ? "flex" : "hidden"} absolute left-4 right-4 top-20 z-10 flex-col gap-4 rounded-xl bg-white p-5 text-[var(--ink)] shadow-xl md:static md:flex md:flex-row md:items-center md:gap-6 md:bg-transparent md:p-0 md:text-white md:shadow-none`}
          >
            <a href="/" className="flex items-center gap-2 text-sm">
              <ArrowLeft size={16} /> Siteye dön
            </a>
            <a href="/admin/ayarlar" className="text-sm">Ayarlar</a>
            <a href="/admin/odemeler" className="text-sm font-bold">
              Ödeme sistemi
            </a>
            <button type="button" onClick={signOut} className="mt-2 border-t border-[var(--line)] pt-4 text-left text-sm font-bold text-red-700 md:mt-0 md:border-0 md:pt-0 md:text-white">
              Çıkış yap
            </button>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[1280px] px-5 py-2 lg:px-10">
        <AdminBookingsPage />
      </div>
    </main>
  );
}