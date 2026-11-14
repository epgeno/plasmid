/* @ts-self-types="./plasmid_core.d.ts" */

export class PlasmidWasmEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PlasmidWasmEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_plasmidwasmengine_free(ptr, 0);
    }
    /**
     * Decodes ClinVar/Wiki markdown annotations and ACMG rules from an annotation chunk.
     * @param {Uint8Array} chunk_bytes
     * @returns {any}
     */
    static decode_annotation_chunk(chunk_bytes) {
        const ptr0 = passArray8ToWasm0(chunk_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_decode_annotation_chunk(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Decodes FASTA reference sequence for a specific range window.
     * @param {Uint8Array} chunk_bytes
     * @param {number} start_pos
     * @param {number} end_pos
     * @returns {string}
     */
    static decode_fasta_chunk(chunk_bytes, start_pos, end_pos) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passArray8ToWasm0(chunk_bytes, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.plasmidwasmengine_decode_fasta_chunk(ptr0, len0, start_pos, end_pos);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Decodes downloaded 16KB Merkle leaf chunks against planned index entries and computes SHA-256 digests.
     * @param {string} entries_json
     * @param {Uint8Array} chunks_concat
     * @param {Uint32Array} chunk_indices
     * @param {number} chunk_size
     * @param {string} chrom
     * @param {number} start_pos
     * @param {number} end_pos
     * @returns {any}
     */
    static decode_planned_slice(entries_json, chunks_concat, chunk_indices, chunk_size, chrom, start_pos, end_pos) {
        const ptr0 = passStringToWasm0(entries_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(chunks_concat, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray32ToWasm0(chunk_indices, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(chrom, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_decode_planned_slice(ptr0, len0, ptr1, len1, ptr2, len2, chunk_size, ptr3, len3, start_pos, end_pos);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Zero-copy decode of a VCF variant chunk downloaded via HTTP Range or P2P WebRTC.
     * @param {Uint8Array} chunk_bytes
     * @returns {any}
     */
    static decode_vcf_chunk(chunk_bytes) {
        const ptr0 = passArray8ToWasm0(chunk_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_decode_vcf_chunk(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Automatically detects genome build (GRCh37 vs GRCh38) from input variant coordinates.
     * @param {string} variants_json
     * @returns {string}
     */
    static detect_build(variants_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(variants_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.plasmidwasmengine_detect_build(ptr0, len0);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Returns authoritative contig lengths and centromere coordinates for GRCh38 or GRCh37.
     * @param {string} assembly
     * @returns {any}
     */
    static get_assembly_overview(assembly) {
        const ptr0 = passStringToWasm0(assembly, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_get_assembly_overview(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Computes hex-encoded SHA-256 leaf digest of a chunk.
     * @param {Uint8Array} chunk_bytes
     * @returns {string}
     */
    static hash_chunk_hex(chunk_bytes) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArray8ToWasm0(chunk_bytes, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.plasmidwasmengine_hash_chunk_hex(ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Intersects local OPFS personal variants against sliced ClinVar `.plasmid` Zstd chunks in WebAssembly.
     * @param {string} personal_variants_json
     * @param {string} personal_build
     * @param {string} entries_json
     * @param {Uint8Array} chunks_concat
     * @param {Uint32Array} chunk_indices
     * @param {number} chunk_size
     * @param {string} clinvar_build
     * @returns {any}
     */
    static intersect_personal_with_clinvar(personal_variants_json, personal_build, entries_json, chunks_concat, chunk_indices, chunk_size, clinvar_build) {
        const ptr0 = passStringToWasm0(personal_variants_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(personal_build, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(entries_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(chunks_concat, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray32ToWasm0(chunk_indices, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passStringToWasm0(clinvar_build, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_intersect_personal_with_clinvar(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, chunk_size, ptr5, len5);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Realtime Liftover of GRCh37 (hg19) coordinate to GRCh38 (hg38) in WebAssembly.
     * @param {string} chrom
     * @param {number} pos
     * @param {string} ref_allele
     * @returns {any}
     */
    static liftover_hg19_to_hg38(chrom, pos, ref_allele) {
        const ptr0 = passStringToWasm0(chrom, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(ref_allele, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_liftover_hg19_to_hg38(ptr0, len0, pos, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Realtime reverse Liftover of GRCh38 (hg38) coordinate to GRCh37 (hg19) in WebAssembly.
     * @param {string} chrom
     * @param {number} pos
     * @param {string} ref_allele
     * @returns {any}
     */
    static liftover_hg38_to_hg19(chrom, pos, ref_allele) {
        const ptr0 = passStringToWasm0(chrom, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(ref_allele, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_liftover_hg38_to_hg19(ptr0, len0, pos, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Parses 32-byte PlasmidIndexEntry records from a flat directory or concatenated leaf directories.
     * @param {Uint8Array} directory_bytes
     * @returns {any}
     */
    static parse_directory_entries(directory_bytes) {
        const ptr0 = passArray8ToWasm0(directory_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_parse_directory_entries(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Parses the 128-byte .plasmid binary header into structured metadata and byte offsets.
     * @param {Uint8Array} header_bytes
     * @returns {any}
     */
    static parse_header(header_bytes) {
        const ptr0 = passArray8ToWasm0(header_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_parse_header(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Parses and cryptographically validates a local .plasmid container buffer stored in OPFS.
     * @param {Uint8Array} container_bytes
     * @returns {any}
     */
    static parse_local_plasmid(container_bytes) {
        const ptr0 = passArray8ToWasm0(container_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_parse_local_plasmid(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Parses all leaf directory pointers from a hierarchical Root Directory buffer.
     * @param {Uint8Array} root_dir_bytes
     * @returns {any}
     */
    static parse_root_directory(root_dir_bytes) {
        const ptr0 = passArray8ToWasm0(root_dir_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_parse_root_directory(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Parses an arbitrary local .vcf/.txt byte buffer into a sorted variant table, chromosome coordinate index, and 1Mb PyramidIndex.
     * @param {Uint8Array} vcf_bytes
     * @param {string} assembly_hint
     * @returns {any}
     */
    static parse_vcf_dataset(vcf_bytes, assembly_hint) {
        const ptr0 = passArray8ToWasm0(vcf_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(assembly_hint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_parse_vcf_dataset(ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Plans minimal 16KB Zstd chunk HTTP Range requests for personal DNA ↔ ClinVar intersection.
     * @param {Uint8Array} directory_bytes
     * @param {string} personal_variants_json
     * @param {string} personal_build
     * @param {string} clinvar_build
     * @param {number} payload_offset
     * @param {number} chunk_size
     * @returns {any}
     */
    static plan_intersection_chunks(directory_bytes, personal_variants_json, personal_build, clinvar_build, payload_offset, chunk_size) {
        const ptr0 = passArray8ToWasm0(directory_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(personal_variants_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(personal_build, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(clinvar_build, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_plan_intersection_chunks(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, payload_offset, chunk_size);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Plans minimal hierarchical Leaf Directory HTTP Range requests for personal DNA ↔ ClinVar intersection.
     * @param {Uint8Array} root_dir_bytes
     * @param {string} personal_variants_json
     * @param {string} personal_build
     * @param {string} clinvar_build
     * @returns {any}
     */
    static plan_intersection_leaves(root_dir_bytes, personal_variants_json, personal_build, clinvar_build) {
        const ptr0 = passArray8ToWasm0(root_dir_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(personal_variants_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(personal_build, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(clinvar_build, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_plan_intersection_leaves(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Plans minimal HTTP Range Requests from a downloaded .plasmid flat or leaf directory index.
     * @param {Uint8Array} directory_bytes
     * @param {string} chrom
     * @param {number} start_pos
     * @param {number} end_pos
     * @param {number} payload_offset
     * @param {number} chunk_size
     * @returns {any}
     */
    static plan_range_slice(directory_bytes, chrom, start_pos, end_pos, payload_offset, chunk_size) {
        const ptr0 = passArray8ToWasm0(directory_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(chrom, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_plan_range_slice(ptr0, len0, ptr1, len1, start_pos, end_pos, payload_offset, chunk_size);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Finds overlapping leaf directory pointers and coalesced HTTP Range headers for a coordinate window.
     * @param {Uint8Array} root_dir_bytes
     * @param {string} chrom
     * @param {number} start_pos
     * @param {number} end_pos
     * @returns {any}
     */
    static query_root_leaves(root_dir_bytes, chrom, start_pos, end_pos) {
        const ptr0 = passArray8ToWasm0(root_dir_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(chrom, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_query_root_leaves(ptr0, len0, ptr1, len1, start_pos, end_pos);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Verifies SHA-256 integrity of a downloaded chunk against an expected 32-byte hash.
     * @param {Uint8Array} chunk_bytes
     * @param {Uint8Array} expected_hash
     * @returns {boolean}
     */
    static verify_chunk_hash(chunk_bytes, expected_hash) {
        const ptr0 = passArray8ToWasm0(chunk_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(expected_hash, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_verify_chunk_hash(ptr0, len0, ptr1, len1);
        return ret !== 0;
    }
    /**
     * Verifies locus coordinate & allele consistency against authoritative VCF/FASTA data without synthetic strings.
     * @param {string} rsid
     * @param {string} chrom
     * @param {number} queried_pos
     * @param {string} asserted_ref
     * @param {number} authoritative_pos
     * @param {string} authoritative_ref
     * @param {string | null | undefined} reference_slice
     * @param {number} slice_start_pos
     * @param {string} target_build
     * @returns {boolean}
     */
    static verify_locus_consistency(rsid, chrom, queried_pos, asserted_ref, authoritative_pos, authoritative_ref, reference_slice, slice_start_pos, target_build) {
        const ptr0 = passStringToWasm0(rsid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(chrom, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(asserted_ref, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(authoritative_ref, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(reference_slice) ? 0 : passStringToWasm0(reference_slice, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ptr5 = passStringToWasm0(target_build, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_verify_locus_consistency(ptr0, len0, ptr1, len1, queried_pos, ptr2, len2, authoritative_pos, ptr3, len3, ptr4, len4, slice_start_pos, ptr5, len5);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Recomputes full BEP 52 SHA-256 Merkle Tree over container payload chunks and verifies root hash.
     * @param {Uint8Array} payload_bytes
     * @param {number} chunk_size
     * @param {string} expected_root_hex
     * @returns {any}
     */
    static verify_merkle_tree(payload_bytes, chunk_size, expected_root_hex) {
        const ptr0 = passArray8ToWasm0(payload_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(expected_root_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_verify_merkle_tree(ptr0, len0, chunk_size, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Verifies single-nucleotide reference sequence fingerprint to block coordinate drift.
     * @param {string} rsid
     * @param {string} chrom
     * @param {number} pos
     * @param {string} ref_allele
     * @param {string} reference_slice
     * @param {number} slice_start_pos
     * @param {string} target_build
     * @returns {boolean}
     */
    static verify_ref_fingerprint(rsid, chrom, pos, ref_allele, reference_slice, slice_start_pos, target_build) {
        const ptr0 = passStringToWasm0(rsid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(chrom, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(ref_allele, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(reference_slice, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(target_build, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.plasmidwasmengine_verify_ref_fingerprint(ptr0, len0, ptr1, len1, pos, ptr2, len2, ptr3, len3, slice_start_pos, ptr4, len4);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
}
if (Symbol.dispose) PlasmidWasmEngine.prototype[Symbol.dispose] = PlasmidWasmEngine.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_67e7344beaa85059: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_string_c4f7cb494a2a21f1: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_8d36e20aa758e411: function() {
            const ret = new Map();
            return ret;
        },
        __wbg_new_bebc3f4757acf305: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_ffa92086ea89f79c: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_set_13d25b81ab403f5e: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_bf6dde4923b9b059: function(arg0, arg1, arg2) {
            const ret = arg0.set(arg1, arg2);
            return ret;
        },
        __wbindgen_generic_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_generic_0000000000000003: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./plasmid_core_bg.js": import0,
    };
}

const PlasmidWasmEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_plasmidwasmengine_free(ptr, 1));

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('plasmid_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
