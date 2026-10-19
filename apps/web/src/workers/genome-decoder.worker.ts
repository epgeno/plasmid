/**
 * Web Worker: Background Genome Decoder & Density Binning
 * 
 * Offloads heavy VCF/FASTA chunk parsing from the main React UI thread,
 * ensuring 60fps buttery smooth semantic zooming and navigation.
 */

export interface ParsedVariant {
  chrom: string;
  pos: number;
  id: string;
  ref: string;
  alt: string;
  qual: number;
  filter: string;
  gene?: string;
  clinvar?: string;
  score: number; // ClinVar weighted score
}

export interface DensityBin {
  start: number;
  end: number;
  score: number;
  count: number;
  pathogenicCount: number;
}

self.onmessage = (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    switch (type) {
      case 'PARSE_VCF_CHUNK': {
        const { buffer, targetChrom, windowStart, windowEnd } = payload;
        const text = new TextDecoder('utf-8').decode(buffer);
        const lines = text.split('\n');
        const variants: ParsedVariant[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          const parts = trimmed.split('\t');
          if (parts.length < 8) continue;

          const chrom = parts[0];
          const pos = parseInt(parts[1], 10);
          if (isNaN(pos)) continue;

          // Filter by chromosome if specified
          if (targetChrom && chrom !== targetChrom) continue;
          // Filter by window if specified
          if (windowStart !== undefined && windowEnd !== undefined) {
            if (pos < windowStart || pos > windowEnd) continue;
          }

          const id_str = parts[2];
          const ref = parts[3];
          const alt = parts[4];
          const qual = parseFloat(parts[5]) || 0;
          const filter = parts[6];
          const info = parts[7];

          // Parse ClinVar and Gene info
          let gene: string | undefined;
          let clinvar: string | undefined;
          let score = 1.0; // default baseline

          for (const item of info.split(';')) {
            if (item.startsWith('GENE=')) {
              gene = item.substring(5);
            } else if (item.startsWith('CLNSIG=')) {
              clinvar = item.substring(7);
            }
          }

          if (clinvar) {
            const lower = clinvar.toLowerCase();
            if (lower.includes('pathogenic')) {
              score = 10.0;
            } else if (lower.includes('risk')) {
              score = 5.0;
            } else if (lower.includes('uncertain') || lower.includes('vus')) {
              score = 2.0;
            } else if (lower.includes('benign')) {
              score = 0.5;
            }
          }

          variants.push({
            chrom,
            pos,
            id: id_str,
            ref,
            alt,
            qual,
            filter,
            gene,
            clinvar,
            score,
          });
        }

        self.postMessage({ id, success: true, variants });
        break;
      }

      case 'COMPUTE_DENSITY_BINS': {
        const { variants, start, end, numBins = 100 } = payload;
        const span = Math.max(end - start, 1);
        const binSize = span / numBins;
        const bins: DensityBin[] = [];

        for (let i = 0; i < numBins; i++) {
          bins.push({
            start: Math.floor(start + i * binSize),
            end: Math.floor(start + (i + 1) * binSize),
            score: 0,
            count: 0,
            pathogenicCount: 0,
          });
        }

        for (const v of variants) {
          if (v.pos < start || v.pos > end) continue;
          const binIdx = Math.min(
            numBins - 1,
            Math.max(0, Math.floor((v.pos - start) / binSize))
          );
          bins[binIdx].count += 1;
          bins[binIdx].score += v.score || 1.0;
          if (v.clinvar && v.clinvar.toLowerCase().includes('pathogenic')) {
            bins[binIdx].pathogenicCount += 1;
          }
        }

        self.postMessage({ id, success: true, bins });
        break;
      }

      case 'DECODE_FASTA_SLICE': {
        const { buffer } = payload;
        const text = new TextDecoder('utf-8').decode(buffer);
        // Strip FASTA header line if present
        const lines = text.split('\n');
        let seq = '';
        for (const line of lines) {
          if (!line.startsWith('>')) {
            seq += line.trim();
          }
        }
        self.postMessage({ id, success: true, sequence: seq });
        break;
      }

      default:
        self.postMessage({ id, success: false, error: `Unknown action: ${type}` });
    }
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message || 'Worker error' });
  }
};
