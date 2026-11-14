export type SupportedLanguage = 'en' | 'ko' | 'zh' | 'ja'

export interface NavigatorTranslations {
  title: string
  subtitle: string
  level3Badge: string
  level2Badge: string
  airgapActive: string
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

export interface TranslationSchema {
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
      viewer: string
      liftover: string
      wiki: string
      network: string
      sources: string
    }
  }
  locus: {
    activeLocus: string
    targetBuildPrefix: string
    loadingCatalog: string
    catalogEmpty: string
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
    allelesPrefix: string
    unmappedLabel: string
    delta: string
    targetBuild: string
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
        viewer: '데이터 뷰어',
        liftover: '좌표 변환 및 검증',
        wiki: '임상 기록 & 주석',
        network: '패널 번들링 & 무결성',
        sources: '데이터 출처 및 보안',
      },
    },
    locus: {
      activeLocus: '.plasmid 컨테이너 내 디코딩된 변이',
      targetBuildPrefix: '컨테이너 기준 유전체',
      loadingCatalog: '.plasmid 바이너리 헤더 및 인덱스를 디코딩하는 중…',
      catalogEmpty: '로드된 .plasmid 컨테이너에 디코딩 가능한 변이가 없습니다.',
    },
    navigator: {
      title: '다중 스케일 전장 유전체 네비게이터',
      subtitle: '128B 바이너리 헤더 + 2단계 계층형 리프 슬라이싱 및 Rust/WASM SHA-256 실시간 디코딩',
      level3Badge: '레벨 3 (염기/변이 상세)',
      level2Badge: '레벨 2 (밀도 히스토그램)',
      airgapActive: 'OPFS 에어갭 격리 활성',
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
      allelesPrefix: '대립유전자',
      unmappedLabel: '매핑 범위 밖',
      delta: '실측 좌표 이동량',
      targetBuild: '컨테이너 GRCh38 (hg38) 원본 좌표',
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
      title: 'BEP 52 머클 청크 구조 & 프라이버시 아키텍처',
      desc: '현재 로드된 .plasmid 아카이브의 실제 16KB 머클 청크 구성과 프라이버시 격리 정책을 표시합니다.',
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
        viewer: 'Data Viewer',
        liftover: 'Assembly Liftover',
        wiki: 'Clinical Notes',
        network: 'Container & Privacy',
        sources: 'Data Sources & Privacy',
      },
    },
    locus: {
      activeLocus: 'Decoded Variant from .plasmid Container',
      targetBuildPrefix: 'Container Reference',
      loadingCatalog: 'Decoding .plasmid 128B header and directory index…',
      catalogEmpty: 'No decodable VCF variants found in the loaded .plasmid container.',
    },
    navigator: {
      title: 'Multi-scale Whole-Genome Navigator',
      subtitle: '128B header + 2-stage hierarchical leaf slicing with Rust/WASM decoding & SHA-256 verification.',
      level3Badge: 'Level 3 (Base/Variant)',
      level2Badge: 'Level 2 (Density)',
      airgapActive: 'OPFS Airgap Active',
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
      allelesPrefix: 'Alleles',
      unmappedLabel: 'Unmapped',
      delta: 'Measured Shift',
      targetBuild: 'Container GRCh38 (hg38) Coordinate',
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
      title: 'BEP 52 Merkle Layout & Privacy Isolation',
      desc: 'Displays live chunk geometry from the loaded .plasmid header alongside RFC-0002/0003 privacy isolation guarantees.',
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
        viewer: '数据查看器',
        liftover: '坐标转换与校验',
        wiki: '临床记录与注释',
        network: '容器结构与隐私',
        sources: '数据来源与隐私',
      },
    },
    locus: {
      activeLocus: '.plasmid 容器解码变异位点',
      targetBuildPrefix: '容器参考基因组',
      loadingCatalog: '正在解码 .plasmid 128B 头部与目录索引…',
      catalogEmpty: '当前加载的 .plasmid 容器中未找到可解码的变异记录。',
    },
    navigator: {
      title: '多尺度全基因组导航器',
      subtitle: '128B 二进制头部 + 二级分层叶目录切片与 Rust/WASM SHA-256 校验解码',
      level3Badge: '级别 3 (碱基/变异)',
      level2Badge: '级别 2 (密度直方图)',
      airgapActive: 'OPFS 空气隔离已启用',
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
      allelesPrefix: '等位基因',
      unmappedLabel: '未映射',
      delta: '实测位移',
      targetBuild: '容器 GRCh38 (hg38) 原始坐标',
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
      title: 'BEP 52 默克尔分块结构与隐私隔离',
      desc: '展示当前加载 .plasmid 容器的真实分块参数及隐私隔离策略。',
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
        viewer: 'データビューア',
        liftover: '座標変換・整合性検証',
        wiki: '臨床記録・注釈',
        network: 'コンテナ構造・保護',
        sources: 'データソースとプライバシー',
      },
    },
    locus: {
      activeLocus: '.plasmid コンテナからデコードされた変異',
      targetBuildPrefix: 'コンテナ参照ゲノム',
      loadingCatalog: '.plasmid 128B ヘッダーとディレクトリ索引をデコード中…',
      catalogEmpty: '読み込まれた .plasmid コンテナにデコード可能な変異がありません。',
    },
    navigator: {
      title: 'マルチスケール全ゲノムナビゲーター',
      subtitle: '128B バイナリヘッダー + 2段階階層リーフスライシングおよび Rust/WASM SHA-256 検証デコード',
      level3Badge: 'レベル 3 (塩基/変異)',
      level2Badge: 'レベル 2 (密度ヒストグラム)',
      airgapActive: 'OPFS エアギャップ有効',
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
      allelesPrefix: 'アレル',
      unmappedLabel: '未マップ',
      delta: '実測シフト量',
      targetBuild: 'コンテナ GRCh38 (hg38) 座標',
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
      title: 'BEP 52 マークル構造＆プライバシー隔離',
      desc: '読み込まれた .plasmid ヘッダーの実チャンク構成とプライバシー保護仕様を表示します。',
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
