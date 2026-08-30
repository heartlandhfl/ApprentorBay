import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

const variants = {
  primary:
    'bg-accent text-paper-raised hover:bg-accent-hover active:bg-accent-pressed',
  secondary:
    'bg-paper-raised text-ink border border-line hover:border-ink active:bg-accent-subtle',
  ghost: 'bg-transparent text-ink hover:bg-accent-subtle active:bg-line',
  danger: 'bg-danger text-paper-raised hover:bg-[#7f2424] active:bg-[#681d1d]',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-small',
  md: 'h-10 px-4 text-body',
  lg: 'h-12 px-5 text-body',
} as const;

type ButtonProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  to?: string;
  href?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

const shared =
  'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  to,
  href,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const className = `${shared} ${variants[variant]} ${sizes[size]}`;
  const content = (
    <>
      {loading ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      <span>{loading ? 'Working…' : children}</span>
    </>
  );

  if (to) {
    if (disabled || loading) {
      return (
        <span className={`${className} pointer-events-none`} aria-disabled="true">
          {content}
        </span>
      );
    }
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={className} rel="noreferrer" target="_blank">
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={className}
      disabled={disabled || loading}
      {...rest}
    >
      {content}
    </button>
  );
}
