'use client';

import { usePathname } from 'next/navigation';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const pageTitles: Record<string, string> = {
  '/padron': 'Padron Estudiantil',
  '/padron/cargar': 'Cargar Padron',
};

export default function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Dashboard';

  return (
    <header className="main-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="mobile-menu-btn" onClick={onToggleSidebar}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="main-header-title">{title}</span>
      </div>
    </header>
  );
}
