"use client";

import {
  ArrowRight,
  CalendarDays,
  LogOut,
  Play,
  Settings,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRef } from "react";
import { getSupabaseClient } from "../../lib/supabase";
import SiteLogo from "./SiteLogo";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
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
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.href = `/#${id}`;
    }
  };

  return (
    <header className="site-header fixed top-4 left-1/2 -translate-x-1/2 w-[94%] max-w-6xl z-50 flex items-center justify-between px-6 py-3 rounded-full bg-white/75 dark:bg-zinc-900/85 backdrop-blur-xl border border-black/[0.05] dark:border-white/15 shadow-sm">
      <nav className="flex w-full min-w-0 items-center justify-between gap-4 text-[var(--text-primary)]">
        <a
          href="/"
          aria-label="BAĞMANCI HALI SAHA ana sayfa"
          className="flex min-w-0 shrink-0 items-center gap-2.5 whitespace-nowrap"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 shadow-inner dark:text-emerald-300">
            <SiteLogo size={23} />
          </div>
          <div className="flex min-w-0 items-center gap-1.5 font-black tracking-tight">
            <span className="max-w-[118px] whitespace-normal text-[10px] font-black leading-tight text-[var(--text-primary)] sm:max-w-none sm:whitespace-nowrap sm:text-base">
              BAĞMANCI HALI SAHA
            </span>
          </div>
        </a>

        <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => scrollTo("rezervasyon")} className="header-nav-tab transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.98]">
              <CalendarDays size={14} /> Rezervasyon
            </button>
            <button type="button" onClick={() => scrollTo("kayitlar")} className="header-nav-tab transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.98]">
              <Play size={13} /> Maç Tekrarı
            </button>
            <button type="button" onClick={() => scrollTo("paketler")} className="header-nav-tab transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.98]">Paketler</button>
            <button type="button" onClick={() => scrollTo("iletisim")} className="header-nav-tab transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.98]">İletişim</button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle />
          {userName ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                aria-label="Hesabım menüsünü aç"
                className="relative z-50 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] transition hover:border-[var(--accent-gold)]"
                onClick={() => setAccountOpen((value) => !value)}
              >
                <User className="h-4 w-4" />
              </button>

              {accountOpen && (
                <div className="header-account-menu absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/95 p-3 text-xs text-[var(--text-primary)] shadow-2xl backdrop-blur-xl">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)]">Giriş yapıldı</p>
                  <strong className="block truncate text-sm font-extrabold text-[var(--text-primary)]">
                    {userName}
                  </strong>
                  <div className="my-2 h-px bg-white/10" />
                  <a
                    href="/hesabim"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
                  >
                    <Settings size={14} /> Ayarlar
                  </a>
                  <a
                    href="/hesabim#rezervasyonlar"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
                  >
                    <ArrowRight size={14} /> Rezervasyonlarım
                  </a>
                  <a
                    href="/hesabim#abonelik"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
                  >
                    <ArrowRight size={14} /> Aboneliklerim
                  </a>
                  <button
                    type="button"
                    onClick={signOut}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-bold text-rose-300 transition hover:bg-rose-950/40"
                  >
                    <LogOut size={14} /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/musteri" aria-label="Müşteri girişi" className="relative z-50 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] transition hover:border-[var(--accent-gold)]"><User className="h-4 w-4" /></a>
          )}
        </div>

      </nav>
    </header>
  );
}
