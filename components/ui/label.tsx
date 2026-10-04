import type { JSX } from 'preact';

export type LabelProps = JSX.IntrinsicElements['label'];

export function Label({
  class: className = '',
  className: extraClass = '',
  ...props
}: LabelProps) {
  return (
    <label
      {...props}
      class={`text-sm font-semibold text-stone-700 ${className} ${extraClass}`}
    />
  );
}
