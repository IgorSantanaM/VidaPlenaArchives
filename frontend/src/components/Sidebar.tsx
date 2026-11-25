
import {
  LayoutDashboard,
  FolderOpen,
  CloudUpload,
  Cloud,
  ShieldCheck,
  HeartPulse,
} from "lucide-react";

export type PageKey =
  | "dashboard"
  | "documents"
  | "upload"
  | "storage"
  | "lifecycle";

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

const navigation = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "documents", label: "Documentos", icon: FolderOpen },
  { id: "upload", label: "Enviar documentos", icon: CloudUpload },
  { id: "storage", label: "Armazenamento", icon: Cloud },
  { id: "lifecycle", label: "Retenção e ciclo de vida", icon: ShieldCheck },
] as const;

export default function Sidebar({
  activePage,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <HeartPulse size={23} />
        </div>

        <div className="brand-info">
          <strong>VidaPlena</strong>
          <span>ARCHIVES</span>
        </div>
      </div>

      <div className="sidebar-section-label">MENU PRINCIPAL</div>

      <nav className="sidebar-navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-info-card">
          <div className="sidebar-info-icon">
            <Cloud size={19} />
          </div>

          <strong>Armazenamento seguro</strong>

          <p>
            Seus documentos protegidos na infraestrutura do Google Cloud.
          </p>
        </div>

        <div className="sidebar-footer">
          <span className="sidebar-footer-dot" />
          Sistema de gestão documental
        </div>
      </div>
    </aside>
  );
}
