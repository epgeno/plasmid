use crate::chrom::{chrom_to_id, id_to_chrom};
use crate::error::{PlasmidCoreError, Result};
use plasmid_format::{decompress_gzip_bounded, is_gzip_magic};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::collections::HashMap;

/// Maximum uncompressed VCF size (512 MiB) when decoding `.vcf.gz` streams in memory.
pub const MAX_VCF_DECOMPRESSED_BYTES: u64 = 512 * 1024 * 1024;

/// Structured representation of a genomic variant decoded from a VCF or 23andMe slice.
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
    /// Returns true if this variant is flagged as Pathogenic, Likely Pathogenic, Oncogenic, or Likely Oncogenic.
    pub fn is_pathogenic(&self) -> bool {
        if let Some(sig) = &self.clinvar_significance {
            let s = sig.to_lowercase();
            (s.contains("pathogenic") || s.contains("oncogenic"))
                && !s.contains("conflict")
                && !s.contains("benign")
        } else {
            false
        }
    }
}

fn parse_geneinfo_primary_symbol(raw_geneinfo: &str) -> Option<String> {
    let mut fallback: Option<String> = None;
    for pair in raw_geneinfo.split('|') {
        let sym = pair.split(':').next().unwrap_or("").trim();
        if sym.is_empty() {
            continue;
        }
        if fallback.is_none() {
            fallback = Some(sym.to_string());
        }
        if !sym.starts_with("LOC") {
            return Some(sym.to_string());
        }
    }
    fallback
}

fn is_uninformative_or_uncertain_clnsig(sig: &str) -> bool {
    let lower = sig.trim().to_ascii_lowercase();
    lower.is_empty()
        || lower == "."
        || lower == "not_provided"
        || lower == "no_classification_for_the_single_variant"
        || lower == "uncertain_significance"
        || lower.starts_with("conflicting_")
}

pub struct VcfDecoder;

impl VcfDecoder {
    /// Decodes variant records from a raw UTF-8, zero-padded chunk, or Gzip/BGZF (`.vcf.gz`) byte slice.
    pub fn decode_slice(data: &[u8]) -> Result<Vec<VcfVariantRecord>> {
        let trimmed_data = match data.iter().rposition(|&b| b != 0) {
            Some(last) => &data[..=last],
            None => &[],
        };

        let raw_cow: Cow<'_, [u8]> = if is_gzip_magic(trimmed_data) {
            let decompressed = decompress_gzip_bounded(data, MAX_VCF_DECOMPRESSED_BYTES)
                .or_else(|_| decompress_gzip_bounded(trimmed_data, MAX_VCF_DECOMPRESSED_BYTES))
                .map_err(|e| PlasmidCoreError::VcfParse(format!("Invalid .vcf.gz stream: {e}")))?;
            Cow::Owned(decompressed)
        } else {
            Cow::Borrowed(trimmed_data)
        };

        let text = std::str::from_utf8(&raw_cow).map_err(|_| {
            PlasmidCoreError::VcfParse("Invalid UTF-8 in VCF byte slice".to_string())
        })?;

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

            let raw_id_col = cols[2].trim();

            let raw_ref = cols[3].trim();
            let raw_alt = cols[4].trim();
            if raw_ref.is_empty()
                || raw_alt.is_empty()
                || raw_alt == "."
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

            let filter = if cols.len() > 6 && cols[6] != "." {
                cols[6].to_string()
            } else {
                "PASS".to_string()
            };

            let mut info = HashMap::new();
            let mut gene = None;
            let mut geneinfo_symbol = None;
            let mut clinvar_significance: Option<String> = None;
            let mut onc_significance: Option<String> = None;
            let mut amino_acid_change = None;
            let mut rs_from_info: Option<String> = None;

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
                            "GENEINFO" => {
                                geneinfo_symbol = parse_geneinfo_primary_symbol(&v);
                            }
                            "CLNSIG" | "CLINVAR" => clinvar_significance = Some(v.clone()),
                            "ONC" | "SCI" => {
                                if onc_significance.is_none() {
                                    onc_significance = Some(v.clone());
                                }
                            }
                            "AA" | "HGVSP" => amino_acid_change = Some(v.clone()),
                            "CLNHGVS" => {
                                if amino_acid_change.is_none() {
                                    amino_acid_change = Some(v.clone());
                                }
                            }
                            "RS" => {
                                let first_rs = v.split('|').next().unwrap_or("").trim();
                                if !first_rs.is_empty()
                                    && first_rs.bytes().all(|b| b.is_ascii_digit())
                                {
                                    rs_from_info = Some(format!("rs{first_rs}"));
                                } else if first_rs.starts_with("rs") {
                                    rs_from_info = Some(first_rs.to_string());
                                }
                            }
                            _ => {}
                        }

                        info.insert(k, v);
                    } else {
                        info.insert(item.to_string(), "true".to_string());
                    }
                }
            }

            if gene.is_none()
                && let Some(sym) = geneinfo_symbol
            {
                info.entry("GENE".to_string())
                    .or_insert_with(|| sym.clone());
                gene = Some(sym);
            }

            if clinvar_significance
                .as_deref()
                .is_none_or(is_uninformative_or_uncertain_clnsig)
                && let Some(onc) = onc_significance
                && !onc.to_ascii_lowercase().contains("uncertain")
                && !onc.to_ascii_lowercase().contains("benign")
            {
                clinvar_significance = Some(onc);
            }

            let id = if raw_id_col.is_empty() || raw_id_col == "." {
                rs_from_info
            } else if raw_id_col.bytes().all(|b| b.is_ascii_digit()) {
                info.entry("VARIATION_ID".to_string())
                    .or_insert_with(|| raw_id_col.to_string());
                if let Some(rsid) = rs_from_info {
                    Some(rsid)
                } else if let Ok(vcv_num) = raw_id_col.parse::<u64>() {
                    Some(format!("VCV{vcv_num:09}"))
                } else {
                    Some(raw_id_col.to_string())
                }
            } else {
                Some(raw_id_col.to_string())
            };

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
    use plasmid_format::{CompressionCodec, compress_payload};

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
    fn test_vcf_decoder_ncbi_clinvar_schema_and_vcf_gz() {
        let clinvar_vcf = concat!(
            "##fileformat=VCFv4.1\n",
            "##source=ClinVar\n",
            "##reference=GRCh38\n",
            "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n",
            "19\t44908822\t17848\tC\tT\t.\t.\tALLELEID=32885;CLNDN=Hyperlipoproteinemia_type_III;CLNHGVS=NC_000019.10:g.44908822C>T;CLNREVSTAT=reviewed_by_expert_panel;CLNSIG=drug_response;GENEINFO=APOE:348;MC=SO:0001583|missense_variant;RS=7412\n",
            "11\t5227002\t15333\tT\tA\t.\t.\tALLELEID=30381;CLNDN=Sickle_cell_disease;CLNREVSTAT=criteria_provided,_multiple_submitters,_no_conflicts;CLNSIG=Pathogenic;GENEINFO=HBB:3043|LOC106099062:106099062;RS=334\n"
        );
        let gz_bytes = compress_payload(CompressionCodec::Bgzf, clinvar_vcf.as_bytes()).unwrap();
        let records = VcfDecoder::decode_slice(&gz_bytes).unwrap();
        assert_eq!(records.len(), 2);

        assert_eq!(records[0].chrom, "chr19");
        assert_eq!(records[0].id.as_deref(), Some("rs7412"));
        assert_eq!(
            records[0].info.get("VARIATION_ID").map(String::as_str),
            Some("17848")
        );
        assert_eq!(records[0].gene.as_deref(), Some("APOE"));
        assert_eq!(
            records[0].clinvar_significance.as_deref(),
            Some("drug_response")
        );

        assert_eq!(records[1].chrom, "chr11");
        assert_eq!(records[1].id.as_deref(), Some("rs334"));
        assert_eq!(records[1].gene.as_deref(), Some("HBB"));
        assert!(records[1].is_pathogenic());
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

        let bogus_5col = "chr7\t140753336\trs1\t유전자\t변이\t99\tPASS\tGENE=BRAF\n";
        let bogus_records = VcfDecoder::decode_slice(bogus_5col.as_bytes()).unwrap();
        assert!(bogus_records.is_empty());
    }
}
