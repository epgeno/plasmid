use clap::{Parser, Subcommand};
use plasmid_cli::commands::{
    build::{self, BuildArgs},
    inspect::{self, InspectArgs},
    pack::{self, PackArgs},
    query::{self, QueryArgs},
    verify::{self, VerifyArgs},
};

#[derive(Parser, Debug)]
#[command(
    name = "plasmid",
    author = "The Plasmid Authors <team@epgeno.org>",
    version,
    about = "Decentralized Genomic Wiki & Streaming Engine Tooling",
    long_about = "Official CLI suite for compiling, inspecting, verifying, and querying .plasmid single-file genomic archives with Merkle tree integrity and range slicing."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Compile VCF, FASTA, and ClinVar annotations into a .plasmid archive
    Build(BuildArgs),

    /// Inspect 128B header, index layout, and metadata of a .plasmid archive
    Inspect(InspectArgs),

    /// Cryptographically verify the SHA-256 Merkle tree and 16KB chunk integrity
    Verify(VerifyArgs),

    /// Perform range queries and extract slices with HTTP Range header plans
    Query(QueryArgs),

    /// Manage and validate RFC-0003 open-access annotation packs
    Pack(PackArgs),
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Build(args) => build::execute(args),
        Commands::Inspect(args) => inspect::execute(args),
        Commands::Verify(args) => verify::execute(args),
        Commands::Query(args) => query::execute(args),
        Commands::Pack(args) => pack::execute(args),
    };

    if let Err(err) = result {
        eprintln!("Error: {}", err);
        std::process::exit(1);
    }
}
