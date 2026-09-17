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
import { getSupabaseClient } from "../../lib/supabase";
import SiteLogo from "./SiteLogo";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [userName, setUserName] = useState("");

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

  const signOut = async () => {
    await getSupabaseClient().auth.signOut();
    setAccountOpen(false);
    setUserName("");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 w-full border-b border-slate-200/80 bg-[#FCFDF9]/95 text-slate-900 shadow-sm backdrop-blur-md transition-colors duration-200 dark:border-emerald-800/40 dark:bg-[#051811]/95 dark:text-white">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
            className="rounded-xl border border-slate-200 p-2 text-slate-700 dark:border-emerald-800/40 dark:text-white md:hidden"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <a
            href="/"
            aria-label="BAĞMANCI HALI SAHA ana sayfa"
            className="flex items-center gap-2.5 text-base font-extrabold tracking-tight sm:text-lg"
          >
            <span className="flex items-center text-amber-500" data-site-logo>
              <SiteLogo size={24} />
            </span>
            <span>
              BAĞMANCI <span className="text-emerald-700 dark:text-emerald-400">HALI SAHA</span>
            </span>
          </a>
        </div>

        {/* MASAÜSTÜ MENÜ BAĞLANTILARI */}
        <nav className="hidden items-center gap-6 text-xs font-bold uppercase tracking-wider md:flex">
          <a
            href="#rezervasyon"
            className="flex items-center gap-1.5 transition hover:text-amber-500"
          >
            <CalendarDays size={14} className="text-amber-500" /> Rezervasyon
          </a>
          <a
            href="#paketler"
            className="transition hover:text-amber-500"
          >
            Paketler
          </a>
          <a
            href="#kayitlar"
            className="flex items-center gap-1.5 transition hover:text-amber-500"
          >
            <Play size={14} className="text-amber-500" /> Maç Tekrarı
          </a>
          <a
            href="#iletisim"
            className="transition hover:text-amber-500"
          >
            İletişim
          </a>
        </nav>

        {/* SAĞ KONTROLLER: TEMA & HESAP */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {userName ? (
            <div className="relative">
              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-800 transition hover:border-amber-400 dark:border-emerald-800/50 dark:bg-[#09261b] dark:text-white"
                onClick={() => setAccountOpen((value) => !value)}
              >
                <UserRound size={15} />
                <span className="hidden sm:inline">Hesabım</span>
                <ChevronDown size={14} />
              </button>
              {accountOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-2xl backdrop-blur-xl dark:border-emerald-800/50 dark:bg-[#061e15] dark:text-white">
                  <p className="text-[11px] opacity-60">Merhaba,</p>
                  <strong className="block truncate text-sm font-bold">{userName}</strong>
                  <div className="my-2 h-px bg-slate-200 dark:bg-emerald-800/30" />
                  <a
                    href="/hesabim"
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium transition hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    <Settings size={14} /> Ayarlar
                  </a>
                  <a
                    href="/hesabim#rezervasyonlar"
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium transition hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    <ArrowRight size={14} /> Rezervasyonlarım
                  </a>
                  <a
                    href="/hesabim#abonelik"
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium transition hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    <ArrowRight size={14} /> Aboneliklerim
                  </a>
                  <button
                    type="button"
                    onClick={signOut}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 font-medium text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
                  >
                    <LogOut size={14} /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a
              href="/musteri"
              className="flex h-9 items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 text-xs font-bold text-black shadow-md transition hover:bg-amber-300"
            >
              <UserRound size={15} /> <span>GİRİŞ YAP</span>
            </a>
          )}
        </div>
      </div>

      {/* MOBİL AÇILIR MENÜ */}
      {open && (
        <nav className="flex flex-col gap-3 border-t border-slate-200/80 bg-white/95 px-5 py-4 text-sm font-bold shadow-lg backdrop-blur-md dark:border-emerald-800/40 dark:bg-[#051811]/95 md:hidden">
          <a
            href="#rezervasyon"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 py-1"
          >
            <CalendarDays size={16} className="text-amber-500" /> Rezervasyon
          </a>
          <a
            href="#paketler"
            onClick={() => setOpen(false)}
            className="py-1"
          >
            Paketler
          </a>
          <a
            href="#kayitlar"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 py-1"
          >
            <Play size={16} className="text-amber-500" /> Maç Tekrarı
          </a>
          <a
            href="#iletisim"
            onClick={() => setOpen(false)}
            className="py-1"
          >
            İletişim
          </a>
        </nav>
      )}
    </header>
  );
}