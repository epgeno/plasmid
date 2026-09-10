use crate::error::{PlasmidCoreError, Result};
use serde::{Deserialize, Serialize};

/// Decoded ClinVar or wiki annotation block.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AnnotationRecord {
    pub title: String,
    pub content: String,
    pub acmg_criteria: Vec<String>,
    pub pubmed_ids: Vec<String>,
}

pub struct AnnotationDecoder;

impl AnnotationDecoder {
    /// Decodes an annotation chunk from markdown or structured text.
    pub fn decode(data: &[u8]) -> Result<AnnotationRecord> {
        let text = std::str::from_utf8(data).map_err(|e| {
            PlasmidCoreError::Serialization(format!("Invalid UTF-8 in annotation: {e}"))
        })?;

        let mut title = String::new();
        let mut acmg_criteria = Vec::new();
        let mut pubmed_ids = Vec::new();

        for line in text.lines() {
            let trimmed = line.trim();
            if title.is_empty() && (trimmed.starts_with('#') || trimmed.starts_with("###")) {
                title = trimmed.trim_start_matches('#').trim().to_string();
            }

            // Detect ACMG criteria (e.g., PVS1, PS1..4, PM1..6, PP1..5, BA1, BS1..4, BP1..7)
            for word in trimmed
                .split(|c: char| c.is_whitespace() || c == ',' || c == ';' || c == '[' || c == ']')
            {
                let w = word.trim();
                if is_acmg_code(w) && !acmg_criteria.contains(&w.to_string()) {
                    acmg_criteria.push(w.to_string());
                }

                // Detect PubMed IDs (PMID: 12345678 or pubmed/12345678)
                if let Some(rest) = w.strip_prefix("PMID:").or_else(|| w.strip_prefix("pmid:")) {
                    let id = rest.trim_matches(|c: char| !c.is_ascii_digit()).to_string();
                    if !id.is_empty() && !pubmed_ids.contains(&id) {
                        pubmed_ids.push(id);
                    }
                }
            }
        }

        if title.is_empty() {
            title = "Genomic Annotation".to_string();
        }

        Ok(AnnotationRecord {
            title,
            content: text.to_string(),
            acmg_criteria,
            pubmed_ids,
        })
    }
}

fn is_acmg_code(s: &str) -> bool {
    let prefixes = ["PVS", "PS", "PM", "PP", "BA", "BS", "BP"];
    for p in prefixes {
        if let Some(rest) = s.strip_prefix(p) {
            return rest.len() == 1 && rest.chars().all(|c| c.is_ascii_digit());
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_annotation_decode() {
        let md = b"### BRAF V600E Mutation\nPathogenic variant (ACMG: [PS1, PS3, PM1, PM2, PP3]).\nRefer to PMID:12068308 and PMID:22818981.";
        let res = AnnotationDecoder::decode(md).unwrap();

        assert_eq!(res.title, "BRAF V600E Mutation");
        assert_eq!(res.acmg_criteria, vec!["PS1", "PS3", "PM1", "PM2", "PP3"]);
        assert_eq!(res.pubmed_ids, vec!["12068308", "22818981"]);
    }
}
