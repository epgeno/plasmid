use clap::Args;
use plasmid_format::{MerkleTree, PlasmidReader, hash_leaf};
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;

#[derive(Args, Debug)]
pub struct VerifyArgs {
    /// Path to .plasmid container file
    pub path: PathBuf,

    /// Output per-chunk verification hashes
    #[arg(short, long, default_value_t = false)]
    pub verbose: bool,
}

pub fn execute(args: VerifyArgs) -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "🔍 Verifying cryptographic integrity for: {}",
        args.path.display()
    );

    let file = File::open(&args.path)?;
    let file_size = file.metadata()?.len();
    let reader = BufReader::new(file);

    let mut plasmid_reader = PlasmidReader::new(reader)?;
    let header = plasmid_reader.header.clone();
    let expected_root_hex = hex_encode(&header.root_hash);

    println!("   Format Version:  {}", header.version);
    println!("   Total Chunks:    {}", header.total_chunks);
    println!("   Expected Root:   {}", expected_root_hex);

    // 1. Check layout bounds
    if header.index_offset + header.index_length > file_size {
        return Err(format!(
            "Integrity Error: Index section exceeds file boundaries (offset: {}, len: {}, file size: {})",
            header.index_offset, header.index_length, file_size
        )
        .into());
    }
    if header.metadata_offset + header.metadata_length > file_size {
        return Err(format!(
            "Integrity Error: Metadata section exceeds file boundaries (offset: {}, len: {}, file size: {})",
            header.metadata_offset, header.metadata_length, file_size
        )
        .into());
    }

    // 2. Validate all chunk hashes
    let mut leaf_hashes = Vec::with_capacity(header.total_chunks as usize);

    for chunk_idx in 0..header.total_chunks as u32 {
        let chunk_data = plasmid_reader.read_chunk(chunk_idx)?;
        let leaf_hash = hash_leaf(&chunk_data);
        leaf_hashes.push(leaf_hash);

        if args.verbose {
            println!(
                "   Chunk #{:<4} [{} B]: {}",
                chunk_idx,
                chunk_data.len(),
                hex_encode(&leaf_hash)
            );
        }
    }

    let calculated_tree = MerkleTree::from_leaves(leaf_hashes);
    let calculated_root = calculated_tree.root();
    let calculated_root_hex = hex_encode(&calculated_root);

    println!("   Calculated Root: {}", calculated_root_hex);

    if calculated_root != header.root_hash {
        eprintln!("\n❌ INTEGRITY VERIFICATION FAILED!");
        eprintln!("   Expected Merkle Root:   {}", expected_root_hex);
        eprintln!("   Calculated Merkle Root: {}", calculated_root_hex);
        return Err(
            "Cryptographic Merkle Root mismatch: File may be corrupted or tampered with.".into(),
        );
    }

    // 3. Reader self-verification check
    if !plasmid_reader.verify_integrity()? {
        return Err("Internal reader integrity verification check failed.".into());
    }

    println!(
        "\n✅ VERIFICATION PASSED: Merkle tree and all {} chunks are 100% valid!",
        header.total_chunks
    );
    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
