'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

const variants = {
  gray: 'bg-slate-700 text-white',
  'gray-subtle': 'bg-slate-100 text-slate-800',
  blue: 'bg-blue-700 text-white',
  'blue-subtle': 'bg-blue-100 text-blue-900',
  purple: 'bg-violet-700 text-white',
  'purple-subtle': 'bg-violet-100 text-violet-900',
  amber: 'bg-amber-600 text-black',
  'amber-subtle': 'bg-amber-100 text-amber-900',
  red: 'bg-red-700 text-white',
  'red-subtle': 'bg-red-100 text-red-900',
  pink: 'bg-pink-700 text-white',
  'pink-subtle': 'bg-pink-100 text-pink-900',
  green: 'bg-emerald-700 text-white',
  'green-subtle': 'bg-emerald-100 text-emerald-900',
  teal: 'bg-teal-700 text-white',
  'teal-subtle': 'bg-teal-100 text-teal-900',
  inverted: 'bg-ink text-white',
  pill: 'border border-border bg-surface text-ink',
} as const;

const sizes = {
  sm: 'h-5 gap-[3px] px-1.5 text-[11px] tracking-[0.2px]',
  md: 'h-6 gap-1 px-2.5 text-[12px]',
  lg: 'h-8 gap-1.5 px-3 text-[14px]',
} as const;

const iconSizes = {
  sm: 'h-[11px] w-[11px]',
  md: 'h-[14px] w-[14px]',
  lg: 'h-4 w-4',
} as const;

export type BadgeVariant = keyof typeof variants;
type BadgeSize = keyof typeof sizes;

interface BadgeProps {
  children?: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  capitalize?: boolean;
  icon?: ReactNode;
  href?: string;
  className?: string;
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function BadgeContent({
  icon,
  size,
  children,
}: Pick<BadgeProps, 'icon' | 'children'> & { size: BadgeSize }) {
  return (
    <>
      {icon && (
        <span className={joinClasses('inline-flex items-center justify-center', iconSizes[size])}>
          {icon}
        </span>
      )}
      {children}
    </>
  );
}

export default function Badge({
  children,
  variant = 'gray',
  size = 'md',
  capitalize = true,
  icon,
  href,
  className,
}: BadgeProps) {
  const badgeClassName = joinClasses(
    'inline-flex shrink-0 items-center justify-center rounded-[9999px] font-body font-medium whitespace-nowrap tabular-nums',
    capitalize && 'capitalize',
    variants[variant],
    sizes[size],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={joinClasses('!no-underline', badgeClassName)}>
        <BadgeContent icon={icon} size={size}>
          {children}
        </BadgeContent>
      </Link>
    );
  }

  return (
    <span className={badgeClassName}>
      <BadgeContent icon={icon} size={size}>
        {children}
      </BadgeContent>
    </span>
  );
}
