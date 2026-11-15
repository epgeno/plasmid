import { EN_TRANSLATIONS } from './locales/en.js'
import { ES_TRANSLATIONS } from './locales/es.js'
import { FR_TRANSLATIONS } from './locales/fr.js'
import { DE_TRANSLATIONS } from './locales/de.js'
import { PT_TRANSLATIONS } from './locales/pt.js'
import { KO_TRANSLATIONS, JA_TRANSLATIONS, ZH_TRANSLATIONS } from './locales/ko_ja_zh.js'
import type {
  ClinicalSignificanceTranslations,
  LandingTranslations,
  LanguageOption,
  NavigatorAuditTranslations,
  NavigatorTranslations,
  SupportedLanguage,
  Translations,
  TranslationSchema,
  VaultErrorTranslations,
  WorkspaceTranslations,
} from './locales/types.js'

export type {
  ClinicalSignificanceTranslations,
  LandingTranslations,
  LanguageOption,
  NavigatorAuditTranslations,
  NavigatorTranslations,
  SupportedLanguage,
  Translations,
  TranslationSchema,
  VaultErrorTranslations,
  WorkspaceTranslations,
}

export const LANGUAGE_STORAGE_KEY = 'plasmid_ui_lang'

export const SUPPORTED_LANGUAGES: ReadonlyArray<LanguageOption> = [
  { code: 'en', label: 'English (EN)', nativeName: 'English' },
  { code: 'es', label: 'Español (ES)', nativeName: 'Español' },
  { code: 'fr', label: 'Français (FR)', nativeName: 'Français' },
  { code: 'de', label: 'Deutsch (DE)', nativeName: 'Deutsch' },
  { code: 'pt', label: 'Português (PT)', nativeName: 'Português' },
  { code: 'ko', label: '한국어 (KO)', nativeName: '한국어' },
  { code: 'ja', label: '日本語 (JA)', nativeName: '日本語' },
  { code: 'zh', label: '中文 (ZH)', nativeName: '中文' },
]

const SUPPORTED_LANGUAGE_SET = new Set<SupportedLanguage>([
  'en',
  'es',
  'fr',
  'de',
  'pt',
  'ko',
  'ja',
  'zh',
])

export const TRANSLATIONS: Record<SupportedLanguage, Translations> = {
  en: EN_TRANSLATIONS,
  es: ES_TRANSLATIONS,
  fr: FR_TRANSLATIONS,
  de: DE_TRANSLATIONS,
  pt: PT_TRANSLATIONS,
  ko: KO_TRANSLATIONS,
  ja: JA_TRANSLATIONS,
  zh: ZH_TRANSLATIONS,
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGE_SET.has(value as SupportedLanguage)
}

export function normalizeBrowserLanguage(
  rawTag: string | null | undefined
): SupportedLanguage {
  if (!rawTag || typeof rawTag !== 'string') {
    return 'en'
  }
  const primary = rawTag.trim().toLowerCase().split(/[-_]/)[0]
  if (isSupportedLanguage(primary)) {
    return primary
  }
  return 'en'
}

export interface DetectLanguageOptions {
  storage?: Pick<Storage, 'getItem'> | null
  navigatorLanguage?: string | null
  navigatorLanguages?: readonly string[] | null
}

export function detectInitialLanguage(
  options?: DetectLanguageOptions
): SupportedLanguage {
  const storage =
    options && 'storage' in options
      ? options.storage
      : typeof window !== 'undefined'
        ? (() => {
            try {
              return window.localStorage
            } catch {
              return null
            }
          })()
        : null

  if (storage) {
    try {
      const saved = storage.getItem(LANGUAGE_STORAGE_KEY)
      if (saved) {
        const cleaned = saved.trim().toLowerCase()
        if (isSupportedLanguage(cleaned)) {
          return cleaned
        }
      }
    } catch {
      // Ignore storage access errors in strict privacy contexts
    }
  }

  const navLang =
    options && 'navigatorLanguage' in options
      ? options.navigatorLanguage
      : typeof navigator !== 'undefined'
        ? navigator.language
        : null

  if (navLang && navLang.trim().length > 0) {
    return normalizeBrowserLanguage(navLang)
  }

  const navLangs =
    options && 'navigatorLanguages' in options
      ? options.navigatorLanguages
      : typeof navigator !== 'undefined'
        ? navigator.languages
        : null

  if (navLangs && navLangs.length > 0) {
    return normalizeBrowserLanguage(navLangs[0])
  }

  return 'en'
}

export function persistLanguageChoice(
  lang: SupportedLanguage,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? (() => {
            try {
              return window.localStorage
            } catch {
              return null
            }
          })()
        : null

  if (!targetStorage) return
  try {
    targetStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch {
    // Ignore quota or sandboxed storage errors
  }
}

export function syncDocumentLanguage(lang: SupportedLanguage): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  const t = TRANSLATIONS[lang]
  document.title = `${t.header.title} — ${t.header.subtitle}`
}

function mapSingleClinicalSigToken(
  token: string,
  sig: ClinicalSignificanceTranslations
): string | null {
  switch (token) {
    case 'pathogenic':
      return sig.pathogenic
    case 'likely_pathogenic':
      return sig.likelyPathogenic
    case 'oncogenic':
      return sig.oncogenic
    case 'likely_oncogenic':
      return sig.likelyOncogenic
    case 'drug_response':
      return sig.drugResponse
    case 'risk_factor':
      return sig.riskFactor
    case 'benign':
      return sig.benign
    case 'likely_benign':
      return sig.likelyBenign
    case 'uncertain_significance':
      return sig.uncertainSignificance
    case 'conflicting_classifications_of_pathogenicity':
    case 'conflicting_interpretations_of_pathogenicity':
    case 'conflicting_classifications_of_oncogenicity':
      return sig.conflicting
    case 'affects':
      return sig.affects
    case 'protective':
      return sig.protective
    case 'association':
      return sig.association
    case 'not_provided':
      return sig.notProvided
    default:
      return null
  }
}

export function localizeClinicalSignificance(
  rawSig: string | null | undefined,
  lang: SupportedLanguage
): string {
  if (!rawSig) return ''
  const sig = TRANSLATIONS[lang].clinicalSig
  const normalized = rawSig.trim().toLowerCase().replace(/\s+/g, '_')

  if (
    normalized === 'pathogenic/likely_pathogenic' ||
    normalized === 'pathogenic,_likely_pathogenic'
  ) {
    return sig.pathogenicLikelyPathogenic
  }
  if (
    normalized === 'benign/likely_benign' ||
    normalized === 'benign,_likely_benign'
  ) {
    return sig.benignLikelyBenign
  }

  const exactSingle = mapSingleClinicalSigToken(normalized, sig)
  if (exactSingle) {
    return exactSingle
  }

  const rawTokens = normalized
    .split(/[|/]+|,_|,/)
    .map((t) => t.replace(/^_+|_+$/g, ''))
    .filter(Boolean)

  const informative = rawTokens.filter((t) => t !== 'other' && t !== 'not_provided')
  const effectiveTokens = informative.length > 0 ? informative : rawTokens

  const hasBothPathogenic =
    effectiveTokens.includes('pathogenic') &&
    effectiveTokens.includes('likely_pathogenic')
  const hasBothBenign =
    effectiveTokens.includes('benign') && effectiveTokens.includes('likely_benign')

  const mapped: string[] = []
  let emittedPathPair = false
  let emittedBenignPair = false

  for (const tok of effectiveTokens) {
    if (hasBothPathogenic && (tok === 'pathogenic' || tok === 'likely_pathogenic')) {
      if (!emittedPathPair) {
        mapped.push(sig.pathogenicLikelyPathogenic)
        emittedPathPair = true
      }
      continue
    }
    if (hasBothBenign && (tok === 'benign' || tok === 'likely_benign')) {
      if (!emittedBenignPair) {
        mapped.push(sig.benignLikelyBenign)
        emittedBenignPair = true
      }
      continue
    }
    if (tok === 'other' && informative.length === 0) {
      mapped.push(sig.notProvided)
      continue
    }
    const label = mapSingleClinicalSigToken(tok, sig)
    if (label) {
      mapped.push(label)
    }
  }

  const deduped = Array.from(new Set(mapped))
  if (deduped.length > 0) {
    return deduped.join(' · ')
  }

  return rawSig.replace(/_/g, ' ')
}

export function formatVaultErrorMessage(raw: string, lang: SupportedLanguage): string {
  const cleaned = raw
    .replace(/^Local \.plasmid parse error:\s*/i, '')
    .replace(/^VCF dataset parse error:\s*/i, '')
    .replace(/^VCF parsing error:\s*/i, '')
    .replace(/^Serialization error:\s*/i, '')
    .trim()

  if (lang === 'en') {
    return cleaned
  }

  const errDict = TRANSLATIONS[lang].vault.errors

  const extMatch = /^Unsupported file extension for "([^"]+)"/i.exec(cleaned)
  if (extMatch) {
    return errDict.unsupportedExt(extMatch[1])
  }

  if (
    /Selected genomic file is empty|buffer is empty|Decompressed \.vcf\.gz stream is empty|only null bytes/i.test(
      cleaned
    )
  ) {
    return errDict.emptyFile
  }

  if (/Invalid \.vcf\.gz stream/i.test(cleaned)) {
    return errDict.invalidGzip
  }

  if (/Invalid UTF-8/i.test(cleaned)) {
    return errDict.invalidUtf8
  }

  if (/Merkle root integrity check failed/i.test(cleaned)) {
    return errDict.merkleFailed
  }

  if (/shorter than 128-byte \.plasmid header|magic|Invalid \.plasmid/i.test(cleaned)) {
    return errDict.invalidPlasmidHeader
  }

  if (
    /Input contains no valid VCF header or variant records|Expected at least 8 tab-delimited columns|No valid variant records found|Invalid coordinate/i.test(
      cleaned
    )
  ) {
    return errDict.noValidVcfRecords
  }

  return errDict.unrecognizedFormat
}

export function localizeRangeLabel(label: string, lang: SupportedLanguage): string {
  const audit = TRANSLATIONS[lang].navigator.audit
  switch (label) {
    case 'Header 128B':
      return audit.rangeHeader128B
    case 'Root Directory':
      return audit.rangeRootDir
    case 'Flat Directory':
      return audit.rangeFlatDir
    case 'Container Metadata':
      return audit.rangeContainerMeta
    case 'Vault VCF':
      return audit.rangeVaultVcf
    case 'Vault .plasmid':
      return audit.rangeVaultPlasmid
    default: {
      const leafMatch = /^Leaf Dir \((.+)\)$/.exec(label)
      if (leafMatch) {
        return audit.rangeLeafDir(leafMatch[1])
      }
      const chunkMatch = /^Chunks? #(.+)$/.exec(label)
      if (chunkMatch) {
        return audit.rangeChunks(chunkMatch[1])
      }
      return label
    }
  }
}

export function localizeAuditTypeBadge(
  type: 'opfs' | 'network' | 'worker',
  lang: SupportedLanguage
): string {
  if (type === 'opfs') return 'OPFS'
  const audit = TRANSLATIONS[lang].navigator.audit
  return type === 'network' ? audit.badgeNetwork : audit.badgeWorker
}

export function localizeAuditMessage(message: string, lang: SupportedLanguage): string {
  if (lang === 'en') return message
  const audit = TRANSLATIONS[lang].navigator.audit

  let m = /^Found (.+) in OPFS\. Engaged offline Airgap slicing\.$/.exec(message)
  if (m) return audit.foundInOpfs(m[1])

  m = /^Downloading (.+) into browser OPFS sandbox\.\.\.$/.exec(message)
  if (m) return audit.downloadingToOpfs(m[1])

  m = /^(.+) cached in OPFS\. Zero-network Airgap slicing engaged\.$/.exec(message)
  if (m) return audit.cachedInOpfs(m[1])

  m = /^HTTP 206 \[(.+)\] (.+) \((.+) B\)$/.exec(message)
  if (m) return `HTTP 206 [${localizeRangeLabel(m[1], lang)}] ${m[2]} (${m[3]} B)`

  m = /^HTTP 200 \[(.+)\] sliced (.+) \((.+) B of (.+) B\)$/.exec(message)
  if (m) {
    return `HTTP 200 [${localizeRangeLabel(m[1], lang)}] ${m[2]} (${m[3]} B / ${m[4]} B)`
  }

  m = /^OPFS \[(.+)\] (.+) \((.+) B\)$/.exec(message)
  if (m) return `OPFS [${localizeRangeLabel(m[1], lang)}] ${m[2]} (${m[3]} B)`

  m =
    /^WASM parsed \.plasmid v(\d+) \((.+), (2-stage hierarchical|flat) index, (\d+) chunks, root=(.+)\)$/.exec(
      message
    )
  if (m) {
    const idxKind =
      m[3] === '2-stage hierarchical' ? audit.indexHierarchical : audit.indexFlat
    return audit.parsedPlasmidHeader(m[1], m[2], idxKind, m[4], m[5])
  }

  m = /^Chunk cache hit for #(.+) \(0 network bytes\)$/.exec(message)
  if (m) return audit.chunkCacheHit(m[1])

  m =
    /^WASM decoded (\d+) variant\(s\), (\d+) note\(s\), SHA-256 verified (\d+) chunk\(s\)$/.exec(
      message
    )
  if (m) return audit.decodedSlice(m[1], m[2], m[3])

  m = /^Jumped to indexed locus (.+) on (.+)$/.exec(message)
  if (m) return audit.jumpedToLocus(m[1], m[2])

  m = /^Leaf directory queried: no overlapping blocks in (.+)$/.exec(message)
  if (m) return audit.leafNoOverlap(m[1])

  m = /^Root directory miss on (.+) \(0 leaf\/chunk bytes needed\)$/.exec(message)
  if (m) return audit.rootDirMiss(m[1])

  m = /^WASM Liftover translated (.+) \((.+)\) -> (.+) \((.+)\)$/.exec(message)
  if (m) return audit.liftoverTranslated(m[1], m[2], m[3], m[4])

  m = /^WASM Liftover \((.+) -> (.+)\): (.+) -> (.+)$/.exec(message)
  if (m) return audit.liftoverWindow(m[1], m[2], m[3], m[4])

  m = /^Liftover unmapped for (.+) \((.+)\): (.+)$/.exec(message)
  if (m) return audit.liftoverUnmapped(m[1], m[2])

  m = /^Switched assembly to (.+) \((.+) unmapped: (.+)\)$/.exec(message)
  if (m) return audit.switchedAssemblyUnmapped(m[1], m[2])

  m = /^Slice error: (.+)$/.exec(message)
  if (m) return audit.sliceError(m[1])

  m = /^OPFS cache error: (.+)$/.exec(message)
  if (m) return audit.opfsCacheError(m[1])

  m = /^WASM assembly geometry error: (.+)$/.exec(message)
  if (m) return audit.geometryError(m[1])

  m =
    /^WASM parsed local VCF \((.+), (\d+) variants across (\d+) chromosomes, sha256=(.+)\)$/.exec(
      message
    )
  if (m) return audit.parsedLocalVcf(m[1], m[2], m[3], m[4])

  m = /^Vault VCF coordinate index miss on (.+) \(0 network bytes\)$/.exec(message)
  if (m) return audit.vaultIndexMiss(m[1])

  m = /^OPFS Vault sliced (\d+) variant\(s\) on (.+) \(0 network bytes\)$/.exec(message)
  if (m) return audit.vaultSliced(m[1], m[2])

  return message
}
