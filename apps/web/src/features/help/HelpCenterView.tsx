import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  FileText,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  Tag,
  Sliders,
  Landmark,
  Info,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  USER_GUIDES,
  BADGE_DICTIONARY,
  BUSINESS_RULES_EXPLANATION,
  ACCOUNTING_SUBMODULES,
  ACCOUNTING_MAPPINGS_DOC,
  ACCOUNTING_CIRCUITS_DOC,
  generateUserManualMarkdown,
} from '@ero/shared';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import { toast } from 'sonner';

export const HelpCenterView: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [activeTab, setActiveTab] = useState<'guides' | 'badges' | 'rules' | 'accounting'>('guides');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(USER_GUIDES[0]?.id || null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(USER_GUIDES.map((g) => g.category));
    return ['ALL', ...Array.from(set)];
  }, []);

  const filteredGuides = useMemo(() => {
    return USER_GUIDES.filter((g) => {
      const matchesCat = selectedCategory === 'ALL' || g.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      if (!term) return matchesCat;
      const matchesText =
        g.title.toLowerCase().includes(term) ||
        g.purpose.toLowerCase().includes(term) ||
        g.summary.toLowerCase().includes(term) ||
        g.steps.some((s) => s.title.toLowerCase().includes(term) || s.description.toLowerCase().includes(term));
      return matchesCat && matchesText;
    });
  }, [selectedCategory, searchTerm]);

  const filteredBadges = useMemo(() => {
    if (!searchTerm.trim()) return BADGE_DICTIONARY;
    const term = searchTerm.toLowerCase().trim();
    return BADGE_DICTIONARY.filter(
      (b) =>
        b.term.toLowerCase().includes(term) ||
        b.spanish.toLowerCase().includes(term) ||
        b.meaning.toLowerCase().includes(term) ||
        b.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredRules = useMemo(() => {
    if (!searchTerm.trim()) return BUSINESS_RULES_EXPLANATION;
    const term = searchTerm.toLowerCase().trim();
    return BUSINESS_RULES_EXPLANATION.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.legalContext.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleDownloadMarkdown = () => {
    const now = new Date();
    const author = user?.fullName || user?.username || 'Usuario Autorizado';
    const doc = generateUserManualMarkdown(author);
    const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manual_Usuario_ERO_ERP_${now.toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Manual de Usuario descargado exitosamente (.md)');
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-700 dark:text-emerald-300">
              <BookOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Centro de Ayuda, Guías & Manual de Usuario
            </h1>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Manual completo de uso por módulos, flujo de procesos, glosario de banderas, reglas de negocio y contabilidad VEN-NIF.
          </p>
        </div>

        {/* Acciones de Visor PDF y Descarga .md */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPdfModalOpen(true)}
            className="border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Abrir Manual Oficial de Usuario en el Visor PDF para imprimir o guardar"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            <span>Imprimir / Visor PDF</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleDownloadMarkdown}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            title="Descargar Manual Completo formateado en Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Descargar Manual (.md)</span>
          </Button>
        </div>
      </div>

      {/* Barra de Búsqueda Global y Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar módulo, proceso, bandera o regla (ej: CxP, Tesorería, arqueo, Verificada, IGTF, BCV, 1.1.01.06)..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          />
        </div>

        {/* Tabs de Navegación */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('guides')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'guides'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Guías por Módulo ({USER_GUIDES.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('badges')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'badges'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Glosario de Banderas ({BADGE_DICTIONARY.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'rules'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Reglas de Negocio ({BUSINESS_RULES_EXPLANATION.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounting')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'accounting'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Contabilidad Detallada VEN-NIF</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PROCEDIMIENTOS PASO A PASO */}
      {activeTab === 'guides' && (
        <div className="space-y-4">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                {cat === 'ALL' ? 'Todos los Módulos' : cat}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredGuides.length === 0 && (
              <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs">
                No se encontraron procedimientos que coincidan con la búsqueda.
              </div>
            )}

            {filteredGuides.map((guide) => {
              const isExpanded = expandedGuideId === guide.id;
              return (
                <div
                  key={guide.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden shadow-2xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedGuideId(isExpanded ? null : guide.id)}
                    className="w-full p-4 flex items-start justify-between gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {guide.category}
                        </span>
                        <h2 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          {guide.title}
                        </h2>
                      </div>
                      <p className="text-[11px] text-neutral-700 dark:text-neutral-300">
                        {guide.summary}
                      </p>
                    </div>

                    <div className="p-1 text-neutral-500 dark:text-neutral-400 shrink-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/30 space-y-4">
                      {/* Propósito / ¿Para qué sirve? */}
                      <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1">
                        <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide block">
                          ¿Para qué sirve este proceso?
                        </span>
                        <p className="text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
                          {guide.purpose}
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                          Forma de Trabajar (Paso a Paso):
                        </h3>

                        <div className="space-y-2.5">
                          {guide.steps.map((step, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-2xs space-y-1"
                            >
                              <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-neutral-100">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span>{step.title}</span>
                              </div>
                              <p className="text-xs text-neutral-700 dark:text-neutral-300 pl-7 leading-relaxed">
                                {step.description}
                              </p>
                              {step.tip && (
                                <div className="ml-7 mt-1.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-1.5">
                                  <Info className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                                  <span>{step.tip}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {guide.rules && guide.rules.length > 0 && (
                        <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-300 dark:border-sky-800 text-xs space-y-1">
                          <span className="text-[11px] font-bold text-sky-950 dark:text-sky-200 block">
                            Reglas de Control Interno Asociadas:
                          </span>
                          <ul className="list-disc list-inside text-[11px] text-sky-900 dark:text-sky-300 space-y-0.5">
                            {guide.rules.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: GLOSARIO DE BANDERAS Y ESTADOS */}
      {activeTab === 'badges' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-300 dark:border-sky-800 text-xs text-sky-950 dark:text-sky-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Significado de Banderas y Estados del Sistema</p>
              <p className="text-[11px] text-sky-900 dark:text-sky-300 mt-0.5">
                Algunas banderas de API y contabilidad conservan su clave estándar internacional junto con su traducción operativa. Aquí se detalla cada etiqueta, qué significa y dónde impacta.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredBadges.map((badge, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg border border-neutral-300 dark:border-neutral-700 truncate">
                      {badge.term}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                      {badge.spanish}
                    </span>
                  </div>
                  <Badge variant={badge.badgeVariant}>{badge.term}</Badge>
                </div>

                <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {badge.meaning}
                </p>

                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 flex flex-wrap items-center justify-between gap-1">
                  <span>Módulo: <strong className="text-neutral-800 dark:text-neutral-200">{badge.category}</strong></span>
                  <span className="italic">Uso: {badge.usageContext}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REGLAS DE NEGOCIO Y CONFIGURACIÓN */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200">
            Guía detallada de las políticas automáticas de negocio, seguridad operativa y cumplimiento legal en Venezuela (SENIAT / BCV / VEN-NIF).
          </div>

          <div className="space-y-3">
            {filteredRules.map((rule, idx) => (
              <div
                key={idx}
                className="p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{rule.name}</span>
                  </h3>
                  <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800 self-start sm:self-auto">
                    {rule.legalContext}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200 block text-[11px]">
                      ¿Para qué sirve?
                    </span>
                    <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-[11px]">
                      {rule.description}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200 block text-[11px]">
                      ¿Cómo configurarlo?
                    </span>
                    <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-[11px]">
                      {rule.configurationGuide}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200 block text-[11px]">
                      Impacto y Auditoría
                    </span>
                    <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-[11px]">
                      {rule.auditImpact}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CONTABILIDAD DETALLADA VEN-NIF */}
      {activeTab === 'accounting' && (
        <div className="space-y-6">
          <div className="p-5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#007BFF] dark:text-[#3D91FF]" />
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Arquitectura y Funcionamiento del Módulo Contable VEN-NIF (NIIF para PYMES)
              </h2>
            </div>
            <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
              Homologado bajo el Código de Comercio de Venezuela (Art. 32-38) y las Normas VEN-NIF de la FCCPV. Ofrece doble moneda funcional simultánea (VES y USD), partida doble estricta, inmutabilidad legal, contabilización automática en tiempo real vinculada a Tesorería, ajuste por inflación VEN-NIF B-10 (INPC del BCV) y regularización cambiaria.
            </p>
          </div>

          {/* 7 Submódulos Contables */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {ACCOUNTING_SUBMODULES.map((sub, i) => (
              <div
                key={i}
                className={`p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-2 shadow-2xs ${
                  i === ACCOUNTING_SUBMODULES.length - 1 ? 'md:col-span-2 lg:col-span-3' : ''
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[#007BFF] dark:text-[#3D91FF]">
                  <Layers className="w-4 h-4" />
                  <h3>{sub.title}</h3>
                </div>
                <p className="text-neutral-700 dark:text-neutral-300 text-[11px] leading-relaxed">
                  {sub.description}
                </p>
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-600 dark:text-neutral-400 font-mono">
                  Ruta: {sub.route}
                </div>
              </div>
            ))}
          </div>

          {/* Circuitos Contables (Debe / Haber) */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 space-y-3 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#007BFF] dark:text-[#3D91FF]" />
                Circuitos de Contabilización Automática (Asientos Debe / Haber)
              </h3>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                Qué asiento contable genera automáticamente cada proceso operativo del ERP
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800 font-bold text-neutral-800 dark:text-neutral-200 border-b border-neutral-300 dark:border-neutral-700">
                  <tr>
                    <th className="py-2.5 px-3">Proceso Operativo</th>
                    <th className="py-2.5 px-3">Evento Disparador</th>
                    <th className="py-2.5 px-3">Cuentas al Debe (Débito)</th>
                    <th className="py-2.5 px-3">Cuentas al Haber (Crédito)</th>
                    <th className="py-2.5 px-3">Alcance / Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-[11px]">
                  {ACCOUNTING_CIRCUITS_DOC.map((c, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 px-3 font-bold text-neutral-900 dark:text-neutral-100">{c.process}</td>
                      <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">{c.trigger}</td>
                      <td className="py-2 px-3 text-emerald-800 dark:text-emerald-300 font-medium">{c.debitAccounts}</td>
                      <td className="py-2 px-3 text-sky-800 dark:text-sky-300 font-medium">{c.creditAccounts}</td>
                      <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Matriz Completa de Mapeos Predeterminados */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 space-y-3 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Matriz de Mapeo Predeterminado (Claves Operativas mapping_key)
              </h3>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                Correspondencia entre claves lógicas del sistema y cuentas auxiliares VEN-NIF (editable en Contabilidad &gt; Contabilización Automática)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800 font-bold text-neutral-800 dark:text-neutral-200 border-b border-neutral-300 dark:border-neutral-700">
                  <tr>
                    <th className="py-2.5 px-3">Clave de Mapeo</th>
                    <th className="py-2.5 px-3">Cuenta VEN-NIF</th>
                    <th className="py-2.5 px-3">Nombre de la Cuenta</th>
                    <th className="py-2.5 px-3">Circuito Comercial</th>
                    <th className="py-2.5 px-3">Comportamiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono text-[11px]">
                  {ACCOUNTING_MAPPINGS_DOC.map((m) => (
                    <tr key={m.key} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 px-3 font-bold text-[#007BFF] dark:text-[#3D91FF]">{m.key}</td>
                      <td className="py-2 px-3 font-bold text-neutral-900 dark:text-neutral-100">{m.accountCode}</td>
                      <td className="py-2 px-3 font-sans font-medium text-neutral-900 dark:text-neutral-100">{m.accountName}</td>
                      <td className="py-2 px-3 font-sans text-neutral-700 dark:text-neutral-300">{m.circuit}</td>
                      <td className="py-2 px-3 font-sans text-neutral-700 dark:text-neutral-300">{m.behavior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Visor PDF Oficial del Manual de Usuario */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title="Manual Oficial de Usuario - ERO ERP VE"
        subtitle="Guía operativa por módulos, glosario de banderas, reglas de negocio y contabilidad VEN-NIF"
        endpoint="/api/reports/user-manual/pdf"
        filename={`Manual_Usuario_ERO_ERP_${new Date().toISOString().slice(0, 10)}.pdf`}
        token={token}
      />
    </div>
  );
};
