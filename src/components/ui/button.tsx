import * as React from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  outline: "border border-border bg-transparent hover:bg-accent",
  ghost: "hover:bg-accent",
  destructive: "bg-destructive/10 text-red-400 border border-red-500/20 hover:bg-destructive/20",
};

const sizes = {
  sm: "h-8 px-3 text-xs rounded-md",
  default: "h-9 px-4 py-2 text-sm rounded-md",
  icon: "h-9 w-9",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
