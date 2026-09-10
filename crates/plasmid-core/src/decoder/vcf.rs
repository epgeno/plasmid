use crate::error::{PlasmidCoreError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Structured representation of a genomic variant decoded from a VCF slice.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VcfVariantRecord {
    pub chrom: String,
    pub pos: u64,
    pub id: Option<String>,
    pub reference: String,
    pub alternate: String,
    pub qual: Option<f32>,
    pub filter: String,
    pub info: HashMap<String, String>,
    pub gene: Option<String>,
    pub clinvar_significance: Option<String>,
    pub amino_acid_change: Option<String>,
}

impl VcfVariantRecord {
    /// Returns true if this variant is flagged as Pathogenic or Likely Pathogenic.
    pub fn is_pathogenic(&self) -> bool {
        if let Some(sig) = &self.clinvar_significance {
            let s = sig.to_lowercase();
            s.contains("pathogenic") && !s.contains("conflict") && !s.contains("benign")
        } else {
            false
        }
    }
}

pub struct VcfDecoder;

impl VcfDecoder {
    /// Decodes variant records from a raw UTF-8 or BGZF-decompressed VCF byte slice.
    pub fn decode_slice(data: &[u8]) -> Result<Vec<VcfVariantRecord>> {
        let text = match std::str::from_utf8(data) {
            Ok(s) => s,
            Err(_) => {
                // If invalid utf8, attempt lossy decoding
                return Err(PlasmidCoreError::VcfParse(
                    "Invalid UTF-8 in VCF byte slice".to_string(),
                ));
            }
        };

        let mut records = Vec::new();

        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() < 5 {
                continue;
            }

            let chrom = cols[0].to_string();
            let pos = match cols[1].parse::<u64>() {
                Ok(p) => p,
                Err(_) => continue,
            };

            let id = if cols[2] != "." && !cols[2].is_empty() {
                Some(cols[2].to_string())
            } else {
                None
            };

            let reference = cols[3].to_string();
            let alternate = cols[4].to_string();

            let qual = if cols.len() > 5 && cols[5] != "." {
                cols[5].parse::<f32>().ok()
            } else {
                None
            };

            let filter = if cols.len() > 6 {
                cols[6].to_string()
            } else {
                "PASS".to_string()
            };

            let mut info = HashMap::new();
            let mut gene = None;
            let mut clinvar_significance = None;
            let mut amino_acid_change = None;

            if cols.len() > 7 && cols[7] != "." {
                for item in cols[7].split(';') {
                    let item = item.trim();
                    if item.is_empty() {
                        continue;
                    }

                    if let Some((k, v)) = item.split_once('=') {
                        let k = k.trim().to_string();
                        let v = v.trim().to_string();

                        match k.as_str() {
                            "GENE" => gene = Some(v.clone()),
                            "CLNSIG" | "CLINVAR" => clinvar_significance = Some(v.clone()),
                            "AA" | "HGVSP" => amino_acid_change = Some(v.clone()),
                            _ => {}
                        }

                        info.insert(k, v);
                    } else {
                        info.insert(item.to_string(), "true".to_string());
                    }
                }
            }

            records.push(VcfVariantRecord {
                chrom,
                pos,
                id,
                reference,
                alternate,
                qual,
                filter,
                info,
                gene,
                clinvar_significance,
                amino_acid_change,
            });
        }

        Ok(records)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vcf_decoder_braf() {
        let raw = b"##fileformat=VCFv4.3\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\nchr7\t140453136\trs113488022\tT\tA\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic;AA=p.Val600Glu\n";
        let records = VcfDecoder::decode_slice(raw).unwrap();

        assert_eq!(records.len(), 1);
        let r = &records[0];
        assert_eq!(r.chrom, "chr7");
        assert_eq!(r.pos, 140453136);
        assert_eq!(r.id.as_deref(), Some("rs113488022"));
        assert_eq!(r.reference, "T");
        assert_eq!(r.alternate, "A");
        assert_eq!(r.gene.as_deref(), Some("BRAF"));
        assert_eq!(r.clinvar_significance.as_deref(), Some("Pathogenic"));
        assert_eq!(r.amino_acid_change.as_deref(), Some("p.Val600Glu"));
        assert!(r.is_pathogenic());
    }
}
