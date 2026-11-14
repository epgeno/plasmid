import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initWorkerWasmSync,
  handleWorkerRequest,
} from '../.wrangler/test-build/workers/genome-decoder.worker.js';
import { plasmidContainerClient } from '../.wrangler/test-build/services/plasmidContainerClient.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const wasmBytes = readFileSync(
  resolve(__dirname, '../.wrangler/test-build/wasm/plasmid_core_bg.wasm')
);
const demoPlasmidBytes = readFileSync(resolve(__dirname, '../public/demo.plasmid'));

// Initialize real Rust-compiled plasmid-core WASM engine before worker unit tests
initWorkerWasmSync(wasmBytes);

/**
 * Helper: Constructs a minimal valid flat .plasmid binary container (128B header + 32B entry + metadata + 16KB chunk)
 */
function buildFlatPlasmidFixture({ chromId, entryType, startPos, endPos, payloadText }) {
  const CHUNK_SIZE = 16384;
  const payloadBytes = Buffer.from(payloadText, 'utf8');
  const chunk = Buffer.alloc(CHUNK_SIZE, 0);
  payloadBytes.copy(chunk, 0);

  const rootHash = createHash('sha256').update(chunk).digest();

  // 32-byte PlasmidIndexEntry
  const indexEntry = Buffer.alloc(32, 0);
  indexEntry.writeUInt16LE(chromId, 0);
  indexEntry.writeUInt8(entryType, 2);
  indexEntry.writeUInt8(0, 3);
  indexEntry.writeBigUInt64LE(BigInt(startPos), 4);
  indexEntry.writeBigUInt64LE(BigInt(endPos), 12);
  indexEntry.writeUInt32LE(0, 20); // chunk_start
  indexEntry.writeUInt32LE(1, 24); // chunk_count
  indexEntry.writeUInt32LE(payloadBytes.length, 28); // payload_bytes

  const metadataBytes = Buffer.from('{"license":"Public Domain"}', 'utf8');
  const indexOffset = 128;
  const indexLength = indexEntry.length;
  const metadataOffset = indexOffset + indexLength;
  const metadataLength = metadataBytes.length;

  // 128-byte PlasmidHeader
  const header = Buffer.alloc(128, 0);
  Buffer.from('PLASMID\x01', 'binary').copy(header, 0);
  header.writeUInt16LE(1, 8); // version = 1
  header.writeUInt16LE(0, 10); // flags = 0 (flat index)
  Buffer.from('GRCh38', 'utf8').copy(header, 12);
  rootHash.copy(header, 28);
  header.writeUInt32LE(CHUNK_SIZE, 60);
  header.writeBigUInt64LE(1n, 64); // total_chunks = 1
  header.writeBigUInt64LE(BigInt(CHUNK_SIZE), 72); // total_payload_bytes
  header.writeBigUInt64LE(BigInt(indexOffset), 80);
  header.writeBigUInt64LE(BigInt(indexLength), 88);
  header.writeBigUInt64LE(BigInt(metadataOffset), 96);
  header.writeBigUInt64LE(BigInt(metadataLength), 104);

  return Buffer.concat([header, indexEntry, metadataBytes, chunk]);
}

test('WASM worker parses 128B header and 2-stage hierarchical leaves from real demo.plasmid', async () => {
  const headerSlice = demoPlasmidBytes.subarray(0, 128);
  const { header } = await handleWorkerRequest('PARSE_HEADER', { buffer: headerSlice });

  assert.equal(header.version, 1);
  assert.equal(header.is_hierarchical, true);
  assert.equal(header.reference_build, 'GRCh38');
  assert.equal(
    header.root_hash_hex,
    '2194a99b799a68533137dbecc466dcd386f7b171d13cee2872403f8726f716a6'
  );
  assert.equal(header.chunk_size, 16384);
  assert.equal(header.total_chunks, 8);
  assert.equal(header.index_offset, 128);
  assert.equal(header.index_length, 128);
  assert.equal(header.payload_offset, 16564);

  const rootDirSlice = demoPlasmidBytes.subarray(
    header.index_offset,
    header.index_offset + header.index_length
  );
  const { leaves } = await handleWorkerRequest('PARSE_ROOT_DIRECTORY', {
    buffer: rootDirSlice,
  });

  assert.equal(leaves.length, 4);
  assert.deepEqual(
    leaves.map((l) => l.chrom_name),
    ['chr7', 'chr13', 'chr17', 'chr19']
  );
});

test('WASM worker slices exact leaf & chunk ranges for BRCA2, APOE, BRAF, TP53, and FASTA without fake fallbacks', async () => {
  const { header } = await handleWorkerRequest('PARSE_HEADER', {
    buffer: demoPlasmidBytes.subarray(0, 128),
  });
  const rootDir = demoPlasmidBytes.subarray(
    header.index_offset,
    header.index_offset + header.index_length
  );

  // 1. Query APOE on chr19 (beyond 64KB offset: bytes=65716-82099)
  const { plan: apoeLeafPlan } = await handleWorkerRequest('QUERY_ROOT_LEAVES', {
    buffer: rootDir,
    chrom: 'chr19',
    startPos: 44905000,
    endPos: 44911000,
  });
  assert.equal(apoeLeafPlan.leaves.length, 1);
  assert.equal(apoeLeafPlan.leaves[0].chrom_name, 'chr19');

  const apoeLeaf = apoeLeafPlan.leaves[0];
  const apoeLeafBytes = demoPlasmidBytes.subarray(
    apoeLeaf.leaf_offset,
    apoeLeaf.leaf_offset + apoeLeaf.leaf_length
  );

  const { plan: apoeSlicePlan } = await handleWorkerRequest('PLAN_RANGE_SLICE', {
    buffer: apoeLeafBytes,
    chrom: 'chr19',
    startPos: 44905000,
    endPos: 44911000,
    payloadOffset: header.payload_offset,
    chunkSize: header.chunk_size,
  });
  assert.deepEqual(apoeSlicePlan.chunk_indices, [3]);
  assert.deepEqual(apoeSlicePlan.byte_ranges, [{ start: 65716, end: 82099 }]);

  const apoeChunk = demoPlasmidBytes.subarray(65716, 82100);
  const apoeDecoded = await handleWorkerRequest('DECODE_PLASMID_SLICE', {
    entries: apoeSlicePlan.entries,
    chunksBuffer: apoeChunk,
    chunkIndices: apoeSlicePlan.chunk_indices,
    chunkSize: header.chunk_size,
    chrom: 'chr19',
    startPos: 44905000,
    endPos: 44911000,
  });

  assert.equal(apoeDecoded.variants.length, 1);
  assert.equal(apoeDecoded.variants[0].gene, 'APOE');
  assert.equal(apoeDecoded.variants[0].id, 'rs429358');
  assert.equal(apoeDecoded.variants[0].ref, 'T');
  assert.equal(apoeDecoded.variants[0].alt, 'C');
  assert.equal(apoeDecoded.variants[0].clinvar, 'Risk_factor');
  assert.equal(apoeDecoded.chunkHashes.length, 1);
  assert.equal(
    apoeDecoded.chunkHashes[0].sha256_hex,
    'fdd281cc58734b068761d7508558c5f47356425a33ccf653db54e0701bc26be3'
  );

  // 2. Query BRCA2 on chr13 -> must return rs80359550 BRCA2 (never mislabeled as TP53!)
  const { plan: brcaLeafPlan } = await handleWorkerRequest('QUERY_ROOT_LEAVES', {
    buffer: rootDir,
    chrom: 'chr13',
    startPos: 32312000,
    endPos: 32318000,
  });
  const brcaLeaf = brcaLeafPlan.leaves[0];
  const { plan: brcaSlicePlan } = await handleWorkerRequest('PLAN_RANGE_SLICE', {
    buffer: demoPlasmidBytes.subarray(
      brcaLeaf.leaf_offset,
      brcaLeaf.leaf_offset + brcaLeaf.leaf_length
    ),
    chrom: 'chr13',
    startPos: 32312000,
    endPos: 32318000,
    payloadOffset: header.payload_offset,
    chunkSize: header.chunk_size,
  });
  const brcaRange = brcaSlicePlan.byte_ranges[0];
  const brcaDecoded = await handleWorkerRequest('DECODE_PLASMID_SLICE', {
    entries: brcaSlicePlan.entries,
    chunksBuffer: demoPlasmidBytes.subarray(brcaRange.start, brcaRange.end + 1),
    chunkIndices: brcaSlicePlan.chunk_indices,
    chunkSize: header.chunk_size,
    chrom: 'chr13',
    startPos: 32312000,
    endPos: 32318000,
  });
  assert.equal(brcaDecoded.variants.length, 1);
  assert.equal(brcaDecoded.variants[0].gene, 'BRCA2');
  assert.equal(brcaDecoded.variants[0].id, 'rs80359550');

  // 3. Query ReferenceFasta interval on chr7:1-80
  const { plan: chr7LeafPlan } = await handleWorkerRequest('QUERY_ROOT_LEAVES', {
    buffer: rootDir,
    chrom: 'chr7',
    startPos: 1,
    endPos: 80,
  });
  const chr7Leaf = chr7LeafPlan.leaves[0];
  const { plan: fastaPlan } = await handleWorkerRequest('PLAN_RANGE_SLICE', {
    buffer: demoPlasmidBytes.subarray(
      chr7Leaf.leaf_offset,
      chr7Leaf.leaf_offset + chr7Leaf.leaf_length
    ),
    chrom: 'chr7',
    startPos: 1,
    endPos: 80,
    payloadOffset: header.payload_offset,
    chunkSize: header.chunk_size,
  });
  assert.deepEqual(fastaPlan.chunk_indices, [4]);
  const fastaRange = fastaPlan.byte_ranges[0];
  const fastaDecoded = await handleWorkerRequest('DECODE_PLASMID_SLICE', {
    entries: fastaPlan.entries,
    chunksBuffer: demoPlasmidBytes.subarray(fastaRange.start, fastaRange.end + 1),
    chunkIndices: fastaPlan.chunk_indices,
    chunkSize: header.chunk_size,
    chrom: 'chr7',
    startPos: 1,
    endPos: 80,
  });
  assert.equal(fastaDecoded.variants.length, 0);
  assert.equal(fastaDecoded.referenceSequence?.length, 80);
  assert.ok(fastaDecoded.referenceSequence.startsWith('ATGCGATCGATCGATC'));

  // 4. Unindexed chromosome & empty interval return honest empty results
  const { plan: emptyChr1 } = await handleWorkerRequest('QUERY_ROOT_LEAVES', {
    buffer: rootDir,
    chrom: 'chr1',
    startPos: 100000,
    endPos: 200000,
  });
  assert.equal(emptyChr1.leaves.length, 0);
});

test('WASM worker verifies full BEP 52 SHA-256 Merkle root and rejects tampered chunks', async () => {
  const { header } = await handleWorkerRequest('PARSE_HEADER', {
    buffer: demoPlasmidBytes.subarray(0, 128),
  });
  const payload = demoPlasmidBytes.subarray(header.payload_offset);

  const { verification } = await handleWorkerRequest('VERIFY_MERKLE_TREE', {
    payloadBuffer: payload,
    chunkSize: header.chunk_size,
    expectedRootHex: header.root_hash_hex,
  });

  assert.equal(verification.verified, true);
  assert.equal(verification.total_chunks, 8);
  assert.equal(verification.calculated_root_hex, header.root_hash_hex);

  // Tamper 1 byte in chunk #2 and verify cryptographic rejection
  const tamperedPayload = new Uint8Array(payload);
  tamperedPayload[header.chunk_size * 2 + 10] ^= 0xff;

  const { verification: badVerification } = await handleWorkerRequest(
    'VERIFY_MERKLE_TREE',
    {
      payloadBuffer: tamperedPayload,
      chunkSize: header.chunk_size,
      expectedRootHex: header.root_hash_hex,
    }
  );
  assert.equal(badVerification.verified, false);
  assert.notEqual(badVerification.calculated_root_hex, header.root_hash_hex);
});

test('WASM worker decodes flat .plasmid binary with ClinVarAnnotation ACMG & PMID extraction and Liftover guard', async () => {
  const flatContainer = buildFlatPlasmidFixture({
    chromId: 7,
    entryType: 3, // EntryType::ClinVarAnnotation
    startPos: 140753300,
    endPos: 140753400,
    payloadText:
      '### BRAF V600E Clinical Evidence\nConfirmed somatic hotspot [PS1, PM1, PP3]. Cite PMID:12068308 and PMID:20818844.\n',
  });

  const { header } = await handleWorkerRequest('PARSE_HEADER', {
    buffer: flatContainer.subarray(0, 128),
  });
  assert.equal(header.is_hierarchical, false);
  assert.equal(header.total_chunks, 1);

  const flatDir = flatContainer.subarray(
    header.index_offset,
    header.index_offset + header.index_length
  );
  const { plan } = await handleWorkerRequest('PLAN_RANGE_SLICE', {
    buffer: flatDir,
    chrom: 'chr7',
    startPos: 140753330,
    endPos: 140753340,
    payloadOffset: header.payload_offset,
    chunkSize: header.chunk_size,
  });
  assert.deepEqual(plan.chunk_indices, [0]);

  const chunkRange = plan.byte_ranges[0];
  const decoded = await handleWorkerRequest('DECODE_PLASMID_SLICE', {
    entries: plan.entries,
    chunksBuffer: flatContainer.subarray(chunkRange.start, chunkRange.end + 1),
    chunkIndices: plan.chunk_indices,
    chunkSize: header.chunk_size,
    chrom: 'chr7',
    startPos: 140753330,
    endPos: 140753340,
  });

  assert.equal(decoded.annotations.length, 1);
  assert.equal(decoded.annotations[0].title, 'BRAF V600E Clinical Evidence');
  assert.deepEqual(decoded.annotations[0].acmg_criteria, ['PS1', 'PM1', 'PP3']);
  assert.deepEqual(decoded.annotations[0].pubmed_ids, ['12068308', '20818844']);

  // Verify Liftover roundtrip & CoordinateGuard +1bp drift rejection
  const { result: lifted } = await handleWorkerRequest('LIFTOVER_COORDINATE', {
    direction: 'hg38_to_hg19',
    chrom: 'chr7',
    pos: 140753336,
    refAllele: 'A',
  });
  assert.equal(lifted.lifted_pos, 140453136);

  await assert.rejects(
    () =>
      handleWorkerRequest('VERIFY_REF_FINGERPRINT', {
        rsid: 'rs113488022',
        chrom: 'chr7',
        pos: 140753337, // +1 bp drift
        refAllele: 'A',
        referenceSlice: 'AC',
        sliceStartPos: 140753336,
        targetBuild: 'GRCh38',
      }),
    /Coordinate Drift|Mismatch|expected/i
  );
});

test('plasmidContainerClient issues exact HTTP 206 Range slices (never fixed bytes=0-65535) and surfaces errors without fake fallbacks', async () => {
  const originalFetch = globalThis.fetch;
  const recordedRanges = [];
  let shouldFailNetwork = false;

  globalThis.fetch = async (_url, init) => {
    if (shouldFailNetwork) {
      return new Response('Upstream storage offline', { status: 503 });
    }
    const headers = new Headers(init?.headers);
    const range = headers.get('range');
    recordedRanges.push(range);

    const match = /^bytes=(\d+)-(\d+)$/i.exec(range || '');
    assert.ok(match, `Expected explicit HTTP Range header, got: ${range}`);
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), demoPlasmidBytes.length - 1);
    const slice = demoPlasmidBytes.subarray(start, end + 1);

    return new Response(slice, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${demoPlasmidBytes.length}`,
        'Content-Length': String(slice.byteLength),
        'Accept-Ranges': 'bytes',
      },
    });
  };

  try {
    plasmidContainerClient.clearCache();

    // 1. Query chr13 BRCA2 window -> must fetch 128B header, 128B root dir, metadata, 64B chr13 leaf, and 16KB chunk #1
    const brcaWin = await plasmidContainerClient.queryWindow({
      chrom: 'chr13',
      startPos: 32312000,
      endPos: 32318000,
      datasetUrl: 'https://test.local/api/data/demo.plasmid',
    });

    assert.ok(
      !recordedRanges.includes('bytes=0-65535'),
      'Must never issue hardcoded fixed 64KB Range request'
    );
    assert.equal(recordedRanges[0], 'bytes=0-127');
    assert.equal(recordedRanges[1], 'bytes=128-255');
    assert.equal(brcaWin.variants.length, 1);
    assert.equal(brcaWin.variants[0].gene, 'BRCA2');
    assert.equal(brcaWin.variants[0].id, 'rs80359550');

    // 2. Query empty genomic window on chr2 -> 0 variants, 0 extra HTTP requests
    const countBeforeEmpty = recordedRanges.length;
    const emptyWin = await plasmidContainerClient.queryWindow({
      chrom: 'chr2',
      startPos: 1000000,
      endPos: 1010000,
      datasetUrl: 'https://test.local/api/data/demo.plasmid',
    });
    assert.equal(emptyWin.variants.length, 0);
    assert.equal(recordedRanges.length, countBeforeEmpty);

    // 3. Network failure on uncached dataset -> throws honest error instead of injecting fake variants
    shouldFailNetwork = true;
    await assert.rejects(
      () =>
        plasmidContainerClient.queryWindow({
          chrom: 'chr7',
          startPos: 140750000,
          endPos: 140756000,
          datasetUrl: 'https://test.local/api/data/unreachable.plasmid',
        }),
      /HTTP 503/
    );
  } finally {
    globalThis.fetch = originalFetch;
    plasmidContainerClient.clearCache();
  }
});
