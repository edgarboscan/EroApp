import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Caras y Emociones',
    icon: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜',
      '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞',
      '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢',
      '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱',
      '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶',
      '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱',
      '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷',
    ],
  },
  {
    id: 'people',
    name: 'Gestos y Personas',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋',
      '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳',
      '💪', '🦾', '🦿', '🦵', '🦶', '👂', '👃', '🧠', '👀', '👁️',
      '🗣️', '👤', '👥', '🧑‍💻', '👨‍💼', '👩‍💼', '🧑‍🍳', '👷', '👮', '🕵️',
    ],
  },
  {
    id: 'hearts',
    name: 'Corazones y Símbolos',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '✨',
      '⭐', '🌟', '💫', '🔥', '💥', '💯', '✅', '❌', '⭕', '🛑',
      '⚠️', '⚡', '💡', '🔔', '🔕', '🎯', '🚀', '🎉', '🎊', '🏆',
      '🥇', '🥈', '🥉', '🔑', '🔒', '🔓', '🛡️', '⏳', '⏰', '⏱️',
    ],
  },
  {
    id: 'office',
    name: 'Oficina y Negocios',
    icon: '💼',
    emojis: [
      '💼', '📁', '📂', '🗂️', '📅', '📆', '🗒️', '🗓️', '📇', '📈',
      '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️',
      '🗃️', '🗄️', '🗑️', '💰', '🪙', '💵', '💶', '💷', '💸', '💳',
      '🧾', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '🏷️', '💻',
      '🖥️', '🖨️', '⌨️', '🖱️', '📱', '☎️', '📞', '🏢', '🏦', '🏬',
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<string>('smileys');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const currentCategory = useMemo(() => {
    return EMOJI_CATEGORIES.find((c) => c.id === activeCategory) || EMOJI_CATEGORIES[0];
  }, [activeCategory]);

  const displayedEmojis = useMemo(() => {
    if (!searchTerm.trim()) {
      return currentCategory.emojis;
    }
    const term = searchTerm.toLowerCase().trim();
    // Buscar en todas las categorías
    const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    // Filtrado simple (si coincide con nombre de categoría o búsqueda)
    const matchingCategory = EMOJI_CATEGORIES.filter((c) => c.name.toLowerCase().includes(term));
    if (matchingCategory.length > 0) {
      return matchingCategory.flatMap((c) => c.emojis);
    }
    return all;
  }, [currentCategory, searchTerm]);

  return (
    <div
      className="absolute bottom-14 left-0 z-50 w-72 sm:w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden flex flex-col h-72 animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Buscador de emoticones */}
      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar emoticón o categoría..."
            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            autoFocus
          />
        </div>
      </div>

      {/* Tabs de categorías */}
      {!searchTerm && (
        <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 px-2 py-1 gap-1">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              title={cat.name}
              className={`flex-1 py-1 text-sm text-center rounded-lg transition-colors cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-white dark:bg-gray-700 shadow-xs'
                  : 'hover:bg-gray-200/50 dark:hover:bg-gray-750 text-gray-500'
              }`}
            >
              <span>{cat.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Grid de Emojis */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-8 gap-1">
          {displayedEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              type="button"
              onClick={() => onSelectEmoji(emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-transform hover:scale-120 cursor-pointer active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
        {displayedEmojis.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-400">
            No se encontraron emoticones
          </div>
        )}
      </div>

      {/* Footer con categoría activa */}
      <div className="px-3 py-1 bg-gray-50 dark:bg-gray-850 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400 flex justify-between items-center">
        <span>{searchTerm ? 'Resultados' : currentCategory.name}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
};

