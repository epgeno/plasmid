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

    // 9. Verify, Inspect, and Query Hierarchical Container
    let hier_verify_args = plasmid_cli::commands::verify::VerifyArgs {
        path: out_hierarchical.clone(),
        verbose: false,
    };
    plasmid_cli::commands::verify::execute(hier_verify_args)
        .expect("verify hierarchical container integrity");

    let hier_inspect_args = plasmid_cli::commands::inspect::InspectArgs {
        path: out_hierarchical.clone(),
        json: false,
        entries: true,
    };
    plasmid_cli::commands::inspect::execute(hier_inspect_args)
        .expect("inspect hierarchical container");

    let hier_query_args = plasmid_cli::commands::query::QueryArgs {
        path: out_hierarchical.clone(),
        chr: "chr7".to_string(),
        start: 140453100,
        end: 140453200,
        entry_type: "all".to_string(),
        json: false,
    };
    plasmid_cli::commands::query::execute(hier_query_args).expect("query hierarchical container");

    // Verify hierarchical reader directly reports all 4 entries and decodes BRAF variant
    {
        let mut h_reader =
            plasmid_format::PlasmidReader::new(File::open(&out_hierarchical).unwrap()).unwrap();
        assert!(h_reader.is_hierarchical());
        let all_entries = h_reader.read_all_entries().unwrap();
        assert_eq!(all_entries.len(), 4);
        assert_eq!(h_reader.query_range(0, 0, u64::MAX, None).unwrap().len(), 4);
        let decoded = plasmid_core::decoder::GenomicCoordinator::decode_slice(
            &mut h_reader,
            "chr7",
            140453100,
            140453200,
        )
        .unwrap();
        assert_eq!(decoded.variants.len(), 1);
        assert_eq!(decoded.variants[0].pos, 140453136);
        assert_eq!(decoded.annotations.len(), 1);
    }

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

#[test]
fn test_cli_vcf_batch_packing_into_16kb_chunks() {
    let dir = tempdir().expect("create tempdir");
    let vcf_path = dir.path().join("packed.vcf");
    let mut vcf_file = File::create(&vcf_path).unwrap();
    writeln!(vcf_file, "##fileformat=VCFv4.2").unwrap();
    writeln!(vcf_file, "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO").unwrap();

    // Write 100 variants on chr7 (~75 bytes each -> ~7.5 KB total, must fit in 1 single 16KB chunk!)
    for i in 0..100u64 {
        let pos = 140_450_000 + i * 100;
        writeln!(
            vcf_file,
            "chr7\t{pos}\trs{i}\tA\tG\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic"
        )
        .unwrap();
    }

    let out_plasmid = dir.path().join("packed.plasmid");
    let build_args = plasmid_cli::commands::build::BuildArgs {
        vcf: Some(vcf_path),
        fasta: None,
        annotation: None,
        output: out_plasmid.clone(),
        reference: "GRCh38".to_string(),
        hierarchical: true,
        entries_per_leaf: 16,
        metadata: None,
    };
    plasmid_cli::commands::build::execute(build_args).expect("build packed hierarchical container");

    let mut reader = plasmid_format::PlasmidReader::new(File::open(&out_plasmid).unwrap()).unwrap();
    assert_eq!(
        reader.header.total_chunks, 1,
        "100 small VCF lines on chr7 must pack into 1 x 16KB chunk instead of 100 chunks"
    );
    let entries = reader.read_all_entries().unwrap();
    assert_eq!(entries.len(), 1);
    let payload = reader.read_entry_payload(&entries[0]).unwrap();
    let payload_str = std::str::from_utf8(&payload).unwrap();
    assert_eq!(payload_str.lines().count(), 100);
    assert!(payload_str.ends_with('\n'));

    // Sub-range query must return only variants overlapping 140_450_200..=140_450_450 (i = 2, 3, 4)
    let sub_slice = plasmid_core::decoder::GenomicCoordinator::decode_slice(
        &mut reader,
        "chr7",
        140_450_200,
        140_450_450,
    )
    .unwrap();
    assert_eq!(sub_slice.variants.len(), 3);
    assert_eq!(sub_slice.variants[0].pos, 140_450_200);
    assert_eq!(sub_slice.variants[1].pos, 140_450_300);
    assert_eq!(sub_slice.variants[2].pos, 140_450_400);
}
