export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ko' | 'ja' | 'zh'

export interface LanguageOption {
  code: SupportedLanguage
  label: string
  nativeName: string
}

export interface NavigatorAuditTranslations {
  badgeNetwork: string
  badgeWorker: string
  rangeHeader128B: string
  rangeRootDir: string
  rangeFlatDir: string
  rangeContainerMeta: string
  rangeVaultVcf: string
  rangeVaultPlasmid: string
  rangeLeafDir: (leaf: string) => string
  rangeChunks: (chunks: string) => string
  foundInOpfs: (file: string) => string
  downloadingToOpfs: (url: string) => string
  cachedInOpfs: (file: string) => string
  parsedPlasmidHeader: (
    ver: string,
    build: string,
    idxKind: string,
    chunks: string,
    root: string
  ) => string
  indexHierarchical: string
  indexFlat: string
  chunkCacheHit: (chunks: string) => string
  decodedSlice: (variants: string, notes: string, chunks: string) => string
  jumpedToLocus: (locus: string, chrom: string) => string
  leafNoOverlap: (interval: string) => string
  rootDirMiss: (interval: string) => string
  liftoverTranslated: (
    srcCoord: string,
    srcAsm: string,
    dstCoord: string,
    dstAsm: string
  ) => string
  liftoverWindow: (srcAsm: string, dstAsm: string, srcWin: string, dstWin: string) => string
  liftoverUnmapped: (coord: string, asm: string) => string
  switchedAssemblyUnmapped: (asm: string, coord: string) => string
  sliceError: (err: string) => string
  opfsCacheError: (err: string) => string
  geometryError: (err: string) => string
  parsedLocalVcf: (build: string, variants: string, chroms: string, sha: string) => string
  vaultIndexMiss: (interval: string) => string
  vaultSliced: (count: string, chrom: string) => string
}

export interface NavigatorTranslations {
  title: string
  subtitle: string
  level3Badge: string
  level2Badge: string
  airgapActive: string
  vaultAirgapLocked: string
  edgeStreaming: string
  cacheToOpfs: string
  cachingPrefix: string
  opfsCacheFailedPrefix: string
  errorPrefix: string
  retryBtn: string
  indexedLociLabel: string
  readingDirectory: string
  noLeavesLoaded: string
  karyotypeTitle: string
  loadingPyramid: string
  pyramidSummary: (total: number, pathogenic: number) => string
  densityBarSuffix: string
  windowLabel: string
  viewportTitle: string
  slicingLoading: string
  noChunksNeeded: string
  fastaJumpBtn: string
  panLeft: string
  panRight: string
  zoomIn: string
  zoomOut: string
  trackBlocksTitle: (count: number) => string
  trackBlocksShort: (count: number) => string
  noBlocksOverlap: string
  trackVariantsTitle: (count: number) => string
  trackVariantsShort: (count: number) => string
  unmappedLiftoverMsg: string
  noVariantsMsg: string
  unannotatedGene: string
  displayedAssembly: string
  containerLabel: string
  vcfInfoCard: string
  noInfoTags: string
  chunkTransferCard: string
  chunksLabel: string
  sliceSizeLabel: string
  chunkShaCard: string
  noChunkDigest: string
  errorInspectorMsg: string
  emptyInspectorMsg: (
    chrom: string,
    start: string,
    end: string,
    asm: string,
    fastaLen?: number
  ) => string
  auditLogTitle: string
  latestEvents: (count: number) => string
  audit: NavigatorAuditTranslations
}

export interface WorkspaceTranslations {
  languageSelectAria: string
  navSectionLabel: string
  collapseRail: string
  expandRail: string
  globalSearchPlaceholder: string
  searchClearAria: string
  searchJumpCoord: (coord: string) => string
  searchNoResults: string
  searchSectionPersonal: string
  searchSectionCatalog: string
  mobileVaultExpand: string
  mobileVaultCollapse: string
  zeroEgressShort: string
  bentoTitleVault: string
  bentoTitlePublic: string
  bentoRingMatched: string
  bentoRingIndexed: string
  bentoRowTotalPersonal: string
  bentoRowTotalIndexed: string
  bentoRowClinvarMatch: string
  bentoRowPackGeometry: string
  bentoRowActionable: string
  bentoKpiBuild: string
  bentoKpiPathogenic: string
  bentoKpiPharmaco: string
  bentoKpiSavings: string
  bentoKpiEgress: string
  contextActiveVariant: string
  securityCardTitle: string
  securityRfcAirgap: string
  securityRfcPublic: string
}

export interface ClinicalSignificanceTranslations {
  pathogenic: string
  likelyPathogenic: string
  pathogenicLikelyPathogenic: string
  oncogenic: string
  likelyOncogenic: string
  drugResponse: string
  riskFactor: string
  benign: string
  likelyBenign: string
  benignLikelyBenign: string
  uncertainSignificance: string
  conflicting: string
  affects: string
  protective: string
  association: string
  notProvided: string
}

export interface VaultErrorTranslations {
  unsupportedExt: (name: string) => string
  emptyFile: string
  invalidGzip: string
  invalidUtf8: string
  merkleFailed: string
  invalidPlasmidHeader: string
  noValidVcfRecords: string
  unrecognizedFormat: string
}

export interface Translations {
  workspace: WorkspaceTranslations
  clinicalSig: ClinicalSignificanceTranslations
  disclaimer: {
    bannerTitle: string
    bannerDesc: string
    badgeLocal: string
  }
  header: {
    title: string
    subtitle: string
    tabs: {
      navigator: string
      intersection: string
      viewer: string
      liftover: string
      wiki: string
      network: string
      sources: string
    }
  }
  locus: {
    activeLocus: string
    activeVaultLocus: string
    targetBuildPrefix: string
    loadingCatalog: string
    catalogEmpty: string
  }
  vault: {
    title: string
    badgeZeroNetwork: string
    desc: string
    dropzonePrompt: string
    dropzoneActive: string
    selectFileBtn: string
    importingStatus: string
    sourceLabel: string
    publicDemoSource: string
    vaultFileBadge: string
    deleteVaultBtn: string
    deleteVaultAria: (name: string) => string
    quotaLabel: (used: string) => string
    uploadErrorPrefix: string
    dismissBtn: string
    intersectRunning: string
    intersectReadyBanner: (matched: number, scanned: number) => string
    openReportBtn: string
    errors: VaultErrorTranslations
  }
  intersection: {
    title: string
    subtitle: string
    emptyTitle: string
    emptyDesc: string
    uploadCtaBtn: string
    runningStatus: string
    privacyProofBadge: string
    cardMatchedTitle: string
    cardMatchedSub: (carriers: number, total: number) => string
    cardPathogenicTitle: string
    cardPathogenicSub: (pathogenic: number, likely: number) => string
    cardPharmacoTitle: string
    cardPharmacoSub: (drug: number, risk: number) => string
    cardSlicingTitle: string
    cardSlicingSub: (chunks: number, kbFetched: string, kbTotal: string) => string
    liftedNotice: (count: number, fromBuild: string, toBuild: string) => string
    searchPlaceholder: string
    filterAll: string
    filterPathogenic: string
    filterLikelyPathogenic: string
    filterDrugResponse: string
    filterRiskFactor: string
    minStarsLabel: string
    starsAll: string
    starsAria: (stars: number) => string
    noFilteredMatches: string
    genotypeLabel: string
    zygosityHet: string
    zygosityHomAlt: string
    zygosityHemi: string
    zygosityObserved: string
    conditionsLabel: string
    consequenceLabel: string
    liftedBadge: (fromBuild: string, origPos: string) => string
    openInNavigatorBtn: string
    clinvarLinkLabel: string
  }
  navigator: NavigatorTranslations
  stream: {
    title: string
    desc: string
    savingsPrefix: string
    payloadBadge: (bytes: number) => string
    dataRange: string
    indexOffset: string
    dataBlocks: string
    license: string
    unspecifiedLicense: string
    integrityTitle: string
    headerRootPrefix: string
    computedRootPrefix: string
    verified: string
    failed: string
    pending: string
    verifyBtn: string
    verifyingBtn: string
    chunkDigestsTitle: string
    chunkPrefix: string
  }
  liftover: {
    title: string
    desc: string
    testToggle: string
    verifiedTitle: string
    verifiedDesc: string
    warningTitle: string
    warningDesc: string
    sourceBuild: string
    liftedGrch38Build: string
    allelesPrefix: string
    unmappedLabel: string
    unmappedNoticeTitle: string
    unmappedNoticeDesc: string
    delta: string
    targetBuild: string
    sourceGrch37Build: string
    deltaNote: string
    blockedLabel: string
    blockedNote: string
  }
  wiki: {
    reference: string
    clinicalSignificance: string
    vcfInfoTitle: string
    annotationsTitle: string
    noAnnotationBundled: string
    acmgCriteria: string
    citationsTitle: string
    citationsNote: string
  }
  swarm: {
    title: string
    desc: string
    liveConsoleTitle: string
    liveConsoleDesc: string
    publicOnlyBadge: string
    roomLabel: string
    roomPlaceholder: string
    localPeerLabel: string
    statusOffline: string
    statusJoining: string
    statusSeeding: (chunks: number) => string
    statusLeeching: string
    joinSeederBtn: string
    joinLeecherBtn: string
    leaveRoomBtn: string
    kpiPeersLabel: string
    kpiPeersSub: (connected: number, banned: number) => string
    kpiRttLabel: string
    kpiRttSub: string
    kpiBytesLabel: string
    kpiBytesSub: (rx: string, tx: string) => string
    kpiVerifyLabel: string
    kpiVerifySub: (verified: number, rejected: number, fallback: number) => string
    actionsTitle: string
    batchSelectLabel: string
    kAnonBadge: string
    requestBatchBtn: (c1: number, c2: number) => string
    requestingBtn: string
    byzantineDemoBtn: string
    singleChunkProbeBtn: string
    seederByzantineToggle: string
    seederReadyNote: (chunks: number) => string
    connectSeederHint: string
    lastTransferP2p: (chunks: string, bytes: string, ms: number) => string
    lastTransferFallback: (bannedPeer: string, range: string, bytes: string) => string
    peersSectionTitle: (count: number) => string
    peersEmpty: string
    peerRoleSeeder: string
    peerRoleLeecher: string
    peerStatusConnecting: string
    peerStatusConnected: string
    peerStatusDisconnected: string
    peerStatusBanned: string
    peerRttCol: string
    peerTransferCol: string
    peerVerifyCol: string
    auditSectionTitle: string
    auditEmpty: string
    containerPackTitle: string
    directoryArchTitle: string
    hierarchicalDesc: (leaves: number) => string
    flatDesc: string
    generatorBuildTitle: string
    privacyTitle: string
    privacyDesc: string
    privacyBadge: string
    privacyStatusTitle: string
    privacyStatusDesc: string
    integrityTitle: string
    integrityDesc: string
    airgapBadge: string
  }
  governance: {
    title: string
    desc: string
    tier1Title: string
    tier1Status: string
    tier1Desc: string
    tier2Title: string
    tier2Status: string
    tier2Desc: string
    tier3Title: string
    tier3Status: string
    tier3Desc: string
    tier4Title: string
    tier4Status: string
    tier4Desc: string
    attributionsTitle: string
    gnomadAttr: string
    cpicAttr: string
    statementTitle: string
    statementDesc: string
  }
}

export type TranslationSchema = Translations
