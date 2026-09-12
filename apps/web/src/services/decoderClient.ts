import type { ParsedVariant, DensityBin } from '../workers/genome-decoder.worker';

class DecoderWorkerClient {
  private static instance: DecoderWorkerClient;
  private worker: Worker | null = null;
  private callbacks: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private reqId: number = 0;

  private constructor() {
    this.initWorker();
  }

  public static getInstance(): DecoderWorkerClient {
    if (!DecoderWorkerClient.instance) {
      DecoderWorkerClient.instance = new DecoderWorkerClient();
    }
    return DecoderWorkerClient.instance;
  }

  private initWorker() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('../workers/genome-decoder.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.worker.onmessage = (e: MessageEvent) => {
          const { id, success, error, ...rest } = e.data;
          const cb = this.callbacks.get(id);
          if (cb) {
            this.callbacks.delete(id);
            if (success) {
              cb.resolve(rest);
            } else {
              cb.reject(new Error(error || 'Worker operation failed'));
            }
          }
        };
      } catch (err) {
        console.warn('Web Worker initialization failed, fallback to sync processing', err);
      }
    }
  }

  public async parseVcfChunk(
    buffer: ArrayBuffer,
    targetChrom?: string,
    windowStart?: number,
    windowEnd?: number
  ): Promise<ParsedVariant[]> {
    if (!this.worker) {
      // Inline fallback
      return this.fallbackParseVcf(buffer, targetChrom, windowStart, windowEnd);
    }

    const id = `req_${++this.reqId}`;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, {
        resolve: (data) => resolve(data.variants),
        reject,
      });
      this.worker!.postMessage(
        {
          id,
          type: 'PARSE_VCF_CHUNK',
          payload: { buffer, targetChrom, windowStart, windowEnd },
        },
        [buffer]
      );
    });
  }

  public async computeDensityBins(
    variants: ParsedVariant[],
    start: number,
    end: number,
    numBins: number = 100
  ): Promise<DensityBin[]> {
    if (!this.worker) {
      return this.fallbackDensityBins(variants, start, end, numBins);
    }

    const id = `req_${++this.reqId}`;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, {
        resolve: (data) => resolve(data.bins),
        reject,
      });
      this.worker!.postMessage({
        id,
        type: 'COMPUTE_DENSITY_BINS',
        payload: { variants, start, end, numBins },
      });
    });
  }

  private fallbackParseVcf(
    buffer: ArrayBuffer,
    targetChrom?: string,
    windowStart?: number,
    windowEnd?: number
  ): ParsedVariant[] {
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
      if (targetChrom && chrom !== targetChrom) continue;
      if (windowStart !== undefined && windowEnd !== undefined) {
        if (pos < windowStart || pos > windowEnd) continue;
      }
      variants.push({
        chrom,
        pos,
        id: parts[2],
        ref: parts[3],
        alt: parts[4],
        qual: parseFloat(parts[5]) || 0,
        filter: parts[6],
        score: 1.0,
      });
    }
    return variants;
  }

  private fallbackDensityBins(
    variants: ParsedVariant[],
    start: number,
    end: number,
    numBins: number
  ): DensityBin[] {
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
      const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor((v.pos - start) / binSize)));
      bins[binIdx].count += 1;
      bins[binIdx].score += v.score || 1.0;
    }
    return bins;
  }
}

export const decoderClient = DecoderWorkerClient.getInstance();
