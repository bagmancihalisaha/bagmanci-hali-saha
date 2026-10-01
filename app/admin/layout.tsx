import type { ReactNode } from "react";
import AdminMotionShell from "./components/AdminMotionShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminMotionShell>{children}</AdminMotionShell>;
}
