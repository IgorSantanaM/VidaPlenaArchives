
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, DragEvent } from "react";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Cloud,
  Database,
  File,
  FileImage,
  FileText,
  FileType2,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  X,
  CalendarClock,
  Layers3,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import type { PageKey } from "./components/Sidebar";

type ArchiveDocument = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  expiresAt: string;
};

type ArchivePage = {
  documents: ArchiveDocument[];
  nextPageToken?: string | null;
};

type Theme = "light" | "dark";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL === "/"
    ? window.location.origin
    : import.meta.env.VITE_API_BASE_URL ?? ""
).replace(/\/$/, "");

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const pageInformation: Record<
  PageKey,
  { title: string; subtitle: string }
> = {
  dashboard: {
    title: "Visão geral",
    subtitle: "Acompanhe seus documentos e o funcionamento do arquivo digital.",
  },
  documents: {
    title: "Documentos",
    subtitle: "Consulte, pesquise e acesse seus documentos arquivados.",
  },
  upload: {
    title: "Enviar documentos",
    subtitle: "Adicione novos arquivos ao arquivo digital do hospital.",
  },
  storage: {
    title: "Armazenamento",
    subtitle: "Conheça a organização e as classes de armazenamento do Google Cloud.",
  },
  lifecycle: {
    title: "Retenção e ciclo de vida",
    subtitle: "Entenda as políticas de retenção e transição dos documentos.",
  },
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type.includes("pdf")) return FileType2;
  if (type.includes("text") || type.includes("document")) return FileText;

  return File;
}


async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      "O endereço da API não está configurado. Verifique o arquivo .env."
    );
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor. Verifique se a API está em execução e tente novamente."
    );
  }

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      message || `O servidor retornou um erro (HTTP ${response.status}).`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

 const text = await response.text();

if (!text) {
  return undefined as T;
}

return JSON.parse(text) as T;
}


function StatCard({
  label,
  value,
  description,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof FileText;
  color: string;
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={20} />
      </div>

      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}
function DocumentList({
  documents,
  loading,
  search,
  onOpen,
}: {
  documents: ArchiveDocument[];
  loading: boolean;
  search: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="document-list">
      <div className="list-header">
        <span>NOME DO ARQUIVO</span>
        <span>TAMANHO</span>
        <span>DATA DE ENVIO</span>
        <span>EXPIRA EM</span>
        <span />
      </div>

      {loading && documents.length === 0 ? (
        <div className="empty-state">
          <LoaderCircle className="spin" size={26} />
          <strong>Carregando documentos...</strong>
        </div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={30} />
          <strong>
            {search
              ? "Nenhum resultado encontrado"
              : "Sua biblioteca está vazia"}
          </strong>
          <span>
            {search
              ? "Tente pesquisar utilizando outro nome."
              : "Envie seu primeiro documento para começar."}
          </span>
        </div>
      ) : (
        documents.map((doc) => {
          const Icon = fileIcon(doc.contentType || "");
          const expired =
            new Date(doc.expiresAt).getTime() < Date.now();

          return (
            <article className="document-row" key={doc.id}>
              <div className="file-cell">
                <span className="file-icon">
                  <Icon size={19} />
                </span>

                <div>
                  <strong title={doc.fileName}>{doc.fileName}</strong>
                  <small>
                    {doc.contentType || "Tipo não informado"}
                  </small>
                </div>
              </div>

              <span className="mobile-label">Tamanho</span>
              <span className="file-size">
                {formatBytes(Number(doc.size || 0))}
              </span>

              <span className="mobile-label">Enviado em</span>
              <span className="date-cell">
                {formatDate(doc.uploadedAt)}
              </span>

              <span className="mobile-label">Expira em</span>
              <span className={`expiry-cell ${expired ? "expired" : ""}`}>
                {formatDate(doc.expiresAt)}
                <small>{expired ? "Expirado" : "Retenção ativa"}</small>
              </span>

              <button
                className="open-button"
                type="button"
                onClick={() => onOpen(doc.id)}
                title="Abrir documento"
                aria-label={`Abrir ${doc.fileName}`}
              >
                <ArrowUpRight size={17} />
              </button>
            </article>
          );
        })
      )}
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [theme, setTheme] = useState<Theme>("light");

  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");
  const [selectedDocument, setSelectedDocument] =
  useState<ArchiveDocument | null>(null);
  const [formatFilter, setFormatFilter] = useState("all");
const [periodFilter, setPeriodFilter] = useState("all");
const [sortOrder, setSortOrder] = useState("recent");
const [currentPage, setCurrentPage] = useState(1);
const pageSize = 10;
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);

 const loadDocuments = useCallback(
  async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest<
        ArchiveDocument[] | ArchivePage
      >("/api/archives/");

      const list = Array.isArray(result)
        ? result
        : result.documents ?? [];

      setDocuments(list);
      setNextPageToken(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar os documentos."
      );
    } finally {
      setLoading(false);
    }
  },
  []
);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  
const filteredDocuments = useMemo(() => {
  const term = search.trim().toLocaleLowerCase("pt-BR");

  let result = documents.filter((document) => {
    // Pesquisa pelo nome
    const matchesSearch = document.fileName
      .toLocaleLowerCase("pt-BR")
      .includes(term);
  // Identificação do formato
    const fileName = document.fileName.toLowerCase();
    const contentType = (document.contentType || "").toLowerCase();

    const matchesFormat =
      formatFilter === "all" ||
      (formatFilter === "pdf" &&
        (contentType.includes("pdf") || fileName.endsWith(".pdf"))) ||
      (formatFilter === "word" &&
        (contentType.includes("word") ||
          contentType.includes("document") ||
          fileName.endsWith(".doc") ||
          fileName.endsWith(".docx"))) ||
      (formatFilter === "excel" &&
        (contentType.includes("spreadsheet") ||
          contentType.includes("excel") ||
          fileName.endsWith(".xls") ||
          fileName.endsWith(".xlsx"))) ||
      (formatFilter === "image" &&
        (contentType.startsWith("image/") ||
          /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName))) ||
      (formatFilter === "other" &&
        !(
          contentType.includes("pdf") ||
          fileName.endsWith(".pdf") ||
          contentType.includes("word") ||
          contentType.includes("document") ||
          fileName.endsWith(".doc") ||
          fileName.endsWith(".docx") ||
          contentType.includes("spreadsheet") ||
          contentType.includes("excel") ||
          fileName.endsWith(".xls") ||
          fileName.endsWith(".xlsx") ||
          contentType.startsWith("image/") ||
          /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName)
        ));

    // Filtro por data de envio
    const uploadDate = new Date(document.uploadedAt).getTime();
    const now = Date.now();
    const days = Number(periodFilter);
    const matchesPeriod =
      periodFilter === "all" ||
      (Number.isFinite(uploadDate) &&
        now - uploadDate <= days * 24 * 60 * 60 * 1000 &&
        uploadDate <= now);

    return matchesSearch && matchesFormat && matchesPeriod;
  });

  // Ordenação
  result.sort((a, b) => {
    switch (sortOrder) {
      case "oldest":
        return new Date(a.uploadedAt).getTime() -
          new Date(b.uploadedAt).getTime();

      case "nameAsc":
        return a.fileName.localeCompare(b.fileName, "pt-BR");

      case "nameDesc":
        return b.fileName.localeCompare(a.fileName, "pt-BR");

      case "sizeAsc":
        return Number(a.size || 0) - Number(b.size || 0);

      case "sizeDesc":
        return Number(b.size || 0) - Number(a.size || 0);

      case "recent":
      default:
        return new Date(b.uploadedAt).getTime() -
          new Date(a.uploadedAt).getTime();
    }
  });

  return result;
}, [documents, search, formatFilter, periodFilter, sortOrder]);
const totalPages = Math.ceil(filteredDocuments.length / pageSize);

const paginatedDocuments = useMemo(() => {
  const startIndex = (currentPage - 1) * pageSize;

  return filteredDocuments.slice(startIndex, startIndex + pageSize);
}, [filteredDocuments, currentPage]);

  const totalBytes = useMemo(
    () =>
      documents.reduce(
        (sum, document) => sum + Number(document.size || 0),
        0
      ),
    [documents]
  );

  const now = Date.now();
  const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;

  const activeDocuments = documents.filter((document) => {
    const expiration = new Date(document.expiresAt).getTime();
    return Number.isFinite(expiration) && expiration >= now;
  }).length;

  const expiredDocuments = documents.filter((document) => {
    const expiration = new Date(document.expiresAt).getTime();
    return Number.isFinite(expiration) && expiration < now;
  });

  const expiringDocuments = documents
    .filter((document) => {
      const expiration = new Date(document.expiresAt).getTime();
      return (
        Number.isFinite(expiration) &&
        expiration >= now &&
        expiration <= thirtyDaysFromNow
      );
    })
    .sort(
      (a, b) =>
        new Date(a.expiresAt).getTime() -
        new Date(b.expiresAt).getTime()
    );

  const recentDocuments = [...documents].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() -
      new Date(a.uploadedAt).getTime()
  );

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setNotice("");

    const retention = Number(days);

    if (!file) {
      setError("Selecione um documento para enviar.");
      return;
    }

    if (
      !Number.isInteger(retention) ||
      retention < 1 ||
      retention > 36500
    ) {
      setError(
        "O prazo deve ser um número inteiro entre 1 e 36.500 dias."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("O arquivo ultrapassa o limite de 20 MB.");
      return;
    }

    const form = new FormData();

    form.append("file", file);
    form.append("days", String(retention));

    setUploading(true);

    try {
      await apiRequest<ArchiveDocument>("/api/archives/archive", {
        method: "POST",
        body: form,
      });

      setFile(null);
      setDays("30");

      if (fileInput.current) {
        fileInput.current.value = "";
      }

      setNotice("Documento enviado e arquivado com sucesso.");

      await loadDocuments();
      setActivePage("documents");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível enviar o documento."
      );
    } finally {
      setUploading(false);
    }
  }

  function openDocument(id: string) {
    if (!API_BASE_URL) {
      setError("Configure VITE_API_BASE_URL no arquivo .env.");
      return;
    }

    window.open(
      `${API_BASE_URL}/api/archives/${id}/content`,
      "_blank",
      "noopener,noreferrer"
    );
  }
async function openDocumentDetails(id: string) {
  setError("");

  try {
    const document = await apiRequest<ArchiveDocument>(
      `/api/archives/${id}`
    );

    setSelectedDocument(document);
  } catch (e) {
    setError(
      e instanceof Error
        ? e.message
        : "Não foi possível carregar os detalhes do documento."
    );
  }
}
  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const dropped = event.dataTransfer.files?.[0];

    if (dropped) {
      setFile(dropped);
    }
  }

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  function toggleTheme() {
    setTheme((current) =>
      current === "light" ? "dark" : "light"
    );
  }

  const page = pageInformation[activePage];

  return (
    <div className="app-shell" data-theme={theme}>
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <main className="main-content">
        <Header
          title={page.title}
          subtitle={page.subtitle}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {(error || notice) && (
          <div
            className={`alert ${
              error ? "alert-error" : "alert-success"
            }`}
            role="status"
          >
            {error ? (
              <X size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}

            <span>{error || notice}</span>

            <button
              className="alert-close"
              type="button"
              onClick={() => {
                setError("");
                setNotice("");
              }}
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {activePage === "dashboard" && (
          <div className="page-content">
            <section className="page-heading dashboard-heading">
              <div>
                <div className="eyebrow">PAINEL DE CONTROLE</div>
                <h1>
                  Gestão documental
                  <br />
                  <span>inteligente e segura.</span>
                </h1>
                <p>
                  Acompanhe os arquivos armazenados e gerencie
                  os documentos do Hospital Vida Plena.
                </p>

                <div className="dashboard-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setActivePage("upload")}
                  >
                    <UploadCloud size={17} />
                    Enviar documento
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => loadDocuments()}
                    disabled={loading}
                  >
                    <RefreshCw
                      size={16}
                      className={loading ? "spin" : ""}
                    />
                    Atualizar dados
                  </button>
                </div>
              </div>

              <div className="heading-art" aria-hidden="true">
                <div className="art-circle">
                  <Archive size={48} strokeWidth={1.35} />
                </div>
              </div>
            </section>

            <section className="dashboard-section-heading">
              <div>
                <span className="section-kicker">RESUMO DO ARQUIVO</span>
                <h2>Indicadores gerais</h2>
              </div>
              <span className="dashboard-scope">
                Dados dos documentos carregados
              </span>
            </section>

            <section className="stats-grid">
              <StatCard
                label="DOCUMENTOS LISTADOS"
                value={String(documents.length)}
                description="Arquivos retornados pela API"
                icon={FileText}
                color="stat-blue"
              />

              <StatCard
                label="ESPAÇO LISTADO"
                value={formatBytes(totalBytes)}
                description="Soma do tamanho dos arquivos carregados"
                icon={Database}
                color="stat-violet"
              />

              <StatCard
                label="RETENÇÃO ATIVA"
                value={String(activeDocuments)}
                description="Documentos ainda dentro do prazo"
                icon={ShieldCheck}
                color="stat-green"
              />

              <StatCard
                label="DOCUMENTOS EXPIRADOS"
                value={String(expiredDocuments.length)}
                description="Entre os documentos carregados"
                icon={AlertCircle}
                color="stat-orange"
              />
            </section>

            <section className="dashboard-grid">
              <article className="content-panel">
                <div className="section-title">
                  <div>
                    <span className="section-kicker">ATIVIDADE RECENTE</span>
                    <h2>Últimos documentos enviados</h2>
                  </div>

                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setActivePage("documents")}
                  >
                    Ver biblioteca
                    <ArrowUpRight size={16} />
                  </button>
                </div>

                {loading && documents.length === 0 ? (
                  <div className="empty-state">
                    <LoaderCircle className="spin" size={26} />
                    <strong>Carregando atividade...</strong>
                    <span>Buscando documentos na API.</span>
                  </div>
                ) : recentDocuments.length === 0 ? (
                  <div className="empty-state">
                    <FolderOpen size={28} />
                    <strong>Nenhum documento disponível</strong>
                    <span>
                      Os documentos enviados aparecerão nesta área.
                    </span>
                  </div>
                ) : (
                  <div className="recent-documents">
                    {recentDocuments.slice(0, 5).map((document) => {
                      const Icon = fileIcon(document.contentType || "");

                      return (
                        <div className="recent-document" key={document.id}>
                          <span className="file-icon">
                            <Icon size={19} />
                          </span>

                          <div className="recent-document-info">
                            <strong title={document.fileName}>
                              {document.fileName}
                            </strong>
                            <small>
                              {formatDate(document.uploadedAt)}
                              <span> · </span>
                              {formatBytes(Number(document.size || 0))}
                            </small>
                          </div>

                          <button
                            className="open-button"
                            type="button"
                            onClick={() => openDocument(document.id)}
                            aria-label={`Abrir ${document.fileName}`}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="content-panel attention-panel">
                <div className="section-title">
                  <div>
                    <span className="section-kicker">ACOMPANHAMENTO</span>
                    <h2>Prazos de retenção</h2>
                  </div>
                  <Clock3 size={21} />
                </div>

                <div className="attention-summary">
                  <div className="attention-summary-icon">
                    <CalendarClock size={21} />
                  </div>
                  <div>
                    <strong>{expiringDocuments.length}</strong>
                    <span>
                      documento(s) com vencimento nos próximos 30 dias
                    </span>
                  </div>
                </div>

                {expiringDocuments.length > 0 ? (
                  <div className="expiring-list">
                    {expiringDocuments.slice(0, 4).map((document) => (
                      <div className="expiring-item" key={document.id}>
                        <div>
                          <strong title={document.fileName}>
                            {document.fileName}
                          </strong>
                          <small>
                            Vencimento: {formatDate(document.expiresAt)}
                          </small>
                        </div>
                        <span className="expiry-status">Atenção</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="attention-empty">
                    {loading ? (
                      <span>Atualizando informações...</span>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>
                          Nenhum vencimento próximo identificado nos
                          documentos carregados.
                        </span>
                      </>
                    )}
                  </div>
                )}

                <p className="dashboard-data-note">
                  A análise considera somente os documentos retornados
                  pela consulta atual da API.
                </p>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setActivePage("documents")}
                >
                  Consultar documentos
                  <ArrowUpRight size={16} />
                </button>
              </article>
            </section>

            <section className="content-panel lifecycle-preview">
              <div className="section-title">
                <div>
                  <span className="section-kicker">
                    POLÍTICA DE ARMAZENAMENTO
                  </span>
                  <h2>Ciclo de vida dos documentos</h2>
                </div>

                <button
                  className="text-button"
                  type="button"
                  onClick={() => setActivePage("lifecycle")}
                >
                  Ver política
                  <ArrowUpRight size={16} />
                </button>
              </div>

              <div className="lifecycle-steps">
                {[
                  { name: "Standard", period: "0–30 dias" },
                  { name: "Nearline", period: "Após 30 dias" },
                  { name: "Coldline", period: "Após 90 dias" },
                  { name: "Archive", period: "Após 365 dias" },
                ].map((item, index) => (
                  <div className="lifecycle-step" key={item.name}>
                    <span className="step-number">0{index + 1}</span>
                    <strong>{item.name}</strong>
                    <small>{item.period}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activePage === "documents" && (
          <div className="page-content">
            <section className="page-intro">
              <div>
                <div className="eyebrow">BIBLIOTECA DIGITAL</div>
                <h1>Documentos arquivados</h1>
                <p>
                  Consulte e acesse os arquivos armazenados no sistema.
                </p>
              </div>

              <button
                className="primary-button"
                type="button"
                onClick={() => setActivePage("upload")}
              >
                <UploadCloud size={17} />
                Novo documento
              </button>
            </section>

            <section className="content-panel">
              <div className="table-toolbar">
                <div className="result-count">
                  {documents.length} documento(s) carregado(s)
                </div>

                <label className="search-box">
                  <Search size={16} />
                  <input
                    value={search}
                   onChange={(event) => {
  setSearch(event.target.value);
  setCurrentPage(1);
}}
                    placeholder="Buscar documento..."
                  />
                </label>

<div className="document-filters">
  <label className="filter-control">
    <span>Formato</span>
    <select
      value={formatFilter}
      onChange={(event) => {
  setFormatFilter(event.target.value);
  setCurrentPage(1);
}}
    >
      <option value="all">Todos os formatos</option>
      <option value="pdf">PDF</option>
      <option value="word">Word</option>
      <option value="excel">Excel</option>
      <option value="image">Imagens</option>
      <option value="other">Outros</option>
    </select>
  </label>

  <label className="filter-control">
    <span>Período</span>
    <select
      value={periodFilter}
      onChange={(event) => {
  setPeriodFilter(event.target.value);
  setCurrentPage(1);
}}
    >
      <option value="all">Qualquer data</option>
      <option value="7">Últimos 7 dias</option>
      <option value="30">Últimos 30 dias</option>
      <option value="90">Últimos 90 dias</option>
    </select>
  </label>

  <label className="filter-control">
    <span>Ordenar por</span>
    <select
      value={sortOrder}
      onChange={(event) => {
  setSortOrder(event.target.value);
  setCurrentPage(1);
}}
    >
      <option value="recent">Mais recentes</option>
      <option value="oldest">Mais antigos</option>
      <option value="nameAsc">Nome (A–Z)</option>
      <option value="nameDesc">Nome (Z–A)</option>
      <option value="sizeAsc">Menor tamanho</option>
      <option value="sizeDesc">Maior tamanho</option>
    </select>
  </label>
</div>

                <button
                  className="refresh-button"
                  type="button"
                  onClick={() => loadDocuments()}
                  disabled={loading}
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "spin" : ""}
                  />
                  Atualizar
                </button>
              </div>

              <DocumentList
  documents={paginatedDocuments}
  loading={loading}
  search={search}
 onOpen={openDocumentDetails}
/>
<div className="pagination">
  <span>
    {filteredDocuments.length} documento(s) encontrado(s)
  </span>

  <div className="pagination-controls">
    <button
      type="button"
      disabled={currentPage <= 1}
      onClick={() => setCurrentPage((page) => page - 1)}
    >
      Anterior
    </button>

    <span>
      {totalPages === 0 ? 0 : currentPage} / {totalPages}
    </span>

    <button
      type="button"
      disabled={currentPage >= totalPages}
      onClick={() => setCurrentPage((page) => page + 1)}
    >
      Próxima
    </button>
  </div>
</div>

{selectedDocument && (
  <div
    className="document-modal-overlay"
    onClick={() => setSelectedDocument(null)}
  >
    <div
      className="document-modal"
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-modal-title"
    >
      <div className="document-modal-header">
        <div>
          <span className="modal-eyebrow">
            DETALHES DO DOCUMENTO
          </span>
          <h2 id="document-modal-title">Informações do arquivo</h2>
        </div>

        <button
          type="button"
          className="modal-close"
          onClick={() => setSelectedDocument(null)}
          aria-label="Fechar"
        >
          ×
        </button>
      </div>

      <div className="document-modal-file">
        <strong>{selectedDocument.fileName}</strong>
        <span>
          {selectedDocument.contentType || "Tipo não informado"}
        </span>
      </div>

      <div className="document-modal-details">
        <div>
          <span>Tamanho</span>
          <strong>
            {formatBytes(Number(selectedDocument.size || 0))}
          </strong>
        </div>

        <div>
          <span>Data de envio</span>
          <strong>{formatDate(selectedDocument.uploadedAt)}</strong>
        </div>

        <div>
          <span>Expiração</span>
          <strong>{formatDate(selectedDocument.expiresAt)}</strong>
        </div>

        <div>
          <span>Situação da retenção</span>
          <strong
            className={
              new Date(selectedDocument.expiresAt).getTime() < Date.now()
                ? "modal-expired"
                : "modal-active"
            }
          >
            {new Date(selectedDocument.expiresAt).getTime() < Date.now()
              ? "Expirada"
              : "Ativa"}
          </strong>
        </div>
      </div>

      <div className="document-modal-actions">
        <button
          type="button"
          className="modal-secondary-button"
          onClick={() => setSelectedDocument(null)}
        >
          Fechar
        </button>

        <button
          type="button"
          className="modal-primary-button"
          onClick={() => openDocument(selectedDocument.id)}
        >
          Abrir arquivo
        </button>
      </div>
    </div>
  </div>
)}

              {nextPageToken && !search && (
                <button
                  className="load-more"
                  type="button"
                  onClick={() => loadDocuments()} 
                 disabled={loading}
                >
                  {loading ? "Carregando..." : "Carregar mais documentos"}
                </button>
              )}

              <div className="list-footnote">
                <ShieldCheck size={14} />
                Os arquivos são armazenados no Google Cloud Storage.
              </div>
            </section>
          </div>
        )}

        {activePage === "upload" && (
          <div className="page-content">
            <section className="page-intro">
              <div>
                <div className="eyebrow">NOVO ARQUIVO</div>
                <h1>Enviar documento</h1>
                <p>
                  Adicione arquivos à biblioteca digital do hospital.
                </p>
              </div>
            </section>

            <section className="content-panel upload-page-panel">
              <div className="section-title">
                <div>
                  <span className="section-kicker">UPLOAD</span>
                  <h2>Selecionar arquivo</h2>
                </div>

                <span className="section-number">01 / ENVIO</span>
              </div>

              <form className="upload-panel" onSubmit={handleUpload}>
                <div
                  className="drop-zone"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleFileDrop}
                >
                 <input
                   ref={fileInput}
                  type="file"
                   onChange={selectFile}
                   disabled={uploading}
                />

                  <div className="upload-symbol">
                    <UploadCloud size={27} />
                  </div>

                  {file ? (
                    <>
                      <strong className="selected-file">
                        {file.name}
                      </strong>
                      <span>
                        {formatBytes(file.size)} • Arquivo selecionado
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Arraste seu arquivo até aqui</strong>
                      <span>
                        ou <b>clique para procurar</b> no computador
                      </span>
                    </>
                  )}

                  <small>Limite de tamanho: 20 MB</small>
                </div>

                <div className="upload-controls">
                  <label htmlFor="retention">
                    Prazo de retenção
                  </label>

                  <div className="input-with-suffix">
                    <input
                      id="retention"
                      type="number"
                      min="1"
                      max="36500"
                      value={days}
                      onChange={(event) => setDays(event.target.value)}
                    />
                    <span>dias</span>
                  </div>

                  <p>
                    O documento será configurado para expirar após
                    esse período.
                  </p>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={uploading || !file}
                  >
                    {uploading ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <UploadCloud size={17} />
                    )}

                    {uploading ? "Enviando..." : "Enviar documento"}
                  </button>
                </div>
              </form>

              <div className="upload-security-note">
                <ShieldCheck size={19} />
                <div>
                  <strong>Envio protegido</strong>
                  <p>
                    Os documentos são encaminhados à API para
                    armazenamento no Google Cloud Storage.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activePage === "storage" && (
          <div className="page-content">
            <section className="page-intro">
              <div>
                <div className="eyebrow">INFRAESTRUTURA</div>
                <h1>Armazenamento</h1>
                <p>
                  Organização dos arquivos por classes de armazenamento
                  do Google Cloud Storage.
                </p>
              </div>
            </section>

            <section className="storage-banner content-panel">
              <div className="storage-banner-icon">
                <Cloud size={30} />
              </div>

              <div>
                <span className="section-kicker">
                  ARMAZENAMENTO EM NUVEM
                </span>
                <h2>Google Cloud Storage</h2>
                <p>
                  A solução utiliza diferentes classes de armazenamento
                  para equilibrar acesso, disponibilidade e custo ao
                  longo do tempo.
                </p>
              </div>
            </section>

            <section className="storage-class-grid">
              <article className="storage-class-card">
                <div className="storage-class-icon">
                  <Activity size={22} />
                </div>
                <span className="storage-period">0–30 DIAS</span>
                <h3>Standard</h3>
                <p>
                  Indicada para documentos acessados frequentemente,
                  especialmente no período inicial.
                </p>
                <span className="storage-tag">Acesso frequente</span>
              </article>

              <article className="storage-class-card">
                <div className="storage-class-icon">
                  <HardDrive size={22} />
                </div>
                <span className="storage-period">APÓS 30 DIAS</span>
                <h3>Nearline</h3>
                <p>
                  Indicada para documentos acessados com menor
                  frequência.
                </p>
                <span className="storage-tag">Acesso ocasional</span>
              </article>

              <article className="storage-class-card">
                <div className="storage-class-icon">
                  <Archive size={22} />
                </div>
                <span className="storage-period">APÓS 90 DIAS</span>
                <h3>Coldline</h3>
                <p>
                  Indicada para arquivos que precisam ser mantidos
                  por períodos prolongados.
                </p>
                <span className="storage-tag">Acesso pouco frequente</span>
              </article>

              <article className="storage-class-card">
                <div className="storage-class-icon">
                  <Database size={22} />
                </div>
                <span className="storage-period">APÓS 365 DIAS</span>
                <h3>Archive</h3>
                <p>
                  Indicada para preservação de longo prazo,
                  com acesso eventual.
                </p>
                <span className="storage-tag">Arquivo de longo prazo</span>
              </article>
            </section>

            <section className="content-panel storage-information">
              <div className="section-title">
                <div>
                  <span className="section-kicker">INFORMAÇÃO</span>
                  <h2>Uso das classes de armazenamento</h2>
                </div>
                <Layers3 size={22} />
              </div>

              <p>
                As classes representam a política de transição planejada
                para os documentos. A quantidade de arquivos e o volume
                efetivamente armazenado em cada classe dependem dos dados
                disponibilizados pela infraestrutura.
              </p>
            </section>
          </div>
        )}

        {activePage === "lifecycle" && (
          <div className="page-content">
            <section className="page-intro">
              <div>
                <div className="eyebrow">GOVERNANÇA DOCUMENTAL</div>
                <h1>Retenção e ciclo de vida</h1>
                <p>
                  Entenda como os documentos são mantidos e como
                  sua classe de armazenamento evolui.
                </p>
              </div>
            </section>

            <section className="content-panel retention-highlight">
              <div className="retention-icon">
                <ShieldCheck size={30} />
              </div>

              <div>
                <span className="section-kicker">PRESERVAÇÃO DOCUMENTAL</span>
                <h2>Retenção de até 20 anos</h2>
                <p>
                  O projeto considera a preservação dos documentos
                  pelo período legal de retenção definido para o hospital.
                </p>
              </div>
            </section>

            <section className="content-panel">
              <div className="section-title">
                <div>
                  <span className="section-kicker">TRANSIÇÃO AUTOMÁTICA</span>
                  <h2>Etapas do ciclo de vida</h2>
                </div>
                <CalendarClock size={22} />
              </div>

              <div className="lifecycle-timeline">
                <div className="timeline-item">
                  <span className="timeline-marker" />
                  <div>
                    <span className="timeline-period">0–30 DIAS</span>
                    <h3>Standard</h3>
                    <p>
                      Período inicial de acesso rápido aos documentos.
                    </p>
                  </div>
                </div>

                <div className="timeline-item">
                  <span className="timeline-marker" />
                  <div>
                    <span className="timeline-period">APÓS 30 DIAS</span>
                    <h3>Nearline</h3>
                    <p>
                      Transição para armazenamento de acesso ocasional.
                    </p>
                  </div>
                </div>

                <div className="timeline-item">
                  <span className="timeline-marker" />
                  <div>
                    <span className="timeline-period">APÓS 90 DIAS</span>
                    <h3>Coldline</h3>
                    <p>
                      Armazenamento para documentos pouco acessados.
                    </p>
                  </div>
                </div>

                <div className="timeline-item">
                  <span className="timeline-marker" />
                  <div>
                    <span className="timeline-period">APÓS 365 DIAS</span>
                    <h3>Archive</h3>
                    <p>
                      Armazenamento voltado à preservação de longo prazo.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="content-panel retention-information">
              <div className="section-title">
                <div>
                  <span className="section-kicker">ATENÇÃO</span>
                  <h2>Retenção não é ciclo de vida</h2>
                </div>
                <Clock3 size={22} />
              </div>

              <p>
                A retenção determina por quanto tempo o documento
                deve ser preservado. Já o ciclo de vida determina
                quando ele muda de classe de armazenamento.
                A transição entre Standard, Nearline, Coldline e
                Archive não significa que o documento será excluído.
              </p>
            </section>

            <section className="content-panel retention-information">
              <div className="section-title">
                <div>
                  <span className="section-kicker">CONTROLE DE PRAZO</span>
                  <h2>Configuração de retenção</h2>
                </div>
                <CalendarClock size={22} />
              </div>

              <p>
                No envio de documentos, o sistema permite informar
                o prazo de retenção em dias. Essa configuração é
                encaminhada à API pelo campo de retenção do arquivo.
              </p>

              <button
                className="secondary-button"
                type="button"
                onClick={() => setActivePage("upload")}
              >
                Configurar novo documento
                <ArrowUpRight size={16} />
              </button>
            </section>
          </div>
        )}

        <footer className="footer">
          <span>VIDAPLENA ARCHIVES</span>
          <span>
            Organização, preservação e segurança documental.
          </span>
        </footer>
      </main>
    </div>
  );
}
