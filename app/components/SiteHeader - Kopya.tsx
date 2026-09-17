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
    <header className="luxury-header site-header fixed left-0 right-0 top-0 z-50">
      <div className="luxury-header-top">
        <button
          type="button"
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          className="luxury-header-menu md:hidden"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <a
          href="/"
          aria-label="BAĞMANCI HALI SAHA ana sayfa"
          className="luxury-header-brand display"
        >
          <span className="luxury-header-logo-mark" data-site-logo>
            <SiteLogo size={25} />
          </span>
          <span>
            BAĞMANCI <span className="text-[var(--lime)]">HALI SAHA</span>
          </span>
        </a>
        <div className="luxury-header-controls">
          <ThemeToggle />
          {userName ? (
            <div className="luxury-header-account">
              <button
                type="button"
                className="luxury-account-button"
                onClick={() => setAccountOpen((value) => !value)}
              >
                <UserRound size={16} />
                <span>Hesabım</span>
                <ChevronDown size={15} />
              </button>
              {accountOpen && (
                <div className="luxury-account-menu">
                  <p>Merhaba,</p>
                  <strong>{userName}</strong>
                  <a href="/hesabim">
                    <Settings size={15} /> Ayarlar
                  </a>
                  <a href="/hesabim#rezervasyonlar">
                    <ArrowRight size={15} /> Rezervasyonlarım
                  </a>
                  <a href="/hesabim#abonelik">
                    <ArrowRight size={15} /> Aboneliklerim
                  </a>
                  <button type="button" onClick={signOut}>
                    <LogOut size={15} /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a
              href="/musteri"
              className="luxury-account-button luxury-login-button"
            >
              <UserRound size={16} /> <span>GİRİŞ YAP</span>
            </a>
          )}
        </div>
      </div>
      <nav className="luxury-sub-bar" aria-label="Ana navigasyon">
        <a href="#rezervasyon" onClick={() => setOpen(false)}>
          <CalendarDays size={15} /> Rezervasyon
        </a>
        <a href="#kayitlar" onClick={() => setOpen(false)}>
          <Play size={15} /> Maç Tekrarı
        </a>
      </nav>
      <nav
        className={`${open ? "flex" : "hidden"} luxury-mobile-menu`}
      >
        <a
          className="text-sm font-semibold"
          href="#rezervasyon"
          onClick={() => setOpen(false)}
        >
          Rezervasyon
        </a>
        <a
          className="text-sm font-semibold"
          href="#paketler"
          onClick={() => setOpen(false)}
        >
          Paketler
        </a>
        <a
          className="text-sm font-semibold"
          href="#kayitlar"
          onClick={() => setOpen(false)}
        >
          Maç kayıtları
        </a>
        <a
          className="text-sm font-semibold"
          href="#iletisim"
          onClick={() => setOpen(false)}
        >
          İletişim
        </a>
      </nav>
    </header>
  );
}
