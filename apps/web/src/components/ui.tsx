import { AlertTriangle, Inbox, Loader2, X, type LucideIcon } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'border border-transparent bg-accent-strong text-white hover:brightness-95',
  secondary: 'border border-transparent bg-surface-2 text-fg hover:bg-border',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent',
        VARIANT[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

const field =
  'min-h-11 w-full rounded-xl border border-transparent bg-surface-2 px-4 py-3 text-sm text-fg placeholder:text-muted/75 outline-none transition focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/10';

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(field, className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cn(field, 'min-h-20 resize-y', className)} />
);
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(field, className)} />;

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('workspace-card min-w-0 rounded-[24px] bg-surface p-5 sm:p-7', className)}>
      {title && (
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
            {Icon && <Icon className="size-5 shrink-0 text-muted" strokeWidth={2} />}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export const Badge = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', className)}>{children}</span>
);

/** 데모(샘플) 데이터 표시. 설정 → 데모 데이터에서 한 번에 지울 수 있다. */
export const DemoBadge = () => (
  <Badge className="bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400">DEMO</Badge>
);

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export const Spinner = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center justify-center py-8 text-muted', className)}>
    <Loader2 className="size-5 animate-spin" />
  </div>
);

export const FullPageSpinner = () => (
  <div className="flex h-full items-center justify-center">
    <Loader2 className="size-6 animate-spin text-accent" />
  </div>
);

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-2" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="rounded-full bg-surface-2 p-3">
        <Icon className="size-5 text-muted" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-6 text-center">
      <AlertTriangle className="size-5 text-red-500" />
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-1">
          다시 시도
        </Button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2" aria-label="닫기">
            <X className="size-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
