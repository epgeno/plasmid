use crate::error::{PlasmidCoreError, Result};

/// Normalizes chromosome names to standard numeric IDs (1..=22, 23=X, 24=Y, 25=M).
pub fn chrom_to_id(name: &str) -> Result<u16> {
    let clean = name
        .trim()
        .trim_start_matches("chr")
        .trim_start_matches("CHR");
    let upper = clean.to_uppercase();
    match upper.as_str() {
        "X" => Ok(23),
        "Y" => Ok(24),
        "M" | "MT" => Ok(25),
        val => match val.parse::<u16>() {
            Ok(num) if (1..=22).contains(&num) => Ok(num),
            _ => Err(PlasmidCoreError::UnknownChromosome(name.to_string())),
        },
    }
}

/// Formats a chromosome ID into standard 'chrN' notation.
pub fn id_to_chrom(id: u16) -> String {
    match id {
        23 => "chrX".to_string(),
        24 => "chrY".to_string(),
        25 => "chrM".to_string(),
        n => format!("chr{n}"),
    }
}

/// Approximate contig lengths for GRCh38 human reference genome.
pub fn grch38_contig_length(chrom_id: u16) -> Option<u64> {
    match chrom_id {
        1 => Some(248_956_422),
        2 => Some(242_193_529),
        3 => Some(198_295_559),
        4 => Some(190_214_555),
        5 => Some(181_538_259),
        6 => Some(170_805_979),
        7 => Some(159_345_973),
        8 => Some(145_138_636),
        9 => Some(138_394_717),
        10 => Some(133_797_422),
        11 => Some(135_086_622),
        12 => Some(133_275_309),
        13 => Some(114_364_328),
        14 => Some(107_043_718),
        15 => Some(101_991_189),
        16 => Some(90_338_345),
        17 => Some(83_257_441),
        18 => Some(80_373_285),
        19 => Some(58_617_616),
        20 => Some(64_444_167),
        21 => Some(46_709_983),
        22 => Some(50_818_468),
        23 => Some(156_040_895), // chrX
        24 => Some(57_227_415),  // chrY
        25 => Some(16_569),      // chrM
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chrom_conversions() {
        assert_eq!(chrom_to_id("chr7").unwrap(), 7);
        assert_eq!(chrom_to_id("7").unwrap(), 7);
        assert_eq!(chrom_to_id("chrX").unwrap(), 23);
        assert_eq!(chrom_to_id("x").unwrap(), 23);
        assert_eq!(chrom_to_id("chrY").unwrap(), 24);
        assert_eq!(chrom_to_id("chrM").unwrap(), 25);
        assert_eq!(chrom_to_id("chrMT").unwrap(), 25);
        assert!(chrom_to_id("chr99").is_err());
        assert!(chrom_to_id("chrInvalid").is_err());

        assert_eq!(id_to_chrom(7), "chr7");
        assert_eq!(id_to_chrom(23), "chrX");
        assert_eq!(id_to_chrom(24), "chrY");
        assert_eq!(id_to_chrom(25), "chrM");
    }
}
