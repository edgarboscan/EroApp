import React from 'react';
import { Mail } from 'lucide-react';
import { useMailComposerStore } from '../../stores/mailComposerStore';

export const MailComposerButton: React.FC = () => {
  const openComposer = useMailComposerStore((s) => s.openComposer);

  return (
    <button
      type="button"
      onClick={() => openComposer()}
      className="relative p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF] dark:focus-visible:ring-[#3D91FF] cursor-pointer"
      title="Redactor de Correo Electrónico (Gmail SMTP)"
      aria-label="Redactar Correo"
    >
      <Mail className="w-5 h-5" />
    </button>
  );
};
