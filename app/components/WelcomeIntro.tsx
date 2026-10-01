"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import SiteLogo from "./SiteLogo";

export default function WelcomeIntro() {
  const [open, setOpen] = useState(true);
  const reduced = useReducedMotion();
  const releaseRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const root = document.documentElement;
    const main = document.getElementById("top");
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    // A remembered anchor must not bypass the requested homepage welcome.
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
    root.setAttribute("data-home-entering", "");
    if (main) main.inert = true;
    const reset = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    reset();
    window.addEventListener("pageshow", reset);
    let frame = 0;
    releaseRef.current = () => {
      root.removeAttribute("data-home-entering");
      if (main) main.inert = false;
      reset();
      frame = requestAnimationFrame(reset);
    };
    const timer = window.setTimeout(() => setOpen(false), 1700);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", reset);
      root.removeAttribute("data-home-entering");
      if (main) main.inert = false;
      history.scrollRestoration = previousRestoration;
    };
  }, []);

  return <AnimatePresence onExitComplete={() => releaseRef.current()}>
    {open && <motion.div className="welcome-intro" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}>
      <img className="welcome-backdrop" src="/arena-welcome.jpg" alt="Bağmancı Arena'da futbol sahası" />
      <div className="welcome-shade" />
      <motion.div initial={{ opacity: 0, scale: reduced ? 1 : 0.8, y: reduced ? 0 : 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.8 }} className="welcome-mark">
        <SiteLogo size={56} />
        <p>BAĞMANCI ARENA</p>
        <span>Maçın adresine hoş geldin.</span>
        <div className="welcome-progress"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduced ? 0 : 2, ease: "linear" }} /></div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}
