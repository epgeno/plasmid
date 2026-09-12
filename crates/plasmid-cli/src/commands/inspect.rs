use clap::Args;
use plasmid_core::chrom::id_to_chrom;
use plasmid_format::{EntryType, PlasmidReader};
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;

#[derive(Args, Debug)]
pub struct InspectArgs {
    /// Path to .plasmid container file
    pub path: PathBuf,

    /// Output inspection data as JSON
    #[arg(long, default_value_t = false)]
    pub json: bool,

    /// Dump individual index entries
    #[arg(short, long, default_value_t = false)]
    pub entries: bool,
}

#[derive(Serialize)]
struct ContainerInspection {
    file: String,
    file_size_bytes: u64,
    magic: String,
    format_version: u16,
    reference_build: String,
    root_merkle_hash: String,
    chunk_size_bytes: u32,
    total_chunks: u64,
    is_hierarchical: bool,
    index_offset: u64,
    index_length: u64,
    metadata_offset: u64,
    metadata_length: u64,
    metadata: serde_json::Value,
    entry_counts: HashMap<String, usize>,
    total_index_entries: usize,
}

pub fn execute(args: InspectArgs) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open(&args.path)?;
    let file_size = file.metadata()?.len();
    let reader = BufReader::new(file);

    let mut plasmid_reader = PlasmidReader::new(reader)?;
    let header = plasmid_reader.header.clone();
    let is_hierarchical = plasmid_reader.is_hierarchical();

    let root_hex = hex_encode(&header.root_hash);
    let magic_str = "PLASMID\\x01".to_string();

    let meta_val: serde_json::Value =
        serde_json::from_str(&plasmid_reader.metadata_json).unwrap_or(serde_json::Value::Null);

    // Collect all entries across flat or hierarchical index
    let all_entries = if is_hierarchical {
        plasmid_reader.query_range(0, 0, u64::MAX, None)?
    } else if let Some(dir) = &plasmid_reader.directory {
        dir.entries.clone()
    } else {
        Vec::new()
    };

    let mut counts: HashMap<String, usize> = HashMap::new();
    for e in &all_entries {
        let type_name = match e.entry_type {
            EntryType::VcfVariant => "VcfVariant",
            EntryType::ReferenceFasta => "ReferenceFasta",
            EntryType::ClinVarAnnotation => "ClinVarAnnotation",
            _ => "Unknown",
        };
        *counts.entry(type_name.to_string()).or_insert(0) += 1;
    }

    if args.json {
        let inspection = ContainerInspection {
            file: args.path.display().to_string(),
            file_size_bytes: file_size,
            magic: magic_str,
            format_version: header.version,
            reference_build: header.reference_build.clone(),
            root_merkle_hash: root_hex,
            chunk_size_bytes: header.chunk_size,
            total_chunks: header.total_chunks,
            is_hierarchical,
            index_offset: header.index_offset,
            index_length: header.index_length,
            metadata_offset: header.metadata_offset,
            metadata_length: header.metadata_length,
            metadata: meta_val,
            entry_counts: counts,
            total_index_entries: all_entries.len(),
        };
        println!("{}", serde_json::to_string_pretty(&inspection)?);
        return Ok(());
    }

    println!("============================================================");
    println!("🧬 .plasmid Container Inspection: {}", args.path.display());
    println!("============================================================");
    println!(
        "File Size:         {} bytes ({:.2} KB)",
        file_size,
        file_size as f64 / 1024.0
    );
    println!("Magic:             {:?}", magic_str);
    println!("Format Version:    {}", header.version);
    println!("Reference Build:   {}", header.reference_build);
    println!("Root Merkle Hash:  {}", root_hex);
    println!("Chunk Size:        {} bytes (16 KB)", header.chunk_size);
    println!("Total Chunks:      {} blocks", header.total_chunks);
    println!(
        "Index Mode:        {}",
        if is_hierarchical {
            "2-Stage Hierarchical (PMTiles v3 Leaf Directory)"
        } else {
            "Standard Flat Directory"
        }
    );
    println!(
        "Index Layout:      Offset {}, Length {} bytes",
        header.index_offset, header.index_length
    );
    println!(
        "Metadata Layout:   Offset {}, Length {} bytes",
        header.metadata_offset, header.metadata_length
    );

    if !plasmid_reader.metadata_json.trim().is_empty() && plasmid_reader.metadata_json != "{}" {
        println!("\n--- Container Metadata ---");
        println!("{}", plasmid_reader.metadata_json);
    }

    println!(
        "\n--- Index Entries Summary (Total: {}) ---",
        all_entries.len()
    );
    for (name, count) in &counts {
        println!("  • {:<20}: {} entries", name, count);
    }

    if args.entries && !all_entries.is_empty() {
        println!("\n--- Detailed Entry Directory ---");
        println!(
            "{:<6} {:<15} {:<12} {:<12} {:<10} {:<10}",
            "TYPE", "CHROM", "START", "END", "CHUNK_ST", "BYTES"
        );
        println!("{}", "-".repeat(70));
        for e in all_entries.iter().take(100) {
            let type_str = match e.entry_type {
                EntryType::VcfVariant => "VCF",
                EntryType::ReferenceFasta => "FASTA",
                EntryType::ClinVarAnnotation => "NOTE",
                _ => "UNK",
            };
            let chrom_str = id_to_chrom(e.chrom_id);
            println!(
                "{:<6} {:<15} {:<12} {:<12} {:<10} {:<10}",
                type_str, chrom_str, e.start_pos, e.end_pos, e.chunk_start, e.payload_bytes
            );
        }
        if all_entries.len() > 100 {
            println!(
                "... and {} more entries (use filtering to narrow)",
                all_entries.len() - 100
            );
        }
    }

    println!("============================================================");

    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
