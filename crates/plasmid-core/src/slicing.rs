use crate::chrom::chrom_to_id;
use crate::error::{PlasmidCoreError, Result};
use plasmid_format::{EntryType, PlasmidDirectory, PlasmidIndexEntry};
use serde::{Deserialize, Serialize};

/// HTTP Byte Range for Cloudflare R2 / S3 requests.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}

impl ByteRange {
    pub fn new(start: u64, end: u64) -> Self {
        Self { start, end }
    }

    /// Formats as an HTTP Range header value: 'bytes=start-end'.
    pub fn to_http_header(&self) -> String {
        format!("bytes={}-{}", self.start, self.end)
    }

    /// Number of bytes spanned by this inclusive range.
    pub fn len(&self) -> u64 {
        if self.end >= self.start {
            self.end - self.start + 1
        } else {
            0
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Checks if this range overlaps with or is adjacent to another range within max_gap bytes.
    pub fn can_coalesce(&self, other: &Self, max_gap: u64) -> bool {
        let (first, second) = if self.start <= other.start {
            (self, other)
        } else {
            (other, self)
        };
        second.start <= first.end.saturating_add(max_gap + 1)
    }

    /// Merges two overlapping or adjacent ranges.
    pub fn merge(&self, other: &Self) -> Self {
        Self {
            start: self.start.min(other.start),
            end: self.end.max(other.end),
        }
    }
}

/// Coalesces sorted or unsorted byte ranges into minimal non-overlapping contiguous ranges.
pub fn coalesce_byte_ranges(mut ranges: Vec<ByteRange>, max_gap: u64) -> Vec<ByteRange> {
    if ranges.is_empty() {
        return Vec::new();
    }

    ranges.sort_by_key(|r| r.start);

    let mut merged: Vec<ByteRange> = Vec::with_capacity(ranges.len());
    let mut current = ranges[0];

    for next in ranges.into_iter().skip(1) {
        if current.can_coalesce(&next, max_gap) {
            current = current.merge(&next);
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    merged
}

/// Query plan describing exact byte ranges and 16KB Merkle chunks needed to satisfy a range slice.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlicingPlan {
    pub chrom_id: u16,
    pub start_pos: u64,
    pub end_pos: u64,
    pub chunk_indices: Vec<u32>,
    pub byte_ranges: Vec<ByteRange>,
    pub entries: Vec<PlasmidIndexEntry>,
    pub total_chunk_bytes: u64,
    pub total_download_bytes: u64,
}

pub struct RangePlanner;

impl RangePlanner {
    /// Generates an optimized SlicingPlan for a given genomic coordinate query.
    pub fn plan_slice(
        directory: &PlasmidDirectory,
        chrom_name: &str,
        start_pos: u64,
        end_pos: u64,
        entry_type: Option<EntryType>,
        payload_start_offset: u64,
        chunk_size: u32,
    ) -> Result<SlicingPlan> {
        if start_pos > end_pos {
            return Err(PlasmidCoreError::InvalidCoordinateRange {
                start: start_pos,
                end: end_pos,
            });
        }

        let chrom_id = chrom_to_id(chrom_name)?;
        let entries = directory.query_range(chrom_id, start_pos, end_pos, entry_type);

        let mut chunk_set = Vec::new();
        for entry in &entries {
            for c in 0..entry.chunk_count {
                chunk_set.push(entry.chunk_start + c);
            }
        }
        chunk_set.sort_unstable();
        chunk_set.dedup();

        // Convert chunk indices into 16KB byte ranges
        let raw_ranges: Vec<ByteRange> = chunk_set
            .iter()
            .map(|&chunk_idx| {
                let start = payload_start_offset + (chunk_idx as u64 * chunk_size as u64);
                let end = start + chunk_size as u64 - 1;
                ByteRange::new(start, end)
            })
            .collect();

        // Coalesce adjacent chunk ranges (0 gap means contiguous 16KB chunks merge into one HTTP range)
        let byte_ranges = coalesce_byte_ranges(raw_ranges, 0);

        let total_chunk_bytes = chunk_set.len() as u64 * chunk_size as u64;
        let total_download_bytes = byte_ranges.iter().map(|r| r.len()).sum();

        Ok(SlicingPlan {
            chrom_id,
            start_pos,
            end_pos,
            chunk_indices: chunk_set,
            byte_ranges,
            entries,
            total_chunk_bytes,
            total_download_bytes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_byte_range_coalesce() {
        let r1 = ByteRange::new(0, 16383);
        let r2 = ByteRange::new(16384, 32767);
        let r3 = ByteRange::new(65536, 81919);

        let merged = coalesce_byte_ranges(vec![r1, r2, r3], 0);
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0], ByteRange::new(0, 32767));
        assert_eq!(merged[0].to_http_header(), "bytes=0-32767");
        assert_eq!(merged[0].len(), 32768);
        assert_eq!(merged[1], ByteRange::new(65536, 81919));
    }
}
