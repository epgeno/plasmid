export type SupportedLanguage = 'en' | 'ko' | 'zh' | 'ja'

export interface TranslationSchema {
  disclaimer: {
    bannerTitle: string
    bannerDesc: string
    badgeLocal: string
  }
  header: {
    subtitle: string
    tabs: {
      stream: string
      liftover: string
      wiki: string
      swarm: string
      governance: string
    }
  }
  locus: {
    activeLocus: string
    targetBuild: string
  }
  stream: {
    cardTitle: string
    cardDesc: string
    metricLabel: string
    planTitle: string
    stars: string
    httpRange: string
    leafIndex: string
    targetChunks: string
    license: string
    merkleTitle: string
    merkleVerified: string
    merklePending: string
    reverifyBtn: string
    verifyingBtn: string
  }
  liftover: {
    title: string
    desc: string
    simulateDrift: string
    driftDetectedTitle: string
    driftDetectedDesc: string
    verifiedTitle: string
    verifiedDesc: string
    sourceBuild: string
    delta: string
    targetBuild: string
    deltaNote: string
  }
  wiki: {
    reference: string
    clinicalSignificance: string
    acmgCriteria: string
    citationsTitle: string
    citationsNote: string
  }
  swarm: {
    title: string
    desc: string
    activeTopics: string
    packClinvar: string
    packAcmg: string
    packCpic: string
    peerStats: string
    privacyTitle: string
    privacyDesc: string
    btnSingle: string
    btnCoarse: string
    privacyBlockedTitle: string
    privacyBlockedDesc: string
    privacyActiveTitle: string
    privacyActiveDesc: string
    byzantineTitle: string
    byzantineDesc: string
    airgapBadge: string
    activePeersTitle: string
    peerStateSeeding: string
    peerStateVerifying: string
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
    regulatoryNotice: string
  }
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationSchema> = {
  ko: {
    disclaimer: {
      bannerTitle: '연구 및 교육용 도구 안내:',
      bannerDesc: '본 플랫폼은 학술 연구 및 교육 목적의 유전체 데이터 뷰어로, 의학적 진단이나 치료 결정 용도로 사용될 수 없습니다.',
      badgeLocal: '공공 데이터 기반 • 개인정보 브라우저 로컬 처리',
    },
    header: {
      subtitle: '탈중앙화 오픈 유전체 브라우저 & 스트리밍 엔진',
      tabs: {
        stream: '데이터 조회',
        liftover: '좌표 변환',
        wiki: '임상 지식',
        swarm: '분산 네트워크',
        governance: '데이터 출처 및 보호',
      },
    },
    locus: {
      activeLocus: '조회 변이 위치',
      targetBuild: '기준 유전체: GRCh38 (hg38)',
    },
    stream: {
      cardTitle: '스마트 구간 스트리밍 활성화',
      cardDesc: '128MB 전체 파일을 다운로드하지 않고, 필요한 변이 위치(1 KB)만 즉각 가져옵니다.',
      metricLabel: '네트워크 트래픽 절감율',
      planTitle: '유전자 구간 조회 명세',
      stars: '검증 등급',
      httpRange: 'HTTP 바이트 구간',
      leafIndex: '인덱스 리프 주소',
      targetChunks: '수신 데이터 블록',
      license: '데이터 출처/라이선스',
      merkleTitle: '데이터 무결성 검증 (머클 루트)',
      merkleVerified: '검증 완료 (공식 원본과 완벽 일치)',
      merklePending: '검증 대기',
      reverifyBtn: '무결성 재검증',
      verifyingBtn: '검증 진행 중...',
    },
    liftover: {
      title: '유전체 버전 변환 및 정합성 검증',
      desc: '이전 표준(GRCh37/hg19) 데이터를 최신 표준(GRCh38)으로 안전하게 변환하고 단일 염기 오차를 자동 검증합니다.',
      simulateDrift: '1-bp 오차 감지 테스트',
      driftDetectedTitle: '좌표 불일치 감지 (변환 중단)',
      driftDetectedDesc: '입력 위치가 기준 유전체의 앵커 변이 위치와 일치하지 않아 안전을 위해 변환을 중단했습니다.',
      verifiedTitle: '좌표 정합성 검증 완료',
      verifiedDesc: 'hg19와 hg38 간의 앵커 변이 정렬이 확인되어 안전하게 좌표가 변환되었습니다.',
      sourceBuild: '이전 표준 (GRCh37 / hg19)',
      delta: '좌표 이동 거리',
      targetBuild: '최신 표준 (GRCh38 / hg38)',
      deltaNote: 'UCSC 유전체 매핑 체인으로 검증됨',
    },
    wiki: {
      reference: '참조 번호',
      clinicalSignificance: '임상적 유의성',
      acmgCriteria: 'ACMG/AMP 분류 기준',
      citationsTitle: '근거 학술 문헌 (PubMed 원문 링크)',
      citationsNote: '공식 학술 데이터베이스 식별자(PMID) 기반',
    },
    swarm: {
      title: 'P2P 분산 네트워크 & 고속 캐싱',
      desc: '자주 조회되는 주요 임상 패널 데이터를 로컬 네트워크 피어와 분산 공유하여 신속하게 로딩합니다.',
      activeTopics: '활성 임상 패널 3개',
      packClinvar: 'ClinVar 병원성 변이 패널',
      packAcmg: 'ACMG 권고 유전자 패널',
      packCpic: '약물유전체 가이드라인 패널',
      peerStats: '피어 활성 • 캐시 완료',
      privacyTitle: '조회 프라이버시 보호 (패널 번들링)',
      privacyDesc: '특정 희귀질환 조회 이력이 네트워크에 노출되지 않도록, 개별 변이가 아닌 패널 단위로 데이터를 수신합니다.',
      btnSingle: '단일 변이 직접 요청 시뮬레이션',
      btnCoarse: '임상 패널 단위 수신 (보호 모드)',
      privacyBlockedTitle: '단일 변이 직접 요청 제한 (프라이버시 보호)',
      privacyBlockedDesc: '개별 변이 단독 요청 시 네트워크 피어가 사용자의 질환 관심을 추론할 수 있어, 패널 일괄 다운로드가 적용됩니다.',
      privacyActiveTitle: '조회 프라이버시 보호 활성화',
      privacyActiveDesc: '전체 패널을 일괄 수신하므로 외부 피어는 사용자가 어떤 특정 변이를 확인하는지 전혀 알 수 없습니다.',
      byzantineTitle: '네트워크 무결성 보호',
      byzantineDesc: '위조되거나 변조된 피어 데이터는 머클 해시 대조를 통해 즉시 격리 및 폐기됩니다.',
      airgapBadge: '로컬 샌드박스 가동',
      activePeersTitle: '연결된 분산 네트워크 노드',
      peerStateSeeding: '검증 데이터 공유 중',
      peerStateVerifying: '수신 및 무결성 검증 중',
    },
    governance: {
      title: '데이터 출처 및 개인정보 보호 체계',
      desc: 'Plasmid는 공공 과학 데이터만을 사용하며, 사용자의 개인 유전체 데이터를 외부로 절대 전송하지 않습니다.',
      tier1Title: '공공 유전체 데이터 (Public Domain)',
      tier1Status: '완전 공개',
      tier1Desc: '미국 국립생명공학정보센터(NCBI)의 ClinVar, dbSNP, RefSeq 및 공공 참조 유전체 데이터로, 전 세계 연구자에게 자유롭게 공개된 공공 데이터입니다.',
      tier2Title: '인구 집단 통계 및 임상 가이드라인',
      tier2Status: '출처 표기 준수',
      tier2Desc: 'Broad Institute의 gnomAD 대립유전자 빈도 데이터와 Stanford CPIC 가이드라인으로, 표준 학술 라이선스 규정에 따라 출처를 엄격히 표기합니다.',
      tier3Title: '상용 유료 데이터베이스 배제 정책',
      tier3Status: '미수집/비유포',
      tier3Desc: 'OMIM, COSMIC, HGMD 등 상용 가입형 데이터베이스의 저작권 본문은 수집하거나 유포하지 않으며, 공개 표준 식별자(MIM ID, PMID)만을 상호 참조합니다.',
      tier4Title: '사용자 개인 유전체 파일 (WGS/VCF)',
      tier4Status: '브라우저 내부 격리',
      tier4Desc: '사용자가 불러오는 개인 유전체 파일은 서버나 네트워크로 절대 전송되지 않습니다. 모든 연산은 사용자의 브라우저 로컬 환경(WebAssembly) 내에서만 처리됩니다.',
      attributionsTitle: '공식 학술 데이터 출처 표기',
      gnomadAttr: 'gnomAD: Genome Aggregation Database, Broad Institute of MIT and Harvard 제공 데이터 활용 (ODbL 1.0).',
      cpicAttr: 'CPIC: Clinical Pharmacogenetics Implementation Consortium 제공 가이드라인 활용 (CC-BY 4.0).',
      regulatoryNotice: '본 도구는 순수 학술 연구 및 교육 목적으로 제공되며, 의료법상 진단이나 의학적 조언을 대신할 수 없습니다.',
    },
  },
  en: {
    disclaimer: {
      bannerTitle: 'RESEARCH & EDUCATIONAL USE ONLY:',
      bannerDesc: 'This platform is an open scientific genome viewer for academic exploration and education. It is not intended for clinical diagnosis or treatment planning.',
      badgeLocal: 'Public Data Based • Local Browser Processing',
    },
    header: {
      subtitle: 'Decentralized Open Genomic Browser & Streaming Engine',
      tabs: {
        stream: 'Data Viewer',
        liftover: 'Assembly Liftover',
        wiki: 'Clinical Notes',
        swarm: 'P2P Network',
        governance: 'Data Sources & Privacy',
      },
    },
    locus: {
      activeLocus: 'ACTIVE GENOMIC LOCUS',
      targetBuild: 'Reference Genome: GRCh38 (hg38)',
    },
    stream: {
      cardTitle: 'Smart Range Streaming Active',
      cardDesc: 'Fetches only the required 1 KB variant window directly instead of downloading a monolithic 128 MB file.',
      metricLabel: 'NETWORK TRAFFIC REDUCTION',
      planTitle: 'Variant Slicing Plan',
      stars: 'Evidence Level',
      httpRange: 'HTTP Byte Range',
      leafIndex: 'Directory Leaf Index',
      targetChunks: 'Target Data Chunks',
      license: 'Data License / Source',
      merkleTitle: 'Data Integrity Verification (Merkle Root)',
      merkleVerified: 'Verified (Exact Cryptographic Match with Official Source)',
      merklePending: 'Pending Verification',
      reverifyBtn: 'Re-verify Proof',
      verifyingBtn: 'Verifying...',
    },
    liftover: {
      title: 'Genome Assembly Liftover & Integrity Guard',
      desc: 'Reliably converts coordinates from legacy build (GRCh37/hg19) to latest standard (GRCh38) with single-nucleotide validation.',
      simulateDrift: 'Test 1-bp Coordinate Mismatch',
      driftDetectedTitle: 'Coordinate Mismatch Detected (Halted)',
      driftDetectedDesc: 'Input coordinate does not match reference genome anchor locus. Conversion safely suspended.',
      verifiedTitle: 'Coordinate Integrity Verified',
      verifiedDesc: 'Anchor variant alignment between hg19 and hg38 confirmed. Safely converted.',
      sourceBuild: 'Legacy Build (GRCh37 / hg19)',
      delta: 'Coordinate Shift',
      targetBuild: 'Current Build (GRCh38 / hg38)',
      deltaNote: 'Validated against UCSC Genome Mapping Chain',
    },
    wiki: {
      reference: 'Reference ID',
      clinicalSignificance: 'Clinical Significance',
      acmgCriteria: 'ACMG/AMP Criteria Tags',
      citationsTitle: 'Evidence-Backed Citations (PubMed)',
      citationsNote: 'Indexed via standard literature IDs (PMID)',
    },
    swarm: {
      title: 'P2P Distributed Network & Rapid Caching',
      desc: 'Accelerates high-demand clinical panels across local network peers with automatic origin fallback.',
      activeTopics: '3 Active Clinical Panels',
      packClinvar: 'ClinVar Pathogenic Panel',
      packAcmg: 'ACMG Recommended Panel',
      packCpic: 'Pharmacogenomics Panel',
      peerStats: 'active peers • cached locally',
      privacyTitle: 'Query Privacy Protection (Panel Bundling)',
      privacyDesc: 'To protect your inquiry intent from network peers, data is fetched as complete clinical panels rather than exposing single-variant lookups.',
      btnSingle: 'Simulate Single Variant Lookup',
      btnCoarse: 'Subscribe Clinical Panel (Protected)',
      privacyBlockedTitle: 'Direct Single-Variant Request Restricted',
      privacyBlockedDesc: 'Requesting isolated variants over peer connections could expose query intent. Panel bundling is enforced to preserve privacy.',
      privacyActiveTitle: 'Query Privacy Protected',
      privacyActiveDesc: 'Entire panel received in bulk. Network peers cannot determine which specific variant you are inspecting.',
      byzantineTitle: 'Network Integrity Guard',
      byzantineDesc: 'Corrupted or altered peer chunks are immediately detected via Merkle hashes and safely discarded.',
      airgapBadge: 'Local Sandbox Active',
      activePeersTitle: 'Connected Network Nodes',
      peerStateSeeding: 'Sharing Verified Data',
      peerStateVerifying: 'Downloading & Verifying',
    },
    governance: {
      title: 'Data Sources & Privacy Architecture',
      desc: 'Plasmid relies strictly on verified public scientific repositories and never transmits user genomic files to external networks.',
      tier1Title: 'Public Domain Genomics',
      tier1Status: 'Unrestricted',
      tier1Desc: 'NCBI ClinVar, dbSNP, RefSeq, and Genome Reference Consortium builds. Open federal scientific databases freely accessible to all researchers.',
      tier2Title: 'Population Statistics & Clinical Guidelines',
      tier2Status: 'Attribution Mandated',
      tier2Desc: 'Broad Institute gnomAD allele frequencies and Stanford CPIC dosing guidelines. Preserved with standard academic attributions.',
      tier3Title: 'Commercial Datasets Policy',
      tier3Status: 'Excluded',
      tier3Desc: 'Proprietary commercial databases (such as OMIM, COSMIC, or HGMD subscriptions) are not hosted or distributed. Only open standard identifiers (MIM, PMID) are referenced.',
      tier4Title: 'Personal Genomic Files (WGS/VCF)',
      tier4Status: 'Local Browser Sandbox',
      tier4Desc: 'User genome files are strictly processed inside your local browser via WebAssembly. Your genetic data is never uploaded to any server or shared with peer nodes.',
      attributionsTitle: 'Official Academic Attributions',
      gnomadAttr: 'gnomAD: Data from Genome Aggregation Database, Broad Institute of MIT and Harvard (ODbL 1.0).',
      cpicAttr: 'CPIC: Guidelines from Clinical Pharmacogenetics Implementation Consortium (CC-BY 4.0).',
      regulatoryNotice: 'This tool is provided solely for academic research and education. It does not provide medical diagnosis or replace professional genetic consultation.',
    },
  },
  zh: {
    disclaimer: {
      bannerTitle: '仅供学术研究与教育使用：',
      bannerDesc: '本平台为用于学术研究与教学的开源基因组浏览器，不得用于临床诊断或医疗决策。',
      badgeLocal: '基于开放公共数据 • 浏览器本地隐私沙箱',
    },
    header: {
      subtitle: '去中心化开放基因组浏览器与分片流引擎',
      tabs: {
        stream: '数据浏览',
        liftover: '坐标转换',
        wiki: '临床笔记',
        swarm: '分布式网络',
        governance: '数据来源与隐私',
      },
    },
    locus: {
      activeLocus: '当前位点',
      targetBuild: '参考基因组：GRCh38 (hg38)',
    },
    stream: {
      cardTitle: '智能分片流式加载已启用',
      cardDesc: '无需下载完整的 128 MB 大文件，即可毫秒级直接获取所需的 1 KB 变异数据块。',
      metricLabel: '网络流量节约率',
      planTitle: '变异位点分片计划',
      stars: '证据置信度',
      httpRange: 'HTTP 字节区间',
      leafIndex: '索引叶节点',
      targetChunks: '目标数据块',
      license: '数据来源/许可证',
      merkleTitle: '数据完整性校验（默克尔根）',
      merkleVerified: '校验通过（与官方数据源完全一致）',
      merklePending: '等待验证',
      reverifyBtn: '重新校验',
      verifyingBtn: '校验中...',
    },
    liftover: {
      title: '基因组版本转换与坐标校验',
      desc: '安全地将旧版坐标（GRCh37/hg19）精准转换为最新标准（GRCh38），自动防御单碱基漂移误差。',
      simulateDrift: '测试 1-bp 坐标偏差',
      driftDetectedTitle: '检测到坐标不匹配（已安全暂停）',
      driftDetectedDesc: '输入位置与参考基因组的已知锚定位点不一致，已安全终止转换。',
      verifiedTitle: '坐标完整性校验成功',
      verifiedDesc: 'hg19 与 hg38 锚定位点对齐一致，坐标转换安全完成。',
      sourceBuild: '旧版参考基因组（GRCh37 / hg19）',
      delta: '坐标偏移量',
      targetBuild: '最新参考基因组（GRCh38 / hg38）',
      deltaNote: '基于 UCSC 映射链验证',
    },
    wiki: {
      reference: '参考编号',
      clinicalSignificance: '临床意义',
      acmgCriteria: 'ACMG/AMP 分类标准',
      citationsTitle: '循证医学文献（PubMed 原文链接）',
      citationsNote: '基于官方文献标识符 (PMID) 索引',
    },
    swarm: {
      title: 'P2P 分布式网络与高速缓存',
      desc: '通过本地网络节点协同分发高频临床变异数据集，实现高速缓存与容灾回源。',
      activeTopics: '3 个活跃临床数据集',
      packClinvar: 'ClinVar 致病变异包',
      packAcmg: 'ACMG 推荐筛查包',
      packCpic: '药物基因组学包',
      peerStats: '活跃节点 • 本地缓存',
      privacyTitle: '查询隐私保护（面板打包机制）',
      privacyDesc: '为防止网络节点推断用户的查询意图与潜在疾病状态，系统按临床面板整体拉取，禁止暴露单变异请求。',
      btnSingle: '模拟单变异探测请求',
      btnCoarse: '按临床面板整体下载（保护模式）',
      privacyBlockedTitle: '单变异直接请求受限（隐私保护）',
      privacyBlockedDesc: '直接探测单个变异可能会向对等节点泄露您的查询隐私。系统强制执行面板打包下载。',
      privacyActiveTitle: '查询隐私保护已激活',
      privacyActiveDesc: '已整体获取变异面板，网络节点无法获知您具体在查看哪个基因位点。',
      byzantineTitle: '网络完整性防护',
      byzantineDesc: '被篡改或损坏的数据块将通过默克尔树哈希校验立即被隔离并废弃。',
      airgapBadge: '本地沙箱运行中',
      activePeersTitle: '已连接的网络节点',
      peerStateSeeding: '正在共享已验证数据',
      peerStateVerifying: '正在下载并验证',
    },
    governance: {
      title: '数据来源与隐私保护架构',
      desc: 'Plasmid 严格基于合规的公共科研数据库构建，绝不会将用户的个人基因组数据上传至外部网络。',
      tier1Title: '公有领域科学数据（Public Domain）',
      tier1Status: '完全开放',
      tier1Desc: 'NCBI ClinVar、dbSNP、RefSeq 及参考基因组数据。属于美国联邦政府公有领域数据，向全球科研人员完全免费开放。',
      tier2Title: '人群频率与临床指南',
      tier2Status: '合规署名',
      tier2Desc: 'Broad 研究所 gnomAD 等位基因频率数据及 Stanford CPIC 药物指南，严格遵从开源学术许可证规范完整署名。',
      tier3Title: '商业数据库排除准则',
      tier3Status: '严格排除',
      tier3Desc: 'OMIM、COSMIC、HGMD 等商业专有数据库的版权文本一律不予收录或传播，仅收录公开事实标准编号（MIM、PMID）。',
      tier4Title: '用户个人基因组文件（WGS/VCF）',
      tier4Status: '浏览器沙箱隔离',
      tier4Desc: '用户载入的个人基因组文件完全在本地浏览器通过 WebAssembly 离线解码，绝不上传至任何服务器或 P2P 节点。',
      attributionsTitle: '官方学术数据来源声明',
      gnomadAttr: 'gnomAD: 数据源自麻省理工与哈佛 Broad 研究所基因组汇总数据库 (ODbL 1.0)。',
      cpicAttr: 'CPIC: 指南数据源自临床药物基因组学实施联盟 (CC-BY 4.0)。',
      regulatoryNotice: '本工具仅供学术研究和科学普及，不能替代专业医疗人员的临床诊断与医学意见。',
    },
  },
  ja: {
    disclaimer: {
      bannerTitle: '研究・教育目的専用ツール：',
      bannerDesc: '本ツールは学術研究および教育目的のオープンゲノムビューアであり、臨床診断や治療方針の決定には使用できません。',
      badgeLocal: 'オープンデータ準拠 • ブラウザ内ローカル処理',
    },
    header: {
      subtitle: '分散型オープンゲノムブラウザ＆ストリーミングエンジン',
      tabs: {
        stream: 'データ閲覧',
        liftover: '座標変換',
        wiki: '臨床情報',
        swarm: '分散ネットワーク',
        governance: 'データ出典とプライバシー',
      },
    },
    locus: {
      activeLocus: '対象変異位置',
      targetBuild: '参照ゲノム：GRCh38 (hg38)',
    },
    stream: {
      cardTitle: 'スマート範囲ストリーミング有効',
      cardDesc: '128 MB の巨大ファイルを一括取得することなく、必要な変異区間（1 KB）のみを即座に取得します。',
      metricLabel: 'ネットワーク通信量削減率',
      planTitle: '変異区間スライス仕様',
      stars: 'エビデンス信頼度',
      httpRange: 'HTTP バイト範囲',
      leafIndex: 'インデックスリーフ',
      targetChunks: '対象データブロック',
      license: 'ライセンス・出典',
      merkleTitle: 'データ整合性検証（マークルツリー）',
      merkleVerified: '検証完了（公式データソースと完全一致）',
      merklePending: '検証待ち',
      reverifyBtn: '再検証',
      verifyingBtn: '検証中...',
    },
    liftover: {
      title: 'ゲノムアセンブリ座標変換＆整合性ガード',
      desc: '旧規格（GRCh37/hg19）の座標を最新規格（GRCh38）へ安全に変換し、1塩基のズレも自動検知します。',
      simulateDrift: '1-bp 座標ズレ検知テスト',
      driftDetectedTitle: '座標の不一致を検知（変換を中断）',
      driftDetectedDesc: '入力位置が参照ゲノムのアンカー変異と一致しないため、安全のため変換を中断しました。',
      verifiedTitle: '座標整合性検証完了',
      verifiedDesc: 'hg19 と hg38 間のアンカー変異が確認され、安全に変換されました。',
      sourceBuild: '旧参照ゲノム（GRCh37 / hg19）',
      delta: '座標シフト量',
      targetBuild: '最新参照ゲノム（GRCh38 / hg38）',
      deltaNote: 'UCSC ゲノムマッピングチェーンで検証済み',
    },
    wiki: {
      reference: '参照番号',
      clinicalSignificance: '臨床的意義',
      acmgCriteria: 'ACMG/AMP 分類基準',
      citationsTitle: 'エビデンス文献（PubMed 原著リンク）',
      citationsNote: '公式文献識別子 (PMID) に基づく索引',
    },
    swarm: {
      title: 'P2P 分散ネットワーク＆高速キャッシュ',
      desc: '需要の高い主要臨床パネルデータをローカルピア間で分散共有し、高速な読み込みを実現します。',
      activeTopics: '3 つのアクティブ臨床パネル',
      packClinvar: 'ClinVar 病原性変異パネル',
      packAcmg: 'ACMG 推奨遺伝子パネル',
      packCpic: '薬理遺伝学ガイドラインパネル',
      peerStats: 'ピア稼働中 • キャッシュ完了',
      privacyTitle: 'クエリプライバシー保護（パネル一括受信）',
      privacyDesc: '特定の希少疾患検索がネットワーク上のピアに特定されないよう、単一変異ではなくパネル単位で一括受信します。',
      btnSingle: '単一変異リクエストをシミュレーション',
      btnCoarse: '臨床パネル一括受信（保護モード）',
      privacyBlockedTitle: '単一変異の直接取得を制限（プライバシー保護）',
      privacyBlockedDesc: '個別変異のみを取得するとピアに検索意図が特定される恐れがあるため、パネル一括ダウンロードを強制します。',
      privacyActiveTitle: 'クエリプライバシー保護が有効',
      privacyActiveDesc: 'パネル全体を一括取得しているため、外部ピアはどの特定変異を調べているかを一切把握できません。',
      byzantineTitle: 'ネットワーク完全性保護',
      byzantineDesc: '改ざんされたピアデータはマークルハッシュ検証によって即座に隔離・破棄されます。',
      airgapBadge: 'ローカルサンドボックス稼働中',
      activePeersTitle: '接続中のネットワークノード',
      peerStateSeeding: '検証済みデータを共有中',
      peerStateVerifying: 'ダウンロードおよび検証中',
    },
    governance: {
      title: 'データ出典およびプライバシー保護体系',
      desc: 'Plasmid は検証済みの公共科学データのみを使用し、利用者の個人ゲノムデータを外部に送信することは一切ありません。',
      tier1Title: 'パブリックドメイン科学データ',
      tier1Status: '完全公開',
      tier1Desc: '米国国立生物工学情報センター(NCBI)の ClinVar、dbSNP、RefSeq 等のデータです。著作権制限のないパブリックドメインとして全世界の研究者に提供されています。',
      tier2Title: '集団頻度および臨床ガイドライン',
      tier2Status: '出典明記',
      tier2Desc: 'Broad Institute の gnomAD アレル頻度データおよび Stanford CPIC 投薬ガイドラインです。標準的な学術ライセンスに基づき出典を明記しています。',
      tier3Title: '商用有料データベース除外ポリシー',
      tier3Status: '収集・配布禁止',
      tier3Desc: 'OMIM、COSMIC、HGMD 等の商用サブスクリプションの著作権本文は一切収集・再配布せず、公開識別子（MIM番号、PMID）のみを相互参照します。',
      tier4Title: '利用者の個人ゲノムデータ (WGS/VCF)',
      tier4Status: 'ブラウザ内完全隔離',
      tier4Desc: '利用者が読み込む個人ゲノムファイルは外部サーバや P2P ネットワークに送信されず、お使いのブラウザ内（WebAssembly）でのみ安全に解析されます。',
      attributionsTitle: '公式学術データ出典明記',
      gnomadAttr: 'gnomAD: Genome Aggregation Database, Broad Institute of MIT and Harvard 提供データ活用 (ODbL 1.0)。',
      cpicAttr: 'CPIC: Clinical Pharmacogenetics Implementation Consortium ガイドライン活用 (CC-BY 4.0)。',
      regulatoryNotice: '本ツールは学術研究・教育目的で提供されており、医療法上の診断や医師の助言に代わるものではありません。',
    },
  },
}

export interface LocalizedVariantData {
  gene: string
  mutation: string
  chrom: string
  hg38Pos: number
  hg19Pos: number
  rsid: number
  ref: string
  alt: string
  clinvar: string
  stars: number
  reviewStatus: Record<SupportedLanguage, string>
  license: string
  acmg: string[]
  notes: Record<SupportedLanguage, string>
  byteRange: string
  leafOffset: number
  leafLength: number
  chunks: number[]
  merkleRoot: string
  pubmed: { id: number; title: string; year: number }[]
}

export const LOCALIZED_PRESET_VARIANTS: Record<string, LocalizedVariantData> = {
  'BRAF V600E': {
    gene: 'BRAF',
    mutation: 'p.Val600Glu',
    chrom: 'chr7',
    hg38Pos: 140753336,
    hg19Pos: 140453136,
    rsid: 113488022,
    ref: 'T',
    alt: 'A',
    clinvar: 'Pathogenic (Tier 1)',
    stars: 4,
    reviewStatus: {
      ko: '임상 진료 지침 (최고 신뢰도)',
      en: 'Practice guideline (Highest clinical confidence)',
      zh: '临床实践指南（最高置信度）',
      ja: '診療ガイドライン（最高信頼度）',
    },
    license: 'Public Domain (17 U.S.C. § 105)',
    acmg: ['PS1', 'PM1', 'PM2', 'PP3', 'PP5'],
    notes: {
      ko: 'BRAF 원암유전자의 키나아제 활성 도메인에 발생하는 과오돌연변이입니다. 흑색종 및 대장암 등에서 BRAF/MEK 억제제 표적 치료 반응의 핵심 지표입니다.',
      en: 'Activating missense mutation in the kinase domain of the BRAF proto-oncogene. Strong clinical evidence for targeted BRAF/MEK inhibitor combination therapy.',
      zh: 'BRAF 原癌基因激酶结构域的激活错义突变。黑色素瘤及结直肠癌等对 BRAF/MEK 抑制剂靶向疗法反应的重要临床指标。',
      ja: 'BRAF 原がん遺伝子のキナーゼ活性ドメインに生じるミスセンス変異です。悪性黒色腫等における BRAF/MEK 阻害薬標的療法の重要な指標です。',
    },
    byteRange: 'bytes=1048576-1064959',
    leafOffset: 2048,
    leafLength: 320,
    chunks: [64, 65],
    merkleRoot: '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    pubmed: [
      { id: 12068308, title: 'Mutations of the BRAF gene in human cancer', year: 2002 },
      { id: 20818844, title: 'Improved survival with vemurafenib in melanoma with BRAF V600E', year: 2010 },
    ],
  },
  'TP53 R175H': {
    gene: 'TP53',
    mutation: 'p.Arg175His',
    chrom: 'chr17',
    hg38Pos: 7675088,
    hg19Pos: 7578406,
    rsid: 28934578,
    ref: 'G',
    alt: 'A',
    clinvar: 'Pathogenic',
    stars: 3,
    reviewStatus: {
      ko: '전문가 패널 검토 완료 (ClinGen TP53)',
      en: 'Reviewed by expert panel (ClinGen TP53)',
      zh: '专家组评审完成（ClinGen TP53）',
      ja: '専門家パネル検証済み（ClinGen TP53）',
    },
    license: 'Public Domain (17 U.S.C. § 105)',
    acmg: ['PS1', 'PS3', 'PM1', 'PP3'],
    notes: {
      ko: '종양 억제 인자 p53의 DNA 결합 부위를 손상시키는 대표적 구조적 핫스팟 변이입니다. 리-프라우메니 증후군 및 다수 고형암에서 빈번하게 관찰됩니다.',
      en: 'Structural hotspot mutation disrupting the DNA-binding domain of the tumor suppressor p53. Associated with Li-Fraumeni syndrome and multiple somatic cancers.',
      zh: '破坏抑癌因子 p53 DNA 结合区域的代表性结构热点突变。与李-佛美尼综合征及多种实体瘤密切相关。',
      ja: 'がん抑制遺伝子 p53 の DNA 結合領域を破壊するホットスポット変異です。リー・フラウメニ症候群および各種の固形がんで頻繁に認められます。',
    },
    byteRange: 'bytes=2097152-2113535',
    leafOffset: 4096,
    leafLength: 320,
    chunks: [128],
    merkleRoot: '0x5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    pubmed: [
      { id: 1855983, title: 'Mutations in the p53 gene in human tumors', year: 1991 },
      { id: 17311302, title: 'The p53 pathway: 20 years of cancer biology', year: 2007 },
    ],
  },
  'HBB rs334 (HbS)': {
    gene: 'HBB',
    mutation: 'p.Glu6Val',
    chrom: 'chr11',
    hg38Pos: 5227002,
    hg19Pos: 5248232,
    rsid: 334,
    ref: 'T',
    alt: 'A',
    clinvar: 'Pathogenic (Actionable)',
    stars: 4,
    reviewStatus: {
      ko: '임상 진료 지침 (ACMG / CPIC)',
      en: 'Practice guideline (ACMG / CPIC)',
      zh: '临床实践指南（ACMG / CPIC）',
      ja: '診療ガイドライン（ACMG / CPIC）',
    },
    license: 'Public Domain (17 U.S.C. § 105)',
    acmg: ['PS1', 'PM1', 'PM2', 'PP4'],
    notes: {
      ko: '베타-글로빈 유전자의 단일 염기 치환 변이입니다. 동형접합 시 겸상적혈구 빈혈증을 유발하며, 이형접합 시 말라리아에 대한 방어 효과를 보입니다.',
      en: 'Pathogenic transversion mutation in the beta-globin chain causing sickle cell anemia in homozygotes and sickle cell trait with malaria resistance in heterozygotes.',
      zh: 'β-珠蛋白基因中的单碱基突变。纯合子导致镰状细胞贫血，杂合子表现为具有疟疾抗性的镰状细胞性状。',
      ja: 'β-グロビン遺伝子の塩基置換変異です。ホモ接合体では鎌状赤血球貧血症を引き起こし、ヘテロ接合体ではマラリア抵抗性を示します。',
    },
    byteRange: 'bytes=3145728-3162111',
    leafOffset: 6144,
    leafLength: 320,
    chunks: [192],
    merkleRoot: '0x4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    pubmed: [
      { id: 13735160, title: 'Molecular basis of sickle cell anemia', year: 1957 },
      { id: 25164801, title: 'Management of sickle cell disease: a comprehensive review', year: 2014 },
    ],
  },
}
