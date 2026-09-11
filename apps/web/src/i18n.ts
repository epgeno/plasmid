export type SupportedLanguage = 'en' | 'ko' | 'zh' | 'ja'

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
      viewer: string
      liftover: string
      wiki: string
      network: string
      sources: string
    }
  }
  locus: {
    activeLocus: string
    targetBuild: string
  }
  stream: {
    title: string
    desc: string
    savingsLabel: string
    planTitle: string
    stars: string
    dataRange: string
    indexOffset: string
    dataBlocks: string
    license: string
    integrityTitle: string
    verified: string
    pending: string
    verifyBtn: string
    verifyingBtn: string
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
    privacyBadge: string
    privacyStatusTitle: string
    privacyStatusDesc: string
    integrityTitle: string
    integrityDesc: string
    airgapBadge: string
    activePeersTitle: string
    peerStateSharing: string
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
    statementTitle: string
    statementDesc: string
  }
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationSchema> = {
  ko: {
    disclaimer: {
      bannerTitle: '학술 연구 및 교육용 도구 안내',
      bannerDesc: '본 플랫폼은 공공 유전체 학술 데이터 뷰어로, 의료 진단이나 치료 결정 용도로 사용될 수 없습니다.',
      badgeLocal: '공공 표준 데이터 • 브라우저 로컬 분석',
    },
    header: {
      title: 'Plasmid',
      subtitle: '분산형 유전체 위키 & 초고속 구간 스트리밍',
      tabs: {
        viewer: '데이터 뷰어',
        liftover: '좌표 변환 및 검증',
        wiki: '임상 지식 위키',
        network: 'P2P 분산 네트워크',
        sources: '데이터 출처 및 보안',
      },
    },
    locus: {
      activeLocus: '조회 중인 유전체 위치',
      targetBuild: '기준 유전체: GRCh38 (hg38)',
    },
    stream: {
      title: '스마트 구간 스트리밍 활성화',
      desc: '128 MB 전체 파일을 일괄 다운로드하지 않고, 필요한 변이 구간(1 KB)만 즉시 수신합니다.',
      savingsLabel: '네트워크 대역폭 절감율: 95.0%',
      planTitle: '유전체 데이터 스트리밍 상세',
      stars: '등급',
      dataRange: '데이터 전송 범위 (Byte Range)',
      indexOffset: '인덱스 색인 위치 (Index Offset)',
      dataBlocks: '수신 블록 번호 (Data Blocks)',
      license: '데이터 라이선스',
      integrityTitle: '데이터 원본 무결성 검증',
      verified: '암호화 검증 완료 (공식 데이터베이스 원본 일치)',
      pending: '무결성 확인 대기 중',
      verifyBtn: '무결성 재검증',
      verifyingBtn: '검증 중...',
    },
    liftover: {
      title: '유전체 버전 변환 및 정합성 검증',
      desc: '이전 표준(GRCh37/hg19) 좌표를 최신 표준(GRCh38)으로 안전하게 변환하며 단일 염기 단위로 정합성을 검증합니다.',
      testToggle: '좌표 불일치 감지 예시 확인 (+1 bp 임의 오차)',
      verifiedTitle: '좌표 정합성 검증 완료',
      verifiedDesc: '공식 유전체 앵커 매핑과 100% 일치합니다.',
      warningTitle: '좌표 불일치 감지 (안전 조치)',
      warningDesc: '기준 유전체 위치와 염기 서열이 일치하지 않아 데이터 변환을 안전하게 중단했습니다.',
      sourceBuild: '이전 표준 (GRCh37 / hg19)',
      delta: '좌표 이동 거리',
      targetBuild: '최신 표준 (GRCh38 / hg38)',
      deltaNote: 'UCSC 표준 유전체 체인 매핑 기반',
    },
    wiki: {
      reference: '참조 식별자',
      clinicalSignificance: '임상적 유의성',
      acmgCriteria: 'ACMG/AMP 분류 기준',
      citationsTitle: '근거 학술 문헌 (PubMed 원문 링크)',
      citationsNote: '공식 학술 데이터베이스 식별자(PMID) 기반',
    },
    swarm: {
      title: 'P2P 분산 네트워크 & 고속 캐싱',
      desc: '자주 조회되는 주요 임상 패널 데이터를 인근 네트워크 노드와 분산 공유하여 신속하게 로딩합니다.',
      activeTopics: '활성 임상 패널 3개',
      packClinvar: 'ClinVar 병원성 변이 패널',
      packAcmg: 'ACMG 권고 유전자 패널',
      packCpic: '약물유전체 가이드라인 패널',
      peerStats: '피어 활성 • 캐시 완료',
      privacyTitle: '조회 프라이버시 보호 (패널 번들링)',
      privacyDesc: '사용자의 특정 희귀질환 조회 이력이 네트워크에 노출되지 않도록, 개별 변이가 아닌 임상 패널 단위로 일괄 수신합니다.',
      privacyBadge: '프라이버시 보호 상시 활성화',
      privacyStatusTitle: '사용자 조회 정보 완벽 보호 중',
      privacyStatusDesc: '전체 패널을 일괄 수신하므로 네트워크의 다른 노드는 사용자가 어떤 변이를 확인하는지 전혀 알 수 없습니다.',
      integrityTitle: '네트워크 데이터 무결성 보호',
      integrityDesc: '수신된 모든 데이터는 공식 서명과 대조 검증되며, 변조된 데이터는 즉시 격리 및 폐기됩니다.',
      airgapBadge: '로컬 샌드박스 가동',
      activePeersTitle: '연결된 분산 네트워크 노드',
      peerStateSharing: '검증된 데이터 공유 중',
      peerStateVerifying: '수신 및 무결성 검증 중',
    },
    governance: {
      title: '데이터 출처 및 개인정보 보호 체계',
      desc: 'Plasmid는 공공 과학 데이터만을 사용하며, 사용자의 개인 유전체 데이터를 외부로 절대 전송하지 않습니다.',
      tier1Title: '공공 유전체 표준 데이터 (Public Domain)',
      tier1Status: '완전 공개',
      tier1Desc: '미국 국립생명공학정보센터(NCBI)의 ClinVar, dbSNP, RefSeq 및 공공 참조 유전체 데이터로, 전 세계 연구자에게 자유롭게 공개된 공공 데이터입니다.',
      tier2Title: '인구 집단 통계 및 임상 가이드라인',
      tier2Status: '학술 출처 준수',
      tier2Desc: 'Broad Institute의 gnomAD 대립유전자 빈도 데이터와 Stanford CPIC 가이드라인으로, 표준 학술 라이선스 규정에 따라 공식 출처를 명시합니다.',
      tier3Title: '표준 오픈 식별자 연동 체계',
      tier3Status: '표준 상호참조',
      tier3Desc: '저작권 제한이 있는 데이터는 본문을 수집하지 않으며, 전 세계 공통 표준 식별자(ClinVar ID, dbSNP rsID, MIM 번호)만을 연결하여 투명성을 유지합니다.',
      tier4Title: '사용자 개인 유전체 파일 (WGS/VCF)',
      tier4Status: '브라우저 내부 격리',
      tier4Desc: '사용자가 불러오는 개인 유전체 파일은 서버나 네트워크로 절대 전송되지 않습니다. 모든 연산은 사용자의 브라우저 로컬 환경(WebAssembly) 내에서만 안전하게 처리됩니다.',
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
      badgeLocal: 'Open Public Data • Local Browser Processing',
    },
    header: {
      title: 'Plasmid',
      subtitle: 'Decentralized Genomic Wiki & High-Speed Range Streaming',
      tabs: {
        viewer: 'Data Viewer',
        liftover: 'Assembly Liftover',
        wiki: 'Clinical Notes',
        network: 'P2P Network',
        sources: 'Data Sources & Privacy',
      },
    },
    locus: {
      activeLocus: 'Active Genomic Locus',
      targetBuild: 'Reference Genome: GRCh38 (hg38)',
    },
    stream: {
      title: 'Smart Range Streaming Active',
      desc: 'Retrieves only the exact 1 KB variant window needed instead of downloading a full 128 MB file.',
      savingsLabel: 'Network Bandwidth Saved: 95.0%',
      planTitle: 'Genomic Streaming Overview',
      stars: 'Stars',
      dataRange: 'Data Range (Byte Range)',
      indexOffset: 'Index Offset',
      dataBlocks: 'Data Block Numbers',
      license: 'Data License',
      integrityTitle: 'Cryptographic Integrity Verification',
      verified: 'Integrity Verified (Cryptographic Match with Official Source)',
      pending: 'Awaiting Verification',
      verifyBtn: 'Re-verify Integrity',
      verifyingBtn: 'Verifying...',
    },
    liftover: {
      title: 'Genome Assembly Liftover & Integrity Guard',
      desc: 'Safely maps coordinates from legacy assemblies (GRCh37/hg19) to the current standard (GRCh38) with single-nucleotide validation.',
      testToggle: 'Show Coordinate Mismatch Example (+1 bp simulated offset)',
      verifiedTitle: 'Coordinate Integrity Verified',
      verifiedDesc: '100% matched with official genomic anchor mapping.',
      warningTitle: 'Coordinate Mismatch Detected (Safe Halt)',
      warningDesc: 'Reference locus and nucleotide sequence do not match. Coordinate conversion safely suspended.',
      sourceBuild: 'Legacy Build (GRCh37 / hg19)',
      delta: 'Coordinate Shift',
      targetBuild: 'Current Standard (GRCh38 / hg38)',
      deltaNote: 'Validated against UCSC standard chain mapping',
    },
    wiki: {
      reference: 'Reference ID',
      clinicalSignificance: 'Clinical Significance',
      acmgCriteria: 'ACMG/AMP Criteria Tags',
      citationsTitle: 'Evidence-Backed Literature (PubMed Links)',
      citationsNote: 'Indexed by official scientific identifiers (PMID)',
    },
    swarm: {
      title: 'P2P Network & High-Speed Caching',
      desc: 'Distributes frequently accessed clinical panels across local network peers for accelerated loading.',
      activeTopics: '3 Active Clinical Panels',
      packClinvar: 'ClinVar Pathogenic Panel',
      packAcmg: 'ACMG Recommended Gene Panel',
      packCpic: 'Pharmacogenomics Guideline Panel',
      peerStats: 'Peers Active • Fully Cached',
      privacyTitle: 'Query Privacy Protection (Panel Bundling)',
      privacyDesc: 'To prevent network peers from inferring research interest in specific rare conditions, data is transferred in clinical panel bundles rather than individual variants.',
      privacyBadge: 'Privacy Protection Always Active',
      privacyStatusTitle: 'Query Privacy Fully Protected',
      privacyStatusDesc: 'Panels are fetched in bulk; peer nodes have no visibility into which individual variant is being inspected.',
      integrityTitle: 'Network Data Integrity Protection',
      integrityDesc: 'All incoming data is verified against official cryptographic signatures; altered data is automatically quarantined and discarded.',
      airgapBadge: 'Local Sandbox Active',
      activePeersTitle: 'Connected Network Nodes',
      peerStateSharing: 'Sharing Verified Data',
      peerStateVerifying: 'Receiving & Verifying',
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
      tier3Title: 'Open Identifier Standard Cross-Referencing',
      tier3Status: 'Open Identifiers',
      tier3Desc: 'Proprietary narrative texts are never redistributed. Transparent interoperability is maintained through open standard identifiers (ClinVar ID, dbSNP rsID, MIM numbers).',
      tier4Title: 'Private User Genomic Data (WGS/VCF)',
      tier4Status: 'Browser-Isolated',
      tier4Desc: 'Uploaded user files are never sent to external servers or peer networks. All computations run strictly inside your local browser sandbox (WebAssembly).',
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
      badgeLocal: '公共标准数据 • 浏览器本地分析',
    },
    header: {
      title: 'Plasmid',
      subtitle: '去中心化基因组百科与高速切片流引擎',
      tabs: {
        viewer: '数据查看器',
        liftover: '坐标转换与校验',
        wiki: '临床知识百科',
        network: 'P2P 分布式网络',
        sources: '数据来源与隐私',
      },
    },
    locus: {
      activeLocus: '当前查看基因组位点',
      targetBuild: '参考基因组：GRCh38 (hg38)',
    },
    stream: {
      title: '智能区间流式传输已启用',
      desc: '无需下载完整的 128 MB 大文件，仅瞬时读取所需的变异区间（1 KB）。',
      savingsLabel: '网络带宽节省比例：95.0%',
      planTitle: '基因组流式传输详情',
      stars: '星级',
      dataRange: '数据传输范围（Byte Range）',
      indexOffset: '索引偏移位置（Index Offset）',
      dataBlocks: '接收数据块编号',
      license: '数据许可证',
      integrityTitle: '数据完整性校验',
      verified: '密码学校验成功（与官方源数据完全一致）',
      pending: '等待校验',
      verifyBtn: '重新校验',
      verifyingBtn: '校验中...',
    },
    liftover: {
      title: '基因组版本转换与一致性校验',
      desc: '将旧版参考基因组（GRCh37/hg19）坐标安全转换至最新标准（GRCh38），并在单核苷酸精度下验证其一致性。',
      testToggle: '查看坐标不一致示例（+1 bp 模拟误差）',
      verifiedTitle: '坐标一致性校验通过',
      verifiedDesc: '与官方参考基因组锚点位点 100% 匹配。',
      warningTitle: '检测到坐标不一致（安全暂停）',
      warningDesc: '参考位点与核苷酸序列不匹配，已安全停止坐标转换。',
      sourceBuild: '旧版标准（GRCh37 / hg19）',
      delta: '坐标偏移位移',
      targetBuild: '最新标准（GRCh38 / hg38）',
      deltaNote: '基于 UCSC 官方基因组链式映射验证',
    },
    wiki: {
      reference: '参考编号',
      clinicalSignificance: '临床致病性',
      acmgCriteria: 'ACMG/AMP 分类标准',
      citationsTitle: '循证医学学术文献（PubMed 原文链接）',
      citationsNote: '基于官方学术数据库唯一标识符（PMID）',
    },
    swarm: {
      title: 'P2P 分布式网络与高速缓存',
      desc: '通过本地网络节点分布式共享高频临床变异数据包，实现极速加载。',
      activeTopics: '3 个活跃临床数据包',
      packClinvar: 'ClinVar 致病变异数据包',
      packAcmg: 'ACMG 推荐基因数据包',
      packCpic: '药物基因组学指南数据包',
      peerStats: '节点活跃 • 已完成缓存',
      privacyTitle: '查询隐私保护机制（数据包捆绑）',
      privacyDesc: '为防止外部节点推测用户对特定罕见病的查询兴趣，系统按临床面板整体接收，而非单个变异单独请求。',
      privacyBadge: '隐私保护常态化开启',
      privacyStatusTitle: '用户查询意图受完全保护',
      privacyStatusDesc: '整包获取确保外部节点完全无法获知您正在查看哪一个特定变异。',
      integrityTitle: '网络数据完整性保护',
      integrityDesc: '所有接收的数据均与官方数字签名核验，篡改数据将被立即隔离废弃。',
      airgapBadge: '本地沙箱运行',
      activePeersTitle: '已连接分布式节点',
      peerStateSharing: '正在共享已校验数据',
      peerStateVerifying: '正在接收与校验',
    },
    governance: {
      title: '数据来源与个人隐私保护架构',
      desc: 'Plasmid 仅采用经过验证的公共科学数据，绝不将用户的私有基因数据上传至任何服务器。',
      tier1Title: '公共领域基因组标准数据（Public Domain）',
      tier1Status: '完全开源',
      tier1Desc: '来源于美国国家生物技术信息中心（NCBI）的 ClinVar、dbSNP、RefSeq 及公共参考基因组，全球研究人员均可自由使用。',
      tier2Title: '人群频率统计与临床指南',
      tier2Status: '遵循学术引用',
      tier2Desc: '包含 Broad Institute 的 gnomAD 等位基因频率及 Stanford CPIC 指南，严格依照标准学术规范标注来源。',
      tier3Title: '开放标准标识符互通体系',
      tier3Status: '标准相互交叉引用',
      tier3Desc: '受版权限制的文本内容绝不抓取分发，仅通过全球通用标准标识符（ClinVar ID、dbSNP rsID、MIM 编号）实现合规互联。',
      tier4Title: '用户私有基因组文件（WGS/VCF）',
      tier4Status: '浏览器本地完全隔离',
      tier4Desc: '用户上传的基因文件绝不经过任何服务器或 P2P 网络，全部运算在本地浏览器沙箱（WebAssembly）内完成。',
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
      badgeLocal: '公共標準データ • ブラウザ内ローカル処理',
    },
    header: {
      title: 'Plasmid',
      subtitle: '分散型ゲノムWiki＆超高速範囲ストリーミング',
      tabs: {
        viewer: 'データビューア',
        liftover: '座標変換・整合性検証',
        wiki: '臨床知識Wiki',
        network: 'P2P分散ネットワーク',
        sources: 'データソースとプライバシー',
      },
    },
    locus: {
      activeLocus: '閲覧中のゲノム位置',
      targetBuild: '参照ゲノム：GRCh38 (hg38)',
    },
    stream: {
      title: 'スマート範囲ストリーミング稼働中',
      desc: '128 MBのファイル全体をダウンロードせず、必要な変異区間（1 KB）のみを即座に取得します。',
      savingsLabel: 'ネットワーク帯域削減率：95.0%',
      planTitle: 'ゲノムストリーミング詳細',
      stars: '評価',
      dataRange: 'データ転送範囲（Byte Range）',
      indexOffset: 'インデックス位置（Index Offset）',
      dataBlocks: '受信ブロック番号',
      license: 'データライセンス',
      integrityTitle: 'データ完全性検証',
      verified: '暗号化検証完了（公式ソースデータと完全一致）',
      pending: '検証待ち',
      verifyBtn: '完全性を再検証',
      verifyingBtn: '検証中...',
    },
    liftover: {
      title: 'ゲノムアセンブリ座標変換と検証ガード',
      desc: '旧アセンブリ（GRCh37/hg19）の座標を最新標準（GRCh38）に安全に変換し、1塩基単位で整合性を検証します。',
      testToggle: '座標不一致の検示例を確認（+1 bp シミュレーション誤差）',
      verifiedTitle: '座標整合性の検証完了',
      verifiedDesc: '公式参照ゲノムのアンカー位置と100%一致しています。',
      warningTitle: '座標不一致を検知（安全停止）',
      warningDesc: '参照ゲノム位置および塩基配列が一致しないため、座標変換を安全に中断しました。',
      sourceBuild: '旧標準（GRCh37 / hg19）',
      delta: '座標シフト量',
      targetBuild: '最新標準（GRCh38 / hg38）',
      deltaNote: 'UCSC公式チェーンマッピングによる検証済み',
    },
    wiki: {
      reference: '参照ID',
      clinicalSignificance: '臨床的意義',
      acmgCriteria: 'ACMG/AMP 分類基準',
      citationsTitle: '根拠学術論文（PubMed リンク）',
      citationsNote: '公式学術識別子（PMID）に基づく直接リンク',
    },
    swarm: {
      title: 'P2P分散ネットワーク＆高速キャッシュ',
      desc: 'アクセス頻度の高い主要な臨床パネルデータを近隣ノード間で分散共有し、高速ローディングを実現します。',
      activeTopics: '3つのアクティブ臨床パネル',
      packClinvar: 'ClinVar 病原性変異パネル',
      packAcmg: 'ACMG 推奨遺伝子パネル',
      packCpic: '薬理ゲノミクス指針パネル',
      peerStats: 'ピア接続中 • キャッシュ完了',
      privacyTitle: 'クエリプライバシー保護（パネル一括受信）',
      privacyDesc: '特定の希少疾患の閲覧履歴がネットワークに漏洩するのを防ぐため、個別変異ではなく臨床パネル単位で一括受信します。',
      privacyBadge: 'プライバシー保護 常時有効',
      privacyStatusTitle: 'ユーザーの閲覧意図は完全に保護されています',
      privacyStatusDesc: 'パネル全体を一括取得するため、外部ピアにはどの特定変異を閲覧しているかが一切分かりません。',
      integrityTitle: 'ネットワーク完全性保護',
      integrityDesc: '受信したデータはすべて公式署名と照合検証され、改ざんデータは直ちに隔離・破棄されます。',
      airgapBadge: 'ローカルサンドボックス稼働',
      activePeersTitle: '接続済み分散ネットワークノード',
      peerStateSharing: '検証済みデータを共有中',
      peerStateVerifying: '受信および検証中',
    },
    governance: {
      title: 'データソースとプライバシー保護体系',
      desc: 'Plasmidは検証済みの公共科学データのみを使用し、ユーザーの個人ゲノムデータを外部に送信することは一切ありません。',
      tier1Title: '公共ドメインゲノム標準データ（Public Domain）',
      tier1Status: '完全オープン',
      tier1Desc: '米国NCBIのClinVar、dbSNP、RefSeqおよび公共参照ゲノムデータで構成され、世界中の研究者に無償公開されています。',
      tier2Title: '集団統計および臨床ガイドライン',
      tier2Status: '学術的帰属表記',
      tier2Desc: 'Broad InstituteのgnomAD対立遺伝子頻度およびStanford CPICガイドラインを含み、公式な学術引用を明記しています。',
      tier3Title: 'オープン標準識別子による相互参照',
      tier3Status: '標準相互参照',
      tier3Desc: '著作権の存在する本文データは収集・再配布せず、国際標準識別子（ClinVar ID、dbSNP rsID、MIM番号）のみを連携させています。',
      tier4Title: 'ユーザー個人ゲノムファイル（WGS/VCF）',
      tier4Status: 'ブラウザ内完全隔離',
      tier4Desc: 'ユーザーが読み込んだ個人ゲノムデータは、サーバーやP2Pネットワークに一切送信されません。すべての処理はブラウザのローカルサンドボックス（WebAssembly）内で完結します。',
      attributionsTitle: '公式学術データ帰属表記',
      gnomadAttr: 'gnomAD: Genome Aggregation Database (Broad Institute of MIT and Harvard)',
      cpicAttr: 'CPIC: Clinical Pharmacogenetics Implementation Consortium (Stanford University)',
      statementTitle: '研究利用に関する声明',
      statementDesc: 'Plasmidは学術研究および教育目的のオープンソースツールです。医療診断や治療の決定が必要な場合は、専門の医療機関の臨床遺伝専門医にご相談ください。',
    },
  },
}

export interface LocalizedVariant {
  id: string
  label: string
  gene: string
  chrom: string
  pos: number
  ref: string
  alt: string
  hg19Pos: number
  clinvarId: string
  rsId: string
  omimId: string
  significance: string
  stars: number
  reviewStatus: Record<SupportedLanguage, string>
  acmgTags: string[]
  pmids: string[]
  notes: Record<SupportedLanguage, string>
  byteRange: string
  leafOffset: number
  leafLength: number
  chunks: number[]
  merkleRoot: string
  license: string
}

export const LOCALIZED_PRESET_VARIANTS: LocalizedVariant[] = [
  {
    id: 'braf_v600e',
    label: 'BRAF V600E (Melanoma & CRC Hotspot)',
    gene: 'BRAF',
    chrom: 'chr7',
    pos: 140753336,
    ref: 'A',
    alt: 'T',
    hg19Pos: 140453136,
    clinvarId: 'VCV000013961',
    rsId: 'rs113488022',
    omimId: '115150.0001',
    significance: 'Pathogenic',
    stars: 4,
    reviewStatus: {
      ko: '임상 진료 지침 (최고 신뢰도 검증)',
      en: 'Practice guideline (Highest clinical confidence)',
      zh: '临床实践指南（最高置信度标准）',
      ja: '診療ガイドライン（最高信頼度基準）',
    },
    acmgTags: ['PS1', 'PS3', 'PM1', 'PM2', 'PP3'],
    pmids: ['12068308', '20818844', '22663011'],
    notes: {
      ko: 'BRAF 원암유전자의 키나아제 활성화 과오돌연변이입니다. BRAF/MEK 억제제 병용 요법에 대한 임상 반응 근거가 확립되어 있습니다.',
      en: 'Activating missense mutation in the kinase domain of the BRAF proto-oncogene. Well-established clinical response to BRAF/MEK inhibitor combinations.',
      zh: 'BRAF 原癌基因激酶结构域的激活型错义突变。对 BRAF/MEK 抑制剂联合疗法具有明确的临床疗效证据。',
      ja: 'BRAF 原がん遺伝子のキナーゼドメインにおける活性化ミスセンス変異です。BRAF/MEK 阻害薬併用療法に対する確立された臨床エビデンスが存在します。',
    },
    byteRange: 'bytes=1048576-1049600',
    leafOffset: 16384,
    leafLength: 1024,
    chunks: [64, 65],
    merkleRoot: '0x8f2a41d9e2b10098f45a',
    license: 'Public Domain (ClinVar)',
  },
  {
    id: 'tp53_r175h',
    label: 'TP53 R175H (Li-Fraumeni & Multi-Cancer)',
    gene: 'TP53',
    chrom: 'chr17',
    pos: 7676154,
    ref: 'G',
    alt: 'A',
    hg19Pos: 7578406,
    clinvarId: 'VCV000012356',
    rsId: 'rs28934578',
    omimId: '191170.0003',
    significance: 'Pathogenic',
    stars: 3,
    reviewStatus: {
      ko: '전문가 패널 검토 완료 (ClinGen TP53 패널)',
      en: 'Reviewed by expert panel (ClinGen TP53 Panel)',
      zh: '专家组评审完成（ClinGen TP53 专家组）',
      ja: '専門家パネル検証済み（ClinGen TP53 パネル）',
    },
    acmgTags: ['PS1', 'PS3', 'PM1', 'PP3', 'PP5'],
    pmids: ['18511594', '21343900', '29979965'],
    notes: {
      ko: '종양 억제 인자 p53의 DNA 결합 도메인을 파괴하는 구조적 핫스팟 변이입니다. 리-프라우메니 증후군 및 다발성 암과 연관됩니다.',
      en: 'Structural hotspot mutation disrupting the DNA-binding domain of the tumor suppressor p53. Associated with Li-Fraumeni syndrome and multiple cancers.',
      zh: '破坏抑癌蛋白 p53 DNA 结合域的结构热点突变。与李-佛美尼综合征及多种恶性肿瘤紧密相关。',
      ja: 'がん抑制遺伝子 p53 の DNA 結合ドメインを破壊するホットスポット変異です。リー・フラウメニ症候群および各種がんと関連します。',
    },
    byteRange: 'bytes=2097152-2098176',
    leafOffset: 32768,
    leafLength: 1024,
    chunks: [128, 129],
    merkleRoot: '0x43b2f810aa7789ef01c2',
    license: 'Public Domain (ClinVar)',
  },
  {
    id: 'hbb_e6v',
    label: 'HBB rs334 (Sickle Cell Anemia HbS)',
    gene: 'HBB',
    chrom: 'chr11',
    pos: 5227002,
    ref: 'T',
    alt: 'A',
    hg19Pos: 5248232,
    clinvarId: 'VCV000015126',
    rsId: 'rs334',
    omimId: '603903.0001',
    significance: 'Pathogenic',
    stars: 4,
    reviewStatus: {
      ko: '임상 진료 지침 (ACMG / CPIC 가이드라인)',
      en: 'Practice guideline (ACMG / CPIC Actionable)',
      zh: '临床实践指南（ACMG / CPIC 指南推荐）',
      ja: '診療ガイドライン（ACMG / CPIC 推奨）',
    },
    acmgTags: ['PS1', 'PS3', 'PS4', 'PP4'],
    pmids: ['15744018', '24158443', '27043343'],
    notes: {
      ko: '베타-글로빈 유전자의 병원성 전이 변이입니다. 동형접합 시 겸상적혈구 빈혈증을 유발하며, 이형접합 시 말라리아 저항성을 부여합니다.',
      en: 'Pathogenic transversion mutation in the beta-globin chain. Homozygotes manifest sickle cell disease; heterozygotes carry sickle cell trait with malaria resistance.',
      zh: 'β-珠蛋白链中的致病性突变。纯合子引起镰状细胞贫血，杂合子表现为具有疟疾抗性的镰状细胞性状。',
      ja: 'β-グロビン遺伝子の病原性塩基置換変異です。ホモ接合体では鎌状赤血球貧血症を発症し、ヘテロ接合体ではマラリア抵抗性を示します。',
    },
    byteRange: 'bytes=3145728-3146752',
    leafOffset: 49152,
    leafLength: 1024,
    chunks: [192, 193],
    merkleRoot: '0x7e819924df0123cb9981',
    license: 'Public Domain (ClinVar)',
  },
]
