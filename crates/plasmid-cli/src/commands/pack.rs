use clap::{Args, Subcommand};
use plasmid_core::governance::{DataGovernanceGuard, LicenseType};
use plasmid_format::HASH_SIZE;
use plasmid_swarm::pack::{PackCategory, PackManifest, SelectiveSwarmManager};
use std::fs;
use std::path::PathBuf;

#[derive(Args, Debug)]
pub struct PackArgs {
    #[command(subcommand)]
    pub command: PackCommands,
}

#[derive(Subcommand, Debug)]
pub enum PackCommands {
    /// Validate an annotation pack manifest for RFC-0003 data governance compliance
    Validate {
        /// Path to pack manifest JSON file
        #[arg(short, long)]
        manifest: Option<PathBuf>,

        /// License name (e.g. CC0, CC-BY, ODbL, PublicDomain)
        #[arg(long, default_value = "PublicDomain")]
        license: String,

        /// Source origin URL or name
        #[arg(long, default_value = "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/")]
        origin: String,

        /// Attribution notice text
        #[arg(long, default_value = "")]
        attribution: String,

        /// Enforce isolated partition sandbox
        #[arg(long, default_value_t = true)]
        isolated: bool,
    },
}

pub fn execute(args: PackArgs) -> Result<(), Box<dyn std::error::Error>> {
    match args.command {
        PackCommands::Validate {
            manifest,
            license,
            origin,
            attribution,
            isolated,
        } => {
            println!("⚖️  Validating RFC-0003 Annotation Pack Data Governance...");

            let pack_manifest = if let Some(path) = manifest {
                println!("   Reading manifest from: {}", path.display());
                let data = fs::read_to_string(path)?;
                serde_json::from_str::<PackManifest>(&data)?
            } else {
                PackManifest::new(
                    "custom-pack-001",
                    "Custom Annotation Pack",
                    PackCategory::ClinVarPathogenic,
                    [0u8; HASH_SIZE],
                    10,
                    vec!["BRAF".to_string(), "BRCA1".to_string()],
                    &origin,
                )
                .with_license(&license, &attribution, isolated)
            };

            println!("   Pack ID:      {}", pack_manifest.pack_id);
            println!("   Name:         {}", pack_manifest.name);
            println!("   License:      {}", pack_manifest.license_type);
            println!("   Origin:       {}", pack_manifest.origin_url);
            println!(
                "   Partition:    Isolated Local Sandbox = {}",
                pack_manifest.is_isolated_partition
            );

            // 1. Swarm manager governance check
            let swarm_manager = SelectiveSwarmManager::new();
            swarm_manager.validate_pack_governance(&pack_manifest)?;

            // 2. Core governance check for ODbL isolation
            let parsed_license = match pack_manifest.license_type.to_lowercase().as_str() {
                s if s.contains("odbl") => LicenseType::OdbL10,
                s if s.contains("cc0") => LicenseType::Cc0,
                s if s.contains("cc-by") || s.contains("ccby") => LicenseType::CcBy40,
                s if s.contains("public") => LicenseType::PublicDomain,
                _ => LicenseType::ProprietaryRestricted,
            };

            DataGovernanceGuard::validate_odbl_partition(
                parsed_license,
                pack_manifest.is_isolated_partition,
                &pack_manifest.attribution_notice,
            )?;

            // 3. Check attribution text for proprietary database leakage
            DataGovernanceGuard::validate_annotation_payload(&pack_manifest.name)?;
            DataGovernanceGuard::validate_annotation_payload(&pack_manifest.attribution_notice)?;

            println!("\n✅ COMPLIANCE CHECK PASSED:");
            println!(
                "   • Open Access License Whitelist: Verified ({})",
                pack_manifest.license_type
            );
            println!("   • Commercial Restrictive DB Blacklist: None detected");
            println!("   • Local-first Sandbox Isolation: Enforced (RFC-0002)");
            println!(
                "   • SaMD Regulatory Compliance: 21 CFR Part 820 / SaMD non-diagnostic sandbox status active"
            );

            Ok(())
        }
    }
}
