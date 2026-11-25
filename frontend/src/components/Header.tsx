
import {
  Bell,
  ChevronRight,
  Search,
} from "lucide-react";

import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  title: string;
  subtitle: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export default function Header({
  title,
  subtitle,
  theme,
  onToggleTheme,
}: HeaderProps) {
  return (
    <header className="topbar">
      <div className="header-heading">
        <div className="breadcrumb">
          VidaPlena
          <ChevronRight size={13} />
          <strong>{title}</strong>
        </div>

        <div className="header-page-title">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="header-actions">
        <div className="header-search">
          <Search size={17} />
          <span>Pesquisar</span>
          <kbd>Ctrl K</kbd>
        </div>

        <ThemeToggle
          theme={theme}
          onToggle={onToggleTheme}
        />

        <button
          type="button"
          className="notification-button"
          aria-label="Notificações"
        >
          <Bell size={19} />
          <span />
        </button>

        <div className="header-avatar" title="Usuário">
          VP
        </div>
      </div>
    </header>
  );
}
