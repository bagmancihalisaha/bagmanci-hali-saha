"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const options = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
] as const;

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selected = mounted ? theme || "system" : "system";
  const CurrentIcon = selected === "system" ? Monitor : selected === "dark" ? Moon : Sun;
  const activeLabel = options.find((item) => item.value === selected)?.label || "Sistem";

  return (
    <div className="theme-toggle">
      <button type="button" aria-label={`Tema: ${activeLabel}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="theme-toggle-button">
        <CurrentIcon className={resolvedTheme === "dark" ? "text-emerald-300" : "text-emerald-700"} size={17} />
      </button>
      {open && <div className="theme-toggle-panel" role="menu" aria-label="Tema seçimi">
        {options.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" role="menuitemradio" aria-checked={selected === value} className={`theme-toggle-option ${selected === value ? "theme-toggle-option-active" : ""}`} onClick={() => { setTheme(value); setOpen(false); }}>
            <Icon size={15} /><span>{label}</span>{selected === value && <Check className="theme-toggle-check" size={15} />}
          </button>
        ))}
      </div>}
    </div>
  );
}
