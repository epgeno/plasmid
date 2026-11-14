/* tslint:disable */
/* eslint-disable */

export class PlasmidWasmEngine {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Decodes ClinVar/Wiki markdown annotations and ACMG rules from an annotation chunk.
     */
    static decode_annotation_chunk(chunk_bytes: Uint8Array): any;
    /**
     * Decodes FASTA reference sequence for a specific range window.
     */
    static decode_fasta_chunk(chunk_bytes: Uint8Array, start_pos: number, end_pos: number): string;
    /**
     * Decodes downloaded 16KB Merkle leaf chunks against planned index entries and computes SHA-256 digests.
     */
    static decode_planned_slice(entries_json: string, chunks_concat: Uint8Array, chunk_indices: Uint32Array, chunk_size: number, chrom: string, start_pos: number, end_pos: number): any;
    /**
     * Zero-copy decode of a VCF variant chunk downloaded via HTTP Range or P2P WebRTC.
     */
    static decode_vcf_chunk(chunk_bytes: Uint8Array): any;
    /**
     * Automatically detects genome build (GRCh37 vs GRCh38) from input variant coordinates.
     */
    static detect_build(variants_json: string): string;
    /**
     * Returns authoritative contig lengths and centromere coordinates for GRCh38 or GRCh37.
     */
    static get_assembly_overview(assembly: string): any;
    /**
     * Computes hex-encoded SHA-256 leaf digest of a chunk.
     */
    static hash_chunk_hex(chunk_bytes: Uint8Array): string;
    /**
     * Realtime Liftover of GRCh37 (hg19) coordinate to GRCh38 (hg38) in WebAssembly.
     */
    static liftover_hg19_to_hg38(chrom: string, pos: number, ref_allele: string): any;
    /**
     * Realtime reverse Liftover of GRCh38 (hg38) coordinate to GRCh37 (hg19) in WebAssembly.
     */
    static liftover_hg38_to_hg19(chrom: string, pos: number, ref_allele: string): any;
    /**
     * Parses 32-byte PlasmidIndexEntry records from a flat directory or concatenated leaf directories.
     */
    static parse_directory_entries(directory_bytes: Uint8Array): any;
    /**
     * Parses the 128-byte .plasmid binary header into structured metadata and byte offsets.
     */
    static parse_header(header_bytes: Uint8Array): any;
    /**
     * Parses all leaf directory pointers from a hierarchical Root Directory buffer.
     */
    static parse_root_directory(root_dir_bytes: Uint8Array): any;
    /**
     * Plans minimal HTTP Range Requests from a downloaded .plasmid flat or leaf directory index.
     */
    static plan_range_slice(directory_bytes: Uint8Array, chrom: string, start_pos: number, end_pos: number, payload_offset: number, chunk_size: number): any;
    /**
     * Finds overlapping leaf directory pointers and coalesced HTTP Range headers for a coordinate window.
     */
    static query_root_leaves(root_dir_bytes: Uint8Array, chrom: string, start_pos: number, end_pos: number): any;
    /**
     * Verifies SHA-256 integrity of a downloaded chunk against an expected 32-byte hash.
     */
    static verify_chunk_hash(chunk_bytes: Uint8Array, expected_hash: Uint8Array): boolean;
    /**
     * Recomputes full BEP 52 SHA-256 Merkle Tree over container payload chunks and verifies root hash.
     */
    static verify_merkle_tree(payload_bytes: Uint8Array, chunk_size: number, expected_root_hex: string): any;
    /**
     * Verifies single-nucleotide reference sequence fingerprint to block coordinate drift.
     */
    static verify_ref_fingerprint(rsid: string, chrom: string, pos: number, ref_allele: string, reference_slice: string, slice_start_pos: number, target_build: string): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_plasmidwasmengine_free: (a: number, b: number) => void;
    readonly plasmidwasmengine_decode_annotation_chunk: (a: number, b: number) => [number, number, number];
    readonly plasmidwasmengine_decode_fasta_chunk: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly plasmidwasmengine_decode_planned_slice: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => [number, number, number];
    readonly plasmidwasmengine_decode_vcf_chunk: (a: number, b: number) => [number, number, number];
    readonly plasmidwasmengine_detect_build: (a: number, b: number) => [number, number, number, number];
    readonly plasmidwasmengine_get_assembly_overview: (a: number, b: number) => [number, number, number];
    readonly plasmidwasmengine_hash_chunk_hex: (a: number, b: number) => [number, number];
    readonly plasmidwasmengine_liftover_hg19_to_hg38: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly plasmidwasmengine_liftover_hg38_to_hg19: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly plasmidwasmengine_parse_directory_entries: (a: number, b: number) => [number, number, number];
    readonly plasmidwasmengine_parse_header: (a: number, b: number) => [number, number, number];
    readonly plasmidwasmengine_parse_root_directory: (a: number, b: number) => [number, number, number];
    readonly plasmidwasmengine_plan_range_slice: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
    readonly plasmidwasmengine_query_root_leaves: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly plasmidwasmengine_verify_chunk_hash: (a: number, b: number, c: number, d: number) => number;
    readonly plasmidwasmengine_verify_merkle_tree: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly plasmidwasmengine_verify_ref_fingerprint: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
