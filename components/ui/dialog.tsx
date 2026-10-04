import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  variant?: 'default' | 'sheet';
  children: ComponentChildren;
};

export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  variant = 'default',
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    // showModal supplies focus trapping and makes the rest of the page inert.
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open && ref.current?.isConnected) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      class={`fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none bg-transparent p-0 text-stone-900 backdrop:bg-stone-950/35 open:flex ${
        variant === 'sheet'
          ? 'items-end justify-center lg:items-stretch lg:justify-end'
          : 'items-center justify-center'
      }`}
    >
      <div
        class={variant === 'sheet'
          ? 'max-h-[92dvh] w-full overflow-auto rounded-t-lg border border-stone-200 bg-white p-5 shadow-2xl lg:max-h-none lg:w-[42rem] lg:rounded-none'
          : 'max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-auto rounded-lg border border-stone-200 bg-white p-5 shadow-2xl'}
      >
        {children}
      </div>
    </dialog>
  );
}
