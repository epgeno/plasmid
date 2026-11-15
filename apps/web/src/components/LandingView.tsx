import React, { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Compass,
  Cpu,
  Database,
  FileCheck2,
  Globe,
  HardDrive,
  Lock,
  ShieldCheck,
  Stethoscope,
  Upload,
} from 'lucide-react'
import {
  formatVaultErrorMessage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  TRANSLATIONS,
} from '../i18n'
import type { ContainerSession } from '../services/plasmidContainerClient'
import type { VaultFileEntry } from '../services/opfs'

export interface LandingViewProps {
  lang: SupportedLanguage
  onChangeLanguage: (lang: string) => void
  publicSession: ContainerSession | null
  publicSessionError: string | null
  onRetryPublicSession: () => void
  vaultFiles: VaultFileEntry[]
  activeVaultFilename: string | null
  vaultImporting: boolean
  navigationBusy: boolean
  vaultError: string | null
  onDismissVaultError: () => void
  onTriggerFileSelect: () => void
  onDropVaultFile: (file: File) => void
  onExplorePublicDemo: () => void
  onOpenWorkspace: () => void
  onOpenVaultReport: () => void
  onResetHome: () => void
}

export const LandingView: React.FC<LandingViewProps> = ({
  lang,
  onChangeLanguage,
  publicSession,
  publicSessionError,
  onRetryPublicSession,
  vaultFiles,
  activeVaultFilename,
  vaultImporting,
  navigationBusy,
  vaultError,
  onDismissVaultError,
  onTriggerFileSelect,
  onDropVaultFile,
  onExplorePublicDemo,
  onOpenWorkspace,
  onOpenVaultReport,
  onResetHome,
}) => {
  const [isDragging, setIsDragging] = useState(false)

  const t = TRANSLATIONS[lang]
  const lt = t.landing
  const wt = t.workspace
  const isBusy = vaultImporting || navigationBusy

  const clinvarVariantCount = publicSession?.pyramid.total_variants ?? null
  const clinvarPathogenicCount = publicSession?.pyramid.total_pathogenic ?? null
  const clinvarBuild = publicSession?.header.reference_build ?? 'GRCh38'
  const clinvarChunks = publicSession?.header.total_chunks ?? null
  const fallbackTelemetryText = publicSessionError ? '—' : lt.livePackLoadingValue
  const formattedVariantCount =
    clinvarVariantCount !== null ? clinvarVariantCount.toLocaleString(lang) : null
  const formattedPathogenicCount =
    clinvarPathogenicCount !== null ? clinvarPathogenicCount.toLocaleString(lang) : null

  const activeSavedVaultEntry =
    (activeVaultFilename
      ? vaultFiles.find((f) => f.opfsPath === activeVaultFilename)
      : null) ?? vaultFiles[0] ?? null

  return (
    <div className="plasmid-landing-shell" data-testid="landing-view">
      {/* ===================================================================
          1. EDITORIAL STICKY TOP HEADER
         =================================================================== */}
      <header className="plasmid-landing-header">
        <div className="plasmid-landing-header-inner">
          <button
            type="button"
            data-testid="landing-brand-home"
            aria-label={lt.brandHomeAria}
            onClick={onResetHome}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              background: 'transparent',
              border: 'none',
              padding: '2px 0',
              cursor: 'pointer',
              textAlign: 'left',
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Cpu size={17} color="#ffffff" />
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  color: '#0f172a',
                }}
              >
                {t.header.title}
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  borderRadius: '9999px',
                  fontWeight: 700,
                }}
              >
                v0.1.0
              </span>
            </span>
          </button>

          <div className="plasmid-landing-header-actions">
            {/* 8-Language Selector */}
            <div
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <Globe
                size={14}
                color="#475569"
                style={{
                  position: 'absolute',
                  left: '10px',
                  pointerEvents: 'none',
                  flexShrink: 0,
                }}
              />
              <select
                data-testid="language-select"
                aria-label={wt.languageSelectAria}
                title={wt.languageSelectAria}
                value={lang}
                onChange={(e) => onChangeLanguage(e.target.value)}
                style={{
                  width: '100%',
                  minWidth: 0,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  padding: '8px 28px 8px 30px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {SUPPORTED_LANGUAGES.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                color="#64748b"
                style={{
                  position: 'absolute',
                  right: '9px',
                  pointerEvents: 'none',
                  flexShrink: 0,
                }}
              />
            </div>

            {/* Direct Workspace Shortcut Button */}
            <button
              type="button"
              data-testid="landing-open-workspace-btn"
              disabled={isBusy}
              onClick={onOpenWorkspace}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 13px',
                fontSize: '12px',
                fontWeight: 700,
                lineHeight: 1.25,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                cursor: isBusy ? 'wait' : 'pointer',
                opacity: isBusy ? 0.65 : 1,
                minWidth: 0,
              }}
            >
              <span style={{ wordBreak: 'break-word' }}>{lt.openWorkspaceBtn}</span>
              <ArrowRight size={14} color="#2563eb" style={{ flexShrink: 0 }} />
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================
          2. EDITORIAL HERO + 1-CLICK 23andMe / VCF ONBOARDING
         =================================================================== */}
      <main className="plasmid-landing-main">
        <section style={{ marginBottom: '28px' }}>
          <div style={{ maxWidth: '820px', marginBottom: '24px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 11px',
                borderRadius: '9999px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: '12px',
                fontWeight: 700,
                marginBottom: '14px',
                maxWidth: '100%',
                wordBreak: 'break-word',
              }}
            >
              <ShieldCheck size={14} style={{ flexShrink: 0 }} />
              <span>{lt.eyebrowBadge}</span>
            </span>

            <h1
              className="cjk-keep"
              style={{
                fontSize: 'clamp(25px, 3.6vw, 40px)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.16,
                color: '#0f172a',
                margin: '0 0 12px 0',
              }}
            >
              {lt.heroTitle}
            </h1>

            <p
              className="cjk-keep"
              style={{
                fontSize: 'clamp(14px, 1.4vw, 16px)',
                lineHeight: 1.6,
                color: '#475569',
                margin: 0,
                maxWidth: '720px',
              }}
            >
              {lt.heroSubtitle}
            </p>
          </div>

          <div className="plasmid-landing-hero-grid">
            {/* LEFT HERO CARD: Primary OPFS Onboarding Dropzone + Dual CTAs */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    <HardDrive size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                    <span>{lt.uploadCardTitle}</span>
                  </span>
                  <span
                    className="tabular-nums"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Lock size={11} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>{t.vault.vaultFileBadge}</span>
                  </span>
                </div>

                {/* Drag & Drop Onboarding Surface */}
                <div
                  data-testid="landing-dropzone"
                  onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(true)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setIsDragging(false)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file && !isBusy) {
                      onDropVaultFile(file)
                    }
                  }}
                  onClick={() => {
                    if (!isBusy) {
                      onTriggerFileSelect()
                    }
                  }}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: isDragging ? '2px dashed #2563eb' : '1.5px dashed #cbd5e1',
                    backgroundColor: isDragging ? '#eff6ff' : '#f8fafc',
                    cursor: vaultImporting ? 'wait' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Upload size={17} color="#2563eb" />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        className="cjk-keep"
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          fontWeight: 600,
                          lineHeight: 1.48,
                          color: '#1e293b',
                          wordBreak: 'break-word',
                        }}
                      >
                        {vaultImporting
                          ? lt.uploadCardImporting
                          : isDragging
                            ? lt.uploadCardActive
                            : lt.uploadCardHint}
                      </p>
                    </div>
                  </div>

                  {/* Supported Formats Strip */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        marginRight: '2px',
                      }}
                    >
                      {lt.supportedFormatsLabel}:
                    </span>
                    {(
                      [
                        lt.format23andMe,
                        lt.formatAncestry,
                        lt.formatVcf,
                        lt.formatAutoLiftover,
                      ] as const
                    ).map((badge) => (
                      <span
                        key={badge}
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          wordBreak: 'break-word',
                        }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Error Alert if Invalid File Selected on Landing */}
                {vaultError && (
                  <div
                    role="alert"
                    data-testid="vault-error-banner"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '8px',
                      color: '#be123c',
                      fontSize: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        minWidth: 0,
                        flex: '1 1 200px',
                      }}
                    >
                      <AlertTriangle
                        size={15}
                        color="#be123c"
                        style={{ flexShrink: 0, marginTop: '1px' }}
                      />
                      <span style={{ wordBreak: 'break-word' }}>
                        <strong>{t.vault.uploadErrorPrefix}</strong>{' '}
                        {formatVaultErrorMessage(vaultError, lang)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onDismissVaultError}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #fecdd3',
                        backgroundColor: '#ffffff',
                        color: '#be123c',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t.vault.dismissBtn}
                    </button>
                  </div>
                )}

                {/* Quick Resume Banner if a Personal Vault File Already Exists in OPFS */}
                {activeSavedVaultEntry && (
                  <div
                    data-testid="landing-existing-vault-banner"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      fontSize: '12px',
                      color: '#14532d',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        minWidth: 0,
                        wordBreak: 'break-word',
                      }}
                    >
                      <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                      <span>{lt.activeVaultBanner(activeSavedVaultEntry.name)}</span>
                    </span>
                    <button
                      type="button"
                      data-testid="landing-resume-vault-btn"
                      disabled={isBusy}
                      onClick={onOpenVaultReport}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #166534',
                        backgroundColor: '#166534',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: isBusy ? 'wait' : 'pointer',
                        opacity: isBusy ? 0.65 : 1,
                      }}
                    >
                      {lt.resumeVaultReportBtn}
                    </button>
                  </div>
                )}
              </div>

              {/* Dual Hero CTA Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                <button
                  type="button"
                  data-testid="landing-upload-cta"
                  disabled={isBusy}
                  onClick={onTriggerFileSelect}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '13px 16px',
                    borderRadius: '10px',
                    border: '1px solid #0f172a',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    lineHeight: 1.3,
                    cursor: isBusy ? 'wait' : 'pointer',
                    opacity: isBusy ? 0.7 : 1,
                    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12)',
                    minWidth: 0,
                  }}
                >
                  <Upload size={16} style={{ flexShrink: 0 }} />
                  <span style={{ wordBreak: 'break-word' }}>{lt.uploadCtaBtn}</span>
                </button>

                <button
                  type="button"
                  data-testid="landing-explore-demo-btn"
                  disabled={isBusy}
                  onClick={onExplorePublicDemo}
                  className="tabular-nums"
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px 16px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '13px',
                    fontWeight: 700,
                    lineHeight: 1.3,
                    cursor: isBusy ? 'wait' : 'pointer',
                    opacity: isBusy ? 0.65 : 1,
                    minWidth: 0,
                  }}
                >
                  <Compass size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                  <span style={{ wordBreak: 'break-word' }}>
                    {formattedVariantCount
                      ? lt.exploreDemoBtn(formattedVariantCount)
                      : lt.exploreDemoLoadingBtn}
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT HERO CARD: Live Measured Public ClinVar Pack Telemetry */}
            <aside
              aria-label={lt.livePackCardTitle}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                minWidth: 0,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '14px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    <Database size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                    <span>{lt.livePackCardTitle}</span>
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    {lt.livePackCardBadge}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '10px',
                      paddingBottom: '9px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                      {lt.livePackRowDataset}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0f172a',
                        textAlign: 'right',
                      }}
                    >
                      NCBI ClinVar ({clinvarBuild})
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '10px',
                      paddingBottom: '9px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                      {lt.livePackRowVariants}
                    </span>
                    <span
                      className="tabular-nums"
                      data-testid="landing-live-clinvar-count"
                      style={{
                        fontSize: '15px',
                        fontWeight: 800,
                        color: '#0f172a',
                        textAlign: 'right',
                      }}
                    >
                      {formattedVariantCount ?? fallbackTelemetryText}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '10px',
                      paddingBottom: '9px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                      {lt.livePackRowPathogenic}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        color: '#be123c',
                        textAlign: 'right',
                      }}
                    >
                      {formattedPathogenicCount ?? fallbackTelemetryText}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                      {lt.livePackRowIntegrity}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        textAlign: 'right',
                      }}
                    >
                      {clinvarChunks !== null
                        ? lt.livePackIntegrityValue(clinvarChunks)
                        : fallbackTelemetryText}
                    </span>
                  </div>
                </div>

                {publicSessionError && (
                  <div
                    role="alert"
                    data-testid="landing-public-pack-error"
                    style={{
                      marginTop: '12px',
                      padding: '9px 11px',
                      borderRadius: '8px',
                      backgroundColor: '#fff1f2',
                      border: '1px solid #fecdd3',
                      color: '#be123c',
                      fontSize: '11.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <span style={{ wordBreak: 'break-word', flex: '1 1 160px' }}>
                      <strong>{lt.livePackErrorPrefix}</strong> {publicSessionError}
                    </span>
                    <button
                      type="button"
                      onClick={onRetryPublicSession}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '5px',
                        border: '1px solid #fecdd3',
                        backgroundColor: '#ffffff',
                        color: '#be123c',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {t.navigator.retryBtn}
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#166534',
                  }}
                >
                  <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                  <span>{wt.securityRfcAirgap}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                  }}
                >
                  <Stethoscope size={14} color="#2563eb" style={{ flexShrink: 0 }} />
                  <span>{wt.securityRfcPublic}</span>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* ===================================================================
            3. TRUST & MEASURED METRICS STRIP (0 B / Rust-WASM / Live ClinVar / MIT-Apache)
           =================================================================== */}
        <section
          aria-label={lt.trustSectionAria}
          data-testid="landing-trust-strip"
          className="plasmid-landing-trust-grid"
          style={{ marginBottom: '32px' }}
        >
          <div
            style={{
              padding: '15px 16px',
              borderRadius: '12px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              minWidth: 0,
            }}
          >
            <div
              className="tabular-nums"
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#15803d',
                letterSpacing: '-0.02em',
              }}
            >
              {lt.zeroBytesValue}
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#14532d',
                marginTop: '3px',
                wordBreak: 'break-word',
              }}
            >
              {lt.trustZeroEgressLabel}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#166534',
                marginTop: '2px',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              {lt.trustZeroEgressSub}
            </div>
          </div>

          <div
            style={{
              padding: '15px 16px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Rust / WASM
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                marginTop: '3px',
                wordBreak: 'break-word',
              }}
            >
              {lt.trustLocalWasmLabel}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                marginTop: '2px',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              {lt.trustLocalWasmSub}
            </div>
          </div>

          <div
            style={{
              padding: '15px 16px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              minWidth: 0,
            }}
          >
            <div
              className="tabular-nums"
              data-testid="landing-trust-clinvar-value"
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              {formattedVariantCount ?? fallbackTelemetryText}
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                marginTop: '3px',
                wordBreak: 'break-word',
              }}
            >
              {lt.trustClinvarLabel}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                marginTop: '2px',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              {lt.trustClinvarSub(clinvarBuild)}
            </div>
          </div>

          <div
            style={{
              padding: '15px 16px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              minWidth: 0,
            }}
          >
            <div
              className="tabular-nums"
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              MIT / Apache-2.0
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                marginTop: '3px',
                wordBreak: 'break-word',
              }}
            >
              {lt.trustOpenSourceLabel}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                marginTop: '2px',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              {lt.trustOpenSourceSub}
            </div>
          </div>
        </section>

        {/* ===================================================================
            4. 3-STEP HOW IT WORKS CARDS
           =================================================================== */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ marginBottom: '16px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: '#2563eb',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              {lt.stepsSectionEyebrow}
            </span>
            <h2
              className="cjk-keep"
              style={{
                fontSize: 'clamp(18px, 2.2vw, 22px)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#0f172a',
                margin: 0,
              }}
            >
              {lt.stepsSectionTitle}
            </h2>
          </div>

          <div data-testid="landing-steps-grid" className="plasmid-landing-steps-grid">
            {(
              [
                {
                  num: '01',
                  icon: FileCheck2,
                  title: lt.step1Title,
                  desc: lt.step1Desc,
                },
                {
                  num: '02',
                  icon: Lock,
                  title: lt.step2Title,
                  desc: lt.step2Desc,
                },
                {
                  num: '03',
                  icon: Stethoscope,
                  title: lt.step3Title,
                  desc: lt.step3Desc,
                },
              ] as const
            ).map((step) => {
              const Icon = step.icon
              return (
                <article
                  key={step.num}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} color="#2563eb" />
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        fontFamily: 'ui-monospace, monospace',
                        color: '#64748b',
                      }}
                    >
                      {lt.stepBadge(step.num)}
                    </span>
                  </div>

                  <h3
                    className="cjk-keep"
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#0f172a',
                      lineHeight: 1.35,
                    }}
                  >
                    {step.title}
                  </h3>

                  <p
                    className="cjk-keep"
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: '#475569',
                      lineHeight: 1.58,
                    }}
                  >
                    {step.desc}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        {/* ===================================================================
            5. PRIVACY GUARANTEE & NON-DIAGNOSTIC RESEARCH NOTICE
           =================================================================== */}
        <section
          data-testid="landing-privacy-notice"
          className="plasmid-landing-notice-grid"
          style={{ marginBottom: '28px' }}
        >
          <div
            style={{
              padding: '18px',
              borderRadius: '14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px',
              }}
            >
              <ShieldCheck size={16} color="#16a34a" style={{ flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                {lt.privacyTitle}
              </h3>
            </div>
            <p
              className="cjk-keep"
              style={{
                margin: 0,
                fontSize: '12.5px',
                color: '#475569',
                lineHeight: 1.6,
              }}
            >
              {lt.privacyDesc}
            </p>
          </div>

          <div
            style={{
              padding: '18px',
              borderRadius: '14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px',
              }}
            >
              <Stethoscope size={16} color="#475569" style={{ flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                {lt.nonDiagnosticTitle}
              </h3>
            </div>
            <p
              className="cjk-keep"
              style={{
                margin: 0,
                fontSize: '12.5px',
                color: '#475569',
                lineHeight: 1.6,
              }}
            >
              {lt.nonDiagnosticDesc}
            </p>
          </div>
        </section>

        <footer
          style={{
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <span>© 2026 EntropyParadox Genomics · MIT / Apache-2.0</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/epgeno/plasmid"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#475569', fontWeight: 600 }}
            >
              GitHub
            </a>
            <a
              href="https://plasmid.wiki"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#475569', fontWeight: 600 }}
            >
              plasmid.wiki
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
