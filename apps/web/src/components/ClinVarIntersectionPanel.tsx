import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Database,
  ExternalLink,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  Upload,
} from 'lucide-react';
import {
  localizeClinicalSignificance,
  SupportedLanguage,
  TRANSLATIONS,
} from '../i18n';
import type { ClinVarIntersectionReport, ClinVarMatchedVariant } from '../types/plasmid';

export interface ClinVarIntersectionPanelProps {
  lang: SupportedLanguage;
  hasVaultFile: boolean;
  loading: boolean;
  error: string | null;
  report: ClinVarIntersectionReport | null;
  onTriggerUpload: () => void;
  onInspectInNavigator: (match: ClinVarMatchedVariant) => void;
}

type CategoryFilter =
  | 'all'
  | 'pathogenic'
  | 'likely_pathogenic'
  | 'drug_response'
  | 'risk_factor';

function renderStars(stars: number, ariaLabel: string): React.ReactNode {
  const clamped = Math.max(0, Math.min(4, stars));
  return (
    <span
      aria-label={ariaLabel}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
    >
      {[0, 1, 2, 3].map((idx) => (
        <Star
          key={idx}
          size={12}
          color={idx < clamped ? '#d97706' : '#cbd5e1'}
          fill={idx < clamped ? '#f59e0b' : 'none'}
          strokeWidth={idx < clamped ? 2 : 1.75}
        />
      ))}
    </span>
  );
}

function getSignificanceBadgeStyle(category: string): {
  bg: string;
  fg: string;
  border: string;
} {
  switch (category) {
    case 'pathogenic':
    case 'oncogenic':
      return { bg: '#fff1f2', fg: '#be123c', border: '#fecdd3' };
    case 'likely_pathogenic':
      return { bg: '#fff7ed', fg: '#9a3412', border: '#fed7aa' };
    case 'drug_response':
      return { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' };
    case 'risk_factor':
      return { bg: '#fefce8', fg: '#854d0e', border: '#fef08a' };
    default:
      return { bg: '#f8fafc', fg: '#334155', border: '#e2e8f0' };
  }
}

export const ClinVarIntersectionPanel: React.FC<ClinVarIntersectionPanelProps> = ({
  lang,
  hasVaultFile,
  loading,
  error,
  report,
  onTriggerUpload,
  onInspectInNavigator,
}) => {
  const it = TRANSLATIONS[lang].intersection;
  const wt = TRANSLATIONS[lang].workspace;
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [minStars, setMinStars] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredMatches = useMemo<ClinVarMatchedVariant[]>(() => {
    if (!report) return [];
    const q = searchQuery.trim().toLowerCase();

    return report.matches.filter((m) => {
      if (categoryFilter === 'pathogenic') {
        if (
          m.significance_category !== 'pathogenic' &&
          m.significance_category !== 'oncogenic'
        ) {
          return false;
        }
      } else if (categoryFilter !== 'all' && m.significance_category !== categoryFilter) {
        return false;
      }

      if (m.review_stars < minStars) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        m.gene ?? '',
        m.rsid,
        m.variation_id ? `VCV${m.variation_id}` : '',
        m.chrom,
        String(m.pos),
        m.clinical_significance,
        localizeClinicalSignificance(m.clinical_significance, lang),
        ...m.conditions,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [report, categoryFilter, minStars, searchQuery, lang]);

  const ringArcs = useMemo(() => {
    if (!report) return [];
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const total = Math.max(1, report.total_personal_variants);
    const pathogenic = report.pathogenic_count + report.likely_pathogenic_count;
    const pharmaco = report.drug_response_count + report.risk_factor_count;
    const otherMatched = Math.max(0, report.matched_count - pathogenic - pharmaco);
    const remaining = Math.max(0, report.total_personal_variants - report.matched_count);

    const segments = [
      { key: 'pathogenic', value: pathogenic, color: '#be123c' },
      { key: 'pharmaco', value: pharmaco, color: '#2563eb' },
      { key: 'other', value: otherMatched, color: '#0d9488' },
      { key: 'remaining', value: remaining, color: '#e2e8f0' },
    ];

    let offset = 0;
    return segments
      .filter((s) => s.value > 0)
      .map((s) => {
        const len = (s.value / total) * circumference;
        const arc = {
          key: s.key,
          color: s.color,
          dashArray: `${len} ${circumference}`,
          dashOffset: -offset,
        };
        offset += len;
        return arc;
      });
  }, [report]);

  const formatZygosity = (z: string): string => {
    switch (z) {
      case 'Heterozygous':
        return it.zygosityHet;
      case 'HomozygousAlt':
        return it.zygosityHomAlt;
      case 'Hemizygous':
        return it.zygosityHemi;
      default:
        return it.zygosityObserved;
    }
  };

  return (
    <section
      data-testid="clinvar-intersection-panel"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px',
        backgroundColor: '#ffffff',
        marginBottom: '24px',
        minWidth: 0,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h2
            className="cjk-keep"
            style={{
              fontSize: '17px',
              fontWeight: 800,
              margin: '0 0 6px 0',
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            {it.title}
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
            {it.subtitle}
          </p>
        </div>

        <span
          data-testid="clinvar-zero-egress-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: '9999px',
            backgroundColor: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0',
            fontSize: '11px',
            fontWeight: 700,
            maxWidth: '100%',
            wordBreak: 'break-word',
          }}
        >
          <ShieldCheck size={14} style={{ flexShrink: 0 }} />
          <span>{it.privacyProofBadge}</span>
        </span>
      </div>

      {!hasVaultFile && !loading && !report ? (
        <div
          data-testid="clinvar-empty-state"
          style={{
            padding: '28px 18px',
            borderRadius: '10px',
            backgroundColor: '#f8fafc',
            border: '1.5px dashed #cbd5e1',
            textAlign: 'center',
          }}
        >
          <h3
            className="cjk-keep"
            style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}
          >
            {it.emptyTitle}
          </h3>
          <p
            style={{
              margin: '0 auto 16px auto',
              maxWidth: '620px',
              fontSize: '13px',
              color: '#475569',
              lineHeight: 1.55,
            }}
          >
            {it.emptyDesc}
          </p>
          <button
            type="button"
            data-testid="clinvar-empty-upload-btn"
            onClick={onTriggerUpload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #0f172a',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              maxWidth: '100%',
            }}
          >
            <Upload size={15} style={{ flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word' }}>{it.uploadCtaBtn}</span>
          </button>
        </div>
      ) : loading ? (
        <div
          data-testid="clinvar-loading-state"
          style={{
            padding: '24px',
            borderRadius: '10px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '13px',
            fontWeight: 600,
            color: '#1d4ed8',
          }}
        >
          {it.runningStatus}
        </div>
      ) : error ? (
        <div
          role="alert"
          data-testid="clinvar-error-state"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 16px',
            borderRadius: '10px',
            backgroundColor: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
            fontSize: '13px',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span style={{ wordBreak: 'break-word' }}>{error}</span>
        </div>
      ) : report ? (
        <>
          {/* Function-Inspired SVG Ring + Structured Breakdown Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              padding: '14px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '14px',
              minWidth: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '78px',
                height: '78px',
                flexShrink: 0,
              }}
            >
              <svg width="78" height="78" viewBox="0 0 78 78" fill="none" aria-hidden="true">
                <circle cx="39" cy="39" r="32" stroke="#e2e8f0" strokeWidth="7" fill="none" />
                <g transform="rotate(-90 39 39)">
                  {ringArcs.map((arc) => (
                    <circle
                      key={arc.key}
                      cx="39"
                      cy="39"
                      r="32"
                      stroke={arc.color}
                      strokeWidth="7"
                      strokeDasharray={arc.dashArray}
                      strokeDashoffset={arc.dashOffset}
                      strokeLinecap="butt"
                      fill="none"
                    />
                  ))}
                </g>
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <span
                  className="tabular-nums"
                  style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}
                >
                  {report.matched_count}
                </span>
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b' }}>
                  {wt.bentoRingMatched}
                </span>
              </div>
            </div>

            <div
              style={{
                flex: '1 1 220px',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: 500 }}>
                  <Database size={13} color="#64748b" />
                  <span>{wt.bentoRowTotalPersonal}</span>
                </span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: '#0f172a' }}>
                  {report.total_personal_variants.toLocaleString()} ({report.personal_build})
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: 500 }}>
                  <Stethoscope size={13} color="#2563eb" />
                  <span>{wt.bentoRowClinvarMatch}</span>
                </span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: '#0f172a' }}>
                  {report.matched_count.toLocaleString()} / {report.clinvar_variants_scanned.toLocaleString()}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: 500 }}>
                  <Activity size={13} color="#be123c" />
                  <span>{wt.bentoRowActionable}</span>
                </span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: '#0f172a' }}>
                  {report.pathogenic_count + report.likely_pathogenic_count} ·{' '}
                  {report.drug_response_count + report.risk_factor_count}
                </span>
              </div>
            </div>
          </div>

          {/* Plausible-style Summary Telemetry Cards */}
          <div data-testid="clinvar-summary-cards" className="plasmid-clinvar-kpi-grid">
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                minWidth: 0,
              }}
            >
              <span
                className="cjk-keep"
                style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block' }}
              >
                {it.cardMatchedTitle}
              </span>
              <div
                data-testid="clinvar-matched-count"
                className="tabular-nums"
                style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}
              >
                {report.matched_count}
              </div>
              <span className="tabular-nums cjk-keep" style={{ fontSize: '11px', color: '#64748b' }}>
                {it.cardMatchedSub(
                  report.carrier_personal_variants,
                  report.total_personal_variants
                )}
              </span>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                minWidth: 0,
              }}
            >
              <span
                className="cjk-keep"
                style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block' }}
              >
                {it.cardPathogenicTitle}
              </span>
              <div
                className="tabular-nums"
                style={{ fontSize: '22px', fontWeight: 800, color: '#be123c', marginTop: '2px' }}
              >
                {report.pathogenic_count + report.likely_pathogenic_count}
              </div>
              <span className="tabular-nums cjk-keep" style={{ fontSize: '11px', color: '#64748b' }}>
                {it.cardPathogenicSub(report.pathogenic_count, report.likely_pathogenic_count)}
              </span>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                minWidth: 0,
              }}
            >
              <span
                className="cjk-keep"
                style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block' }}
              >
                {it.cardPharmacoTitle}
              </span>
              <div
                className="tabular-nums"
                style={{ fontSize: '22px', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}
              >
                {report.drug_response_count + report.risk_factor_count}
              </div>
              <span className="tabular-nums cjk-keep" style={{ fontSize: '11px', color: '#64748b' }}>
                {it.cardPharmacoSub(report.drug_response_count, report.risk_factor_count)}
              </span>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #bbf7d0',
                backgroundColor: '#f0fdf4',
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', display: 'block' }}>
                {it.cardSlicingTitle}
              </span>
              <div
                className="tabular-nums"
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: '#15803d',
                  marginTop: '4px',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {report.personalBytesSent} B · {report.elapsedMs} ms
              </div>
              <span
                className="tabular-nums"
                style={{ fontSize: '11px', color: '#166534', wordBreak: 'break-word' }}
              >
                {it.cardSlicingSub(
                  report.clinvarChunksAccessed.length,
                  (report.clinvarBytesFetched / 1024).toFixed(1),
                  (report.clinvarTotalFileSize / 1024).toFixed(0)
                )}
              </span>
            </div>
          </div>

          {report.lifted_variants_count > 0 && (
            <div
              data-testid="clinvar-liftover-banner"
              style={{
                marginBottom: '14px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e3a8a',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {it.liftedNotice(
                report.lifted_variants_count,
                report.personal_build,
                report.clinvar_build
              )}
            </div>
          )}

          {/* Filter & Search Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minWidth: 0, maxWidth: '100%' }}>
              {(
                [
                  { id: 'all', label: `${it.filterAll} (${report.matched_count})` },
                  {
                    id: 'pathogenic',
                    label: `${it.filterPathogenic} (${report.pathogenic_count})`,
                  },
                  {
                    id: 'likely_pathogenic',
                    label: `${it.filterLikelyPathogenic} (${report.likely_pathogenic_count})`,
                  },
                  {
                    id: 'drug_response',
                    label: `${it.filterDrugResponse} (${report.drug_response_count})`,
                  },
                  {
                    id: 'risk_factor',
                    label: `${it.filterRiskFactor} (${report.risk_factor_count})`,
                  },
                ] as const
              ).map((pill) => {
                const active = categoryFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    data-testid={`clinvar-filter-${pill.id}`}
                    onClick={() => setCategoryFilter(pill.id)}
                    className="tabular-nums"
                    style={{
                      padding: '5px 10px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: active ? 700 : 600,
                      border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
                      backgroundColor: active ? '#0f172a' : '#ffffff',
                      color: active ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      maxWidth: '100%',
                    }}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                flex: '1 1 220px',
                justifyContent: 'flex-end',
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              <select
                aria-label={it.minStarsLabel}
                data-testid="clinvar-stars-select"
                value={minStars}
                onChange={(e) => setMinStars(Number(e.target.value))}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f172a',
                  maxWidth: '100%',
                }}
              >
                <option value={0}>{it.starsAll}</option>
                <option value={1}>1+ / 4</option>
                <option value={2}>2+ / 4</option>
                <option value={3}>3+ / 4</option>
              </select>

              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  flex: '1 1 170px',
                  minWidth: 0,
                  maxWidth: '100%',
                }}
              >
                <Search
                  size={14}
                  color="#64748b"
                  style={{ position: 'absolute', left: '9px', pointerEvents: 'none' }}
                />
                <input
                  type="search"
                  data-testid="clinvar-report-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={it.searchPlaceholder}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 28px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '12px',
                    color: '#0f172a',
                    minWidth: 0,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Matched Clinical Variant List */}
          {filteredMatches.length === 0 ? (
            <div
              data-testid="clinvar-no-matches"
              style={{
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                fontSize: '13px',
                color: '#64748b',
                textAlign: 'center',
              }}
            >
              {it.noFilteredMatches}
            </div>
          ) : (
            <div
              data-testid="clinvar-match-list"
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              {filteredMatches.map((m) => {
                const badge = getSignificanceBadgeStyle(m.significance_category);
                return (
                  <article
                    key={m.key}
                    data-testid="clinvar-match-card"
                    data-gene={m.gene ?? ''}
                    data-rsid={m.rsid}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '16px',
                              fontWeight: 800,
                              color: '#0f172a',
                            }}
                          >
                            {m.gene || m.chrom}
                          </span>

                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              backgroundColor: badge.bg,
                              color: badge.fg,
                              border: `1px solid ${badge.border}`,
                              wordBreak: 'break-word',
                            }}
                          >
                            {localizeClinicalSignificance(m.clinical_significance, lang)}
                          </span>

                          <span
                            className="tabular-nums"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#475569',
                              fontWeight: 600,
                            }}
                            title={m.review_status}
                          >
                            {renderStars(m.review_stars, it.starsAria(Math.max(0, Math.min(4, m.review_stars))))}
                            <span>({m.review_stars}/4)</span>
                          </span>
                        </div>

                        <div
                          className="tabular-nums"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginTop: '6px',
                            fontSize: '12px',
                            color: '#475569',
                            fontFamily: 'ui-monospace, monospace',
                          }}
                        >
                          <span>{m.rsid}</span>
                          <span>·</span>
                          <span>
                            {m.chrom}:{m.pos.toLocaleString()} ({m.reference}&gt;{m.alternate})
                          </span>
                          {m.hgvs && (
                            <>
                              <span>·</span>
                              <span style={{ wordBreak: 'break-all' }}>{m.hgvs}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Personal Genotype + Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                          maxWidth: '100%',
                        }}
                      >
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'ui-monospace, monospace',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#f8fafc',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                          }}
                        >
                          {it.genotypeLabel}: {m.personal_genotype} ({formatZygosity(m.zygosity)})
                        </span>

                        {m.variation_id && (
                          <a
                            href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${m.variation_id}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#2563eb',
                              fontSize: '11px',
                              fontWeight: 600,
                              textDecoration: 'none',
                              maxWidth: '100%',
                            }}
                          >
                            <span style={{ wordBreak: 'break-word' }}>{it.clinvarLinkLabel}</span>
                            <ExternalLink size={11} style={{ flexShrink: 0 }} />
                          </a>
                        )}

                        <button
                          type="button"
                          data-testid="clinvar-inspect-navigator-btn"
                          onClick={() => onInspectInNavigator(m)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #2563eb',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            maxWidth: '100%',
                          }}
                        >
                          <Compass size={12} style={{ flexShrink: 0 }} />
                          <span style={{ wordBreak: 'break-word' }}>{it.openInNavigatorBtn}</span>
                        </button>
                      </div>
                    </div>

                    {/* Conditions & Provenance Row */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid #f1f5f9',
                        fontSize: '12px',
                      }}
                    >
                      {m.conditions.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '6px',
                            minWidth: 0,
                          }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                            {it.conditionsLabel}:
                          </span>
                          {m.conditions.map((cond) => (
                            <span
                              key={cond}
                              style={{
                                fontSize: '11px',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                color: '#0f172a',
                                fontWeight: 600,
                                wordBreak: 'break-word',
                              }}
                            >
                              {cond}
                            </span>
                          ))}
                        </div>
                      )}

                      {m.molecular_consequence && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontWeight: 600,
                          }}
                        >
                          {it.consequenceLabel}: {m.molecular_consequence}
                        </span>
                      )}

                      {m.lifted_from_build && (
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '11px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 600,
                            fontFamily: 'ui-monospace, monospace',
                          }}
                        >
                          {it.liftedBadge(
                            m.lifted_from_build,
                            `${m.chrom}:${m.personal_pos.toLocaleString()}`
                          )}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
};
