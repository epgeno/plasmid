use crate::error::{PlasmidCoreError, Result};
use serde::{Deserialize, Serialize};

/// Decoded FASTA reference record.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FastaRecord {
    pub name: String,
    pub description: Option<String>,
    pub sequence: String,
}

impl FastaRecord {
    pub fn len(&self) -> usize {
        self.sequence.len()
    }

    pub fn is_empty(&self) -> bool {
        self.sequence.is_empty()
    }

    /// Slices an interval (1-based, inclusive) from the reference sequence.
    pub fn slice_1based(&self, start: u64, end: u64) -> Result<&str> {
        if start == 0 || start > end {
            return Err(PlasmidCoreError::InvalidCoordinateRange { start, end });
        }
        let s_idx = (start - 1) as usize;
        let e_idx = end as usize;

        if e_idx > self.sequence.len() {
            return Err(PlasmidCoreError::FastaParse(format!(
                "Requested end coordinate {} exceeds reference length {}",
                end,
                self.sequence.len()
            )));
        }

        Ok(&self.sequence[s_idx..e_idx])
    }
}

pub struct FastaDecoder;

impl FastaDecoder {
    /// Decodes FASTA records from a raw byte slice.
    pub fn decode_slice(data: &[u8]) -> Result<Vec<FastaRecord>> {
        let text = std::str::from_utf8(data)
            .map_err(|e| PlasmidCoreError::FastaParse(format!("Invalid UTF-8: {e}")))?;

        let mut records = Vec::new();
        let mut current_name = String::new();
        let mut current_desc = None;
        let mut current_seq = String::new();

        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if let Some(header) = line.strip_prefix('>') {
                if !current_name.is_empty() {
                    records.push(FastaRecord {
                        name: current_name,
                        description: current_desc,
                        sequence: current_seq,
                    });
                    current_seq = String::new();
                }

                let mut parts = header.splitn(2, |c: char| c.is_whitespace());
                current_name = parts.next().unwrap_or("").to_string();
                current_desc = parts.next().map(|s| s.to_string());
            } else {
                current_seq.push_str(line);
            }
        }

        if !current_name.is_empty() {
            records.push(FastaRecord {
                name: current_name,
                description: current_desc,
                sequence: current_seq,
            });
        }

        Ok(records)
    }

    /// Computes the reverse complement of a DNA sequence.
    pub fn reverse_complement(dna: &str) -> String {
        dna.chars()
            .rev()
            .map(|c| match c {
                'A' | 'a' => 'T',
                'T' | 't' => 'A',
                'C' | 'c' => 'G',
                'G' | 'g' => 'C',
                'N' | 'n' => 'N',
                other => other,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fasta_decode_and_slice() {
        let raw = b">chr7 human chromosome 7 snippet\nGTGATTTTGGTCTAGCTACAGTGAAATCTCGATGGAGT\nGGGTCCCATCAGTTTGAACAGTTGTCTGGATCCATTTTG\n";
        let records = FastaDecoder::decode_slice(raw).unwrap();

        assert_eq!(records.len(), 1);
        let rec = &records[0];
        assert_eq!(rec.name, "chr7");
        assert_eq!(
            rec.description.as_deref(),
            Some("human chromosome 7 snippet")
        );

        // 1-based coordinates:
        // Index 1..=5 should be "GTGAT"
        let sub = rec.slice_1based(1, 5).unwrap();
        assert_eq!(sub, "GTGAT");

        // Reverse complement
        assert_eq!(FastaDecoder::reverse_complement("ATCG"), "CGAT");
    }
}
