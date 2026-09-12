use clap::Args;
use plasmid_core::chrom::{chrom_to_id, id_to_chrom};
use plasmid_format::{DEFAULT_CHUNK_SIZE, EntryType, PlasmidBuilder};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter};
use std::path::{Path, PathBuf};

#[derive(Args, Debug)]
pub struct BuildArgs {
    /// Path to input VCF file
    #[arg(long)]
    pub vcf: Option<PathBuf>,

    /// Path to input FASTA reference file
    #[arg(long)]
    pub fasta: Option<PathBuf>,

    /// Path to input annotations (Markdown/ClinVar notes) file
    #[arg(long)]
    pub annotation: Option<PathBuf>,

    /// Output .plasmid container path
    #[arg(short, long)]
    pub output: PathBuf,

    /// Reference genome build (e.g. GRCh38, GRCh37)
    #[arg(short, long, default_value = "GRCh38")]
    pub reference: String,

    /// Build with PMTiles v3 style 2-stage hierarchical leaf directory
    #[arg(long, default_value_t = false)]
    pub hierarchical: bool,

    /// Maximum index entries per leaf directory block in hierarchical mode
    #[arg(long, default_value_t = 64)]
    pub entries_per_leaf: usize,

    /// Custom metadata JSON string or path to JSON file
    #[arg(long)]
    pub metadata: Option<String>,
}

pub fn execute(args: BuildArgs) -> Result<(), Box<dyn std::error::Error>> {
    println!("📦 Compiling .plasmid genomic archive...");
    println!("   Reference Build: {}", args.reference);
    println!("   Output File:     {}", args.output.display());

    let mut builder = PlasmidBuilder::new(&args.reference);

    // 1. Process Metadata
    let meta_str = if let Some(m) = &args.metadata {
        if Path::new(m).is_file() {
            fs::read_to_string(m)?
        } else {
            m.clone()
        }
    } else {
        serde_json::json!({
            "generator": "plasmid-cli v0.1.0",
            "created_at": "2026-09-12T00:00:00Z",
            "license": "Public Domain / CC0",
            "reference_build": args.reference,
        })
        .to_string()
    };
    builder.set_metadata(&meta_str);

    let mut vcf_count = 0usize;
    let mut fasta_count = 0usize;
    let mut annotation_count = 0usize;

    // 2. Parse VCF
    if let Some(vcf_path) = &args.vcf {
        println!("   Loading VCF from: {}", vcf_path.display());
        let file = File::open(vcf_path)?;
        let reader = BufReader::new(file);

        for line_res in reader.lines() {
            let line = line_res?;
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let parts: Vec<&str> = trimmed.split('\t').collect();
            if parts.len() < 5 {
                continue;
            }

            let chrom_str = parts[0];
            let pos: u64 = parts[1].parse().unwrap_or(0);
            if pos == 0 {
                continue;
            }

            let chrom_id = match chrom_to_id(chrom_str) {
                Ok(id) => id,
                Err(_) => continue,
            };

            let ref_seq = parts[3];
            let end_pos = pos + (ref_seq.len().max(1) as u64) - 1;

            builder.add_item(
                chrom_id,
                EntryType::VcfVariant,
                pos,
                end_pos,
                line.into_bytes(),
            );
            vcf_count += 1;
        }
        println!("   ↳ Ingested {} variant records", vcf_count);
    }

    // 3. Parse FASTA
    if let Some(fasta_path) = &args.fasta {
        println!("   Loading FASTA from: {}", fasta_path.display());
        let file = File::open(fasta_path)?;
        let reader = BufReader::new(file);

        let mut current_chrom: Option<u16> = None;
        let mut current_seq = String::new();
        let mut current_pos = 1u64;

        for line_res in reader.lines() {
            let line = line_res?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if let Some(stripped) = trimmed.strip_prefix('>') {
                // Flush previous contig segment if any
                if let (Some(cid), false) = (current_chrom, current_seq.is_empty()) {
                    let end_pos = current_pos + current_seq.len() as u64 - 1;
                    let payload = format!(">{}\n{}\n", id_to_chrom(cid), current_seq);
                    builder.add_item(
                        cid,
                        EntryType::ReferenceFasta,
                        current_pos,
                        end_pos,
                        payload.into_bytes(),
                    );
                    fasta_count += 1;
                    current_seq.clear();
                }

                let header_part = stripped.split_whitespace().next().unwrap_or("");
                current_chrom = chrom_to_id(header_part).ok();
                current_pos = 1;
            } else if let Some(cid) = current_chrom {
                current_seq.push_str(trimmed);
                // Chunk every 16,384 bases to align with 16KB Merkle leaves
                if current_seq.len() >= DEFAULT_CHUNK_SIZE as usize {
                    let end_pos = current_pos + current_seq.len() as u64 - 1;
                    let payload = format!(">{}\n{}\n", id_to_chrom(cid), current_seq);
                    builder.add_item(
                        cid,
                        EntryType::ReferenceFasta,
                        current_pos,
                        end_pos,
                        payload.into_bytes(),
                    );
                    fasta_count += 1;
                    current_pos = end_pos + 1;
                    current_seq.clear();
                }
            }
        }

        if let (Some(cid), false) = (current_chrom, current_seq.is_empty()) {
            let end_pos = current_pos + current_seq.len() as u64 - 1;
            let payload = format!(">{}\n{}\n", id_to_chrom(cid), current_seq);
            builder.add_item(
                cid,
                EntryType::ReferenceFasta,
                current_pos,
                end_pos,
                payload.into_bytes(),
            );
            fasta_count += 1;
        }
        println!("   ↳ Ingested {} reference sequence blocks", fasta_count);
    }

    // 4. Parse Annotations
    if let Some(ann_path) = &args.annotation {
        println!("   Loading Annotations from: {}", ann_path.display());
        let content = fs::read_to_string(ann_path)?;
        // Parse markdown sections delimited by `##`
        for section in content.split("\n##") {
            let trimmed = section.trim();
            if trimmed.is_empty() {
                continue;
            }
            let first_line = trimmed.lines().next().unwrap_or("");
            let clean_line = first_line.trim_start_matches('#').trim();
            let tokens: Vec<&str> = clean_line.split_whitespace().collect();
            if let Some(coord_part) = tokens.first() {
                let parsed_coord = (|| -> Option<(u16, u64, u64)> {
                    let (chr_str, range_str) = coord_part.split_once(':')?;
                    let (s_str, e_str) = range_str.split_once('-')?;
                    let cid = chrom_to_id(chr_str).ok()?;
                    let s = s_str.parse::<u64>().ok()?;
                    let e = e_str.parse::<u64>().ok()?;
                    Some((cid, s, e))
                })();

                if let Some((cid, s, e)) = parsed_coord {
                    let note = if trimmed.starts_with('#') {
                        trimmed.to_string()
                    } else {
                        format!("## {}", trimmed)
                    };
                    // RFC-0003 governance validation on annotation payload
                    plasmid_core::governance::DataGovernanceGuard::validate_annotation_payload(
                        &note,
                    )?;
                    builder.add_item(cid, EntryType::ClinVarAnnotation, s, e, note.into_bytes());
                    annotation_count += 1;
                }
            }
        }
        println!("   ↳ Ingested {} annotation notes", annotation_count);
    }

    let total_items = vcf_count + fasta_count + annotation_count;
    if total_items == 0 {
        eprintln!("⚠️  Warning: No input data provided. Building container with empty payload.");
    }

    // Create parent directories if missing
    if let Some(parent) = args.output.parent() {
        fs::create_dir_all(parent)?;
    }

    let out_file = File::create(&args.output)?;
    let writer = BufWriter::new(out_file);

    let header = if args.hierarchical {
        println!(
            "   Generating 2-stage hierarchical leaf directory ({} entries/leaf)...",
            args.entries_per_leaf
        );
        builder.build_hierarchical(writer, args.entries_per_leaf)?
    } else {
        println!("   Generating standard flat directory index...");
        builder.build(writer)?
    };

    let file_meta = fs::metadata(&args.output)?;
    let root_hex = hex_encode(&header.root_hash);

    println!("\n✅ Successfully generated .plasmid archive!");
    println!("   File:            {}", args.output.display());
    println!(
        "   File Size:       {} bytes ({:.2} KB)",
        file_meta.len(),
        file_meta.len() as f64 / 1024.0
    );
    println!("   Total Chunks:    {} (16 KB each)", header.total_chunks);
    println!("   Root Merkle:     {}", root_hex);
    println!(
        "   Index Offset:    {} ({} bytes)",
        header.index_offset, header.index_length
    );
    println!(
        "   Metadata Offset: {} ({} bytes)",
        header.metadata_offset, header.metadata_length
    );

    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
