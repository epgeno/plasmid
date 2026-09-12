use crate::chrom::{chrom_to_id, grch38_contig_length, id_to_chrom};
use crate::decoder::VcfVariantRecord;
use serde::{Deserialize, Serialize};

pub const PYRAMID_BIN_SIZE: u64 = 1_000_000; // 1 Mb bins

/// Centromere positions (approximate junction of p and q arms) for GRCh38
pub fn grch38_centromere_pos(chrom_id: u16) -> u64 {
    match chrom_id {
        1 => 123_400_000,
        2 => 93_900_000,
        3 => 90_900_000,
        4 => 50_000_000,
        5 => 48_800_000,
        6 => 59_800_000,
        7 => 60_100_000,
        8 => 45_200_000,
        9 => 43_800_000,
        10 => 39_800_000,
        11 => 53_400_000,
        12 => 35_500_000,
        13 => 17_700_000,
        14 => 17_200_000,
        15 => 19_000_000,
        16 => 36_800_000,
        17 => 25_100_000,
        18 => 18_500_000,
        19 => 24_400_000,
        20 => 28_100_000,
        21 => 12_000_000,
        22 => 15_000_000,
        23 => 61_000_000, // chrX
        24 => 10_400_000, // chrY
        _ => 0,
    }
}

/// Centromere positions for GRCh37 / hg19
pub fn grch37_centromere_pos(chrom_id: u16) -> u64 {
    match chrom_id {
        1 => 125_000_000,
        2 => 93_300_000,
        3 => 91_000_000,
        4 => 50_400_000,
        5 => 48_400_000,
        6 => 61_000_000,
        7 => 59_900_000,
        8 => 45_600_000,
        9 => 49_000_000,
        10 => 40_200_000,
        11 => 53_700_000,
        12 => 35_800_000,
        13 => 17_900_000,
        14 => 17_600_000,
        15 => 19_000_000,
        16 => 36_600_000,
        17 => 24_000_000,
        18 => 17_200_000,
        19 => 26_500_000,
        20 => 27_500_000,
        21 => 13_200_000,
        22 => 14_700_000,
        23 => 60_600_000, // chrX
        24 => 12_500_000, // chrY
        _ => 0,
    }
}

pub fn grch37_contig_length(chrom_id: u16) -> u64 {
    match chrom_id {
        1 => 249_250_621,
        2 => 243_199_373,
        3 => 198_022_430,
        4 => 191_154_276,
        5 => 180_915_260,
        6 => 171_115_067,
        7 => 159_138_663,
        8 => 146_364_022,
        9 => 141_213_431,
        10 => 135_534_747,
        11 => 135_006_516,
        12 => 133_851_895,
        13 => 115_169_878,
        14 => 107_349_540,
        15 => 102_531_392,
        16 => 90_354_753,
        17 => 81_195_210,
        18 => 78_077_248,
        19 => 59_128_983,
        20 => 63_025_520,
        21 => 48_129_895,
        22 => 51_304_566,
        23 => 155_270_560, // chrX
        24 => 59_373_566,  // chrY
        _ => 0,
    }
}

/// 1Mb binned summary for one chromosome
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChromosomeOverview {
    pub chrom_id: u16,
    pub chrom_name: String,
    pub length: u64,
    pub centromere: u64,
    /// Binned weighted scores across each 1Mb block
    pub bins: Vec<f32>,
    pub max_score: f32,
    pub total_variants: u32,
    pub pathogenic_count: u32,
}

/// Level 0 Whole-Genome Multi-Scale Pyramid Index
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PyramidIndex {
    pub build: String,
    pub bin_size: u64,
    pub chromosomes: Vec<ChromosomeOverview>,
    pub total_variants: u32,
    pub total_pathogenic: u32,
}

impl PyramidIndex {
    pub fn new(build: &str) -> Self {
        let is_grch37 = build.to_uppercase().contains("37") || build.to_uppercase().contains("19");
        let mut chromosomes = Vec::with_capacity(24);

        for id in 1..=24 {
            let name = id_to_chrom(id);
            let length = if is_grch37 {
                grch37_contig_length(id)
            } else {
                grch38_contig_length(id).unwrap_or(0)
            };
            let centromere = if is_grch37 {
                grch37_centromere_pos(id)
            } else {
                grch38_centromere_pos(id)
            };
            let num_bins = length.div_ceil(PYRAMID_BIN_SIZE).max(1) as usize;

            chromosomes.push(ChromosomeOverview {
                chrom_id: id,
                chrom_name: name,
                length,
                centromere,
                bins: vec![0.0; num_bins],
                max_score: 0.0,
                total_variants: 0,
                pathogenic_count: 0,
            });
        }

        Self {
            build: build.to_string(),
            bin_size: PYRAMID_BIN_SIZE,
            chromosomes,
            total_variants: 0,
            total_pathogenic: 0,
        }
    }

    /// Ingests a VCF variant and updates the weighted 1Mb bin
    pub fn ingest_variant(&mut self, chrom: &str, variant: &VcfVariantRecord) {
        let chrom_id = match chrom_to_id(chrom) {
            Ok(id) if (1..=24).contains(&id) => id,
            _ => return,
        };

        let chrom_idx = (chrom_id - 1) as usize;
        let chrom_data = &mut self.chromosomes[chrom_idx];

        let bin_idx = (variant.pos / PYRAMID_BIN_SIZE) as usize;
        if bin_idx >= chrom_data.bins.len() {
            return;
        }

        // ClinVar-weighted significance score
        let weight: f32 = if variant.is_pathogenic() {
            10.0
        } else if let Some(sig) = &variant.clinvar_significance {
            let lower = sig.to_lowercase();
            if lower.contains("pathogenic") {
                10.0
            } else if lower.contains("risk") {
                5.0
            } else if lower.contains("uncertain") || lower.contains("vus") {
                2.0
            } else if lower.contains("benign") {
                0.5
            } else {
                1.0
            }
        } else {
            1.0
        };

        chrom_data.bins[bin_idx] += weight;
        if chrom_data.bins[bin_idx] > chrom_data.max_score {
            chrom_data.max_score = chrom_data.bins[bin_idx];
        }

        chrom_data.total_variants += 1;
        self.total_variants += 1;

        if variant.is_pathogenic() {
            chrom_data.pathogenic_count += 1;
            self.total_pathogenic += 1;
        }
    }

    /// Serializes to compact JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserializes from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_pyramid_index_generation() {
        let mut pyramid = PyramidIndex::new("GRCh38");
        assert_eq!(pyramid.chromosomes.len(), 24);

        // Ingest BRAF V600E (chr7:140,453,136)
        let braf = VcfVariantRecord {
            chrom: "chr7".to_string(),
            pos: 140_453_136,
            id: Some("rs113488022".to_string()),
            reference: "T".to_string(),
            alternate: "A".to_string(),
            qual: Some(100.0),
            filter: "PASS".to_string(),
            info: HashMap::new(),
            gene: Some("BRAF".to_string()),
            clinvar_significance: Some("Pathogenic".to_string()),
            amino_acid_change: Some("p.Val600Glu".to_string()),
        };

        pyramid.ingest_variant("chr7", &braf);

        let chr7 = &pyramid.chromosomes[6];
        assert_eq!(chr7.total_variants, 1);
        assert_eq!(chr7.pathogenic_count, 1);
        let bin_140mb = 140_453_136 / PYRAMID_BIN_SIZE;
        assert_eq!(chr7.bins[bin_140mb as usize], 10.0);
        assert_eq!(chr7.max_score, 10.0);

        // Verify JSON roundtrip
        let json = pyramid.to_json().unwrap();
        let deserialized = PyramidIndex::from_json(&json).unwrap();
        assert_eq!(pyramid, deserialized);
    }
}
