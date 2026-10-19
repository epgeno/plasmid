use crate::error::{GovernanceViolationDetails, PlasmidCoreError, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LicenseType {
    PublicDomain,          // 17 U.S.C. § 105 (ClinVar, dbSNP, RefSeq)
    OdbL10,                // Open Database License 1.0 (Broad gnomAD)
    CcBy40,                // Creative Commons Attribution 4.0 (CPIC, PharmGKB)
    Cc0,                   // Creative Commons Zero
    ProprietaryRestricted, // OMIM, COSMIC, HGMD, SNPedia (Blacklisted)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SubmitterStarRating {
    pub stars: u8, // 0 to 4 stars
    pub label: String,
    pub criteria_provided: bool,
}

impl SubmitterStarRating {
    pub fn from_review_status(status: &str) -> Self {
        let clean = status.trim().to_lowercase();
        if clean.contains("practice guideline") || clean.contains("practice_guideline") {
            Self {
                stars: 4,
                label: "Practice guideline (Highest clinical confidence)".to_string(),
                criteria_provided: true,
            }
        } else if clean.contains("expert panel") || clean.contains("reviewed_by_expert_panel") {
            Self {
                stars: 3,
                label: "Reviewed by expert panel".to_string(),
                criteria_provided: true,
            }
        } else if clean.contains("multiple submitters")
            || clean.contains("criteria_provided_multiple_submitters_no_conflicts")
        {
            Self {
                stars: 2,
                label: "Criteria provided, multiple submitters, no conflicts".to_string(),
                criteria_provided: true,
            }
        } else if clean.contains("single submitter")
            || clean.contains("criteria_provided_single_submitter")
        {
            Self {
                stars: 1,
                label: "Criteria provided, single submitter".to_string(),
                criteria_provided: true,
            }
        } else {
            Self {
                stars: 0,
                label: "No assertion criteria provided".to_string(),
                criteria_provided: false,
            }
        }
    }
}

pub const MANDATORY_MEDICAL_DISCLAIMER: &str = "RESEARCH & EDUCATIONAL USE ONLY: This genomic data viewer is an open-source tool for scientific exploration. It is not an FDA/MFDS-approved medical device (SaMD) and must not be used for direct diagnostic purposes, treatment planning, or personal health decisions without review by a certified medical genetics professional.";

pub const GNOMAD_MANDATORY_ATTRIBUTION: &str = "This tool includes data from the gnomAD consortium (Broad Institute). Released under ODbL 1.0 / CC0.";

pub struct DataGovernanceGuard;

impl DataGovernanceGuard {
    /// Validates raw annotation text or VCF metadata against RFC-0003 compliance rules.
    /// Rejects proprietary database scrapes (OMIM, COSMIC, HGMD, SNPedia) and publisher copyright abstracts.
    pub fn validate_annotation_payload(text: &str) -> Result<()> {
        let lower = text.to_lowercase();

        // 1. Blacklist check: OMIM proprietary narrative
        if (lower.contains("omim") || lower.contains("johns hopkins"))
            && (lower.contains("clinical synopsis")
                || lower.contains("copyright (c) johns hopkins"))
        {
            return Err(PlasmidCoreError::DataGovernanceViolation(Box::new(
                GovernanceViolationDetails {
                    source: "OMIM".to_string(),
                    reason: "Proprietary clinical synopsis or copyright notice detected. OMIM narrative text redistribution prohibited under JHU agreement.".to_string(),
                    offending_snippet: extract_snippet(text, "omim"),
                }
            )));
        }

        // 2. Blacklist check: COSMIC proprietary somatic IDs & census
        if lower.contains("catalogue of somatic mutations in cancer")
            || lower.contains("cosmic_id=")
            || lower.contains("cosmic somatic mutation")
            || (lower.contains("qiagen") && lower.contains("cosmic"))
        {
            return Err(PlasmidCoreError::DataGovernanceViolation(Box::new(
                GovernanceViolationDetails {
                    source: "COSMIC".to_string(),
                    reason: "Proprietary COSMIC somatic database markers detected. Commercial distribution strictly licensed by QIAGEN/Sanger.".to_string(),
                    offending_snippet: extract_snippet(text, "cosmic"),
                }
            )));
        }

        // 3. Blacklist check: HGMD proprietary mutation database
        if lower.contains("hgmd_mutation") || lower.contains("human gene mutation database") {
            return Err(PlasmidCoreError::DataGovernanceViolation(Box::new(
                GovernanceViolationDetails {
                    source: "HGMD".to_string(),
                    reason: "Proprietary HGMD database marker detected. Redistribution prohibited by QIAGEN.".to_string(),
                    offending_snippet: extract_snippet(text, "hgmd"),
                }
            )));
        }

        // 4. Blacklist check: SNPedia scraped wiki text
        if lower.contains("snpedia") && (lower.contains("promethease") || lower.contains("repute="))
        {
            return Err(PlasmidCoreError::DataGovernanceViolation(Box::new(
                GovernanceViolationDetails {
                    source: "SNPedia".to_string(),
                    reason: "Scraped SNPedia/Promethease narrative text detected (CC-BY-NC-SA 3.0 restricted).".to_string(),
                    offending_snippet: extract_snippet(text, "snpedia"),
                }
            )));
        }

        // 5. Blacklist check: Publisher-copyrighted full-text abstract bodies
        if lower.contains("all rights reserved. elsevier")
            || lower.contains("springer nature limited")
            || (lower.contains("copyright (c)") && lower.contains("wiley"))
        {
            return Err(PlasmidCoreError::DataGovernanceViolation(Box::new(
                GovernanceViolationDetails {
                    source: "Publisher Copyright".to_string(),
                    reason:
                        "Copyrighted publisher abstract detected. Use PMID/DOI references only."
                            .to_string(),
                    offending_snippet: extract_snippet(text, "copyright"),
                },
            )));
        }

        Ok(())
    }

    /// Validates that ODbL-licensed packs (such as gnomAD) are kept in isolated partitions
    /// and carry the mandatory attribution notice, preventing viral copyleft contamination.
    pub fn validate_odbl_partition(
        license: LicenseType,
        is_isolated_partition: bool,
        attribution_notice: &str,
    ) -> Result<()> {
        if license == LicenseType::OdbL10 {
            if !is_isolated_partition {
                return Err(PlasmidCoreError::DataGovernanceViolation(Box::new(
                    GovernanceViolationDetails {
                        source: "gnomAD (ODbL 1.0)".to_string(),
                        reason: "ODbL data cannot be intertwined with core proprietary tables. Must reside in an isolated pack partition.".to_string(),
                        offending_snippet: "is_isolated_partition = false".to_string(),
                    }
                )));
            }
            if !attribution_notice.contains("gnomAD") {
                return Err(PlasmidCoreError::DataGovernanceViolation(Box::new(
                    GovernanceViolationDetails {
                        source: "gnomAD (ODbL 1.0)".to_string(),
                        reason: "Mandatory attribution notice missing. Must cite gnomAD consortium and ODbL license.".to_string(),
                        offending_snippet: attribution_notice.to_string(),
                    }
                )));
            }
        }
        Ok(())
    }
}

fn extract_snippet(text: &str, needle: &str) -> String {
    let lower = text.to_lowercase();
    if let Some(idx) = lower.find(needle) {
        let start = idx.saturating_sub(30);
        let end = (idx + needle.len() + 50).min(text.len());
        format!("...{}...", text[start..end].replace('\n', " "))
    } else {
        text.chars().take(60).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adversarial_omim_rejection() {
        let toxic_omim_payload = "MIM:115150 - Clinical Synopsis: Copyright (C) Johns Hopkins University. Patient exhibits severe cardiac hypertrophy.";
        let err = DataGovernanceGuard::validate_annotation_payload(toxic_omim_payload).unwrap_err();
        match err {
            PlasmidCoreError::DataGovernanceViolation(details) => {
                assert_eq!(details.source, "OMIM");
                assert!(details.reason.contains("JHU agreement"));
            }
            other => panic!("Expected DataGovernanceViolation, got {other:?}"),
        }
    }

    #[test]
    fn test_adversarial_cosmic_rejection() {
        let toxic_cosmic_payload = "Variant in BRAF gene. COSMIC_ID=COSM476, Catalogue of Somatic Mutations in Cancer. Licensed by QIAGEN.";
        let err =
            DataGovernanceGuard::validate_annotation_payload(toxic_cosmic_payload).unwrap_err();
        match err {
            PlasmidCoreError::DataGovernanceViolation(details) => {
                assert_eq!(details.source, "COSMIC");
                assert!(details.reason.contains("QIAGEN/Sanger"));
            }
            other => panic!("Expected DataGovernanceViolation, got {other:?}"),
        }
    }

    #[test]
    fn test_adversarial_snpedia_rejection() {
        let toxic_snpedia_payload =
            "SNPedia / Promethease export: rs113488022(T;A) repute=Bad, magnitude=6.";
        let err =
            DataGovernanceGuard::validate_annotation_payload(toxic_snpedia_payload).unwrap_err();
        match err {
            PlasmidCoreError::DataGovernanceViolation(details) => {
                assert_eq!(details.source, "SNPedia");
            }
            other => panic!("Expected DataGovernanceViolation, got {other:?}"),
        }
    }

    #[test]
    fn test_public_domain_clinvar_pass() {
        let clean_clinvar_payload = "### ClinVar Variant VCV000013961.5\nPathogenic variant in BRAF (chr7:140453136 T>A). Review status: criteria provided, single submitter. Refer to PMID:12068308.";
        assert!(DataGovernanceGuard::validate_annotation_payload(clean_clinvar_payload).is_ok());
    }

    #[test]
    fn test_odbl_partition_isolation_guard() {
        // Non-isolated partition with ODbL must fail
        let res_fail = DataGovernanceGuard::validate_odbl_partition(
            LicenseType::OdbL10,
            false,
            GNOMAD_MANDATORY_ATTRIBUTION,
        );
        assert!(res_fail.is_err());

        // Isolated partition with valid attribution passes
        let res_ok = DataGovernanceGuard::validate_odbl_partition(
            LicenseType::OdbL10,
            true,
            GNOMAD_MANDATORY_ATTRIBUTION,
        );
        assert!(res_ok.is_ok());
    }

    #[test]
    fn test_submitter_star_ratings() {
        assert_eq!(
            SubmitterStarRating::from_review_status("practice guideline").stars,
            4
        );
        assert_eq!(
            SubmitterStarRating::from_review_status("expert panel").stars,
            3
        );
        assert_eq!(
            SubmitterStarRating::from_review_status("multiple submitters").stars,
            2
        );
        assert_eq!(
            SubmitterStarRating::from_review_status("single submitter").stars,
            1
        );
        assert_eq!(
            SubmitterStarRating::from_review_status("no assertion").stars,
            0
        );
    }
}
