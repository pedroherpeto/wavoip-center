"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wavoip-500 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-wavoip-500 text-black hover:bg-wavoip-400 active:bg-wavoip-600",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 active:bg-red-700",
        outline:
          "border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]",
        secondary:
          "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80",
        ghost: "hover:bg-[var(--muted)]",
        link: "text-wavoip-500 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 min-w-[44px]",
        sm: "h-10 px-4 text-xs min-w-[44px]",
        lg: "h-14 px-8 text-base min-w-[44px]",
        xl: "h-16 px-10 text-lg min-w-[44px]",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
