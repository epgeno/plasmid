use crate::error::{PlasmidFormatError, Result};
use flate2::Compression;
use flate2::read::MultiGzDecoder;
use flate2::write::GzEncoder;
use ruzstd::decoding::StreamingDecoder;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::io::{Read, Write};
use std::str::FromStr;

pub const CODEC_MASK: u8 = 0x03;

/// Maximum decompressed payload size per index entry (64 MiB) to block zip/zstd bombs.
pub const MAX_DECOMPRESSED_ENTRY_BYTES: u64 = 64 * 1024 * 1024;

/// RFC-0001 Payload Decompression Codec stored in the lower 2 bits of `PlasmidIndexEntry::flags`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[repr(u8)]
pub enum CompressionCodec {
    #[default]
    Raw = 0,
    Bgzf = 1,
    Zstd = 2,
}

impl CompressionCodec {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Raw => "raw",
            Self::Bgzf => "bgzf",
            Self::Zstd => "zstd",
        }
    }
}

impl fmt::Display for CompressionCodec {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl TryFrom<u8> for CompressionCodec {
    type Error = PlasmidFormatError;

    fn try_from(val: u8) -> Result<Self> {
        match val {
            0 => Ok(Self::Raw),
            1 => Ok(Self::Bgzf),
            2 => Ok(Self::Zstd),
            other => Err(PlasmidFormatError::UnsupportedCodec(other)),
        }
    }
}

impl FromStr for CompressionCodec {
    type Err = PlasmidFormatError;

    fn from_str(s: &str) -> Result<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "0" | "raw" | "none" | "uncompressed" => Ok(Self::Raw),
            "1" | "bgzf" | "gzip" | "gz" => Ok(Self::Bgzf),
            "2" | "zstd" | "zst" | "zstandard" => Ok(Self::Zstd),
            other => Err(PlasmidFormatError::Compression {
                codec: other.to_string(),
                reason: "expected one of: raw, bgzf, zstd".to_string(),
            }),
        }
    }
}

pub fn is_gzip_magic(bytes: &[u8]) -> bool {
    bytes.len() >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b
}

pub fn is_zstd_magic(bytes: &[u8]) -> bool {
    bytes.len() >= 4 && bytes[0..4] == [0x28, 0xb5, 0x2f, 0xfd]
}

/// Compresses a raw byte buffer with the specified RFC-0001 codec.
pub fn compress_payload(codec: CompressionCodec, raw: &[u8]) -> Result<Vec<u8>> {
    match codec {
        CompressionCodec::Raw => Ok(raw.to_vec()),
        CompressionCodec::Bgzf => {
            let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
            encoder
                .write_all(raw)
                .map_err(|e| PlasmidFormatError::Compression {
                    codec: "bgzf".to_string(),
                    reason: e.to_string(),
                })?;
            encoder
                .finish()
                .map_err(|e| PlasmidFormatError::Compression {
                    codec: "bgzf".to_string(),
                    reason: e.to_string(),
                })
        }
        CompressionCodec::Zstd => compress_zstd(raw, 9),
    }
}

/// Compresses bytes using Zstandard at a configurable level (`1..=22`).
#[cfg(not(target_arch = "wasm32"))]
pub fn compress_zstd(raw: &[u8], level: i32) -> Result<Vec<u8>> {
    zstd::stream::encode_all(std::io::Cursor::new(raw), level).map_err(|e| {
        PlasmidFormatError::Compression {
            codec: "zstd".to_string(),
            reason: e.to_string(),
        }
    })
}

/// Pure-Rust RFC 8878 Zstandard frame emitter fallback for wasm32 targets without C `zstd-sys`.
#[cfg(target_arch = "wasm32")]
pub fn compress_zstd(raw: &[u8], _level: i32) -> Result<Vec<u8>> {
    const MAX_BLOCK_SIZE: usize = 128 * 1024;
    let mut out = Vec::with_capacity(raw.len() + 16);
    // Zstd Frame Magic: 0xFD2FB528 (LE)
    out.extend_from_slice(&[0x28, 0xb5, 0x2f, 0xfd]);
    // Frame_Header_Descriptor: Single_Segment_Flag=1 (0x20) | FCS_Field_Size=2 (4 bytes -> 0x80) = 0xA0
    out.push(0xa0);
    out.extend_from_slice(&(raw.len() as u32).to_le_bytes());

    if raw.is_empty() {
        // Single empty last raw block: Last_Block=1, Block_Type=0 (Raw), Block_Size=0
        out.extend_from_slice(&[0x01, 0x00, 0x00]);
        return Ok(out);
    }

    let total = raw.len();
    let mut offset = 0;
    while offset < total {
        let block_len = (total - offset).min(MAX_BLOCK_SIZE);
        let is_last = u32::from(offset + block_len >= total);
        let block_header: u32 = is_last | ((block_len as u32) << 3);
        let hb = block_header.to_le_bytes();
        out.extend_from_slice(&hb[0..3]);
        out.extend_from_slice(&raw[offset..offset + block_len]);
        offset += block_len;
    }
    Ok(out)
}

/// Decompresses an entry payload according to its RFC-0001 codec using pure-Rust decoders (`ruzstd` / `flate2`).
pub fn decompress_payload(codec: CompressionCodec, data: &[u8]) -> Result<Vec<u8>> {
    decompress_payload_bounded(codec, data, MAX_DECOMPRESSED_ENTRY_BYTES)
}

/// Decompresses a payload with an explicit maximum output byte cap.
pub fn decompress_payload_bounded(
    codec: CompressionCodec,
    data: &[u8],
    max_bytes: u64,
) -> Result<Vec<u8>> {
    match codec {
        CompressionCodec::Raw => {
            if data.len() as u64 > max_bytes {
                return Err(PlasmidFormatError::Decompression {
                    codec: "raw".to_string(),
                    reason: format!(
                        "payload size {} exceeds safety cap of {} bytes",
                        data.len(),
                        max_bytes
                    ),
                });
            }
            Ok(data.to_vec())
        }
        CompressionCodec::Bgzf => decompress_gzip_bounded(data, max_bytes),
        CompressionCodec::Zstd => decompress_zstd_bounded(data, max_bytes),
    }
}

/// Decompresses single-member Gzip or multi-member BGZF streams with a strict output cap.
pub fn decompress_gzip_bounded(data: &[u8], max_bytes: u64) -> Result<Vec<u8>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }
    let decoder = MultiGzDecoder::new(data);
    let mut bounded = decoder.take(max_bytes.saturating_add(1));
    let mut out = Vec::new();
    bounded
        .read_to_end(&mut out)
        .map_err(|e| PlasmidFormatError::Decompression {
            codec: "gzip/bgzf".to_string(),
            reason: e.to_string(),
        })?;
    if out.len() as u64 > max_bytes {
        return Err(PlasmidFormatError::Decompression {
            codec: "gzip/bgzf".to_string(),
            reason: format!(
                "decompressed stream exceeded maximum allowed size of {} bytes",
                max_bytes
            ),
        });
    }
    Ok(out)
}

/// Decompresses Zstandard frames using pure-Rust `ruzstd` (WASM & Native compatible) with a strict output cap.
pub fn decompress_zstd_bounded(data: &[u8], max_bytes: u64) -> Result<Vec<u8>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }
    let decoder = StreamingDecoder::new(data).map_err(|e| PlasmidFormatError::Decompression {
        codec: "zstd".to_string(),
        reason: e.to_string(),
    })?;
    let mut bounded = decoder.take(max_bytes.saturating_add(1));
    let mut out = Vec::new();
    bounded
        .read_to_end(&mut out)
        .map_err(|e| PlasmidFormatError::Decompression {
            codec: "zstd".to_string(),
            reason: e.to_string(),
        })?;
    if out.len() as u64 > max_bytes {
        return Err(PlasmidFormatError::Decompression {
            codec: "zstd".to_string(),
            reason: format!(
                "decompressed Zstd stream exceeded maximum allowed size of {} bytes",
                max_bytes
            ),
        });
    }
    Ok(out)
}
