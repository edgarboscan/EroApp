import { create } from 'zustand';

export interface MailAttachmentItem {
  filename: string;
  content: string; // base64 string
  contentType?: string;
  sizeBytes?: number;
}

export interface OpenComposerOptions {
  to?: string;
  toName?: string;
  recipientType?: 'customer' | 'supplier' | 'user' | 'custom';
  subject?: string;
  message?: string;
  attachments?: MailAttachmentItem[];
}

interface MailComposerState {
  isOpen: boolean;
  initialData: OpenComposerOptions | null;
  openComposer: (data?: OpenComposerOptions) => void;
  closeComposer: () => void;
}

export const useMailComposerStore = create<MailComposerState>((set) => ({
  isOpen: false,
  initialData: null,
  openComposer: (data) => set({ isOpen: true, initialData: data || null }),
  closeComposer: () => set({ isOpen: false, initialData: null }),
}));
