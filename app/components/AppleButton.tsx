import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";

type ButtonVariant = "primary" | "secondary";

type AppleButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: ReactNode;
  className?: string;
};

type AppleButtonAsLink = AppleButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof AppleButtonProps> & {
    href: string;
  };

type AppleButtonAsButton = AppleButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof AppleButtonProps> & {
    href?: never;
  };

export default function AppleButton(props: AppleButtonAsLink | AppleButtonAsButton) {
  if ("href" in props && typeof props.href === "string") {
    const { children, variant = "primary", icon, className = "", href, ...rest } = props;
    const buttonClassName = `apple-button apple-button-${variant} ${className}`.trim();

    return (
      <motion.span
        className="inline-flex"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <a href={href} className={buttonClassName} {...rest}>
          <span>{children}</span>
          {icon}
        </a>
      </motion.span>
    );
  }

  const { children, variant = "primary", icon, className = "", ...rest } = props;
  const buttonClassName = `apple-button apple-button-${variant} ${className}`.trim();

  return (
    <motion.span
      className="inline-flex"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <button className={buttonClassName} {...rest}>
        <span>{children}</span>
        {icon}
      </button>
    </motion.span>
  );
}