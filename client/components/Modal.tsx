import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';
import { Stack } from './Stack';
import { Text } from './Text';

type ModalProps = {
  open: boolean;
  title: string;
  onClose?: () => void;
  dismissible?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({
  open,
  title,
  onClose,
  dismissible = true,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open || !dismissible || !onClose) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-4 sm:items-center sm:px-6">
      {dismissible && onClose ? (
        <button
          type="button"
          aria-label="Close dialog"
          className="absolute inset-0 bg-ink/40"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 z-0 bg-ink/40" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm border border-line bg-paper-raised p-4 shadow-lg sm:p-6"
      >
        <Stack gap={16}>
          <Text variant="h2" as="h2">
            <span id="modal-title">{title}</span>
          </Text>
          {children}
          {footer !== undefined
            ? footer
            : dismissible && onClose
              ? (
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={onClose}>
                    Close
                  </Button>
                </div>
              )
              : null}
        </Stack>
      </div>
    </div>
  );
}
