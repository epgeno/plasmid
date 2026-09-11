# RFC-0003: Biomedical Data Licensing, IP Governance, and Swarm Privacy Safeguards

- **Status:** Approved
- **Authors:** epgeno Architecture & Legal Governance Working Group
- **Created:** 2026-09-11
- **Target Implementation:** `plasmid-format`, `plasmid-swarm`, `apps/web`

---

## 1. Overview & Regulatory Rationale

The Plasmid platform decentralizes genomic variation data, annotation tracks, and slicing engines via P2P swarming. Biomedical knowledge resources present complex intellectual property, database rights, and privacy landscapes. 

This specification establishes the definitive data governance criteria, whitelisting/blacklisting frameworks, and traffic analysis countermeasures for all `.plasmid` containers distributed over the public P2P mesh.

---

## 2. Legal Grounding: Natural Facts vs. Database Rights

### 2.1 Idea-Expression Dichotomy & Non-Copyrightability of Raw Sequence Data
- **Natural Discovery (17 U.S.C. § 102 / *AMP v. Myriad Genetics*, 2013):** Native nucleotide sequences, chromosome positions (`chr7:140453136`), single nucleotide polymorphisms (`rs113488022`), allele changes (`T>A`), and population allele frequencies are physical and mathematical facts of nature. They are not original works of authorship and cannot be copyrighted or patented.
- **US Federal Works Exemption (17 U.S.C. § 105):** Scientific resources created by the National Institutes of Health (NIH), National Center for Biotechnology Information (NCBI), and National Library of Medicine (NLM) are placed directly in the **Public Domain**.

### 2.2 Compilation Copyright & Sui Generis Database Rights
- **Compilation Copyright (US):** While individual facts are free, creative compilation, arrangement, and original narrative clinical commentary (e.g., OMIM disease reviews, curator essays) are protected by copyright.
- **EU Sui Generis Database Right (Directive 96/9/EC):** In the EU and UK, database creators who demonstrate substantial investment in obtaining, verifying, or presenting data hold exclusive rights to prohibit the extraction and re-utilization of substantial parts of the database, regardless of fact copyrightability (*British Horseracing Board v. William Hill*).

---

## 3. Dataset Whitelist & Blacklist Matrix

All data packed into `.plasmid` containers for public P2P swarming must strictly adhere to this matrix:

| Dataset | Source Agency | Legal Classification | Swarm Pack Status | Technical Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **ClinVar** | NIH / NCBI | Public Domain (US Gov) | **WHITELISTED** | Full bundling allowed; display review star status |
| **dbSNP / dbVar** | NIH / NCBI | Public Domain (US Gov) | **WHITELISTED** | Raw rsID and genomic positions |
| **GRCh37 / GRCh38 / T2T** | GRC / NCBI | Public Domain (US Gov) | **WHITELISTED** | 2-bit FASTA slices & chain conversion tables |
| **gnomAD** | Broad Institute | ODbL 1.0 / CC0 | **WHITELISTED (CONDITIONAL)** | Isolated pack partition; mandatory attribution notice |
| **CPIC / PharmGKB** | CPIC Consortium | CC-BY 4.0 | **WHITELISTED** | Pharmacogenomic guidelines with attribution |
| **ACMG SF 81 List** | ACMG | Scientific Guideline | **WHITELISTED** | Factual gene symbol list only; no proprietary text |
| **OMIM** | Johns Hopkins Univ. | Proprietary (Fee Required) | **STRICT BLACKLIST** | Never extract or bundle; hyperlink via `MIM:ID` only |
| **COSMIC** | Sanger / QIAGEN | Proprietary Commercial | **STRICT BLACKLIST** | Never extract or bundle; hyperlink via URL only |
| **HGMD** | QIAGEN | Proprietary Commercial | **STRICT BLACKLIST** | Absolute exclusion |
| **SNPedia Articles** | MyHeritage | CC-BY-NC-SA 3.0 (Restricted) | **STRICT BLACKLIST** | Never scrape or redistribute wiki narrative text |
| **PubMed Abstracts** | Publishers / NLM | Publisher Copyrighted | **STRICT BLACKLIST** | Reference by `PMID` / `DOI` metadata only |
| **User Personal Genomes** | Individual Data Subject | GDPR Art. 9 / Sensitive Data | **ABSOLUTE AIR-GAP** | Zero swarm transmission; local OPFS/WASM only |

---

## 4. Adversarial Threat Vectors & Countermeasures

### 4.1 ODbL Viral License Contamination
- **Threat:** Merging gnomAD allele frequencies into composite binary tables could be construed as creating a "Derived Database" under ODbL §4.4, virally forcing downstream clinical annotators to open-source private clinical interpretation databases.
- **Countermeasure:** Architectural Pack Isolation. gnomAD data must reside in a distinct container or isolated sub-table (`pack_category: PopulationFrequency`). Downstream applications consume gnomAD as a collective component rather than an inseparable derivative database.

### 4.2 Swarm Query Side-Channel Attack (Traffic Analysis & Deanonymization)
- **Threat:** If an end-user's client requests a single 16KB leaf chunk covering a rare genetic disorder mutation (e.g., Huntington's `HTT` or early-onset Alzheimer's `PSEN1`), malicious swarm peers logging chunk request hashes can infer the user's carrier status.
- **Countermeasure:** **Mandatory Coarse-Grained Swarming & Oblivious Slicing.**
  1. Clients MUST NOT request isolated fine-grained variant chunks.
  2. Public swarms operate exclusively on coarse-grained, high-density packs (~50MB `ClinVarPathogenic`, ~15MB `AcmgSecondaryFindings`).
  3. Clients download and cache the entire high-density pack, locally performing in-memory variant slicing via WASM. Swarm peers only observe participation in broad public clinical panels, preserving k-anonymity.

### 4.3 SaMD (Software as a Medical Device) Regulatory Liability
- **Threat:** Providing direct risk interpretations ("You have an 80% risk of hereditary cancer") classifies the software as a regulated medical device (FDA 21 CFR 820 / EU IVDR), subjecting the open-source repository to regulatory injunctions.
- **Countermeasure:** Pure Scientific Data Viewer positioning.
  1. Plasmid displays verbatim submitter consensus and raw ACMG/AMP classifications (Pathogenic, Likely Pathogenic, VUS, Likely Benign, Benign).
  2. Explicit rendering of ClinVar Gold Star review tiers (0: no assertion, 1: single submitter, 2: multiple submitters with criteria, 3: expert panel, 4: practice guideline).
  3. Mandatory non-diagnostic research disclaimer rendered in all client interfaces.

---

## 5. Compliance & Ingestion Gate

Any pull request or script adding new annotation sources to `plasmid` must provide:
1. Verifiable Public Domain (CC0 / 17 U.S.C. § 105) or permissive open license proof.
2. Absence of publisher-copyrighted abstracts or proprietary curation summaries.
3. Isolated pack metadata definition preventing ODbL / copyleft entanglement.
