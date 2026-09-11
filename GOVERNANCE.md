# Plasmid Project Governance

This document outlines the governance model, decision-making process, and clinical SSOT preservation principles for the **Plasmid** project under `epgeno`.

---

## 🏛️ Principles & Mission

1. **Decentralization Without Anarchy**: We empower researchers and individuals with peer-to-peer data distribution while rigorously protecting clinical truth.
2. **Deterministic Clinical SSOT**: Unlike general encyclopedias, genomic variant pathogenicity directly impacts medical decisions. Human consensus from ClinVar and ACMG standards forms an immutable base layer that cannot be overwritten by arbitrary wiki edits.
3. **Zero-Knowledge Air-Gap**: The project governance guarantees that no code shall ever be merged that transmits private, non-consensual genomic sequences over public networks.

---

## 👥 Roles & Responsibilities

### Contributors
Anyone who submits issues, pull requests, documentation updates, or genomic literature reviews.

### Maintainers
Maintainers are responsible for reviewing pull requests, managing release tags, maintaining CI/CD infrastructure, and upholding code and security standards.

### Genomic Editorial Board
Bioinformatics researchers and clinical geneticists responsible for auditing automated ClinVar sync pipelines and reviewing community-submitted literature links.

---

## 🛡️ Clinical Data Integrity & Anti-Vandalism Policy

To prevent dangerous medical misinformation or deliberate vandalism:

* **Tier 1 (Immutable Clinical Baseline)**: Pathogenicity classifications (`Pathogenic`, `Likely Pathogenic`, `VUS`, `Benign`) are cryptographically anchored to official NCBI ClinVar and ACMG release archives. These records are read-only.
* **Tier 2 (Community Literature Reviews)**: Community annotations (GWAS studies, functional assay papers, case reports) are managed through **GitHub PR peer-review or signed cryptographic attestations**.
* No anonymous direct write access is permitted to variant interpretation headers.

---

## 📜 Decision-Making & RFC Process

Significant architectural or cryptographic changes follow the RFC (Request for Comments) lifecycle:

1. **Draft**: Proposed as a PR against `docs/rfc/`.
2. **Review & Adversarial Stress Testing**: Open review by maintainers and community. Must pass a dedicated adversarial red-teaming assessment (e.g. Byzantine swarm peers, coordinate drift, browser OOM).
3. **Accepted**: Approved by consensus of maintainers.
4. **Implemented**: Code lands in `main` satisfying all test gates.
5. **Final**: Tagged in a public release.
