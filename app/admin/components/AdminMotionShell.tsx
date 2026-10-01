"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function AdminMotionShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="admin-motion-shell"
    >
      {children}
    </motion.div>
  );
}
