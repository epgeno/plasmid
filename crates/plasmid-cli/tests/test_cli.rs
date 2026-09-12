use std::fs::{self, File};
use std::io::Write;
use tempfile::tempdir;

#[test]
fn test_cli_build_inspect_verify_query_e2e() {
    let dir = tempdir().expect("create tempdir");

    // 1. Create synthetic VCF
    let vcf_path = dir.path().join("test.vcf");
    let mut vcf_file = File::create(&vcf_path).unwrap();
    writeln!(vcf_file, "##fileformat=VCFv4.2").unwrap();
    writeln!(vcf_file, "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO").unwrap();
    writeln!(
        vcf_file,
        "chr7\t140453136\trs113488022\tT\tA\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic"
    )
    .unwrap();
    writeln!(
        vcf_file,
        "chr17\t43044295\trs80357906\tC\tT\t100\tPASS\tGENE=BRCA1;CLNSIG=Pathogenic"
    )
    .unwrap();

    // 2. Create synthetic FASTA
    let fasta_path = dir.path().join("test.fa");
    let mut fasta_file = File::create(&fasta_path).unwrap();
    writeln!(fasta_file, ">chr7").unwrap();
    writeln!(
        fasta_file,
        "GTGATTTTGGTCTAGCTACAGTGAAATCTCGATGGAGTGGGTCCCATCAGTTTGAACAG"
    )
    .unwrap();

    // 3. Create synthetic Annotation
    let ann_path = dir.path().join("test.md");
    let mut ann_file = File::create(&ann_path).unwrap();
    writeln!(ann_file, "## chr7:140453100-140453200 BRAF V600E Hotspot").unwrap();
    writeln!(ann_file, "ClinVar Pathogenic variant. ACMG: PS1, PM1.").unwrap();

    // 4. Test Flat Container Build
    let out_plasmid = dir.path().join("test.plasmid");
    let build_args = plasmid_cli::commands::build::BuildArgs {
        vcf: Some(vcf_path.clone()),
        fasta: Some(fasta_path.clone()),
        annotation: Some(ann_path.clone()),
        output: out_plasmid.clone(),
        reference: "GRCh38".to_string(),
        hierarchical: false,
        entries_per_leaf: 64,
        metadata: None,
    };
    plasmid_cli::commands::build::execute(build_args).expect("build flat container");

    assert!(out_plasmid.exists());
    let file_len = fs::metadata(&out_plasmid).unwrap().len();
    assert!(file_len > 128);

    // 5. Test Inspect
    let inspect_args = plasmid_cli::commands::inspect::InspectArgs {
        path: out_plasmid.clone(),
        json: true,
        entries: true,
    };
    plasmid_cli::commands::inspect::execute(inspect_args).expect("inspect container");

    // 6. Test Verify
    let verify_args = plasmid_cli::commands::verify::VerifyArgs {
        path: out_plasmid.clone(),
        verbose: true,
    };
    plasmid_cli::commands::verify::execute(verify_args).expect("verify container integrity");

    // 7. Test Query (chr7 BRAF region)
    let query_args = plasmid_cli::commands::query::QueryArgs {
        path: out_plasmid.clone(),
        chr: "chr7".to_string(),
        start: 140453100,
        end: 140453200,
        entry_type: "all".to_string(),
        json: true,
    };
    plasmid_cli::commands::query::execute(query_args).expect("query range");

    // 8. Test Hierarchical Build
    let out_hierarchical = dir.path().join("test_hierarchical.plasmid");
    let hier_build_args = plasmid_cli::commands::build::BuildArgs {
        vcf: Some(vcf_path),
        fasta: Some(fasta_path),
        annotation: Some(ann_path),
        output: out_hierarchical.clone(),
        reference: "GRCh38".to_string(),
        hierarchical: true,
        entries_per_leaf: 2,
        metadata: None,
    };
    plasmid_cli::commands::build::execute(hier_build_args).expect("build hierarchical container");

    // 9. Verify Hierarchical Container
    let hier_verify_args = plasmid_cli::commands::verify::VerifyArgs {
        path: out_hierarchical.clone(),
        verbose: false,
    };
    plasmid_cli::commands::verify::execute(hier_verify_args)
        .expect("verify hierarchical container integrity");

    // 10. Tamper Detection Test
    let mut data = fs::read(&out_plasmid).unwrap();
    // Tamper with payload byte inside chunk payload (last chunk)
    let tamper_idx = data.len() - 100;
    data[tamper_idx] ^= 0xFF;
    let tampered_path = dir.path().join("tampered.plasmid");
    fs::write(&tampered_path, data).unwrap();

    let tampered_verify_args = plasmid_cli::commands::verify::VerifyArgs {
        path: tampered_path,
        verbose: false,
    };
    let verify_res = plasmid_cli::commands::verify::execute(tampered_verify_args);
    assert!(
        verify_res.is_err(),
        "Tampered archive must fail Merkle verification"
    );
}

#[test]
fn test_cli_pack_validate() {
    let pack_args = plasmid_cli::commands::pack::PackArgs {
        command: plasmid_cli::commands::pack::PackCommands::Validate {
            manifest: None,
            license: "PublicDomain".to_string(),
            origin: "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/".to_string(),
            attribution: "NCBI ClinVar public domain".to_string(),
            isolated: true,
        },
    };
    plasmid_cli::commands::pack::execute(pack_args).expect("validate valid pack");
}
