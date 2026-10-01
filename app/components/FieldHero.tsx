"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight, Play, MapPin } from "lucide-react";
import AppleButton from "./AppleButton";

export default function FieldHero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const reveal = { hidden: { opacity: 0, y: 40, filter: "blur(8px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9 } } };

  return (
    <section ref={ref} className="field-hero order-1" aria-labelledby="field-hero-title">
      <motion.img className="field-hero-image" src="/hero.jpg" alt="Yeşil çim futbol sahası" fetchPriority="high" style={{ y: reduced ? 0 : y }} />
      <div className="field-hero-shade" />
      <motion.div className="field-hero-content" initial={reduced ? false : "hidden"} animate="visible" variants={{ visible: { transition: { delayChildren: reduced ? 0 : 1.85, staggerChildren: reduced ? 0 : 0.16 } } }}>
        <motion.p variants={reveal} className="field-location"><MapPin size={14} /> Şanlıurfa · Bağmancı Halı Saha</motion.p>
        <motion.h1 variants={reveal} id="field-hero-title">BAĞMANCI<br />HALI SAHA<span>Maçın adresi belli.</span></motion.h1>
        <motion.p variants={reveal} className="field-hero-description">Takımını topla. Yerini ayır.<br />Sahada buluşalım.</motion.p>
        <motion.div variants={reveal} className="field-hero-actions">
          <AppleButton href="#rezervasyon" icon={<ArrowUpRight size={18} />}>Hemen Randevu Al</AppleButton>
          <AppleButton href="#kayitlar" variant="secondary" icon={<Play size={16} />}>Maç Tekrarı İzle</AppleButton>
        </motion.div>
        <motion.div variants={reveal} className="field-rates"><span>Gündüz <strong>1.200 TL</strong></span><span>Gece <strong>1.800 TL</strong></span></motion.div>
      </motion.div>
      <div className="field-hero-bottom"><a href="#rezervasyon"><ArrowDown size={16} /> Sahanı seç, maça başla</a><span>120+ Oyuncu</span></div>
    </section>
  );
}
