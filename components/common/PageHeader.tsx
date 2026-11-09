"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary",
  children,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 md:mb-8"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          {Icon && (
            <div className="w-12 h-12 rounded-2xl bg-card border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center justify-center flex-shrink-0">
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-[-0.035em] text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-xs md:text-sm text-muted-foreground font-medium mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {children && <div className="flex items-center gap-2.5 flex-wrap">{children}</div>}
      </div>
    </motion.div>
  );
}

export default PageHeader;


