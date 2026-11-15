export type GenomeAssembly = 'GRCh38' | 'GRCh37';

export type DataSourceMode = 'public' | 'vault';

export type EntryTypeName =
  | 'ReferenceFasta'
  | 'CramAlignment'
  | 'VcfVariant'
  | 'ClinVarAnnotation'
  | 'WikiMarkdown';

export interface ByteRange {
  start: number;
  end: number;
}

export interface WasmHeaderInfo {
  version: number;
  flags: number;
  is_hierarchical: boolean;
  reference_build: string;
  root_hash_hex: string;
  root_hash_bytes: number[];
  chunk_size: number;
  total_chunks: number;
  total_payload_bytes: number;
  index_offset: number;
  index_length: number;
  metadata_offset: number;
  metadata_length: number;
  payload_offset: number;
}

export interface PlasmidIndexEntry {
  chrom_id: number;
  entry_type: EntryTypeName;
  flags: number;
  start_pos: number;
  end_pos: number;
  chunk_start: number;
  chunk_count: number;
  payload_bytes: number;
}

export interface WasmIndexEntryInfo {
  chrom_id: number;
  chrom_name: string;
  entry: PlasmidIndexEntry;
}

export interface WasmLeafPointerInfo {
  chrom_id: number;
  chrom_name: string;
  flags: number;
  min_pos: number;
  max_pos: number;
  leaf_offset: number;
  leaf_length: number;
  entry_count: number;
}

export interface WasmLeafQueryPlan {
  chrom_id: number;
  leaves: WasmLeafPointerInfo[];
  byte_ranges: ByteRange[];
}

export interface SlicingPlan {
  chrom_id: number;
  start_pos: number;
  end_pos: number;
  chunk_indices: number[];
  byte_ranges: ByteRange[];
  entries: PlasmidIndexEntry[];
  total_chunk_bytes: number;
  total_download_bytes: number;
}

export interface VcfVariantRecord {
  chrom: string;
  pos: number;
  id: string | null;
  reference: string;
  alternate: string;
  qual: number | null;
  filter: string;
  info: Record<string, string>;
  gene: string | null;
  clinvar_significance: string | null;
  amino_acid_change: string | null;
}

export interface AnnotationRecord {
  title: string;
  content: string;
  acmg_criteria: string[];
  pubmed_ids: string[];
}

export interface DecodeStats {
  variants_count: number;
  annotations_count: number;
  total_bytes_processed: number;
}

export interface UnifiedGenomicSlice {
  chrom: string;
  start_pos: number;
  end_pos: number;
  variants: VcfVariantRecord[];
  reference_sequence: string | null;
  annotations: AnnotationRecord[];
  stats: DecodeStats;
}

export interface WasmChunkHashInfo {
  chunk_index: number;
  byte_length: number;
  sha256_hex: string;
}

export interface WasmDecodedSlice {
  slice: UnifiedGenomicSlice;
  chunk_hashes: WasmChunkHashInfo[];
}

export interface WasmMerkleVerification {
  verified: boolean;
  expected_root_hex: string;
  calculated_root_hex: string;
  total_chunks: number;
  verified_bytes: number;
  chunk_hashes: string[];
}

export interface WasmMerkleProofStep {
  sibling_hex: string;
  is_right: boolean;
}

export interface WasmChunkMerkleBundle {
  chunk_index: number;
  total_chunks: number;
  leaf_sha256_hex: string;
  root_hash_hex: string;
  proof: WasmMerkleProofStep[];
}

export interface WasmChunkProofVerification {
  verified: boolean;
  chunk_index: number;
  total_chunks: number;
  leaf_sha256_hex: string;
  calculated_root_hex: string;
  expected_root_hex: string;
}

export interface ChromosomeOverview {
  chrom_id: number;
  chrom_name: string;
  length: number;
  centromere: number;
  bins: number[];
  max_score: number;
  total_variants: number;
  pathogenic_count: number;
}

export interface PyramidIndex {
  build: string;
  bin_size: number;
  chromosomes: ChromosomeOverview[];
  total_variants: number;
  total_pathogenic: number;
}

export interface ContainerMetadata {
  generator?: string;
  created_at?: string;
  license?: string;
  reference_build?: string;
  pyramid?: PyramidIndex;
  [key: string]: unknown;
}

export interface LiftoverResult {
  original_build: GenomeAssembly;
  target_build: GenomeAssembly;
  original_chrom: string;
  original_pos: number;
  lifted_chrom: string;
  lifted_pos: number;
  ref_allele: string;
  sequence_fingerprint_verified: boolean;
  gene_hint: string | null;
}

export interface ParsedVariant {
  chrom: string;
  pos: number;
  id: string;
  ref: string;
  alt: string;
  qual: number | null;
  filter: string;
  gene?: string;
  clinvar?: string;
  aminoAcidChange?: string;
  info: Record<string, string>;
  score: number;
}

export interface DensityBin {
  start: number;
  end: number;
  score: number;
  count: number;
  pathogenicCount: number;
}

export interface CatalogVariantItem {
  key: string;
  variant: ParsedVariant;
  entry: PlasmidIndexEntry;
  leaf?: WasmLeafPointerInfo;
  byteRangeHeader: string;
  chunkIndices: number[];
  chunkHashes: WasmChunkHashInfo[];
  annotations: AnnotationRecord[];
  bytesTransferred: number;
}

export interface WasmChromCoordinateIndex {
  chrom_id: number;
  chrom_name: string;
  min_pos: number;
  max_pos: number;
  variant_count: number;
  pathogenic_count: number;
  start_index: number;
  end_index: number;
}

export interface WasmVcfDatasetRaw {
  reference_build: string;
  byte_length: number;
  sha256_hex: string;
  pyramid: PyramidIndex;
  chrom_index: WasmChromCoordinateIndex[];
  variants: VcfVariantRecord[];
}

export interface ParsedVcfDataset {
  reference_build: string;
  byte_length: number;
  sha256_hex: string;
  pyramid: PyramidIndex;
  chrom_index: WasmChromCoordinateIndex[];
  variants: ParsedVariant[];
  raw_variants: VcfVariantRecord[];
}

export interface ClinVarMatchedVariant {
  key: string;
  chrom: string;
  pos: number;
  personal_pos: number;
  lifted_from_build: string | null;
  rsid: string;
  variation_id: string | null;
  gene: string | null;
  reference: string;
  alternate: string;
  personal_genotype: string;
  zygosity: 'Heterozygous' | 'HomozygousAlt' | 'Hemizygous' | 'Observed' | string;
  clinical_significance: string;
  significance_category:
    | 'pathogenic'
    | 'likely_pathogenic'
    | 'oncogenic'
    | 'drug_response'
    | 'risk_factor'
    | 'other'
    | string;
  review_stars: number;
  review_status: string;
  conditions: string[];
  molecular_consequence: string | null;
  hgvs: string | null;
  allele_frequency: number | null;
}

export interface WasmIntersectionResult {
  personal_build: string;
  clinvar_build: string;
  total_personal_variants: number;
  carrier_personal_variants: number;
  lifted_variants_count: number;
  clinvar_variants_scanned: number;
  matched_count: number;
  pathogenic_count: number;
  likely_pathogenic_count: number;
  drug_response_count: number;
  risk_factor_count: number;
  matches: ClinVarMatchedVariant[];
  chunk_hashes: WasmChunkHashInfo[];
}

export interface ClinVarIntersectionReport extends WasmIntersectionResult {
  vaultFilename: string;
  clinvarDatasetUrl: string;
  clinvarTotalFileSize: number;
  clinvarBytesFetched: number;
  clinvarChunksAccessed: number[];
  rangeHeadersIssued: string[];
  personalBytesSent: 0;
  elapsedMs: number;
}

export interface WasmLocalPlasmidDatasetRaw {
  header: WasmHeaderInfo;
  metadata_json: string;
  merkle: WasmMerkleVerification;
  pyramid: PyramidIndex;
  chrom_index: WasmChromCoordinateIndex[];
  leaves: WasmLeafPointerInfo[];
  entries: WasmIndexEntryInfo[];
  variants: VcfVariantRecord[];
}

export interface ParsedLocalPlasmidDataset {
  header: WasmHeaderInfo;
  metadata_json: string;
  merkle: WasmMerkleVerification;
  pyramid: PyramidIndex;
  chrom_index: WasmChromCoordinateIndex[];
  leaves: WasmLeafPointerInfo[];
  entries: WasmIndexEntryInfo[];
  variants: ParsedVariant[];
  raw_variants: VcfVariantRecord[];
}
