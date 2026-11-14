use crate::chrom::{chrom_to_id, id_to_chrom};
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
        let trimmed_data = match data.iter().rposition(|&b| b != 0) {
            Some(last) => &data[..=last],
            None => &[],
        };

        let text = match std::str::from_utf8(trimmed_data) {
            Ok(s) => s,
            Err(_) => {
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
            if cols.len() == 4 {
                let raw_id = cols[0].trim();
                let chrom = match chrom_to_id(cols[1]) {
                    Ok(cid) => id_to_chrom(cid),
                    Err(_) => continue,
                };
                let pos = match cols[2].trim().parse::<u64>() {
                    Ok(p) if p > 0 => p,
                    _ => continue,
                };
                let gt = cols[3].trim().to_uppercase();
                if gt.is_empty()
                    || gt == "--"
                    || gt == "00"
                    || gt == "."
                    || !gt
                        .chars()
                        .all(|c| matches!(c, 'A' | 'C' | 'G' | 'T' | 'I' | 'D'))
                {
                    continue;
                }
                let reference = gt[0..1].to_string();
                let alternate = if gt.len() > 1 && gt[1..] != gt[0..1] {
                    gt[1..].to_string()
                } else {
                    reference.clone()
                };
                let id = if !raw_id.is_empty() && raw_id != "." {
                    Some(raw_id.to_string())
                } else {
                    None
                };
                let mut info = HashMap::new();
                info.insert("GT".to_string(), gt);
                records.push(VcfVariantRecord {
                    chrom,
                    pos,
                    id,
                    reference,
                    alternate,
                    qual: None,
                    filter: "PASS".to_string(),
                    info,
                    gene: None,
                    clinvar_significance: None,
                    amino_acid_change: None,
                });
                continue;
            }

            if cols.len() < 5 {
                continue;
            }

            let chrom = chrom_to_id(cols[0])
                .map(id_to_chrom)
                .unwrap_or_else(|_| cols[0].to_string());
            let pos = match cols[1].parse::<u64>() {
                Ok(p) if p > 0 => p,
                _ => continue,
            };

            let id = if cols[2] != "." && !cols[2].is_empty() {
                Some(cols[2].to_string())
            } else {
                None
            };

            let raw_ref = cols[3].trim();
            let raw_alt = cols[4].trim();
            if raw_ref.is_empty()
                || raw_alt.is_empty()
                || !raw_ref.bytes().all(|b| {
                    matches!(
                        b.to_ascii_uppercase(),
                        b'A' | b'C'
                            | b'G'
                            | b'T'
                            | b'N'
                            | b'U'
                            | b'R'
                            | b'Y'
                            | b'S'
                            | b'W'
                            | b'K'
                            | b'M'
                            | b'B'
                            | b'D'
                            | b'H'
                            | b'V'
                            | b'.'
                    )
                })
                || !raw_alt
                    .bytes()
                    .all(|b| b.is_ascii_graphic() && b != b'\t' && b != b' ')
            {
                continue;
            }

            let reference = raw_ref.to_string();
            let alternate = raw_alt.to_string();

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

            if cols.len() >= 10 && cols[8] != "." && cols[9] != "." {
                for (fmt_key, sample_val) in cols[8].split(':').zip(cols[9].split(':')) {
                    let fk = fmt_key.trim();
                    let sv = sample_val.trim();
                    if !fk.is_empty() && !sv.is_empty() && sv != "." {
                        info.entry(fk.to_string()).or_insert_with(|| sv.to_string());
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

    #[test]
    fn test_vcf_decoder_multi_variant_and_zero_padded_chunk() {
        let mut chunk = vec![0u8; 16384];
        let payload = concat!(
            "chr7\t140453136\trs113488022\tT\tA\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic\n",
            "chr7\t140453200\trs9999999\tG\tC\t90\tPASS\tGENE=BRAF;CLNSIG=Benign"
        )
        .as_bytes();
        chunk[..payload.len()].copy_from_slice(payload);

        let records = VcfDecoder::decode_slice(&chunk).unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].pos, 140453136);
        assert_eq!(
            records[0].clinvar_significance.as_deref(),
            Some("Pathogenic")
        );
        assert_eq!(records[1].pos, 140453200);
        assert_eq!(records[1].clinvar_significance.as_deref(), Some("Benign"));
    }

    #[test]
    fn test_vcf_decoder_unprefixed_chrom_format_sample_and_tsv() {
        let personal_vcf = concat!(
            "##fileformat=VCFv4.2\n",
            "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tPATIENT01\n",
            "1\t55051215\trs28362286\tC\tA\t99\tPASS\tGENE=PCSK9;CLNSIG=Benign\tGT:DP:GQ\t0/1:42:99\n",
            "X\t154030500\trs1050828\tC\tT\t95\tPASS\tGENE=G6PD;CLNSIG=Pathogenic\tGT:DP\t1/1:38\n"
        );
        let records = VcfDecoder::decode_slice(personal_vcf.as_bytes()).unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].chrom, "chr1");
        assert_eq!(records[0].info.get("GT").map(String::as_str), Some("0/1"));
        assert_eq!(records[0].info.get("DP").map(String::as_str), Some("42"));
        assert_eq!(records[1].chrom, "chrX");
        assert_eq!(records[1].info.get("GT").map(String::as_str), Some("1/1"));
        assert!(records[1].is_pathogenic());

        let tsv = concat!(
            "# rsid\tchromosome\tposition\tgenotype\n",
            "rs1800562\t6\t26092913\tGA\n",
            "rs000000\t6\t26093000\t--\n"
        );
        let tsv_records = VcfDecoder::decode_slice(tsv.as_bytes()).unwrap();
        assert_eq!(tsv_records.len(), 1);
        assert_eq!(tsv_records[0].chrom, "chr6");
        assert_eq!(tsv_records[0].pos, 26092913);
        assert_eq!(tsv_records[0].id.as_deref(), Some("rs1800562"));
        assert_eq!(tsv_records[0].reference, "G");
        assert_eq!(tsv_records[0].alternate, "A");
        assert_eq!(
            tsv_records[0].info.get("GT").map(String::as_str),
            Some("GA")
        );

        // Non-ASCII 5-column TSV must NOT be accepted as valid VCF REF/ALT bases
        let bogus_5col = "chr7\t140753336\trs1\t유전자\t변이\t99\tPASS\tGENE=BRAF\n";
        let bogus_records = VcfDecoder::decode_slice(bogus_5col.as_bytes()).unwrap();
        assert!(bogus_records.is_empty());
    }
}
