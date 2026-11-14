export type SupportedLanguage = 'en' | 'ko' | 'zh' | 'ja'

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
  emptyInspectorMsg: (chrom: string, start: string, end: string, asm: string, fastaLen?: number) => string
  auditLogTitle: string
  latestEvents: (count: number) => string
}

export interface WorkspaceTranslations {
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

export interface TranslationSchema {
  workspace: WorkspaceTranslations
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

export const TRANSLATIONS: Record<SupportedLanguage, TranslationSchema> = {
  ko: {
    workspace: {
      navSectionLabel: '워크스페이스',
      collapseRail: '내비게이션 접기',
      expandRail: '내비게이션 펼치기',
      globalSearchPlaceholder: '유전자, rsID, 좌표 검색',
      searchClearAria: '검색어 지우기',
      searchJumpCoord: (coord) => `좌표 이동: ${coord}`,
      searchNoResults: '일치하는 변이 또는 좌표가 없습니다.',
      searchSectionPersonal: '개인 ClinVar 일치 변이',
      searchSectionCatalog: '디코딩된 컨테이너 변이',
      mobileVaultExpand: '볼트 열기',
      mobileVaultCollapse: '볼트 접기',
      zeroEgressShort: '외부 전송 0 B',
      bentoTitleVault: '개인 유전체 임상 교차 요약',
      bentoTitlePublic: '공공 ClinVar 참조 팩 요약',
      bentoRingMatched: '임상 일치',
      bentoRingIndexed: '색인 변이',
      bentoRowTotalPersonal: '전체 개인 변이',
      bentoRowTotalIndexed: '전체 색인 변이',
      bentoRowClinvarMatch: 'ClinVar 일치',
      bentoRowPackGeometry: 'Zstd 머클 컨테이너',
      bentoRowActionable: '병원성 · 약물반응',
      bentoKpiBuild: '기준 빌드',
      bentoKpiPathogenic: '병원성/유사',
      bentoKpiPharmaco: '약물·위험인자',
      bentoKpiSavings: '구간 절감율',
      bentoKpiEgress: '외부 전송',
      contextActiveVariant: '선택 변이 컨텍스트',
      securityCardTitle: '에어갭 격리 및 거버넌스 상태',
      securityRfcAirgap: 'RFC-0002 OPFS 샌드박스 격리 (0 B 송신)',
      securityRfcPublic: 'RFC-0003 공공 도메인 청크만 조회',
    },
    disclaimer: {
      bannerTitle: '학술 연구 및 교육용 도구 안내',
      bannerDesc: '본 플랫폼은 공공 유전체 학술 데이터 뷰어로, 의료 진단이나 치료 결정 용도로 사용될 수 없습니다.',
      badgeLocal: '공공 표준 데이터 • 브라우저 로컬 WASM 분석',
    },
    header: {
      title: 'Plasmid',
      subtitle: '분산형 유전체 위키 & .plasmid 정밀 구간 스트리밍',
      tabs: {
        navigator: '전장 유전체 네비게이터',
        intersection: '임상 교차 리포트',
        viewer: '데이터 뷰어',
        liftover: '좌표 변환 및 검증',
        wiki: '임상 기록 & 주석',
        network: '패널 번들링 & 무결성',
        sources: '데이터 출처 및 보안',
      },
    },
    locus: {
      activeLocus: '.plasmid 컨테이너 내 디코딩된 변이',
      activeVaultLocus: '로컬 OPFS 에어갭 볼트 내 디코딩된 개인 변이',
      targetBuildPrefix: '기준 유전체',
      loadingCatalog: '유전체 데이터 및 인덱스를 WASM으로 디코딩하는 중…',
      catalogEmpty: '로드된 데이터셋에 디코딩 가능한 변이가 없습니다.',
    },
    vault: {
      title: '개인 유전체 로컬 OPFS 에어갭 볼트',
      badgeZeroNetwork: '네트워크 전송 0 B • 브라우저 내부 격리',
      desc: '로컬 .vcf, .vcf.gz, 23andMe .txt, .plasmid 파일을 브라우저 전용 격리 저장소(OPFS)에 보관하고 외부 개인정보 전송 0바이트로 공공 ClinVar Zstd 팩과 로컬 WASM 교차 매칭합니다.',
      dropzonePrompt: '여기에 개인 .vcf / .vcf.gz / .txt / .plasmid 파일을 드래그하거나 클릭하여 선택',
      dropzoneActive: '파일을 놓아 브라우저 OPFS 에어갭 볼트에 격리 저장',
      selectFileBtn: '로컬 파일 불러오기',
      importingStatus: 'OPFS 격리 저장 및 WASM 파싱 중…',
      sourceLabel: '활성 데이터 소스',
      publicDemoSource: '공공 ClinVar Zstd 팩 (demo.plasmid)',
      vaultFileBadge: 'OPFS 볼트',
      deleteVaultBtn: '삭제',
      deleteVaultAria: (name) => `OPFS 볼트에서 ${name} 삭제`,
      quotaLabel: (used) => `OPFS 사용량: ${used}`,
      uploadErrorPrefix: '로컬 볼트 파일 오류:',
      dismissBtn: '닫기',
      intersectRunning: '로컬 WASM에서 공공 ClinVar Zstd 청크와 개인 변이를 교차 매칭하는 중…',
      intersectReadyBanner: (matched, scanned) =>
        `ClinVar 교차 매칭 완료: 임상 변이 ${matched}건 일치 (스캔된 ClinVar 레코드 ${scanned.toLocaleString()}건 • 개인 데이터 전송 0 B)`,
      openReportBtn: '임상 교차 리포트 열기',
    },
    intersection: {
      title: '개인 DNA ↔ 공공 ClinVar Zstd 교차 매칭 리포트',
      subtitle: '개인 유전체는 OPFS 샌드박스 내부에 100% 격리(외부 전송 0 B)한 채, 일치 염색체의 공공 ClinVar 16KB Zstd 머클 청크만 HTTP 206 슬라이싱해 로컬 WASM에서 교차 분석합니다.',
      emptyTitle: '업로드된 개인 유전체 파일이 없습니다',
      emptyDesc: '상단 OPFS 에어갭 볼트에 개인 .vcf, .vcf.gz 또는 23andMe .txt 파일을 불러오면 외부 서버로 단 1바이트도 전송하지 않고 로컬 WASM에서 병원성·약물반응 변이를 즉시 교차 매칭합니다.',
      uploadCtaBtn: '개인 .vcf / .vcf.gz / .txt 불러오기',
      runningStatus: 'HTTP 206 ClinVar Zstd 청크 슬라이싱 및 로컬 WASM 대립유전자 교차 매칭 중…',
      privacyProofBadge: '개인 데이터 외부 전송 0 B 검증됨',
      cardMatchedTitle: '일치 임상 변이',
      cardMatchedSub: (carriers, total) => `보인 대립유전자 ${carriers}건 / 입력 ${total}건`,
      cardPathogenicTitle: '병원성 / 유사병원성',
      cardPathogenicSub: (p, lp) => `병원성·종양성 ${p}건 • 유사병원성 ${lp}건`,
      cardPharmacoTitle: '약물반응 & 위험인자',
      cardPharmacoSub: (drug, risk) => `약물유전체 ${drug}건 • 위험인자 ${risk}건`,
      cardSlicingTitle: 'ClinVar HTTP 206 슬라이싱',
      cardSlicingSub: (chunks, kbFetched, kbTotal) => `${chunks}개 Zstd 청크 (${kbFetched} / ${kbTotal} KB)`,
      liftedNotice: (count, fromB, toB) =>
        `입력 변이 ${count}건의 ${fromB} 좌표를 내장 UCSC 체인을 통해 ${toB} 좌표계로 자동 변환 후 대립유전자 일치 여부를 검증했습니다.`,
      searchPlaceholder: '유전자 · rsID · 질환 검색',
      filterAll: '전체',
      filterPathogenic: '병원성/종양성',
      filterLikelyPathogenic: '유사병원성',
      filterDrugResponse: '약물반응',
      filterRiskFactor: '위험인자',
      minStarsLabel: '근거 등급',
      starsAll: '전체 별점',
      noFilteredMatches: '선택한 필터 또는 검색어와 일치하는 임상 변이가 없습니다.',
      genotypeLabel: '개인 유전형',
      zygosityHet: '이형접합 (Het)',
      zygosityHomAlt: '변이 동형접합 (Hom-Alt)',
      zygosityHemi: '반접합 (Hemi)',
      zygosityObserved: '변이 검출',
      conditionsLabel: '연관 임상 표현형 (ClinVar CLNDN)',
      consequenceLabel: '분자적 결과',
      liftedBadge: (fromB, origPos) => `${fromB} ${origPos}에서 자동 변환됨`,
      openInNavigatorBtn: '네비게이터에서 위치 보기',
      clinvarLinkLabel: 'ClinVar 원문',
    },
    navigator: {
      title: '다중 스케일 전장 유전체 네비게이터',
      subtitle: '128B 바이너리 헤더 + 2단계 계층형 리프 슬라이싱 및 Rust/WASM SHA-256 실시간 디코딩',
      level3Badge: '레벨 3 (염기/변이 상세)',
      level2Badge: '레벨 2 (밀도 히스토그램)',
      airgapActive: 'OPFS 에어갭 격리 활성',
      vaultAirgapLocked: '개인 볼트 에어갭 격리 (통신 0건)',
      edgeStreaming: '엣지 구간 스트리밍',
      cacheToOpfs: 'OPFS 로컬 저장',
      cachingPrefix: '저장 중',
      errorPrefix: '컨테이너 구간 조회 실패:',
      retryBtn: '재시도',
      indexedLociLabel: '.plasmid 색인 구간:',
      readingDirectory: '컨테이너 디렉터리를 읽는 중…',
      noLeavesLoaded: '색인된 변이 리프가 없습니다',
      karyotypeTitle: '레벨 0: 전장 유전체 피라미드 핵형 개요',
      loadingPyramid: '피라미드 메타데이터 로드 중…',
      pyramidSummary: (total, pathogenic) => `색인 변이 ${total}건 (병원성 ${pathogenic}건)`,
      densityBarSuffix: '1Mb 피라미드 밀도 & 동원체 지도',
      windowLabel: '조회 구간',
      viewportTitle: '고해상도 .plasmid 슬라이스 뷰포트',
      slicingLoading: 'WASM 슬라이싱 및 디코딩 중…',
      noChunksNeeded: '필요 청크 0개',
      fastaJumpBtn: '1–200 bp (참조서열)',
      panLeft: '좌측 이동',
      panRight: '우측 이동',
      zoomIn: '확대 (2배)',
      zoomOut: '축소 (0.5배)',
      trackBlocksTitle: (c) => `컨테이너 색인 블록 & 참조 서열 (일치 ${c}개)`,
      trackBlocksShort: (c) => `색인 블록 & 서열 (${c}개)`,
      noBlocksOverlap: '이 좌표 구간과 겹치는 .plasmid 데이터 블록이 없습니다.',
      trackVariantsTitle: (c) => `WASM 디코딩 변이 레코드 (구간 내 ${c}건)`,
      trackVariantsShort: (c) => `디코딩 변이 (${c}건)`,
      unmappedLiftoverMsg: '보정 체인 범위 밖 구간입니다 — 기준 유전체를 전환하거나 색인 위치로 이동하세요.',
      noVariantsMsg: '이 유전체 구간에 관측된 변이가 없습니다.',
      unannotatedGene: '미지정 유전자',
      displayedAssembly: '표시 기준 유전체',
      containerLabel: '컨테이너 원본',
      vcfInfoCard: '디코딩된 VCF INFO 속성',
      noInfoTags: 'INFO 태그 없음',
      chunkTransferCard: '청크 슬라이싱 및 전송량',
      chunksLabel: '청크 번호',
      sliceSizeLabel: '전송 크기',
      chunkShaCard: 'WASM 청크 SHA-256 해시',
      noChunkDigest: '청크 해시 없음',
      errorInspectorMsg: '컨테이너 구간 응답이 복구될 때까지 변이를 표시할 수 없습니다.',
      emptyInspectorMsg: (chrom, start, end, asm, fastaLen) =>
        `${chrom}:${start}-${end} (${asm}) 구간에 디코딩된 VCF 변이가 없습니다.${fastaLen ? ` (참조 FASTA 서열 ${fastaLen} bp 디코딩 완료)` : ''}`,
      auditLogTitle: '.plasmid 구간 스트리밍 & WASM 감사 로그',
      latestEvents: (c) => `최근 ${c}건`,
    },
    stream: {
      title: '.plasmid HTTP 206 정밀 구간 스트리밍',
      desc: '128B 바이너리 헤더와 2단계 리프 디렉터리 색인을 조회하여, 대상 좌표의 16KB 머클 청크만 정밀 수신·디코딩합니다.',
      savingsPrefix: '단일 청크 전송 절감율',
      payloadBadge: (b) => `16 KB 머클 청크 내 유효 페이로드 ${b} B`,
      dataRange: '실제 전송 범위 (HTTP Range)',
      indexOffset: '리프 인덱스 위치 (Leaf Pointer)',
      dataBlocks: '수신 머클 청크 (16KB Leaves)',
      license: '컨테이너 메타데이터 라이선스',
      unspecifiedLicense: '미지정',
      integrityTitle: 'SHA-256 BEP 52 머클 루트 무결성 검증 (WASM)',
      headerRootPrefix: '헤더 루트',
      computedRootPrefix: '계산된 루트',
      verified: 'WASM SHA-256 머클 트리 전체 청크 검증 통과',
      failed: '머클 해시 불일치 감지 (변조 또는 손상됨)',
      pending: '전체 페이로드 머클 트리 검증 대기 중',
      verifyBtn: 'WASM 머클 무결성 검증 실행',
      verifyingBtn: 'WASM 해시 연산 중...',
      chunkDigestsTitle: '청크별 SHA-256 리프 해시 검증 내역',
      chunkPrefix: '청크',
    },
    liftover: {
      title: '유전체 버전 변환 (WASM Liftover) 및 염기 지문 검증',
      desc: 'Rust/WASM 엔진으로 GRCh37(hg19) ↔ GRCh38(hg38) 좌표를 실시간 변환하고 염기 서열 정합성을 검증합니다.',
      testToggle: '+1 bp 좌표 오차 주입 시 차단 검증',
      verifiedTitle: 'WASM 염기 지문 및 좌표 정합성 검증 통과',
      verifiedDesc: '참조 서열 염기 지문 및 유전체 앵커 체인 매핑과 일치합니다.',
      warningTitle: 'WASM 좌표 드리프트 불일치 차단',
      warningDesc: '요청된 염기 서열과 참조 유전체 위치가 일치하지 않아 변환이 거부되었습니다.',
      sourceBuild: '변환된 GRCh37 (hg19) 좌표',
      liftedGrch38Build: '변환된 GRCh38 (hg38) 좌표',
      allelesPrefix: '대립유전자',
      unmappedLabel: '매핑 범위 밖',
      unmappedNoticeTitle: '염기 지문 검증 통과 • 보정 체인 범위 밖 좌표',
      unmappedNoticeDesc: '단일 염기 참조 지문은 일치하나, 해당 좌표는 현재 내장된 임상 앵커 Liftover 체인 구간 밖에 위치합니다.',
      delta: '실측 좌표 이동량',
      targetBuild: '원본 GRCh38 (hg38) 좌표',
      sourceGrch37Build: '원본 GRCh37 (hg19) 좌표',
      deltaNote: 'WASM 엔진 실시간 변환 결과',
      blockedLabel: '변환 차단됨 (불일치)',
      blockedNote: '참조 서열 불일치로 변환 중단됨',
    },
    wiki: {
      reference: '참조 식별자 (dbSNP)',
      clinicalSignificance: '임상적 유의성',
      vcfInfoTitle: '.plasmid 디코딩 VCF 레코드 속성',
      annotationsTitle: '컨테이너 내 번들링된 주석 블록',
      noAnnotationBundled: '현재 로드된 .plasmid 컨테이너에는 이 좌표에 대한 별도 마크다운 주석 블록이 포함되어 있지 않으며, 실디코딩된 VCF 레코드 속성만 표시됩니다.',
      acmgCriteria: 'ACMG/AMP 분류 기준',
      citationsTitle: '근거 학술 문헌 (PubMed 원문 링크)',
      citationsNote: '주석 블록 내 추출된 공식 PMID 식별자',
    },
    swarm: {
      title: 'WebRTC P2P 머클 스웜 & 프라이버시 무결성',
      desc: '실제 RTCPeerConnection + RTCDataChannel로 공공 .plasmid 16KB 머클 청크를 피어 간 교환하고, 변조 청크 수신 시 자동 차단 및 HTTP 206 Origin 폴백을 수행합니다.',
      liveConsoleTitle: '실시간 WebRTC DataChannel 스웜 콘솔',
      liveConsoleDesc: '동일한 스웜 룸 ID로 두 개 이상의 브라우저 탭/기기가 참여하면 /api/swarm/signal 시그널링을 거쳐 직접 P2P 연결됩니다.',
      publicOnlyBadge: '공공 ClinVar 팩 전용 • 개인 볼트 0 B 격리',
      roomLabel: '스웜 룸 ID',
      roomPlaceholder: '예: clinvar-grch38',
      localPeerLabel: '내 피어 ID',
      statusOffline: '오프라인 (미참여)',
      statusJoining: '시그널링 및 검증 중…',
      statusSeeding: (chunks) => `시더 활성 (${chunks}개 16KB 청크 검증됨)`,
      statusLeeching: '리처 활성 (128B 헤더 루트 고정)',
      joinSeederBtn: '시더(Seeder)로 참여',
      joinLeecherBtn: '리처(Leecher)로 참여',
      leaveRoomBtn: '스웜 연결 해제',
      kpiPeersLabel: '연결 피어 / 차단',
      kpiPeersSub: (conn, banned) => `연결 ${conn}명 · 비잔틴 차단 ${banned}명`,
      kpiRttLabel: '실측 WebRTC RTT',
      kpiRttSub: 'RTCDataChannel PING/PONG',
      kpiBytesLabel: 'P2P 전송 바이트',
      kpiBytesSub: (rx, tx) => `수신 ${rx} · 송신 ${tx}`,
      kpiVerifyLabel: '머클 검증 & 폴백',
      kpiVerifySub: (ok, bad, fb) => `통과 ${ok} · 거부 ${bad} · 206폴백 ${fb}`,
      actionsTitle: '16KB 리프 청크 배치 교환 & 비잔틴 방어 실증',
      batchSelectLabel: '요청 청크 배치',
      kAnonBadge: '최소 2청크(32KB) K-익명성 강제',
      requestBatchBtn: (c1, c2) => `16KB 청크 P2P 배치 요청 (#${c1}, #${c2})`,
      requestingBtn: 'RTCDataChannel 전송 중…',
      byzantineDemoBtn: '변조 청크(Byzantine) 주입 → 자동 차단 & Origin 206 폴백 실증',
      singleChunkProbeBtn: '단일 청크 요청 거부 검증 (K-익명성)',
      seederByzantineToggle: '다음 P2P 응답에 변조 바이트 송출 (Byzantine Seeder 테스트 모드)',
      seederReadyNote: (chunks) => `현재 시더 모드입니다. 연결된 리처에게 ${chunks}개의 검증된 16KB 머클 리프 청크와 BEP 52 증명을 전송합니다.`,
      connectSeederHint: '동일 룸에 연결된 시더(Seeder) 피어가 있어야 실시간 P2P 청크 교환 및 비잔틴 차단 실증을 실행할 수 있습니다.',
      lastTransferP2p: (chunks, bytes, ms) => `WebRTC P2P 검증 완료: 청크 [${chunks}] (${bytes}, ${ms} ms) — WASM BEP 52 머클 루트 일치`,
      lastTransferFallback: (peer, range, bytes) => `비잔틴 피어(${peer}) 즉시 차단 완료 → Origin HTTP 206 폴백 복구 [${range}] (${bytes})`,
      peersSectionTitle: (count) => `실시간 스웜 피어 연결 상태 (${count})`,
      peersEmpty: '현재 연결된 원격 피어가 없습니다. 다른 브라우저 탭이나 세션에서 동일 스웜 룸으로 참여하세요.',
      peerRoleSeeder: '시더 (Seeder)',
      peerRoleLeecher: '리처 (Leecher)',
      peerStatusConnecting: '연결 협상 중',
      peerStatusConnected: 'DataChannel 연결됨',
      peerStatusDisconnected: '연결 종료',
      peerStatusBanned: '비잔틴 차단됨 (BANNED)',
      peerRttCol: '실측 RTT',
      peerTransferCol: 'P2P 송수신',
      peerVerifyCol: 'SHA-256 검증',
      auditSectionTitle: '실시간 WebRTC 시그널링 & 머클 검증 로그',
      auditEmpty: '아직 스웜 이벤트가 없습니다. 시더 또는 리처로 룸에 참여하면 실제 협상·검증 기록이 표시됩니다.',
      containerPackTitle: '로드된 .plasmid 컨테이너 사양',
      directoryArchTitle: '디렉터리 색인 구조',
      hierarchicalDesc: (leaves) => `2단계 계층형 리프 (${leaves}개 리프)`,
      flatDesc: '단일 플랫 디렉터리 색인',
      generatorBuildTitle: '생성 도구 및 기준 유전체',
      privacyTitle: '조회 프라이버시 보호 (패널 단위 번들링 원칙)',
      privacyDesc: '단일 변이 단위의 P2P 요청은 트래픽 분석으로 희귀질환 관심사를 노출할 수 있으므로 금지되며, ~50MB 단위의 공공 임상 패널 번들로만 교환하도록 설계되었습니다.',
      privacyBadge: '프라이버시 보호 준수',
      privacyStatusTitle: '개인 유전체 파일 OPFS 에어갭 격리',
      privacyStatusDesc: '사용자 로컬 데이터는 브라우저 OPFS 및 WebAssembly 샌드박스 내부에서만 처리되며 외부 네트워크 바인딩이 존재하지 않습니다.',
      integrityTitle: '수신 청크 암호화 검증',
      integrityDesc: '모든 16KB 리프 블록은 WASM 내에서 SHA-256 해시를 계산하여 컨테이너 헤더의 32바이트 머클 루트와 대조합니다.',
      airgapBadge: 'WASM SHA-256 활성',
    },
    governance: {
      title: '데이터 출처 및 개인정보 보호 체계',
      desc: 'Plasmid는 공공 과학 데이터만을 사용하며, 사용자의 개인 유전체 데이터를 외부로 절대 전송하지 않습니다.',
      tier1Title: '공공 유전체 표준 데이터',
      tier1Status: '완전 공개',
      tier1Desc: '미국 국립생명공학정보센터(NCBI)의 ClinVar, dbSNP, RefSeq 및 공공 참조 유전체 데이터로, 전 세계 연구자에게 자유롭게 공개된 공공 데이터입니다.',
      tier2Title: '인구 집단 통계 및 임상 가이드라인',
      tier2Status: '학술 출처 준수',
      tier2Desc: 'Broad Institute의 gnomAD 대립유전자 빈도 데이터와 Stanford CPIC 가이드라인으로, 표준 학술 라이선스 규정에 따라 공식 출처를 명시합니다.',
      tier3Title: '표준 오픈 식별자 연동 체계',
      tier3Status: '표준 상호참조',
      tier3Desc: '저작권 제한이 있는 상용 데이터베이스 본문은 번들링하지 않으며, 공개 표준 식별자만을 연결합니다.',
      tier4Title: '사용자 개인 유전체 파일 (WGS/VCF)',
      tier4Status: '브라우저 내부 격리',
      tier4Desc: '사용자가 불러오는 개인 유전체 파일은 서버나 네트워크로 절대 전송되지 않습니다. 모든 연산은 브라우저 로컬 환경 내에서만 처리됩니다.',
      attributionsTitle: '공식 학술 데이터 출처 표기',
      gnomadAttr: 'gnomAD: Genome Aggregation Database (Broad Institute of MIT and Harvard)',
      cpicAttr: 'CPIC: Clinical Pharmacogenetics Implementation Consortium (Stanford University)',
      statementTitle: '연구용 라이선스 및 사용 안내',
      statementDesc: 'Plasmid는 오픈소스 학술 연구 도구입니다. 의학적 판단이나 치료 결정이 필요한 경우 전문 의료기관의 유전학 전문의와 상담하시기 바랍니다.',
    },
  },
  en: {
    workspace: {
      navSectionLabel: 'Workspace',
      collapseRail: 'Collapse navigation',
      expandRail: 'Expand navigation',
      globalSearchPlaceholder: 'Search gene, rsID, chr:pos',
      searchClearAria: 'Clear search',
      searchJumpCoord: (coord) => `Jump to ${coord}`,
      searchNoResults: 'No matching variant or coordinate.',
      searchSectionPersonal: 'Personal ClinVar Matches',
      searchSectionCatalog: 'Decoded Container Loci',
      mobileVaultExpand: 'Vault',
      mobileVaultCollapse: 'Hide',
      zeroEgressShort: '0 B Egress',
      bentoTitleVault: 'Personal Clinical Screening Summary',
      bentoTitlePublic: 'Public ClinVar Reference Summary',
      bentoRingMatched: 'Matched',
      bentoRingIndexed: 'Indexed',
      bentoRowTotalPersonal: 'Personal Variants',
      bentoRowTotalIndexed: 'Indexed Variants',
      bentoRowClinvarMatch: 'ClinVar Matches',
      bentoRowPackGeometry: 'Zstd Merkle Pack',
      bentoRowActionable: 'Pathogenic · Pharmaco',
      bentoKpiBuild: 'Ref Build',
      bentoKpiPathogenic: 'Pathogenic',
      bentoKpiPharmaco: 'Drug & Risk',
      bentoKpiSavings: 'Range Saved',
      bentoKpiEgress: 'Data Egress',
      contextActiveVariant: 'Active Variant Context',
      securityCardTitle: 'Air-Gap & Governance Posture',
      securityRfcAirgap: 'RFC-0002 OPFS Sandbox (0 B Outbound)',
      securityRfcPublic: 'RFC-0003 Public Coarse Packs Only',
    },
    disclaimer: {
      bannerTitle: 'Scientific Research & Educational Tool',
      bannerDesc: 'This platform is an open scientific genomic viewer and is not intended for clinical diagnosis or medical treatment decisions.',
      badgeLocal: 'Open Public Data • Local Browser WASM Decoding',
    },
    header: {
      title: 'Plasmid',
      subtitle: 'Decentralized Genomic Wiki & .plasmid Byte-Range Streaming',
      tabs: {
        navigator: 'Genome Navigator',
        intersection: 'ClinVar Match',
        viewer: 'Data Viewer',
        liftover: 'Assembly Liftover',
        wiki: 'Clinical Notes',
        network: 'Container & Privacy',
        sources: 'Data Sources & Privacy',
      },
    },
    locus: {
      activeLocus: 'Decoded Variant from .plasmid Container',
      activeVaultLocus: 'Decoded Variant from Local OPFS Air-Gap Vault',
      targetBuildPrefix: 'Reference Build',
      loadingCatalog: 'Decoding genomic dataset and coordinate index via WASM…',
      catalogEmpty: 'No decodable VCF variants found in the loaded dataset.',
    },
    vault: {
      title: 'Private Genome OPFS Air-Gap Vault',
      badgeZeroNetwork: '0 B Personal Data Sent • Browser Sandbox',
      desc: 'Store local .vcf, .vcf.gz, 23andMe .txt, or .plasmid files inside OPFS and intersect them against the public ClinVar Zstd pack locally in WebAssembly with zero outbound personal bytes.',
      dropzonePrompt: 'Drag & drop a local .vcf / .vcf.gz / .txt / .plasmid file here, or click to browse',
      dropzoneActive: 'Release to store file inside isolated OPFS Air-Gap Vault',
      selectFileBtn: 'Import Local File',
      importingStatus: 'Saving to OPFS & parsing via WASM…',
      sourceLabel: 'Active Data Source',
      publicDemoSource: 'Public ClinVar Zstd Pack (demo.plasmid)',
      vaultFileBadge: 'OPFS Vault',
      deleteVaultBtn: 'Delete',
      deleteVaultAria: (name) => `Delete ${name} from OPFS Vault`,
      quotaLabel: (used) => `OPFS Used: ${used}`,
      uploadErrorPrefix: 'Local Vault File Error:',
      dismissBtn: 'Dismiss',
      intersectRunning: 'Intersecting local OPFS variants with public ClinVar Zstd chunks in WASM…',
      intersectReadyBanner: (matched, scanned) =>
        `ClinVar Intersection Ready: ${matched} clinical match(es) across ${scanned.toLocaleString()} ClinVar records (0 B personal data sent)`,
      openReportBtn: 'Open ClinVar Report',
    },
    intersection: {
      title: 'Personal DNA ↔ Public ClinVar Zstd Intersection Report',
      subtitle: 'Your personal variants never leave OPFS (0 B outbound). Only coarse 16KB Zstd Merkle chunks from the public ClinVar .plasmid pack are HTTP 206 range-sliced and intersected locally in Rust/WASM.',
      emptyTitle: 'No Personal Genome Loaded in OPFS Vault',
      emptyDesc: 'Import a personal .vcf, .vcf.gz, or 23andMe .txt file into the OPFS Air-Gap Vault above to screen against NCBI ClinVar entirely inside local WebAssembly.',
      uploadCtaBtn: 'Import Personal .vcf / .vcf.gz / .txt',
      runningStatus: 'Slicing public ClinVar Zstd chunks via HTTP 206 & matching alleles in WASM…',
      privacyProofBadge: '0 B Outbound Personal Data Verified',
      cardMatchedTitle: 'Matched Clinical Loci',
      cardMatchedSub: (carriers, total) => `${carriers} carrier call(s) of ${total} uploaded`,
      cardPathogenicTitle: 'Pathogenic / Likely Path.',
      cardPathogenicSub: (p, lp) => `${p} pathogenic/oncogenic • ${lp} likely pathogenic`,
      cardPharmacoTitle: 'Drug Response & Risk',
      cardPharmacoSub: (drug, risk) => `${drug} pharmacogenomic • ${risk} risk factor`,
      cardSlicingTitle: 'ClinVar HTTP 206 Slicing',
      cardSlicingSub: (chunks, kbFetched, kbTotal) => `${chunks} Zstd chunk(s) (${kbFetched} / ${kbTotal} KB)`,
      liftedNotice: (count, fromB, toB) =>
        `Automatically lifted ${count} personal variant(s) from ${fromB} to ${toB} via the embedded UCSC syntenic chain prior to allele matching.`,
      searchPlaceholder: 'Filter gene, rsID, trait',
      filterAll: 'All',
      filterPathogenic: 'Pathogenic/Oncogenic',
      filterLikelyPathogenic: 'Likely Pathogenic',
      filterDrugResponse: 'Drug Response',
      filterRiskFactor: 'Risk Factor',
      minStarsLabel: 'Evidence Tier',
      starsAll: 'All Stars',
      noFilteredMatches: 'No matched clinical variants fit the current search or filter criteria.',
      genotypeLabel: 'Genotype',
      zygosityHet: 'Heterozygous',
      zygosityHomAlt: 'Homozygous Alt',
      zygosityHemi: 'Hemizygous',
      zygosityObserved: 'Observed',
      conditionsLabel: 'Associated Conditions (ClinVar CLNDN)',
      consequenceLabel: 'Consequence',
      liftedBadge: (fromB, origPos) => `Lifted from ${fromB} ${origPos}`,
      openInNavigatorBtn: 'Inspect in Navigator',
      clinvarLinkLabel: 'NCBI ClinVar',
    },
    navigator: {
      title: 'Multi-scale Whole-Genome Navigator',
      subtitle: '128B header + 2-stage hierarchical leaf slicing with Rust/WASM decoding & SHA-256 verification.',
      level3Badge: 'Level 3 (Base/Variant)',
      level2Badge: 'Level 2 (Density)',
      airgapActive: 'OPFS Airgap Active',
      vaultAirgapLocked: 'Private Vault Air-Gap (0 Network)',
      edgeStreaming: 'Edge Range Streaming',
      cacheToOpfs: 'Cache to OPFS',
      cachingPrefix: 'Caching',
      errorPrefix: 'Container Range Slice Failed:',
      retryBtn: 'Retry',
      indexedLociLabel: 'Indexed Loci in .plasmid:',
      readingDirectory: 'Reading container directory…',
      noLeavesLoaded: 'No indexed variant leaves loaded',
      karyotypeTitle: 'Level 0: .plasmid Pyramid Karyotype Overview',
      loadingPyramid: 'Loading pyramid metadata…',
      pyramidSummary: (total, pathogenic) => `${total} indexed variant(s), ${pathogenic} pathogenic`,
      densityBarSuffix: '1Mb Pyramid Density & Centromere Map',
      windowLabel: 'Window',
      viewportTitle: 'High-Resolution .plasmid Slice Viewport',
      slicingLoading: 'Slicing & decoding via WASM…',
      noChunksNeeded: '0 chunks needed',
      fastaJumpBtn: '1–200 bp (FASTA)',
      panLeft: 'Pan Left',
      panRight: 'Pan Right',
      zoomIn: 'Zoom In (2x)',
      zoomOut: 'Zoom Out (0.5x)',
      trackBlocksTitle: (c) => `CONTAINER INDEXED BLOCKS & FASTA (${c} matched in slice)`,
      trackBlocksShort: (c) => `INDEXED BLOCKS & FASTA (${c})`,
      noBlocksOverlap: 'No .plasmid data blocks overlap this coordinate interval.',
      trackVariantsTitle: (c) => `WASM DECODED VARIANTS (${c} decoded in window)`,
      trackVariantsShort: (c) => `DECODED VARIANTS (${c})`,
      unmappedLiftoverMsg: 'Window outside curated Liftover chain — switch assembly or jump to an indexed locus.',
      noVariantsMsg: 'No variants observed in this genomic window.',
      unannotatedGene: 'Unannotated Gene',
      displayedAssembly: 'Displayed Assembly',
      containerLabel: 'Container',
      vcfInfoCard: 'Decoded VCF INFO Attributes',
      noInfoTags: 'No INFO tags',
      chunkTransferCard: 'Chunk Slicing & Byte Transfer',
      chunksLabel: 'Chunks',
      sliceSizeLabel: 'Slice Size',
      chunkShaCard: 'WASM Chunk SHA-256 Digest',
      noChunkDigest: 'No chunk digest',
      errorInspectorMsg: 'Unable to inspect variants until container range access succeeds.',
      emptyInspectorMsg: (chrom, start, end, asm, fastaLen) =>
        `No decoded VCF variants in ${chrom}:${start}-${end} (${asm}).${fastaLen ? ` Decoded ${fastaLen} bp ReferenceFasta sequence.` : ''}`,
      auditLogTitle: '.plasmid Range Streaming & WASM Audit Log',
      latestEvents: (c) => `Latest ${c} events`,
    },
    stream: {
      title: '.plasmid HTTP 206 Precision Byte-Range Slicing',
      desc: 'Queries the 128B binary header and 2-stage leaf directory index to fetch and decode only the exact 16KB Merkle chunk overlapping the target coordinate.',
      savingsPrefix: 'Single-Query Bandwidth Saved',
      payloadBadge: (b) => `Payload ${b} B inside 16 KB BEP 52 chunk`,
      dataRange: 'Exact HTTP Byte Range',
      indexOffset: 'Leaf Directory Pointer',
      dataBlocks: 'Accessed 16KB Merkle Chunks',
      license: 'Container Metadata License',
      unspecifiedLicense: 'Unspecified',
      integrityTitle: 'SHA-256 BEP 52 Merkle Root Verification (WASM)',
      headerRootPrefix: 'Header Root',
      computedRootPrefix: 'Computed Root',
      verified: 'Verified all container chunks against header Merkle root in WASM',
      failed: 'Merkle root mismatch detected (corrupted or tampered payload)',
      pending: 'Full payload Merkle tree verification ready to run',
      verifyBtn: 'Verify Merkle Root in WASM',
      verifyingBtn: 'Computing SHA-256 Tree...',
      chunkDigestsTitle: 'Per-Chunk SHA-256 Leaf Digests',
      chunkPrefix: 'Chunk',
    },
    liftover: {
      title: 'WASM Genome Assembly Liftover & CoordinateGuard',
      desc: 'Translates coordinates between GRCh37 (hg19) and GRCh38 (hg38) in WebAssembly and validates single-nucleotide reference fingerprints.',
      testToggle: 'Inject +1 bp offset to test WASM CoordinateGuard rejection',
      verifiedTitle: 'WASM CoordinateGuard Verification Passed',
      verifiedDesc: 'Reference allele matches target assembly sequence fingerprint and anchor interval.',
      warningTitle: 'WASM CoordinateGuard Blocked Drift Mismatch',
      warningDesc: 'Reference sequence mismatch detected by plasmid-core WASM; coordinate conversion halted.',
      sourceBuild: 'Lifted GRCh37 (hg19) Coordinate',
      liftedGrch38Build: 'Lifted GRCh38 (hg38) Coordinate',
      allelesPrefix: 'Alleles',
      unmappedLabel: 'Unmapped',
      unmappedNoticeTitle: 'Fingerprint Verified • Outside Curated Liftover Chain',
      unmappedNoticeDesc: 'Single-base reference fingerprint passed, while this locus lies outside the bundled clinical Liftover intervals.',
      delta: 'Measured Shift',
      targetBuild: 'Source GRCh38 (hg38) Coordinate',
      sourceGrch37Build: 'Source GRCh37 (hg19) Coordinate',
      deltaNote: 'Computed live by plasmid-core WASM LiftoverEngine',
      blockedLabel: 'Blocked by Guard',
      blockedNote: 'Conversion halted due to sequence mismatch',
    },
    wiki: {
      reference: 'Reference Identifier (dbSNP)',
      clinicalSignificance: 'Clinical Significance',
      vcfInfoTitle: 'Decoded VCF Record Attributes (.plasmid)',
      annotationsTitle: 'Bundled Container Annotation Blocks',
      noAnnotationBundled: 'No separate markdown annotation entry is bundled for this locus in the loaded .plasmid archive; showing real decoded VCF attributes only.',
      acmgCriteria: 'ACMG/AMP Criteria Tags',
      citationsTitle: 'Cited Literature (PubMed Links)',
      citationsNote: 'Extracted from decoded annotation blocks',
    },
    swarm: {
      title: 'WebRTC P2P Merkle Swarm & Integrity Shield',
      desc: 'Exchanges authentic 16KB .plasmid Merkle chunks across browser peers via RTCPeerConnection + RTCDataChannel with instant Byzantine peer banning and HTTP 206 Origin fallback.',
      liveConsoleTitle: 'Live WebRTC DataChannel Swarm Console',
      liveConsoleDesc: 'Join the same swarm room across two or more browser tabs/devices to negotiate direct P2P data channels via /api/swarm/signal.',
      publicOnlyBadge: 'Public ClinVar Pack Only • Private Vault 0 B Air-Gapped',
      roomLabel: 'Swarm Room ID',
      roomPlaceholder: 'e.g. clinvar-grch38',
      localPeerLabel: 'Local Peer ID',
      statusOffline: 'Offline (Not Joined)',
      statusJoining: 'Negotiating & Verifying…',
      statusSeeding: (chunks) => `Seeding (${chunks} × 16KB chunks verified)`,
      statusLeeching: 'Leeching (128B Header Root Pinned)',
      joinSeederBtn: 'Join as Seeder',
      joinLeecherBtn: 'Join as Leecher',
      leaveRoomBtn: 'Leave Swarm',
      kpiPeersLabel: 'Connected / Banned',
      kpiPeersSub: (conn, banned) => `${conn} connected · ${banned} banned`,
      kpiRttLabel: 'Measured WebRTC RTT',
      kpiRttSub: 'RTCDataChannel PING/PONG',
      kpiBytesLabel: 'P2P DataChannel Bytes',
      kpiBytesSub: (rx, tx) => `RX ${rx} · TX ${tx}`,
      kpiVerifyLabel: 'Merkle Check & Fallback',
      kpiVerifySub: (ok, bad, fb) => `${ok} verified · ${bad} blocked · ${fb} HTTP 206`,
      actionsTitle: '16KB Leaf Chunk Batch Exchange & Byzantine Defense',
      batchSelectLabel: 'Chunk Batch Pair',
      kAnonBadge: 'Min 2 Chunks (32 KB) K-Anonymity',
      requestBatchBtn: (c1, c2) => `Request 16KB Chunk Batch (#${c1}, #${c2})`,
      requestingBtn: 'Transferring over RTCDataChannel…',
      byzantineDemoBtn: 'Inject Tampered Chunk (Byzantine) → Auto-Ban & HTTP 206 Fallback',
      singleChunkProbeBtn: 'Test Single-Chunk Rejection (K-Anonymity)',
      seederByzantineToggle: 'Mutate outgoing chunk bytes on wire (Byzantine Seeder Test Mode)',
      seederReadyNote: (chunks) => `Active Seeder node: serving ${chunks} Merkle-verified 16KB leaf chunks + BEP 52 audit proofs over RTCDataChannel.`,
      connectSeederHint: 'Connect at least one Seeder peer in the same room to run live P2P chunk transfers and Byzantine ban/fallback verification.',
      lastTransferP2p: (chunks, bytes, ms) => `WebRTC P2P Verified: chunks [${chunks}] (${bytes} in ${ms} ms) — WASM BEP 52 Merkle proof matched`,
      lastTransferFallback: (peer, range, bytes) => `Banned Byzantine peer (${peer}) → Recovered via Origin HTTP 206 Fallback [${range}] (${bytes})`,
      peersSectionTitle: (count) => `Live Swarm Peer Connections (${count})`,
      peersEmpty: 'No remote peers connected yet. Open another browser tab or session and join the same Swarm Room ID.',
      peerRoleSeeder: 'Seeder',
      peerRoleLeecher: 'Leecher',
      peerStatusConnecting: 'Connecting',
      peerStatusConnected: 'DataChannel Open',
      peerStatusDisconnected: 'Disconnected',
      peerStatusBanned: 'BANNED (Byzantine)',
      peerRttCol: 'Live RTT',
      peerTransferCol: 'P2P RX / TX',
      peerVerifyCol: 'SHA-256 Check',
      auditSectionTitle: 'Live WebRTC Signaling & Merkle Audit Log',
      auditEmpty: 'No swarm events recorded yet. Join a room as Seeder or Leecher to inspect real WebRTC and SHA-256 verification logs.',
      containerPackTitle: 'Loaded .plasmid Container Geometry',
      directoryArchTitle: 'Directory Architecture',
      hierarchicalDesc: (leaves) => `2-Stage PMTiles Leaf (${leaves} leaves)`,
      flatDesc: 'Flat Directory Index',
      generatorBuildTitle: 'Generator & Build',
      privacyTitle: 'Query Privacy Protection (Coarse Pack Policy)',
      privacyDesc: 'Fine-grained single-variant P2P requests are prohibited to prevent traffic-analysis deanonymization; swarm distribution operates exclusively on ~50MB public clinical packs.',
      privacyBadge: 'RFC-0002 / RFC-0003 Enforced',
      privacyStatusTitle: 'OPFS Air-Gap Isolation for User Files',
      privacyStatusDesc: 'Private sequencing data stays strictly inside browser OPFS and WebAssembly memory with zero network bindings.',
      integrityTitle: 'Cryptographic Chunk Verification',
      integrityDesc: 'Every 16KB leaf block is SHA-256 hashed in WebAssembly and verified against the 32-byte Merkle root in the 128B header.',
      airgapBadge: 'WASM SHA-256 Active',
    },
    governance: {
      title: 'Data Sources & Privacy Architecture',
      desc: 'Plasmid relies solely on validated public scientific databases and never transmits private user genomic files.',
      tier1Title: 'Public Domain Genomic Standards',
      tier1Status: 'Public Domain',
      tier1Desc: 'Open scientific data from NCBI ClinVar, dbSNP, RefSeq, and official reference genome builds, freely accessible to global researchers.',
      tier2Title: 'Population Statistics & Clinical Guidelines',
      tier2Status: 'Academic Attribution',
      tier2Desc: 'Broad Institute gnomAD allele frequencies and Stanford CPIC guidelines, maintained with standard scientific attribution notices.',
      tier3Title: 'Open Identifier Cross-Referencing',
      tier3Status: 'Open Identifiers',
      tier3Desc: 'Proprietary commercial databases (OMIM, COSMIC, HGMD, SNPedia wiki text) are strictly excluded from bundles.',
      tier4Title: 'Private User Genomic Data (WGS/VCF)',
      tier4Status: 'Browser-Isolated',
      tier4Desc: 'Uploaded user files are never sent to external servers or peer networks. All computations run strictly inside your local browser sandbox (OPFS/WebAssembly).',
      attributionsTitle: 'Official Academic Citations',
      gnomadAttr: 'gnomAD: Genome Aggregation Database (Broad Institute of MIT and Harvard)',
      cpicAttr: 'CPIC: Clinical Pharmacogenetics Implementation Consortium (Stanford University)',
      statementTitle: 'Research Use Statement',
      statementDesc: 'Plasmid is an open-source utility for scientific and educational exploration. For clinical diagnoses or medical treatment, please consult a licensed medical geneticist.',
    },
  },
  zh: {
    workspace: {
      navSectionLabel: '工作区',
      collapseRail: '收起导航栏',
      expandRail: '展开导航栏',
      globalSearchPlaceholder: '搜索基因、rsID 或坐标',
      searchClearAria: '清除搜索',
      searchJumpCoord: (coord) => `跳转至 ${coord}`,
      searchNoResults: '未找到匹配的变异或坐标。',
      searchSectionPersonal: '个人 ClinVar 匹配',
      searchSectionCatalog: '已解码容器变异',
      mobileVaultExpand: '保险库',
      mobileVaultCollapse: '收起',
      zeroEgressShort: '0 B 外发',
      bentoTitleVault: '个人基因组临床筛查摘要',
      bentoTitlePublic: '公共 ClinVar 参考包摘要',
      bentoRingMatched: '临床匹配',
      bentoRingIndexed: '索引变异',
      bentoRowTotalPersonal: '个人变异总数',
      bentoRowTotalIndexed: '索引变异总数',
      bentoRowClinvarMatch: 'ClinVar 匹配',
      bentoRowPackGeometry: 'Zstd 默克尔包',
      bentoRowActionable: '致病 · 药物反应',
      bentoKpiBuild: '参考版本',
      bentoKpiPathogenic: '致病/可能',
      bentoKpiPharmaco: '药物与风险',
      bentoKpiSavings: '区间节省率',
      bentoKpiEgress: '数据外发',
      contextActiveVariant: '当前变异上下文',
      securityCardTitle: '空气隔离与数据治理状态',
      securityRfcAirgap: 'RFC-0002 OPFS 本地隔离（0 B 外发）',
      securityRfcPublic: 'RFC-0003 仅读取公共粗粒度包',
    },
    disclaimer: {
      bannerTitle: '学术研究与教育工具说明',
      bannerDesc: '本平台为开源公共基因组学术数据查看器，不作为医疗诊断或治疗决策的依据。',
      badgeLocal: '公共标准数据 • 浏览器本地 WASM 解码',
    },
    header: {
      title: 'Plasmid',
      subtitle: '去中心化基因组百科与 .plasmid 字节范围流引擎',
      tabs: {
        navigator: '全基因组导航',
        intersection: 'ClinVar 匹配报告',
        viewer: '数据查看器',
        liftover: '坐标转换与校验',
        wiki: '临床记录与注释',
        network: '容器结构与隐私',
        sources: '数据来源与隐私',
      },
    },
    locus: {
      activeLocus: '.plasmid 容器解码变异位点',
      activeVaultLocus: '本地 OPFS 空气隔离保险库解码变异',
      targetBuildPrefix: '参考基因组',
      loadingCatalog: '正在通过 WASM 解码基因组数据与坐标索引…',
      catalogEmpty: '当前加载的数据集中未找到可解码的变异记录。',
    },
    vault: {
      title: '个人基因组本地 OPFS 空气隔离保险库',
      badgeZeroNetwork: '个人数据零上传 • 浏览器本地隔离',
      desc: '将本地 .vcf、.vcf.gz、23andMe .txt 或 .plasmid 文件保存在浏览器 OPFS 中，个人数据零外发即可与公共 ClinVar Zstd 包在本地 WASM 内完成交叉匹配。',
      dropzonePrompt: '将本地 .vcf / .vcf.gz / .txt / .plasmid 文件拖放至此处，或点击选择文件',
      dropzoneActive: '释放鼠标以保存至隔离的 OPFS 空气隔离保险库',
      selectFileBtn: '导入本地文件',
      importingStatus: '正在写入 OPFS 并通过 WASM 解析…',
      sourceLabel: '当前数据源',
      publicDemoSource: '公共 ClinVar Zstd 包 (demo.plasmid)',
      vaultFileBadge: 'OPFS 保险库',
      deleteVaultBtn: '删除',
      deleteVaultAria: (name) => `从 OPFS 保险库删除 ${name}`,
      quotaLabel: (used) => `OPFS 已用: ${used}`,
      uploadErrorPrefix: '本地保险库文件错误：',
      dismissBtn: '关闭',
      intersectRunning: '正在本地 WASM 中与公共 ClinVar Zstd 数据块交叉比对…',
      intersectReadyBanner: (matched, scanned) =>
        `ClinVar 交叉匹配完成：检出 ${matched} 项临床变异（扫描 ${scanned.toLocaleString()} 条 ClinVar 记录 • 个人数据发送 0 B）`,
      openReportBtn: '查看临床匹配报告',
    },
    intersection: {
      title: '个人 DNA ↔ 公共 ClinVar Zstd 交叉匹配报告',
      subtitle: '个人基因组完全隔离于 OPFS 沙箱内（外发 0 B），仅通过 HTTP 206 按需切片公共 ClinVar 16KB Zstd 默克尔块并在本地 Rust/WASM 中完成等位基因比对。',
      emptyTitle: '尚未加载个人基因组文件',
      emptyDesc: '请在上方 OPFS 空气隔离保险库导入个人 .vcf、.vcf.gz 或 23andMe .txt 文件，无需上传任何个人数据即可在本地 WASM 筛查致病及药物反应变异。',
      uploadCtaBtn: '导入个人 .vcf / .vcf.gz / .txt',
      runningStatus: '正在通过 HTTP 206 获取公共 ClinVar Zstd 切片并在 WASM 中比对…',
      privacyProofBadge: '已验证：个人数据外发 0 B',
      cardMatchedTitle: '匹配临床变异',
      cardMatchedSub: (carriers, total) => `携带变异 ${carriers} 项 / 共上传 ${total} 项`,
      cardPathogenicTitle: '致病 / 可能致病',
      cardPathogenicSub: (p, lp) => `致病/致癌 ${p} 项 • 可能致病 ${lp} 项`,
      cardPharmacoTitle: '药物反应与风险因子',
      cardPharmacoSub: (drug, risk) => `药物基因组 ${drug} 项 • 风险因子 ${risk} 项`,
      cardSlicingTitle: 'ClinVar HTTP 206 切片',
      cardSlicingSub: (chunks, kbFetched, kbTotal) => `${chunks} 个 Zstd 块 (${kbFetched} / ${kbTotal} KB)`,
      liftedNotice: (count, fromB, toB) =>
        `已通过内置 UCSC 链将 ${count} 项 ${fromB} 个人变异自动转换至 ${toB} 坐标并校验等位基因。`,
      searchPlaceholder: '筛选基因 · rsID · 表型',
      filterAll: '全部',
      filterPathogenic: '致病/致癌',
      filterLikelyPathogenic: '可能致病',
      filterDrugResponse: '药物反应',
      filterRiskFactor: '风险因子',
      minStarsLabel: '证据星级',
      starsAll: '全部星级',
      noFilteredMatches: '当前筛选或搜索条件下没有匹配的临床变异。',
      genotypeLabel: '个人基因型',
      zygosityHet: '杂合 (Het)',
      zygosityHomAlt: '纯合变异 (Hom-Alt)',
      zygosityHemi: '半合 (Hemi)',
      zygosityObserved: '检出变异',
      conditionsLabel: '关联临床表型 (ClinVar CLNDN)',
      consequenceLabel: '分子后果',
      liftedBadge: (fromB, origPos) => `自 ${fromB} ${origPos} 自动转换`,
      openInNavigatorBtn: '在导航器中查看',
      clinvarLinkLabel: 'NCBI ClinVar',
    },
    navigator: {
      title: '多尺度全基因组导航器',
      subtitle: '128B 二进制头部 + 二级分层叶目录切片与 Rust/WASM SHA-256 校验解码',
      level3Badge: '级别 3 (碱基/变异)',
      level2Badge: '级别 2 (密度直方图)',
      airgapActive: 'OPFS 空气隔离已启用',
      vaultAirgapLocked: '私有保险库空气隔离（零通信）',
      edgeStreaming: '边缘区间流传输',
      cacheToOpfs: '缓存至 OPFS',
      cachingPrefix: '正在缓存',
      errorPrefix: '容器区间读取失败：',
      retryBtn: '重试',
      indexedLociLabel: '.plasmid 索引位点：',
      readingDirectory: '正在读取容器目录…',
      noLeavesLoaded: '未加载索引变异叶节点',
      karyotypeTitle: '级别 0：全基因组金字塔核型概览',
      loadingPyramid: '正在加载金字塔元数据…',
      pyramidSummary: (total, pathogenic) => `已索引变异 ${total} 个（致病性 ${pathogenic} 个）`,
      densityBarSuffix: '1Mb 金字塔密度与着丝粒图谱',
      windowLabel: '当前窗口',
      viewportTitle: '高分辨率 .plasmid 切片视口',
      slicingLoading: '正在通过 WASM 切片解码…',
      noChunksNeeded: '无需读取块',
      fastaJumpBtn: '1–200 bp (参考序列)',
      panLeft: '向左平移',
      panRight: '向右平移',
      zoomIn: '放大 (2x)',
      zoomOut: '缩小 (0.5x)',
      trackBlocksTitle: (c) => `容器索引数据块与参考序列（匹配 ${c} 项）`,
      trackBlocksShort: (c) => `索引块与序列 (${c})`,
      noBlocksOverlap: '当前坐标区间无重叠的 .plasmid 数据块。',
      trackVariantsTitle: (c) => `WASM 解码变异记录（窗口内 ${c} 项）`,
      trackVariantsShort: (c) => `解码变异 (${c})`,
      unmappedLiftoverMsg: '当前窗口超出校准链映射范围 — 请切换基因组版本或跳转至索引位点。',
      noVariantsMsg: '该基因组窗口内未观察到变异。',
      unannotatedGene: '未标注基因',
      displayedAssembly: '当前显示基因组',
      containerLabel: '容器版本',
      vcfInfoCard: '解码 VCF INFO 属性',
      noInfoTags: '无 INFO 标签',
      chunkTransferCard: '分块切片与字节传输',
      chunksLabel: '数据块编号',
      sliceSizeLabel: '切片大小',
      chunkShaCard: 'WASM 数据块 SHA-256 摘要',
      noChunkDigest: '无数据块摘要',
      errorInspectorMsg: '容器范围读取恢复前无法显示变异详情。',
      emptyInspectorMsg: (chrom, start, end, asm, fastaLen) =>
        `${chrom}:${start}-${end} (${asm}) 区间内无解码 VCF 变异。${fastaLen ? `（已解码 ${fastaLen} bp 参考 FASTA 序列）` : ''}`,
      auditLogTitle: '.plasmid 区间流与 WASM 审计日志',
      latestEvents: (c) => `最近 ${c} 条记录`,
    },
    stream: {
      title: '.plasmid HTTP 206 精准区间切片',
      desc: '解析 128B 二进制头部与二级叶目录索引，仅按需读取并解码目标坐标对应的 16KB 默克尔数据块。',
      savingsPrefix: '单次查询带宽节省',
      payloadBadge: (b) => `16 KB 默克尔块内有效负载 ${b} B`,
      dataRange: '实际 HTTP 字节范围',
      indexOffset: '叶目录索引指针',
      dataBlocks: '读取的 16KB 默克尔块',
      license: '容器元数据许可证',
      unspecifiedLicense: '未指定',
      integrityTitle: 'SHA-256 BEP 52 默克尔根完整性校验 (WASM)',
      headerRootPrefix: '头部根哈希',
      computedRootPrefix: '计算根哈希',
      verified: 'WASM 已完成全部数据块与头部默克尔根密码学比对',
      failed: '检测到默克尔根哈希不匹配（数据损坏或被篡改）',
      pending: '可执行完整负载默克尔树校验',
      verifyBtn: '运行 WASM 默克尔校验',
      verifyingBtn: '正在计算 SHA-256 树...',
      chunkDigestsTitle: '分块 SHA-256 叶哈希摘要',
      chunkPrefix: '数据块',
    },
    liftover: {
      title: 'WASM 基因组坐标转换与指纹校验',
      desc: '通过 Rust/WASM 引擎实时转换 GRCh37 (hg19) 与 GRCh38 (hg38) 坐标，并校验单核苷酸参考指纹。',
      testToggle: '注入 +1 bp 偏移以验证拦截机制',
      verifiedTitle: 'WASM 序列指纹校验通过',
      verifiedDesc: '参考等位基因与目标基因组序列指纹及锚点映射一致。',
      warningTitle: 'WASM 已拦截坐标偏移不匹配',
      warningDesc: '检测到参考序列指纹不匹配，已安全中止坐标转换。',
      sourceBuild: '转换后 GRCh37 (hg19) 坐标',
      liftedGrch38Build: '转换后 GRCh38 (hg38) 坐标',
      allelesPrefix: '等位基因',
      unmappedLabel: '未映射',
      unmappedNoticeTitle: '序列指纹校验通过 • 超出内置转换链区间',
      unmappedNoticeDesc: '单碱基参考指纹校验一致，但该位点位于当前内置临床锚点转换链区间之外。',
      delta: '实测位移',
      targetBuild: '源 GRCh38 (hg38) 原始坐标',
      sourceGrch37Build: '源 GRCh37 (hg19) 原始坐标',
      deltaNote: '由 WASM 引擎实时计算',
      blockedLabel: '已拦截转换',
      blockedNote: '参考序列不匹配，已中止转换',
    },
    wiki: {
      reference: '参考标识符 (dbSNP)',
      clinicalSignificance: '临床意义',
      vcfInfoTitle: '解码 VCF 记录属性 (.plasmid)',
      annotationsTitle: '容器内置注释块',
      noAnnotationBundled: '当前 .plasmid 容器未包含该位点的独立 Markdown 注释块，仅展示真实解码的 VCF 属性。',
      acmgCriteria: 'ACMG/AMP 分类标准',
      citationsTitle: '循证医学文献 (PubMed)',
      citationsNote: '提取自解码注释块中的 PMID',
    },
    swarm: {
      title: 'WebRTC P2P 默克尔集群与完整性防护',
      desc: '通过真实的 RTCPeerConnection + RTCDataChannel 在浏览器节点间交换 16KB .plasmid 默克尔块，并在检出篡改数据时自动封禁节点并回退至 HTTP 206 源站。',
      liveConsoleTitle: '实时 WebRTC DataChannel 集群控制台',
      liveConsoleDesc: '在两个或多个浏览器标签页加入相同的集群房间 ID，即可经由 /api/swarm/signal 建立端到端 P2P 数据通道。',
      publicOnlyBadge: '仅限公共 ClinVar 包 • 私有保险库 0 B 隔离',
      roomLabel: '集群房间 ID',
      roomPlaceholder: '例如: clinvar-grch38',
      localPeerLabel: '本机节点 ID',
      statusOffline: '离线（未加入）',
      statusJoining: '正在信令协商与校验…',
      statusSeeding: (chunks) => `做种中（已校验 ${chunks} 个 16KB 块）`,
      statusLeeching: '下载节点已就绪（已锁定 128B 头部根哈希）',
      joinSeederBtn: '作为做种节点(Seeder)加入',
      joinLeecherBtn: '作为下载节点(Leecher)加入',
      leaveRoomBtn: '离开集群房间',
      kpiPeersLabel: '已连接 / 已封禁',
      kpiPeersSub: (conn, banned) => `连接 ${conn} · 拜占庭封禁 ${banned}`,
      kpiRttLabel: '实测 WebRTC 延迟',
      kpiRttSub: 'RTCDataChannel PING/PONG',
      kpiBytesLabel: 'P2P 传输字节',
      kpiBytesSub: (rx, tx) => `接收 ${rx} · 发送 ${tx}`,
      kpiVerifyLabel: '默克尔校验与回退',
      kpiVerifySub: (ok, bad, fb) => `通过 ${ok} · 拦截 ${bad} · 206回退 ${fb}`,
      actionsTitle: '16KB 叶数据块批量交换与拜占庭防御验证',
      batchSelectLabel: '请求数据块批次',
      kAnonBadge: '强制最少 2 块 (32 KB) K-匿名保护',
      requestBatchBtn: (c1, c2) => `P2P 请求 16KB 数据块批次 (#${c1}, #${c2})`,
      requestingBtn: '正在通过 RTCDataChannel 传输…',
      byzantineDemoBtn: '注入篡改块(Byzantine) → 自动封禁并回退 HTTP 206 源站',
      singleChunkProbeBtn: '验证单块请求拦截 (K-匿名守卫)',
      seederByzantineToggle: '在下次 P2P 响应中注入篡改字节（拜占庭做种测试模式）',
      seederReadyNote: (chunks) => `当前为做种节点模式，可向已连接节点提供全部 ${chunks} 个经默克尔校验的 16KB 数据块及 BEP 52 证明。`,
      connectSeederHint: '请先在同一房间连接至少一个做种节点(Seeder)，以运行实时 P2P 分块交换及拜占庭封禁回退验证。',
      lastTransferP2p: (chunks, bytes, ms) => `WebRTC P2P 校验通过：数据块 [${chunks}]（${bytes}，${ms} ms）— WASM BEP 52 默克尔根一致`,
      lastTransferFallback: (peer, range, bytes) => `已封禁拜占庭节点 (${peer}) → 已通过源站 HTTP 206 回退恢复 [${range}] (${bytes})`,
      peersSectionTitle: (count) => `实时集群节点列表 (${count})`,
      peersEmpty: '当前房间暂无远程节点连接。请在另一浏览器标签页或会话中加入相同房间 ID。',
      peerRoleSeeder: '做种节点 (Seeder)',
      peerRoleLeecher: '下载节点 (Leecher)',
      peerStatusConnecting: '正在握手连接',
      peerStatusConnected: 'DataChannel 已连接',
      peerStatusDisconnected: '已断开',
      peerStatusBanned: '已封禁 (Byzantine)',
      peerRttCol: '实测 RTT',
      peerTransferCol: 'P2P 收发量',
      peerVerifyCol: 'SHA-256 校验',
      auditSectionTitle: '实时 WebRTC 信令与默克尔审计日志',
      auditEmpty: '尚无集群事件记录。加入房间后将实时显示信令协商与 SHA-256 默克尔校验明细。',
      containerPackTitle: '当前 .plasmid 容器参数',
      directoryArchTitle: '目录索引架构',
      hierarchicalDesc: (leaves) => `二级分层叶索引（${leaves} 个叶块）`,
      flatDesc: '单层平面目录索引',
      generatorBuildTitle: '构建工具与参考基因组',
      privacyTitle: '查询隐私保护（粗粒度打包策略）',
      privacyDesc: '禁止按单个变异发起 P2P 请求以防流量分析去匿名化，仅允许按 ~50MB 公共临床面板进行交换。',
      privacyBadge: '隐私保护已启用',
      privacyStatusTitle: 'OPFS 本地空气隔离沙箱',
      privacyStatusDesc: '用户私有测序文件严格限制在本地 OPFS 与 WebAssembly 内存中处理。',
      integrityTitle: '数据块密码学校验',
      integrityDesc: '每个 16KB 数据块均在 WASM 中计算 SHA-256 并与头部 32 字节默克尔根核验。',
      airgapBadge: 'WASM SHA-256 已启用',
    },
    governance: {
      title: '数据来源与个人隐私保护架构',
      desc: 'Plasmid 仅采用经过验证的公共科学数据，绝不将用户的私有基因数据上传至任何服务器。',
      tier1Title: '公共领域基因组标准数据',
      tier1Status: '完全开源',
      tier1Desc: '来源于 NCBI ClinVar、dbSNP、RefSeq 及公共参考基因组，全球研究人员均可自由使用。',
      tier2Title: '人群频率统计与临床指南',
      tier2Status: '遵循学术引用',
      tier2Desc: '包含 Broad Institute 的 gnomAD 等位基因频率及 Stanford CPIC 指南，严格标注学术来源。',
      tier3Title: '开放标准标识符互通体系',
      tier3Status: '标准交叉引用',
      tier3Desc: '严禁打包商业受限数据库正文，仅保留开放标准标识符。',
      tier4Title: '用户私有基因组文件（WGS/VCF）',
      tier4Status: '浏览器本地完全隔离',
      tier4Desc: '用户上传的基因文件绝不经过任何服务器或 P2P 网络，全部运算在本地浏览器沙箱内完成。',
      attributionsTitle: '官方学术引用声明',
      gnomadAttr: 'gnomAD: Genome Aggregation Database (Broad Institute of MIT and Harvard)',
      cpicAttr: 'CPIC: Clinical Pharmacogenetics Implementation Consortium (Stanford University)',
      statementTitle: '研究用途声明',
      statementDesc: 'Plasmid 是面向学术研究与教育探索的开源工具。如需医疗诊断或个性化治疗，请咨询具备资质的医学遗传学专科医师。',
    },
  },
  ja: {
    workspace: {
      navSectionLabel: 'ワークスペース',
      collapseRail: 'サイドバーを折りたたむ',
      expandRail: 'サイドバーを展開',
      globalSearchPlaceholder: '遺伝子・rsID・座標を検索',
      searchClearAria: '検索をクリア',
      searchJumpCoord: (coord) => `座標へ移動: ${coord}`,
      searchNoResults: '一致する変異または座標がありません。',
      searchSectionPersonal: '個人 ClinVar 一致変異',
      searchSectionCatalog: 'デコード済み変異',
      mobileVaultExpand: '保管庫',
      mobileVaultCollapse: '閉じる',
      zeroEgressShort: '外部送信 0 B',
      bentoTitleVault: '個人ゲノム臨床照合サマリー',
      bentoTitlePublic: '公共 ClinVar 参照パック概要',
      bentoRingMatched: '臨床一致',
      bentoRingIndexed: '索引変異',
      bentoRowTotalPersonal: '個人変異総数',
      bentoRowTotalIndexed: '索引変異総数',
      bentoRowClinvarMatch: 'ClinVar 一致',
      bentoRowPackGeometry: 'Zstd マークルパック',
      bentoRowActionable: '病原性・薬物応答',
      bentoKpiBuild: '参照ビルド',
      bentoKpiPathogenic: '病原性/準',
      bentoKpiPharmaco: '薬物・リスク',
      bentoKpiSavings: '範囲削減率',
      bentoKpiEgress: '外部送信',
      contextActiveVariant: '選択中の変異コンテキスト',
      securityCardTitle: 'エアギャップ・データ保護状態',
      securityRfcAirgap: 'RFC-0002 OPFS 隔離（送信 0 B）',
      securityRfcPublic: 'RFC-0003 公共パネル単位のみ照会',
    },
    disclaimer: {
      bannerTitle: '学術研究および教育用ツールの案内',
      bannerDesc: '本プラットフォームはオープンな公共ゲノムデータビューアであり、医療診断や治療決定を目的としたものではありません。',
      badgeLocal: '公共標準データ • ブラウザ内 WASM デコード',
    },
    header: {
      title: 'Plasmid',
      subtitle: '分散型ゲノムWiki＆.plasmid バイト範囲ストリーミング',
      tabs: {
        navigator: '全ゲノムナビゲーター',
        intersection: 'ClinVar 照合レポート',
        viewer: 'データビューア',
        liftover: '座標変換・整合性検証',
        wiki: '臨床記録・注釈',
        network: 'コンテナ構造・保護',
        sources: 'データソースとプライバシー',
      },
    },
    locus: {
      activeLocus: '.plasmid コンテナからデコードされた変異',
      activeVaultLocus: 'OPFS エアギャップ保管庫からデコードされた個人変異',
      targetBuildPrefix: '参照ゲノム',
      loadingCatalog: 'ゲノムデータと座標索引を WASM でデコード中…',
      catalogEmpty: '読み込まれたデータセットにデコード可能な変異がありません。',
    },
    vault: {
      title: '個人ゲノム OPFS エアギャップ保管庫',
      badgeZeroNetwork: '個人データ送信 0 B • ブラウザ内完全隔離',
      desc: 'ローカルの .vcf・.vcf.gz・23andMe .txt・.plasmid ファイルを OPFS に隔離保存し、個人データを一切外部送信せず公共 ClinVar Zstd パックとローカル WASM で交差照合します。',
      dropzonePrompt: 'ここに個人 .vcf / .vcf.gz / .txt / .plasmid ファイルをドロップ、またはクリックして選択',
      dropzoneActive: 'ドロップして OPFS エアギャップ保管庫へ隔離保存',
      selectFileBtn: 'ローカルファイル読込',
      importingStatus: 'OPFS 隔離保存および WASM 解析中…',
      sourceLabel: '有効データソース',
      publicDemoSource: '公共 ClinVar Zstd パック (demo.plasmid)',
      vaultFileBadge: 'OPFS 保管庫',
      deleteVaultBtn: '削除',
      deleteVaultAria: (name) => `OPFS 保管庫から ${name} を削除`,
      quotaLabel: (used) => `OPFS 使用量: ${used}`,
      uploadErrorPrefix: 'ローカル保管庫エラー:',
      dismissBtn: '閉じる',
      intersectRunning: 'ローカル WASM で公共 ClinVar Zstd チャンクと交差照合中…',
      intersectReadyBanner: (matched, scanned) =>
        `ClinVar 照合完了: 臨床変異 ${matched} 件一致 (走査 ClinVar ${scanned.toLocaleString()} 件 • 個人データ送信 0 B)`,
      openReportBtn: '臨床照合レポートを開く',
    },
    intersection: {
      title: '個人 DNA ↔ 公共 ClinVar Zstd 交差照合レポート',
      subtitle: '個人ゲノムは OPFS サンドボックス内に完全隔離（外部送信 0 B）したまま、該当染色体の公共 ClinVar 16KB Zstd マークルチャンクのみを HTTP 206 取得しローカル Rust/WASM で照合します。',
      emptyTitle: 'OPFS 保管庫に個人ゲノムファイルがありません',
      emptyDesc: '上部の OPFS エアギャップ保管庫に個人 .vcf・.vcf.gz または 23andMe .txt ファイルを読み込むと、外部送信ゼロで ClinVar 病原性・薬物応答変異を即座に照合します。',
      uploadCtaBtn: '個人 .vcf / .vcf.gz / .txt を読み込む',
      runningStatus: 'HTTP 206 ClinVar Zstd チャンク取得および WASM アレル照合中…',
      privacyProofBadge: '個人データ外部送信 0 B 検証済み',
      cardMatchedTitle: '一致した臨床変異',
      cardMatchedSub: (carriers, total) => `保有変異 ${carriers} 件 / 入力 ${total} 件`,
      cardPathogenicTitle: '病原性 / 準病原性',
      cardPathogenicSub: (p, lp) => `病原性・腫瘍性 ${p} 件 • 準病原性 ${lp} 件`,
      cardPharmacoTitle: '薬物応答・リスク因子',
      cardPharmacoSub: (drug, risk) => `薬理ゲノム ${drug} 件 • リスク因子 ${risk} 件`,
      cardSlicingTitle: 'ClinVar HTTP 206 取得',
      cardSlicingSub: (chunks, kbFetched, kbTotal) => `${chunks} Zstd チャンク (${kbFetched} / ${kbTotal} KB)`,
      liftedNotice: (count, fromB, toB) =>
        `内蔵 UCSC チェーンにより ${count} 件の個人変異を ${fromB} から ${toB} へ自動座標変換した上でアレル一致を検証しました。`,
      searchPlaceholder: '遺伝子・rsID・疾患で絞込',
      filterAll: 'すべて',
      filterPathogenic: '病原性/腫瘍性',
      filterLikelyPathogenic: '準病原性',
      filterDrugResponse: '薬物応答',
      filterRiskFactor: 'リスク因子',
      minStarsLabel: '根拠ランク',
      starsAll: '全スター',
      noFilteredMatches: '選択されたフィルタまたは検索条件に一致する臨床変異はありません。',
      genotypeLabel: '個人遺伝子型',
      zygosityHet: 'ヘテロ接合 (Het)',
      zygosityHomAlt: '変異ホモ接合 (Hom-Alt)',
      zygosityHemi: 'ヘミ接合 (Hemi)',
      zygosityObserved: '変異検出',
      conditionsLabel: '関連臨床表現型 (ClinVar CLNDN)',
      consequenceLabel: '分子影響',
      liftedBadge: (fromB, origPos) => `${fromB} ${origPos} から自動変換`,
      openInNavigatorBtn: 'ナビゲーターで表示',
      clinvarLinkLabel: 'NCBI ClinVar',
    },
    navigator: {
      title: 'マルチスケール全ゲノムナビゲーター',
      subtitle: '128B バイナリヘッダー + 2段階階層リーフスライシングおよび Rust/WASM SHA-256 検証デコード',
      level3Badge: 'レベル 3 (塩基/変異)',
      level2Badge: 'レベル 2 (密度ヒストグラム)',
      airgapActive: 'OPFS エアギャップ有効',
      vaultAirgapLocked: '個人保管庫エアギャップ（通信 0件）',
      edgeStreaming: 'エッジ範囲ストリーミング',
      cacheToOpfs: 'OPFS に保存',
      cachingPrefix: '保存中',
      errorPrefix: 'コンテナ範囲取得エラー:',
      retryBtn: '再試行',
      indexedLociLabel: '.plasmid 索引座位:',
      readingDirectory: 'コンテナディレクトリを読み込み中…',
      noLeavesLoaded: '索引された変異リーフがありません',
      karyotypeTitle: 'レベル 0: 全ゲノムピラミッド核型概要',
      loadingPyramid: 'ピラミッドメタデータ読み込み中…',
      pyramidSummary: (total, pathogenic) => `索引変異 ${total} 件 (病原性 ${pathogenic} 件)`,
      densityBarSuffix: '1Mb ピラミッド密度＆セントロメア地図',
      windowLabel: '表示範囲',
      viewportTitle: '高解像度 .plasmid スライスビューポート',
      slicingLoading: 'WASM でスライス・デコード中…',
      noChunksNeeded: '必要チャンク 0個',
      fastaJumpBtn: '1–200 bp (参照配列)',
      panLeft: '左へ移動',
      panRight: '右へ移動',
      zoomIn: '拡大 (2x)',
      zoomOut: '縮小 (0.5x)',
      trackBlocksTitle: (c) => `コンテナ索引ブロック＆参照配列 (一致 ${c} 件)`,
      trackBlocksShort: (c) => `索引ブロック＆配列 (${c})`,
      noBlocksOverlap: 'この座標区間と重なる .plasmid データブロックはありません。',
      trackVariantsTitle: (c) => `WASM デコード変異レコード (区間内 ${c} 件)`,
      trackVariantsShort: (c) => `デコード変異 (${c})`,
      unmappedLiftoverMsg: 'チェーンマッピング範囲外です — アセンブリを切り替えるか索引座位へ移動してください。',
      noVariantsMsg: 'このゲノム区間に観測された変異はありません。',
      unannotatedGene: '未注釈遺伝子',
      displayedAssembly: '表示アセンブリ',
      containerLabel: 'コンテナ基準',
      vcfInfoCard: 'デコード済み VCF INFO 属性',
      noInfoTags: 'INFO タグなし',
      chunkTransferCard: 'チャンクスライス＆転送サイズ',
      chunksLabel: 'チャンク番号',
      sliceSizeLabel: 'スライスサイズ',
      chunkShaCard: 'WASM チャンク SHA-256 ダイジェスト',
      noChunkDigest: 'チャンクハッシュなし',
      errorInspectorMsg: 'コンテナ範囲アクセスが復旧するまで変異を表示できません。',
      emptyInspectorMsg: (chrom, start, end, asm, fastaLen) =>
        `${chrom}:${start}-${end} (${asm}) にデコードされた VCF 変異はありません。${fastaLen ? ` (参照 FASTA 配列 ${fastaLen} bp デコード済み)` : ''}`,
      auditLogTitle: '.plasmid 範囲ストリーミング＆WASM 監査ログ',
      latestEvents: (c) => `最新 ${c} 件`,
    },
    stream: {
      title: '.plasmid HTTP 206 精密レンジスライシング',
      desc: '128B バイナリヘッダーと2段階リーフディレクトリ索引を参照し、対象座標を含む 16KB マークルチャンクのみを取得・デコードします。',
      savingsPrefix: '単一クエリ帯域削減率',
      payloadBadge: (b) => `16 KB マークルチャンク内ペイロード ${b} B`,
      dataRange: '実転送バイト範囲 (HTTP Range)',
      indexOffset: 'リーフ索引ポインタ',
      dataBlocks: '取得 16KB マークルチャンク',
      license: 'コンテナメタデータライセンス',
      unspecifiedLicense: '未指定',
      integrityTitle: 'SHA-256 BEP 52 マークルルート完全性検証 (WASM)',
      headerRootPrefix: 'ヘッダールート',
      computedRootPrefix: '計算ルート',
      verified: 'WASM にて全チャンクとヘッダーマークルルートの一致を検証済み',
      failed: 'マークルルート不一致を検出（破損または改ざん）',
      pending: '全ペイロードのマークルツリー検証を実行可能',
      verifyBtn: 'WASM マークル検証を実行',
      verifyingBtn: 'SHA-256 ツリー計算中...',
      chunkDigestsTitle: 'チャンク別 SHA-256 リーフハッシュ',
      chunkPrefix: 'チャンク',
    },
    liftover: {
      title: 'WASM アセンブリ座標変換＆フィンガープリント検証',
      desc: 'Rust/WASM エンジンにより GRCh37 (hg19) と GRCh38 (hg38) 間の座標をリアルタイム変換し、1塩基配列フィンガープリントを検証します。',
      testToggle: '+1 bp オフセットを注入して遮断を検証',
      verifiedTitle: 'WASM 整合性検証完了',
      verifiedDesc: '参照アレルが対象アセンブリ配列フィンガープリントおよびアンカー区間と一致しています。',
      warningTitle: 'WASM が座標ドリフト不一致を遮断',
      warningDesc: '参照塩基配列の不一致が検出されたため、座標変換を安全に停止しました。',
      sourceBuild: '変換された GRCh37 (hg19) 座標',
      liftedGrch38Build: '変換された GRCh38 (hg38) 座標',
      allelesPrefix: 'アレル',
      unmappedLabel: '未マップ',
      unmappedNoticeTitle: '配列フィンガープリント検証完了 • 内蔵変換チェーン範囲外',
      unmappedNoticeDesc: '1塩基参照フィンガープリントは一致していますが、この座位は内蔵された臨床アンカー変換チェーン区間外です。',
      delta: '実測シフト量',
      targetBuild: '元 GRCh38 (hg38) 座標',
      sourceGrch37Build: '元 GRCh37 (hg19) 座標',
      deltaNote: 'WASM エンジンによる実測値',
      blockedLabel: '変換遮断',
      blockedNote: '参照配列不一致のため変換停止',
    },
    wiki: {
      reference: '参照ID (dbSNP)',
      clinicalSignificance: '臨床的意義',
      vcfInfoTitle: 'デコード済み VCF レコード属性 (.plasmid)',
      annotationsTitle: 'バンドル済み注釈ブロック',
      noAnnotationBundled: '現在の .plasmid コンテナにはこの座位の個別 Markdown 注釈ブロックは含まれておらず、デコードされた VCF 属性のみを表示しています。',
      acmgCriteria: 'ACMG/AMP 分類基準',
      citationsTitle: '根拠学術論文 (PubMed リンク)',
      citationsNote: 'デコード済み注釈ブロックから抽出された PMID',
    },
    swarm: {
      title: 'WebRTC P2P マークルスウォーム＆完全性保護',
      desc: '実際の RTCPeerConnection + RTCDataChannel を通じて 16KB .plasmid マークルチャンクをピア間で交換し、改ざん検出時は即時遮断と HTTP 206 オリジンフォールバックを実行します。',
      liveConsoleTitle: 'リアルタイム WebRTC DataChannel スウォームコンソール',
      liveConsoleDesc: '複数のブラウザタブや端末から同じルームIDに参加すると、/api/swarm/signal 経由で直接 P2P データチャネルを確立します。',
      publicOnlyBadge: '公共 ClinVar パック専用 • 個人保管庫 0 B 隔離',
      roomLabel: 'スウォームルーム ID',
      roomPlaceholder: '例: clinvar-grch38',
      localPeerLabel: '自ピア ID',
      statusOffline: 'オフライン（未参加）',
      statusJoining: 'シグナリング・検証中…',
      statusSeeding: (chunks) => `シーダー稼働中（${chunks} 個の 16KB チャンク検証済）`,
      statusLeeching: 'リーチャー稼働中（128B ヘッダールート固定）',
      joinSeederBtn: 'シーダー(Seeder)として参加',
      joinLeecherBtn: 'リーチャー(Leecher)として参加',
      leaveRoomBtn: 'スウォームから退出',
      kpiPeersLabel: '接続ピア / 遮断',
      kpiPeersSub: (conn, banned) => `接続 ${conn} · ビザンチン遮断 ${banned}`,
      kpiRttLabel: '実測 WebRTC RTT',
      kpiRttSub: 'RTCDataChannel PING/PONG',
      kpiBytesLabel: 'P2P 転送バイト',
      kpiBytesSub: (rx, tx) => `受信 ${rx} · 送信 ${tx}`,
      kpiVerifyLabel: 'マークル検証＆復旧',
      kpiVerifySub: (ok, bad, fb) => `合格 ${ok} · 拒否 ${bad} · 206復旧 ${fb}`,
      actionsTitle: '16KB リーフチャンク一括交換＆ビザンチン防御実証',
      batchSelectLabel: '要求チャンクバッチ',
      kAnonBadge: '最小2チャンク(32KB) K-匿名性強制',
      requestBatchBtn: (c1, c2) => `16KB チャンク P2P バッチ要求 (#${c1}, #${c2})`,
      requestingBtn: 'RTCDataChannel 転送中…',
      byzantineDemoBtn: '改ざんチャンク(Byzantine)注入 → 自動遮断＆Origin 206 フォールバック実証',
      singleChunkProbeBtn: '単一チャンク要求拒否を検証 (K-匿名性)',
      seederByzantineToggle: '次回の P2P 応答に改ざんバイトを送出（Byzantine Seeder テストモード）',
      seederReadyNote: (chunks) => `現在シーダーモードです。接続されたリーチャーへ検証済み 16KB マークルチャンク ${chunks} 個と BEP 52 証明を配信します。`,
      connectSeederHint: 'リアルタイム P2P チャンク交換およびビザンチン遮断実証を実行するには、同一ルームにシーダー(Seeder)を接続してください。',
      lastTransferP2p: (chunks, bytes, ms) => `WebRTC P2P 検証完了: チャンク [${chunks}] (${bytes}, ${ms} ms) — WASM BEP 52 マークルルート一致`,
      lastTransferFallback: (peer, range, bytes) => `ビザンチンピア (${peer}) を即時遮断 → Origin HTTP 206 フォールバック復旧 [${range}] (${bytes})`,
      peersSectionTitle: (count) => `リアルタイム接続ピア一覧 (${count})`,
      peersEmpty: '現在接続されているリモートピアはありません。別のブラウザタブで同じルームIDに参加してください。',
      peerRoleSeeder: 'シーダー (Seeder)',
      peerRoleLeecher: 'リーチャー (Leecher)',
      peerStatusConnecting: '接続交渉中',
      peerStatusConnected: 'DataChannel 接続済',
      peerStatusDisconnected: '切断',
      peerStatusBanned: '遮断済 (BANNED)',
      peerRttCol: '実測 RTT',
      peerTransferCol: 'P2P 送受信',
      peerVerifyCol: 'SHA-256 検証',
      auditSectionTitle: 'WebRTC シグナリング＆マークル検証監査ログ',
      auditEmpty: 'スウォームイベントはまだありません。ルームに参加すると実際の交渉・ハッシュ検証ログが表示されます。',
      containerPackTitle: '読み込み済み .plasmid コンテナ仕様',
      directoryArchTitle: 'ディレクトリ索引構造',
      hierarchicalDesc: (leaves) => `2段階階層リーフ索引 (${leaves} リーフ)`,
      flatDesc: 'フラットディレクトリ索引',
      generatorBuildTitle: '生成ツール＆ビルド',
      privacyTitle: 'クエリプライバシー保護 (パック単位配信)',
      privacyDesc: 'トラフィック解析による特定疾患関心の推測を防ぐため、単一変異単位の P2P 要求は禁止され、約50MBの公開パネル単位でのみ共有されます。',
      privacyBadge: 'プライバシー保護準拠',
      privacyStatusTitle: 'OPFS エアギャップローカル隔離',
      privacyStatusDesc: '個人ゲノムファイルはブラウザの OPFS および WebAssembly メモリ内でのみ処理されます。',
      integrityTitle: '暗号学的チャンク検証',
      integrityDesc: 'すべての 16KB リーフブロックは WASM 内で SHA-256 ハッシュ化され、128B ヘッダー内のマークルルートと照合されます。',
      airgapBadge: 'WASM SHA-256 稼働中',
    },
    governance: {
      title: 'データソースとプライバシー保護体系',
      desc: 'Plasmidは検証済みの公共科学データのみを使用し、ユーザーの個人ゲノムデータを外部に送信することは一切ありません。',
      tier1Title: '公共ドメインゲノム標準データ',
      tier1Status: '完全オープン',
      tier1Desc: '米国NCBIのClinVar、dbSNP、RefSeqおよび公共参照ゲノムデータで構成され、世界中の研究者に無償公開されています。',
      tier2Title: '集団統計および臨床ガイドライン',
      tier2Status: '学術的帰属表記',
      tier2Desc: 'Broad InstituteのgnomAD対立遺伝子頻度およびStanford CPICガイドラインを含み、公式な学術引用を明記しています。',
      tier3Title: 'オープン標準識別子による相互参照',
      tier3Status: '標準相互参照',
      tier3Desc: '商用・制限付きデータベース本文は一切バンドルせず、公開標準識別子のみを扱います。',
      tier4Title: 'ユーザー個人ゲノムファイル（WGS/VCF）',
      tier4Status: 'ブラウザ内完全隔離',
      tier4Desc: 'ユーザーが読み込んだ個人ゲノムデータは、サーバーやP2Pネットワークに一切送信されません。すべての処理はローカルサンドボックス内で完結します。',
      attributionsTitle: '公式学術データ帰属表記',
      gnomadAttr: 'gnomAD: Genome Aggregation Database (Broad Institute of MIT and Harvard)',
      cpicAttr: 'CPIC: Clinical Pharmacogenetics Implementation Consortium (Stanford University)',
      statementTitle: '研究利用に関する声明',
      statementDesc: 'Plasmidは学術研究および教育目的のオープンソースツールです。医療診断や治療の決定が必要な場合は、専門の医療機関の臨床遺伝専門医にご相談ください。',
    },
  },
}
