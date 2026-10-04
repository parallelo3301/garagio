import type { JSX } from 'preact';

const variants = {
  default: 'bg-emerald-700 text-white hover:bg-emerald-800',
  outline: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-100',
  ghost: 'text-stone-600 hover:bg-stone-100',
  destructive: 'bg-red-700 text-white hover:bg-red-800',
};

export type ButtonProps = JSX.IntrinsicElements['button'] & {
  variant?: keyof typeof variants;
};

export function Button({
  variant = 'default',
  type = 'button',
  class: className = '',
  className: extraClass = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      class={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        variants[variant]
      } ${className} ${extraClass}`}
    />
  );
}
