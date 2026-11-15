import React, { useMemo } from 'react';
import {
  Activity,
  ArrowUpRight,
  Database,
  ShieldCheck,
  Stethoscope,
  Upload,
} from 'lucide-react';
import { SupportedLanguage, TRANSLATIONS } from '../i18n';
import type { ContainerSession } from '../services/plasmidContainerClient';
import type {
  CatalogVariantItem,
  ClinVarIntersectionReport,
  DataSourceMode,
} from '../types/plasmid';

export interface ClinicalSummaryBentoProps {
  lang: SupportedLanguage;
  sourceMode: DataSourceMode;
  session: ContainerSession | null;
  catalogItems: CatalogVariantItem[];
  savingsPct: string | null;
  intersectionReport: ClinVarIntersectionReport | null;
  intersectionLoading: boolean;
  onOpenIntersectionTab: () => void;
  onTriggerUpload: () => void;
}

interface RingSegment {
  key: string;
  value: number;
  color: string;
}

function formatCompactRingValue(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 10_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return n.toLocaleString();
}

export const ClinicalSummaryBento: React.FC<ClinicalSummaryBentoProps> = ({
  lang,
  sourceMode,
  session,
  catalogItems,
  savingsPct,
  intersectionReport,
  intersectionLoading,
  onOpenIntersectionTab,
  onTriggerUpload,
}) => {
  const t = TRANSLATIONS[lang];
  const wt = t.workspace;
  const isVault = sourceMode === 'vault';

  const sampledPharmacoCount = useMemo(() => {
    let count = 0;
    for (const item of catalogItems) {
      const sig = (item.variant.clinvar || '').toLowerCase();
      if (sig.includes('drug_response') || sig.includes('risk_factor')) {
        count += 1;
      }
    }
    return count;
  }, [catalogItems]);

  const metrics = useMemo(() => {
    if (isVault) {
      const totalPersonal =
        intersectionReport?.total_personal_variants ?? session?.pyramid.total_variants ?? 0;
      const matched = intersectionReport?.matched_count ?? 0;
      const pathogenic =
        (intersectionReport?.pathogenic_count ?? 0) +
        (intersectionReport?.likely_pathogenic_count ?? 0);
      const pharmaco =
        (intersectionReport?.drug_response_count ?? 0) +
        (intersectionReport?.risk_factor_count ?? 0);
      const otherMatched = Math.max(0, matched - pathogenic - pharmaco);
      const remaining = Math.max(0, totalPersonal - pathogenic - pharmaco - otherMatched);

      const segments: RingSegment[] = [
        { key: 'pathogenic', value: pathogenic, color: '#be123c' },
        { key: 'pharmaco', value: pharmaco, color: '#2563eb' },
        { key: 'other', value: otherMatched, color: '#0d9488' },
        { key: 'remaining', value: remaining, color: '#e2e8f0' },
      ];

      return {
        ringCenterNumber: intersectionLoading ? '…' : formatCompactRingValue(matched),
        ringCenterSub: wt.bentoRingMatched,
        totalDenominator: Math.max(1, totalPersonal),
        segments,
        row1Label: wt.bentoRowTotalPersonal,
        row1Value: totalPersonal.toLocaleString(),
        row2Label: wt.bentoRowClinvarMatch,
        row2Value: intersectionLoading ? '…' : matched.toLocaleString(),
        pathogenicCount: pathogenic,
        pharmacoCount: pharmaco,
        buildValue:
          intersectionReport?.personal_build || session?.header.reference_build || 'GRCh38',
        egressSub: intersectionReport
          ? `${intersectionReport.elapsedMs} ms · ${intersectionReport.clinvarChunksAccessed.length} ch`
          : 'OPFS Air-Gap',
      };
    }

    const totalIndexed = session?.pyramid.total_variants ?? 0;
    const totalPathogenic = session?.pyramid.total_pathogenic ?? 0;
    const nonPathogenic = Math.max(0, totalIndexed - totalPathogenic);

    const segments: RingSegment[] = [
      { key: 'pathogenic', value: totalPathogenic, color: '#be123c' },
      { key: 'indexed', value: nonPathogenic, color: '#2563eb' },
    ];

    return {
      ringCenterNumber: session ? formatCompactRingValue(totalIndexed) : '…',
      ringCenterSub: wt.bentoRingIndexed,
      totalDenominator: Math.max(1, totalIndexed),
      segments,
      row1Label: wt.bentoRowTotalIndexed,
      row1Value: session ? totalIndexed.toLocaleString() : '—',
      row2Label: wt.bentoRowPackGeometry,
      row2Value: session
        ? `${(session.totalFileSize / 1024).toFixed(0)} KB · ${session.header.total_chunks}`
        : '—',
      pathogenicCount: totalPathogenic,
      pharmacoCount: sampledPharmacoCount,
      buildValue: session?.header.reference_build || 'GRCh38',
      egressSub: 'Local WASM',
    };
  }, [
    isVault,
    intersectionReport,
    intersectionLoading,
    session,
    sampledPharmacoCount,
    wt,
  ]);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  const renderedArcs = useMemo(() => {
    let offset = 0;
    const total = metrics.totalDenominator;
    return metrics.segments
      .filter((seg) => seg.value > 0)
      .map((seg) => {
        const len = (seg.value / total) * circumference;
        const arc = {
          key: seg.key,
          color: seg.color,
          dashArray: `${len} ${circumference}`,
          dashOffset: -offset,
        };
        offset += len;
        return arc;
      });
  }, [metrics.segments, metrics.totalDenominator, circumference]);

  return (
    <section
      data-testid="clinical-summary-bento"
      className="plasmid-bento-card"
      aria-label={isVault ? wt.bentoTitleVault : wt.bentoTitlePublic}
    >
      {/* Compact Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.01em',
              wordBreak: 'break-word',
            }}
          >
            {isVault ? wt.bentoTitleVault : wt.bentoTitlePublic}
          </span>
          <span
            className="tabular-nums"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '9999px',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              whiteSpace: 'nowrap',
            }}
          >
            <ShieldCheck size={12} style={{ flexShrink: 0 }} />
            <span>{wt.zeroEgressShort}</span>
          </span>
        </div>

        {isVault ? (
          <button
            type="button"
            onClick={onOpenIntersectionTab}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#0f172a',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              maxWidth: '100%',
            }}
          >
            <span style={{ wordBreak: 'break-word' }}>{t.vault.openReportBtn}</span>
            <ArrowUpRight size={12} color="#2563eb" style={{ flexShrink: 0 }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onTriggerUpload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#0f172a',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              maxWidth: '100%',
            }}
          >
            <Upload size={12} color="#2563eb" style={{ flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word' }}>{t.vault.selectFileBtn}</span>
          </button>
        )}
      </div>

      {/* Main Bento Grid: Left = SVG Donut + Icon-Label-Value Rows, Right = Plausible Tabular KPIs */}
      <div className="plasmid-bento-layout">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            minWidth: 0,
          }}
        >
          {/* Mathematical SVG Donut Ring Gauge */}
          <div
            style={{
              position: 'relative',
              width: '84px',
              height: '84px',
              flexShrink: 0,
            }}
          >
            <svg
              width="84"
              height="84"
              viewBox="0 0 84 84"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="42"
                cy="42"
                r={radius}
                stroke="#f1f5f9"
                strokeWidth="8"
                fill="none"
              />
              <g transform="rotate(-90 42 42)">
                {renderedArcs.map((arc) => (
                  <circle
                    key={arc.key}
                    cx="42"
                    cy="42"
                    r={radius}
                    stroke={arc.color}
                    strokeWidth="8"
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
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                className="tabular-nums"
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}
              >
                {metrics.ringCenterNumber}
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: '#64748b',
                  marginTop: '2px',
                  maxWidth: '58px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {metrics.ringCenterSub}
              </span>
            </div>
          </div>

          {/* Function-style Icon-Label-Value Rows */}
          <div
            style={{
              flex: 1,
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
                paddingBottom: '5px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#334155',
                  minWidth: 0,
                }}
              >
                <Database size={13} color="#64748b" style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: 1.25, wordBreak: 'break-word' }}>
                  {metrics.row1Label}
                </span>
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                }}
              >
                {metrics.row1Value}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '5px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#334155',
                  minWidth: 0,
                }}
              >
                <Stethoscope size={13} color="#2563eb" style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: 1.25, wordBreak: 'break-word' }}>
                  {metrics.row2Label}
                </span>
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                }}
              >
                {metrics.row2Value}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#334155',
                  minWidth: 0,
                }}
              >
                <Activity size={13} color="#be123c" style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: 1.25, wordBreak: 'break-word' }}>
                  {wt.bentoRowActionable}
                </span>
              </span>
              <span
                className="tabular-nums"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#fff1f2',
                    color: '#be123c',
                    border: '1px solid #fecdd3',
                  }}
                >
                  {metrics.pathogenicCount.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  {metrics.pharmacoCount.toLocaleString()}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Plausible-style Compact Tabular KPI Grid */}
        <div className="plasmid-kpi-grid">
        <div
          style={{
            padding: '7px 8px',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#64748b',
              display: 'block',
              lineHeight: 1.25,
              wordBreak: 'break-word',
            }}
          >
            {wt.bentoKpiBuild}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#0f172a',
              display: 'block',
              marginTop: '2px',
            }}
          >
            {metrics.buildValue}
          </span>
        </div>

        <div
          style={{
            padding: '7px 8px',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#64748b',
              display: 'block',
              lineHeight: 1.25,
              wordBreak: 'break-word',
            }}
          >
            {wt.bentoKpiPathogenic}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#be123c',
              display: 'block',
              marginTop: '2px',
            }}
          >
            {metrics.pathogenicCount.toLocaleString()}
          </span>
        </div>

        <div
          style={{
            padding: '7px 8px',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#64748b',
              display: 'block',
              lineHeight: 1.25,
              wordBreak: 'break-word',
            }}
          >
            {isVault ? wt.bentoKpiPharmaco : wt.bentoKpiSavings}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#0f172a',
              display: 'block',
              marginTop: '2px',
            }}
          >
            {isVault
              ? metrics.pharmacoCount.toLocaleString()
              : savingsPct !== null
                ? `${savingsPct}%`
                : '—'}
          </span>
        </div>

        <div
          style={{
            padding: '7px 8px',
            borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#166534',
              display: 'block',
              lineHeight: 1.25,
              wordBreak: 'break-word',
            }}
          >
            {wt.bentoKpiEgress}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#15803d',
              display: 'block',
              marginTop: '2px',
            }}
          >
            0 B
          </span>
        </div>
        </div>
      </div>
    </section>
  );
};
