import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Modal padrão da aplicação — único wrapper de `@radix-ui/react-dialog` usado
 * no projeto. Antes não existia nenhum componente de modal reutilizável.
 */
export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, title, description, children, className }) => (
  <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
          'rounded-2xl border border-border-strong bg-card shadow-panel p-6',
          'focus:outline-none',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <RadixDialog.Title className="text-base font-semibold text-foreground tracking-tight">
            {title}
          </RadixDialog.Title>
          <RadixDialog.Close asChild>
            <button
              aria-label="Fechar"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              <X size={16} />
            </button>
          </RadixDialog.Close>
        </div>
        {description && (
          <RadixDialog.Description className="text-xs text-muted mb-5">
            {description}
          </RadixDialog.Description>
        )}
        {!description && <div className="mb-4" />}
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>
);
