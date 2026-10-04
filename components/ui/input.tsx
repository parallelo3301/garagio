import type { JSX } from 'preact';

export type InputProps = JSX.IntrinsicElements['input'];

export function Input({
  class: className = '',
  className: extraClass = '',
  ...props
}: InputProps) {
  return (
    <input
      {...props}
      class={`min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 file:mr-3 file:rounded file:border-0 file:bg-stone-100 file:px-3 file:py-1 file:text-sm file:font-semibold ${className} ${extraClass}`}
    />
  );
}
