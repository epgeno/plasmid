use crate::chrom::{chrom_to_id, id_to_chrom};
use crate::decoder::FastaDecoder;
use crate::error::{CoordinateDriftDetails, PlasmidCoreError, Result, UnmappedCoordinateDetails};
use plasmid_format::decompress_zstd_bounded;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, OnceLock};

const EMBEDDED_HG19_TO_HG38_CHAIN_ZST: &[u8] = include_bytes!("../data/hg19_to_hg38_chain.bin.zst");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GenomeBuild {
    GRCh37, // hg19
    GRCh38, // hg38
}

impl std::fmt::Display for GenomeBuild {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::GRCh37 => write!(f, "GRCh37 (hg19)"),
            Self::GRCh38 => write!(f, "GRCh38 (hg38)"),
        }
    }
}

/// Verified NCBI dbSNP / ClinVar benchmark Anchor SNP used to auto-detect genome build
/// on headerless microarray exports and verify reference allele consistency.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AnchorSnp {
    pub rsid: &'static str,
    pub gene: &'static str,
    pub chrom: &'static str,
    pub chrom_id: u16,
    pub hg19_pos: u64,
    pub hg38_pos: u64,
    pub ref_base: &'static str,
    pub alt_base: &'static str,
}

pub const CURATED_ANCHOR_SNPS: &[AnchorSnp] = &[
    AnchorSnp {
        rsid: "rs1801133",
        gene: "MTHFR",
        chrom: "chr1",
        chrom_id: 1,
        hg19_pos: 11856378,
        hg38_pos: 11796321,
        ref_base: "G",
        alt_base: "A",
    },
    AnchorSnp {
        rsid: "rs6025",
        gene: "F5",
        chrom: "chr1",
        chrom_id: 1,
        hg19_pos: 169519049,
        hg38_pos: 169549811,
        ref_base: "C",
        alt_base: "T",
    },
    AnchorSnp {
        rsid: "rs1800562",
        gene: "HFE",
        chrom: "chr6",
        chrom_id: 6,
        hg19_pos: 26093141,
        hg38_pos: 26092913,
        ref_base: "G",
        alt_base: "A",
    },
    AnchorSnp {
        rsid: "rs121434568",
        gene: "EGFR",
        chrom: "chr7",
        chrom_id: 7,
        hg19_pos: 55259515,
        hg38_pos: 55191822,
        ref_base: "T",
        alt_base: "G",
    },
    AnchorSnp {
        rsid: "rs113488022",
        gene: "BRAF",
        chrom: "chr7",
        chrom_id: 7,
        hg19_pos: 140453136,
        hg38_pos: 140753336,
        ref_base: "A",
        alt_base: "T",
    },
    AnchorSnp {
        rsid: "rs4244285",
        gene: "CYP2C19",
        chrom: "chr10",
        chrom_id: 10,
        hg19_pos: 96541616,
        hg38_pos: 94781859,
        ref_base: "G",
        alt_base: "A",
    },
    AnchorSnp {
        rsid: "rs334",
        gene: "HBB",
        chrom: "chr11",
        chrom_id: 11,
        hg19_pos: 5248232,
        hg38_pos: 5227002,
        ref_base: "T",
        alt_base: "A",
    },
    AnchorSnp {
        rsid: "rs121913527",
        gene: "KRAS",
        chrom: "chr12",
        chrom_id: 12,
        hg19_pos: 25398284,
        hg38_pos: 25245350,
        ref_base: "C",
        alt_base: "A",
    },
    AnchorSnp {
        rsid: "rs4149056",
        gene: "SLCO1B1",
        chrom: "chr12",
        chrom_id: 12,
        hg19_pos: 21331549,
        hg38_pos: 21178615,
        ref_base: "T",
        alt_base: "C",
    },
    AnchorSnp {
        rsid: "rs671",
        gene: "ALDH2",
        chrom: "chr12",
        chrom_id: 12,
        hg19_pos: 112241766,
        hg38_pos: 111803962,
        ref_base: "G",
        alt_base: "A",
    },
    AnchorSnp {
        rsid: "rs80359550",
        gene: "BRCA2",
        chrom: "chr13",
        chrom_id: 13,
        hg19_pos: 32914437,
        hg38_pos: 32340300,
        ref_base: "GT",
        alt_base: "G",
    },
    AnchorSnp {
        rsid: "rs11540652",
        gene: "TP53",
        chrom: "chr17",
        chrom_id: 17,
        hg19_pos: 7577538,
        hg38_pos: 7674220,
        ref_base: "C",
        alt_base: "T",
    },
    AnchorSnp {
        rsid: "rs28934578",
        gene: "TP53",
        chrom: "chr17",
        chrom_id: 17,
        hg19_pos: 7578406,
        hg38_pos: 7675088,
        ref_base: "C",
        alt_base: "T",
    },
    AnchorSnp {
        rsid: "rs80357906",
        gene: "BRCA1",
        chrom: "chr17",
        chrom_id: 17,
        hg19_pos: 41209079,
        hg38_pos: 43057062,
        ref_base: "T",
        alt_base: "TG",
    },
    AnchorSnp {
        rsid: "rs429358",
        gene: "APOE",
        chrom: "chr19",
        chrom_id: 19,
        hg19_pos: 45411941,
        hg38_pos: 44908684,
        ref_base: "T",
        alt_base: "C",
    },
    AnchorSnp {
        rsid: "rs7412",
        gene: "APOE",
        chrom: "chr19",
        chrom_id: 19,
        hg19_pos: 45412079,
        hg38_pos: 44908822,
        ref_base: "C",
        alt_base: "T",
    },
];

/// Ungapped syntenic interval mapping between GRCh37 (hg19) and GRCh38 (hg38).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LiftoverInterval {
    pub chrom_id: u16,
    pub src_start: u64,
    pub src_end: u64,
    pub dst_start: u64,
    pub dst_end: u64,
    pub strand: char,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LiftoverResult {
    pub original_build: GenomeBuild,
    pub target_build: GenomeBuild,
    pub original_chrom: String,
    pub original_pos: u64,
    pub lifted_chrom: String,
    pub lifted_pos: u64,
    pub ref_allele: String,
    pub sequence_fingerprint_verified: bool,
    pub gene_hint: Option<String>,
}

/// Adversarial Coordinate Guard to protect against coordinate confusion and false clinical diagnoses.
pub struct CoordinateGuard;

impl CoordinateGuard {
    /// Detects whether an input variant list matches GRCh37 or GRCh38 using verified anchor markers.
    pub fn detect_build(variants: &[(String, u64)]) -> Option<GenomeBuild> {
        let mut hg19_matches = 0;
        let mut hg38_matches = 0;

        for (chrom, pos) in variants {
            let Ok(cid) = chrom_to_id(chrom) else {
                continue;
            };
            for anchor in CURATED_ANCHOR_SNPS {
                if cid == anchor.chrom_id {
                    if *pos == anchor.hg19_pos {
                        hg19_matches += 1;
                    } else if *pos == anchor.hg38_pos {
                        hg38_matches += 1;
                    }
                }
            }
        }

        if hg38_matches > hg19_matches {
            Some(GenomeBuild::GRCh38)
        } else if hg19_matches > hg38_matches {
            Some(GenomeBuild::GRCh37)
        } else {
            None
        }
    }

    /// Verifies reference base consistency against target reference sequence slice.
    pub fn verify_ref_fingerprint(
        rsid: &str,
        chrom: &str,
        pos: u64,
        ref_allele: &str,
        reference_slice: &str,
        slice_start_pos: u64,
        target_build: GenomeBuild,
    ) -> Result<()> {
        if pos < slice_start_pos {
            return Ok(());
        }
        let offset = (pos - slice_start_pos) as usize;
        let ref_bytes = ref_allele.as_bytes();
        let slice_bytes = reference_slice.as_bytes();
        if offset + ref_bytes.len() <= slice_bytes.len() {
            let target_bytes = &slice_bytes[offset..offset + ref_bytes.len()];
            if !target_bytes.eq_ignore_ascii_case(ref_bytes) {
                return Err(PlasmidCoreError::CoordinateDriftMismatch(Box::new(
                    CoordinateDriftDetails {
                        rsid: rsid.to_string(),
                        chrom: chrom.to_string(),
                        pos,
                        found: ref_allele.to_string(),
                        expected: String::from_utf8_lossy(target_bytes).into_owned(),
                        target_build: target_build.to_string(),
                    },
                )));
            }
        }
        Ok(())
    }

    /// Verifies that a queried locus coordinate & allele match the authoritative container VCF locus
    /// (and FASTA reference slice when available), blocking +/- bp coordinate drift without synthetic strings.
    #[allow(clippy::too_many_arguments)]
    pub fn verify_locus_consistency(
        rsid: &str,
        chrom: &str,
        queried_pos: u64,
        asserted_ref: &str,
        authoritative_pos: u64,
        authoritative_ref: &str,
        reference_slice: Option<&str>,
        slice_start_pos: u64,
        target_build: GenomeBuild,
    ) -> Result<()> {
        if let Some(seq) = reference_slice {
            Self::verify_ref_fingerprint(
                rsid,
                chrom,
                queried_pos,
                asserted_ref,
                seq,
                slice_start_pos,
                target_build,
            )?;
        }

        if queried_pos != authoritative_pos || !asserted_ref.eq_ignore_ascii_case(authoritative_ref)
        {
            let expected = if queried_pos != authoritative_pos {
                format!("{authoritative_ref}@{authoritative_pos}")
            } else {
                authoritative_ref.to_string()
            };
            return Err(PlasmidCoreError::CoordinateDriftMismatch(Box::new(
                CoordinateDriftDetails {
                    rsid: rsid.to_string(),
                    chrom: chrom.to_string(),
                    pos: queried_pos,
                    found: format!("{asserted_ref}@{queried_pos}"),
                    expected,
                    target_build: target_build.to_string(),
                },
            )));
        }

        Ok(())
    }
}

#[derive(Debug)]
struct ChainIndexData {
    src_sorted: Vec<LiftoverInterval>,
    dst_order: Vec<u32>,
}

fn decode_embedded_ucsc_chain() -> Arc<ChainIndexData> {
    static CACHE: OnceLock<Arc<ChainIndexData>> = OnceLock::new();
    CACHE
        .get_or_init(|| {
            let raw = decompress_zstd_bounded(EMBEDDED_HG19_TO_HG38_CHAIN_ZST, 16 * 1024 * 1024)
                .expect("embedded hg19_to_hg38_chain.bin.zst must decompress cleanly");
            assert!(
                raw.len() >= 12 && &raw[0..8] == b"PLCHAIN1",
                "invalid embedded PLCHAIN1 header"
            );
            let count = u32::from_le_bytes(raw[8..12].try_into().unwrap()) as usize;
            assert_eq!(
                raw.len(),
                12 + count * 14,
                "corrupted embedded PLCHAIN1 payload length"
            );

            let mut src_sorted = Vec::with_capacity(count);
            let mut prev_cid = 0u16;
            let mut prev_src = 0i64;
            let mut prev_dst = 0i64;

            for i in 0..count {
                let off = 12 + i * 14;
                let cid = raw[off] as u16;
                let strand_code = raw[off + 1];
                let d_src = i32::from_le_bytes(raw[off + 2..off + 6].try_into().unwrap()) as i64;
                let size = u32::from_le_bytes(raw[off + 6..off + 10].try_into().unwrap()) as u64;
                let d_dst = i32::from_le_bytes(raw[off + 10..off + 14].try_into().unwrap()) as i64;

                if cid != prev_cid {
                    prev_cid = cid;
                    prev_src = 0;
                    prev_dst = 0;
                }

                let src_start = (prev_src + d_src) as u64;
                let src_end = src_start + size - 1;
                let dst_anchor = (prev_dst + d_dst) as u64;

                let (dst_start, dst_end, strand) = if strand_code == 0 {
                    (dst_anchor, dst_anchor + size - 1, '+')
                } else {
                    (dst_anchor - size + 1, dst_anchor, '-')
                };

                src_sorted.push(LiftoverInterval {
                    chrom_id: cid,
                    src_start,
                    src_end,
                    dst_start,
                    dst_end,
                    strand,
                });

                prev_src = (src_start + size) as i64;
                prev_dst = if strand_code == 0 {
                    (dst_anchor + size) as i64
                } else {
                    dst_anchor as i64 - size as i64
                };
            }

            let mut dst_order: Vec<u32> = (0..count as u32).collect();
            dst_order.sort_by_key(|&idx| {
                let iv = &src_sorted[idx as usize];
                (iv.chrom_id, iv.dst_start)
            });

            Arc::new(ChainIndexData {
                src_sorted,
                dst_order,
            })
        })
        .clone()
}

/// Realtime Whole-Genome Liftover Engine backed by UCSC `hg19ToHg38.over.chain` syntenic alignments.
#[derive(Clone)]
pub struct LiftoverEngine {
    chain: Arc<ChainIndexData>,
}

impl Default for LiftoverEngine {
    fn default() -> Self {
        Self::new_with_curated_regions()
    }
}

impl LiftoverEngine {
    /// Creates an empty engine with zero intervals (for fail-closed unmapped coordinate tests).
    pub fn new() -> Self {
        Self {
            chain: Arc::new(ChainIndexData {
                src_sorted: Vec::new(),
                dst_order: Vec::new(),
            }),
        }
    }

    /// Returns an engine backed by the embedded 25-chromosome UCSC `hg19ToHg38` alignment chain.
    pub fn new_with_curated_regions() -> Self {
        Self {
            chain: decode_embedded_ucsc_chain(),
        }
    }

    pub fn interval_count(&self) -> usize {
        self.chain.src_sorted.len()
    }

    pub fn add_interval(&mut self, interval: LiftoverInterval) {
        let mut intervals = self.chain.src_sorted.clone();
        intervals.push(interval);
        intervals.sort_by_key(|i| (i.chrom_id, i.src_start));
        let mut dst_order: Vec<u32> = (0..intervals.len() as u32).collect();
        dst_order.sort_by_key(|&idx| {
            let iv = &intervals[idx as usize];
            (iv.chrom_id, iv.dst_start)
        });
        self.chain = Arc::new(ChainIndexData {
            src_sorted: intervals,
            dst_order,
        });
    }

    fn find_src_interval(&self, chrom_id: u16, pos: u64) -> Option<&LiftoverInterval> {
        let slice = &self.chain.src_sorted;
        let idx = slice.partition_point(|iv| (iv.chrom_id, iv.src_start) <= (chrom_id, pos));
        if idx == 0 {
            return None;
        }
        let cand = &slice[idx - 1];
        if cand.chrom_id == chrom_id && pos >= cand.src_start && pos <= cand.src_end {
            Some(cand)
        } else {
            None
        }
    }

    fn find_dst_interval(&self, chrom_id: u16, pos: u64) -> Option<&LiftoverInterval> {
        let order = &self.chain.dst_order;
        let slice = &self.chain.src_sorted;
        let idx = order.partition_point(|&i| {
            let iv = &slice[i as usize];
            (iv.chrom_id, iv.dst_start) <= (chrom_id, pos)
        });
        if idx == 0 {
            return None;
        }
        let cand = &slice[order[idx - 1] as usize];
        if cand.chrom_id == chrom_id && pos >= cand.dst_start && pos <= cand.dst_end {
            Some(cand)
        } else {
            None
        }
    }

    /// Translates GRCh37 (hg19) coordinate to GRCh38 (hg38) via UCSC syntenic chain binary search.
    pub fn lift_hg19_to_hg38(
        &self,
        chrom_name: &str,
        pos: u64,
        ref_allele: &str,
    ) -> Result<LiftoverResult> {
        let chrom_id = chrom_to_id(chrom_name)?;

        match self.find_src_interval(chrom_id, pos) {
            Some(inv) => {
                let offset = pos - inv.src_start;
                let (lifted_pos, lifted_ref) = if inv.strand == '+' {
                    (inv.dst_start + offset, ref_allele.to_string())
                } else {
                    (
                        inv.dst_end - offset,
                        FastaDecoder::reverse_complement(ref_allele),
                    )
                };

                let matched_anchor = CURATED_ANCHOR_SNPS
                    .iter()
                    .find(|a| a.chrom_id == chrom_id && a.hg19_pos == pos);
                let fingerprint_verified =
                    matched_anchor.is_some_and(|a| a.ref_base.eq_ignore_ascii_case(ref_allele));
                let gene_hint = matched_anchor
                    .or_else(|| {
                        CURATED_ANCHOR_SNPS.iter().find(|a| {
                            a.chrom_id == chrom_id
                                && (a.hg19_pos as i64 - pos as i64).abs() < 50_000
                        })
                    })
                    .map(|a| a.gene.to_string());

                Ok(LiftoverResult {
                    original_build: GenomeBuild::GRCh37,
                    target_build: GenomeBuild::GRCh38,
                    original_chrom: chrom_name.to_string(),
                    original_pos: pos,
                    lifted_chrom: id_to_chrom(chrom_id),
                    lifted_pos,
                    ref_allele: lifted_ref,
                    sequence_fingerprint_verified: fingerprint_verified,
                    gene_hint,
                })
            }
            None => Err(PlasmidCoreError::UnmappedCoordinate(Box::new(
                UnmappedCoordinateDetails {
                    chrom: chrom_name.to_string(),
                    pos,
                    src_build: "GRCh37".to_string(),
                    dst_build: "GRCh38".to_string(),
                },
            ))),
        }
    }

    /// Translates GRCh38 (hg38) coordinate back to GRCh37 (hg19) via UCSC syntenic chain binary search.
    pub fn lift_hg38_to_hg19(
        &self,
        chrom_name: &str,
        pos: u64,
        ref_allele: &str,
    ) -> Result<LiftoverResult> {
        let chrom_id = chrom_to_id(chrom_name)?;

        match self.find_dst_interval(chrom_id, pos) {
            Some(inv) => {
                let (lifted_pos, lifted_ref) = if inv.strand == '+' {
                    (
                        inv.src_start + (pos - inv.dst_start),
                        ref_allele.to_string(),
                    )
                } else {
                    (
                        inv.src_start + (inv.dst_end - pos),
                        FastaDecoder::reverse_complement(ref_allele),
                    )
                };

                let matched_anchor = CURATED_ANCHOR_SNPS
                    .iter()
                    .find(|a| a.chrom_id == chrom_id && a.hg38_pos == pos);
                let fingerprint_verified =
                    matched_anchor.is_some_and(|a| a.ref_base.eq_ignore_ascii_case(ref_allele));
                let gene_hint = matched_anchor
                    .or_else(|| {
                        CURATED_ANCHOR_SNPS.iter().find(|a| {
                            a.chrom_id == chrom_id
                                && (a.hg38_pos as i64 - pos as i64).abs() < 50_000
                        })
                    })
                    .map(|a| a.gene.to_string());

                Ok(LiftoverResult {
                    original_build: GenomeBuild::GRCh38,
                    target_build: GenomeBuild::GRCh37,
                    original_chrom: chrom_name.to_string(),
                    original_pos: pos,
                    lifted_chrom: id_to_chrom(chrom_id),
                    lifted_pos,
                    ref_allele: lifted_ref,
                    sequence_fingerprint_verified: fingerprint_verified,
                    gene_hint,
                })
            }
            None => Err(PlasmidCoreError::UnmappedCoordinate(Box::new(
                UnmappedCoordinateDetails {
                    chrom: chrom_name.to_string(),
                    pos,
                    src_build: "GRCh38".to_string(),
                    dst_build: "GRCh37".to_string(),
                },
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anchor_snp_build_detection() {
        let hg19_user_file = vec![
            ("chr7".to_string(), 140453136),
            ("chr11".to_string(), 5248232),
            ("chr17".to_string(), 7577538),
        ];

        let detected = CoordinateGuard::detect_build(&hg19_user_file);
        assert_eq!(detected, Some(GenomeBuild::GRCh37));

        let hg38_user_file = vec![
            ("chr7".to_string(), 140753336),
            ("chr11".to_string(), 5227002),
        ];

        let detected_hg38 = CoordinateGuard::detect_build(&hg38_user_file);
        assert_eq!(detected_hg38, Some(GenomeBuild::GRCh38));
    }

    #[test]
    fn test_liftover_ucsc_chain_all_25_chromosomes_and_anchors() {
        let engine = LiftoverEngine::new_with_curated_regions();
        assert!(
            engine.interval_count() > 30_000,
            "Embedded UCSC chain must contain >30,000 syntenic intervals"
        );

        // Verify every single curated anchor SNP lifts accurately in both directions!
        for anchor in CURATED_ANCHOR_SNPS {
            let fwd = engine
                .lift_hg19_to_hg38(anchor.chrom, anchor.hg19_pos, anchor.ref_base)
                .unwrap_or_else(|e| panic!("Forward liftover failed for {}: {e}", anchor.rsid));
            assert_eq!(
                fwd.lifted_pos, anchor.hg38_pos,
                "Forward hg19->hg38 mismatch for {}",
                anchor.rsid
            );
            assert!(fwd.sequence_fingerprint_verified);

            let rev = engine
                .lift_hg38_to_hg19(anchor.chrom, anchor.hg38_pos, anchor.ref_base)
                .unwrap_or_else(|e| panic!("Reverse liftover failed for {}: {e}", anchor.rsid));
            assert_eq!(
                rev.lifted_pos, anchor.hg19_pos,
                "Reverse hg38->hg19 mismatch for {}",
                anchor.rsid
            );
        }

        // Verify non-anchor chromosomes (e.g. chr2, chrX, chr22) also lift via real UCSC chain
        let chr2_lift = engine.lift_hg19_to_hg38("chr2", 25_457_242, "N").unwrap();
        assert_eq!(chr2_lift.lifted_pos, 25_234_373); // DNMT3A R882H
        assert!(!chr2_lift.sequence_fingerprint_verified); // "N" is unverified base
    }

    #[test]
    fn test_adversarial_coordinate_drift_mismatch_rejection() {
        let mock_grch38_reference = "CGGCTA";
        let ref_validation = CoordinateGuard::verify_ref_fingerprint(
            "rs113488022",
            "chr7",
            140453136,
            "A",
            mock_grch38_reference,
            140453136,
            GenomeBuild::GRCh38,
        );

        assert!(ref_validation.is_err());
        match ref_validation.unwrap_err() {
            PlasmidCoreError::CoordinateDriftMismatch(details) => {
                assert_eq!(details.rsid, "rs113488022");
                assert_eq!(details.chrom, "chr7");
                assert_eq!(details.pos, 140453136);
                assert_eq!(details.found, "A");
                assert_eq!(details.expected, "C");
            }
            other => panic!("Unexpected error type: {other}"),
        }
    }

    #[test]
    fn test_unmapped_coordinate_fail_closed() {
        let engine = LiftoverEngine::new();
        let res = engine.lift_hg19_to_hg38("chr22", 999999999, "G");
        assert!(res.is_err());

        // Centromeric gap on real UCSC chain also fails closed
        let full_engine = LiftoverEngine::new_with_curated_regions();
        assert!(
            full_engine
                .lift_hg19_to_hg38("chr1", 125_000_000, "N")
                .is_err()
        );

        let utf8_res = CoordinateGuard::verify_ref_fingerprint(
            "rs_utf8",
            "chr7",
            101,
            "유전자",
            "유전자변이",
            100,
            GenomeBuild::GRCh38,
        );
        assert!(utf8_res.is_err());
    }
}
