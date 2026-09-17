"use client";

import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  LogOut,
  Menu,
  Play,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRef } from "react";
import { getSupabaseClient } from "../../lib/supabase";
import SiteLogo from "./SiteLogo";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    const loadUser = async () => {
      const { data } = await client.auth.getUser();
      setUserName(data.user?.user_metadata?.full_name || "");
    };
    loadUser();
    const { data: listener } = client.auth.onAuthStateChange(
      (_event, session) => {
        setUserName(
          session?.user?.user_metadata?.full_name ||
            "",
        );
        setAccountOpen(false);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [accountOpen]);

  const signOut = async () => {
    await getSupabaseClient().auth.signOut();
    setAccountOpen(false);
    setUserName("");
  };

  const scrollTo = (id: string) => {
    setOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.href = `/#${id}`;
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 w-full border-b border-stone-200/90 bg-[#FCFDF9]/95 text-stone-900 shadow-sm backdrop-blur-md transition-colors duration-300 dark:border-[#0c3826] dark:bg-[#05261b] dark:text-white dark:shadow-xl">
      {/* 1. KATMAN: ÜST ANA BAR (GÜNDÜZ BEYAZ / GECE ZÜMRÜT) */}
      <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-3 sm:px-6">
        
        {/* SOL: MOBİL MENÜ BUTONU */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-300 bg-stone-100 text-stone-800 transition hover:bg-stone-200 dark:border-[#144f37] dark:bg-[#093324] dark:text-white dark:hover:bg-[#0e422f] md:hidden"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* ORTA: SARI LOGO + DİNAMİK BAĞMANCI HALI SAHA */}
        <a
          href="/"
          aria-label="BAĞMANCI HALI SAHA ana sayfa"
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black shadow-sm"
            data-site-logo
          >
            <SiteLogo size={18} />
          </span>
          <div className="flex items-center gap-1.5 font-black tracking-tight">
            <span className="text-sm sm:text-base font-extrabold text-[#081b13] dark:text-white">
              BAĞMANCI
            </span>
            <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
              HALI SAHA
            </span>
          </div>
        </a>

        {/* SAĞ: AKTİF TEMA BUTONU & SARI HESABIM BUTONU */}
        <div className="flex items-center gap-2">
          {/* TEMA SEÇİCİ (KIRPILMAYAN, DOĞRUDAN AKTİF ALAN) */}
          <div className="relative z-50">
            <ThemeToggle />
          </div>

          {/* HESABIM BUTONU */}
          {userName ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                className="flex h-8 items-center gap-1 rounded-full bg-amber-400 px-3 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-amber-300"
                onClick={() => setAccountOpen((value) => !value)}
              >
                <UserRound size={13} className="text-slate-950 shrink-0" />
                <span className="text-[11px] sm:text-xs">Hesabım</span>
                <ChevronDown size={12} className="opacity-80 shrink-0" />
              </button>

              {accountOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-stone-200 bg-white p-3 text-xs text-stone-900 shadow-2xl backdrop-blur-xl dark:border-emerald-800/60 dark:bg-[#062016] dark:text-white">
                  <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Giriş yapıldı</p>
                  <strong className="block truncate text-sm font-extrabold text-stone-900 dark:text-white">
                    {userName}
                  </strong>
                  <div className="my-2 h-px bg-stone-200 dark:bg-emerald-900/40" />
                  <a
                    href="/hesabim"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-semibold text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-white/5"
                  >
                    <Settings size={14} /> Ayarlar
                  </a>
                  <a
                    href="/hesabim#rezervasyonlar"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-semibold text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-white/5"
                  >
                    <ArrowRight size={14} /> Rezervasyonlarım
                  </a>
                  <a
                    href="/hesabim#abonelik"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-semibold text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-white/5"
                  >
                    <ArrowRight size={14} /> Aboneliklerim
                  </a>
                  <button
                    type="button"
                    onClick={signOut}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 font-bold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <LogOut size={14} /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a
              href="/musteri"
              className="flex h-8 items-center gap-1 rounded-full bg-amber-400 px-3 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-300"
            >
              <UserRound size={13} /> <span>GİRİŞ</span>
            </a>
          )}
        </div>
      </div>

      {/* 2. KATMAN: İKİ KAPSÜL BUTON (GÜNDÜZ AÇIK TON / GECE ZÜMRÜT YEŞİLİ) */}
      <div className="mx-auto flex max-w-[1240px] items-center justify-center gap-2 px-3 pb-2.5 pt-0.5">
        <button
          type="button"
          onClick={() => scrollTo("rezervasyon")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-stone-300/80 bg-stone-100 py-2 px-3 text-[11px] sm:text-xs font-bold text-stone-800 shadow-sm transition hover:bg-stone-200 active:scale-[0.98] dark:border-[#144f37] dark:bg-[#093324] dark:text-white dark:hover:bg-[#0e422f]"
        >
          <CalendarDays size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
          <span>Rezervasyon</span>
        </button>

        <button
          type="button"
          onClick={() => scrollTo("kayitlar")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-stone-300/80 bg-stone-100 py-2 px-3 text-[11px] sm:text-xs font-bold text-stone-800 shadow-sm transition hover:bg-stone-200 active:scale-[0.98] dark:border-[#144f37] dark:bg-[#093324] dark:text-white dark:hover:bg-[#0e422f]"
        >
          <Play size={13} className="text-amber-500 dark:text-amber-400 shrink-0" />
          <span>Maç Tekrarı</span>
        </button>

        {/* Masaüstü Ekstra Butonlar */}
        <button
          type="button"
          onClick={() => scrollTo("paketler")}
          className="hidden md:flex flex-1 items-center justify-center gap-1.5 rounded-full border border-stone-300/80 bg-stone-100 py-2 px-3 text-xs font-bold text-stone-800 transition hover:bg-stone-200 dark:border-[#144f37] dark:bg-[#093324] dark:text-white dark:hover:bg-[#0e422f]"
        >
          <span>Paketler</span>
        </button>

        <button
          type="button"
          onClick={() => scrollTo("iletisim")}
          className="hidden md:flex flex-1 items-center justify-center gap-1.5 rounded-full border border-stone-300/80 bg-stone-100 py-2 px-3 text-xs font-bold text-stone-800 transition hover:bg-stone-200 dark:border-[#144f37] dark:bg-[#093324] dark:text-white dark:hover:bg-[#0e422f]"
        >
          <span>İletişim</span>
        </button>
      </div>

      {/* MOBİL AÇILIR MENÜ */}
      {open && (
        <nav className="flex flex-col gap-2 border-t border-stone-200 bg-white px-5 py-4 text-sm font-bold shadow-2xl dark:border-[#0c3826] dark:bg-[#041d14] md:hidden">
          <button
            type="button"
            onClick={() => scrollTo("paketler")}
            className="text-left py-2 text-stone-800 hover:text-amber-500 dark:text-white dark:hover:text-amber-400"
          >
            Paketler
          </button>
          <button
            type="button"
            onClick={() => scrollTo("rezervasyon")}
            className="flex items-center gap-2 text-left py-2 text-stone-800 hover:text-amber-500 dark:text-white dark:hover:text-amber-400"
          >
            <CalendarDays size={16} className="text-amber-500 dark:text-amber-400" /> Rezervasyon
          </button>
          <button
            type="button"
            onClick={() => scrollTo("kayitlar")}
            className="flex items-center gap-2 text-left py-2 text-stone-800 hover:text-amber-500 dark:text-white dark:hover:text-amber-400"
          >
            <Play size={16} className="text-amber-500 dark:text-amber-400" /> Maç Tekrarı
          </button>
          <button
            type="button"
            onClick={() => scrollTo("iletisim")}
            className="text-left py-2 text-stone-800 hover:text-amber-500 dark:text-white dark:hover:text-amber-400"
          >
            İletişim
          </button>
        </nav>
      )}
    </header>
  );
}