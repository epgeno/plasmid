use clap::Args;
use plasmid_core::decoder::GenomicCoordinator;
use plasmid_core::slicing::RangePlanner;
use plasmid_format::{EntryType, PlasmidReader};
use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;

#[derive(Args, Debug)]
pub struct QueryArgs {
    /// Path to .plasmid container file
    pub path: PathBuf,

    /// Chromosome name (e.g. chr7, 7, chr17)
    #[arg(short, long)]
    pub chr: String,

    /// 1-based start genomic position
    #[arg(short, long)]
    pub start: u64,

    /// 1-based end genomic position
    #[arg(short, long)]
    pub end: u64,

    /// Filter by entry type: vcf, fasta, annotation, or all
    #[arg(short = 't', long, default_value = "all")]
    pub entry_type: String,

    /// Output query results as JSON
    #[arg(long, default_value_t = false)]
    pub json: bool,
}

#[derive(Serialize)]
struct QueryResultJson {
    region: String,
    chunks_accessed: Vec<u32>,
    http_range_header: String,
    bytes_transferred: u64,
    total_file_bytes: u64,
    bandwidth_saved_percent: f64,
    variants_count: usize,
    variants: Vec<plasmid_core::decoder::vcf::VcfVariantRecord>,
    reference_sequence: Option<String>,
    annotations_count: usize,
    annotations: Vec<plasmid_core::decoder::annotation::AnnotationRecord>,
}

pub fn execute(args: QueryArgs) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open(&args.path)?;
    let file_size = file.metadata()?.len();
    let reader = BufReader::new(file);

    let mut plasmid_reader = PlasmidReader::new(reader)?;

    let filter_type = match args.entry_type.to_lowercase().as_str() {
        "vcf" | "variant" => Some(EntryType::VcfVariant),
        "fasta" | "ref" => Some(EntryType::ReferenceFasta),
        "annotation" | "clinvar" | "note" => Some(EntryType::ClinVarAnnotation),
        _ => None,
    };

    let plan = RangePlanner::plan_reader(
        &mut plasmid_reader,
        &args.chr,
        args.start,
        args.end,
        filter_type,
    )?;

    let slice =
        GenomicCoordinator::decode_slice(&mut plasmid_reader, &args.chr, args.start, args.end)?;

    let bytes_accessed = plan.total_download_bytes;
    let saved_pct = if file_size > 0 {
        ((file_size.saturating_sub(bytes_accessed)) as f64 / file_size as f64) * 100.0
    } else {
        0.0
    };

    let http_range_header = if plan.byte_ranges.is_empty() {
        "bytes=0-0".to_string()
    } else {
        format!(
            "bytes={}",
            plan.byte_ranges
                .iter()
                .map(|r| format!("{}-{}", r.start, r.end))
                .collect::<Vec<_>>()
                .join(",")
        )
    };

    if args.json {
        let res = QueryResultJson {
            region: format!("{}:{}-{}", args.chr, args.start, args.end),
            chunks_accessed: plan.chunk_indices.clone(),
            http_range_header,
            bytes_transferred: bytes_accessed,
            total_file_bytes: file_size,
            bandwidth_saved_percent: saved_pct,
            variants_count: slice.variants.len(),
            variants: slice.variants,
            reference_sequence: slice.reference_sequence,
            annotations_count: slice.annotations.len(),
            annotations: slice.annotations,
        };
        println!("{}", serde_json::to_string_pretty(&res)?);
        return Ok(());
    }

    println!("============================================================");
    println!("🔬 .plasmid Slicing & Range Query");
    println!("============================================================");
    println!(
        "Region:            {}:{}-{} ({} bp)",
        args.chr,
        args.start,
        args.end,
        args.end.saturating_sub(args.start) + 1
    );
    println!("Target File:       {}", args.path.display());
    println!("HTTP Range Header: {}", http_range_header);
    println!("Chunks Accessed:   {:?}", plan.chunk_indices);
    println!(
        "Data Transferred:  {} bytes / {} bytes ({:.2}% network traffic saved)",
        bytes_accessed, file_size, saved_pct
    );

    println!("\n--- Decoded Variants ({}) ---", slice.variants.len());
    if slice.variants.is_empty() {
        println!("  (No variants found in specified coordinate range)");
    } else {
        println!(
            "{:<12} {:<15} {:<6} {:<6} {:<10} {:<20}",
            "POS", "ID", "REF", "ALT", "GENE", "CLINVAR"
        );
        println!("{}", "-".repeat(70));
        for v in &slice.variants {
            let id = v.id.as_deref().unwrap_or("-");
            let gene = v.gene.as_deref().unwrap_or("-");
            let clnsig = v.clinvar_significance.as_deref().unwrap_or("-");
            println!(
                "{:<12} {:<15} {:<6} {:<6} {:<10} {:<20}",
                v.pos, id, v.reference, v.alternate, gene, clnsig
            );
        }
    }

    if let Some(ref seq) = slice.reference_sequence {
        println!("\n--- Reference Sequence ({} bp) ---", seq.len());
        if seq.len() <= 100 {
            println!("  {}", seq);
        } else {
            let head = &seq[..40];
            let tail = &seq[seq.len() - 40..];
            println!("  {} ... {} ({} bp omitted)", head, tail, seq.len() - 80);
        }
    }

    if !slice.annotations.is_empty() {
        println!(
            "\n--- Matched Annotations ({}) ---",
            slice.annotations.len()
        );
        for ann in &slice.annotations {
            println!("  • {}", ann.title);
            for line in ann.content.lines().take(3) {
                println!("    {}", line);
            }
            if !ann.acmg_criteria.is_empty() {
                println!("    ACMG Evidence: {}", ann.acmg_criteria.join(", "));
            }
        }
    }

    println!("============================================================");

    Ok(())
}
