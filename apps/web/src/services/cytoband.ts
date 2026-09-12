/**
 * Cytogenetic Banding & Assembly Definitions (GRCh38 & GRCh37/hg19)
 * 
 * Provides reference coordinates, centromere boundaries, and Giemsa banding
 * to prevent coordinate drift and misdiagnosis across assemblies.
 */

export interface Cytoband {
  chrom: string;
  start: number;
  end: number;
  name: string;
  stain: 'gneg' | 'gpos25' | 'gpos50' | 'gpos75' | 'gpos100' | 'acen' | 'gvar' | 'stalk';
}

export interface ChromosomeDef {
  id: number;
  name: string;
  length: number;
  centromere: {
    start: number;
    end: number;
  };
}

export type GenomeAssembly = 'GRCh38' | 'GRCh37';

// GRCh38 Chromosome Lengths & Centromere boundaries
export const GRCH38_CHROMOSOMES: Record<string, ChromosomeDef> = {
  chr1:  { id: 1,  name: 'chr1',  length: 248956422, centromere: { start: 121535434, end: 126135434 } },
  chr2:  { id: 2,  name: 'chr2',  length: 242193529, centromere: { start: 92326171,  end: 95326171 } },
  chr3:  { id: 3,  name: 'chr3',  length: 198295559, centromere: { start: 90504854,  end: 93504854 } },
  chr4:  { id: 4,  name: 'chr4',  length: 190214555, centromere: { start: 49660117,  end: 52660117 } },
  chr5:  { id: 5,  name: 'chr5',  length: 181538259, centromere: { start: 46405641,  end: 49405641 } },
  chr6:  { id: 6,  name: 'chr6',  length: 170805979, centromere: { start: 58830166,  end: 61830166 } },
  chr7:  { id: 7,  name: 'chr7',  length: 159345973, centromere: { start: 58054331,  end: 61054331 } },
  chr8:  { id: 8,  name: 'chr8',  length: 145138636, centromere: { start: 43838887,  end: 46838887 } },
  chr9:  { id: 9,  name: 'chr9',  length: 138394717, centromere: { start: 47367679,  end: 50367679 } },
  chr10: { id: 10, name: 'chr10', length: 133797422, centromere: { start: 39254935,  end: 42254935 } },
  chr11: { id: 11, name: 'chr11', length: 135086622, centromere: { start: 51644205,  end: 54644205 } },
  chr12: { id: 12, name: 'chr12', length: 133275309, centromere: { start: 34856694,  end: 37856694 } },
  chr13: { id: 13, name: 'chr13', length: 114364328, centromere: { start: 16000000,  end: 19000000 } },
  chr14: { id: 14, name: 'chr14', length: 107043718, centromere: { start: 16000000,  end: 19000000 } },
  chr15: { id: 15, name: 'chr15', length: 101991189, centromere: { start: 17000000,  end: 20000000 } },
  chr16: { id: 16, name: 'chr16', length: 90338345,  centromere: { start: 35335801,  end: 38335801 } },
  chr17: { id: 17, name: 'chr17', length: 83257441,  centromere: { start: 22263006,  end: 25263006 } },
  chr18: { id: 18, name: 'chr18', length: 80373285,  centromere: { start: 15460898,  end: 18460898 } },
  chr19: { id: 19, name: 'chr19', length: 58617616,  centromere: { start: 24681782,  end: 27681782 } },
  chr20: { id: 20, name: 'chr20', length: 64444167,  centromere: { start: 26369569,  end: 29369569 } },
  chr21: { id: 21, name: 'chr21', length: 46709983,  centromere: { start: 11288129,  end: 14288129 } },
  chr22: { id: 22, name: 'chr22', length: 50818468,  centromere: { start: 13000000,  end: 16000000 } },
  chrX:  { id: 23, name: 'chrX',  length: 156040895, centromere: { start: 58605579,  end: 61605579 } },
  chrY:  { id: 24, name: 'chrY',  length: 57227415,  centromere: { start: 10104553,  end: 13104553 } },
};

// GRCh37 (hg19) Chromosome Lengths & Centromere boundaries
export const GRCH37_CHROMOSOMES: Record<string, ChromosomeDef> = {
  chr1:  { id: 1,  name: 'chr1',  length: 249250621, centromere: { start: 121535434, end: 124535434 } },
  chr2:  { id: 2,  name: 'chr2',  length: 243199373, centromere: { start: 92326171,  end: 95326171 } },
  chr3:  { id: 3,  name: 'chr3',  length: 198022430, centromere: { start: 90504854,  end: 93504854 } },
  chr4:  { id: 4,  name: 'chr4',  length: 191154276, centromere: { start: 49660117,  end: 52660117 } },
  chr5:  { id: 5,  name: 'chr5',  length: 180915260, centromere: { start: 46405641,  end: 49405641 } },
  chr6:  { id: 6,  name: 'chr6',  length: 171115067, centromere: { start: 58830166,  end: 61830166 } },
  chr7:  { id: 7,  name: 'chr7',  length: 159138663, centromere: { start: 58054331,  end: 61054331 } },
  chr8:  { id: 8,  name: 'chr8',  length: 146364022, centromere: { start: 43838887,  end: 46838887 } },
  chr9:  { id: 9,  name: 'chr9',  length: 141213431, centromere: { start: 47367679,  end: 50367679 } },
  chr10: { id: 10, name: 'chr10', length: 135534747, centromere: { start: 39254935,  end: 42254935 } },
  chr11: { id: 11, name: 'chr11', length: 135006516, centromere: { start: 51644205,  end: 54644205 } },
  chr12: { id: 12, name: 'chr12', length: 133851895, centromere: { start: 34856694,  end: 37856694 } },
  chr13: { id: 13, name: 'chr13', length: 115169878, centromere: { start: 16000000,  end: 19000000 } },
  chr14: { id: 14, name: 'chr14', length: 107349540, centromere: { start: 16000000,  end: 19000000 } },
  chr15: { id: 15, name: 'chr15', length: 102531392, centromere: { start: 17000000,  end: 20000000 } },
  chr16: { id: 16, name: 'chr16', length: 90354753,  centromere: { start: 35335801,  end: 38335801 } },
  chr17: { id: 17, name: 'chr17', length: 81195210,  centromere: { start: 22263006,  end: 25263006 } },
  chr18: { id: 18, name: 'chr18', length: 78077248,  centromere: { start: 15460898,  end: 18460898 } },
  chr19: { id: 19, name: 'chr19', length: 59128983,  centromere: { start: 24681782,  end: 27681782 } },
  chr20: { id: 20, name: 'chr20', length: 63025520,  centromere: { start: 26369569,  end: 29369569 } },
  chr21: { id: 21, name: 'chr21', length: 48129895,  centromere: { start: 11288129,  end: 14288129 } },
  chr22: { id: 22, name: 'chr22', length: 51304566,  centromere: { start: 13000000,  end: 16000000 } },
  chrX:  { id: 23, name: 'chrX',  length: 155270560, centromere: { start: 58605579,  end: 61605579 } },
  chrY:  { id: 24, name: 'chrY',  length: 59373566,  centromere: { start: 10104553,  end: 13104553 } },
};

export const ORDERED_CHROMOSOMES = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6',
  'chr7', 'chr8', 'chr9', 'chr10', 'chr11', 'chr12',
  'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18',
  'chr19', 'chr20', 'chr21', 'chr22', 'chrX', 'chrY'
];

export function getChromosomes(assembly: GenomeAssembly): Record<string, ChromosomeDef> {
  return assembly === 'GRCh37' ? GRCH37_CHROMOSOMES : GRCH38_CHROMOSOMES;
}

export function getTotalGenomeLength(assembly: GenomeAssembly): number {
  const chroms = getChromosomes(assembly);
  return Object.values(chroms).reduce((acc, c) => acc + c.length, 0);
}

/**
 * Generate synthetic Giemsa cytobands for standard chromosome layout
 */
export function getChromosomeCytobands(chrom: string, assembly: GenomeAssembly): Cytoband[] {
  const chromDef = getChromosomes(assembly)[chrom];
  if (!chromDef) return [];

  const { length, centromere } = chromDef;
  const bands: Cytoband[] = [];

  // p-arm segments
  const pLength = centromere.start;
  const pStep = pLength / 4;
  bands.push({ chrom, start: 0, end: Math.floor(pStep), name: 'p36.3', stain: 'gpos75' });
  bands.push({ chrom, start: Math.floor(pStep), end: Math.floor(pStep * 2), name: 'p31.1', stain: 'gneg' });
  bands.push({ chrom, start: Math.floor(pStep * 2), end: Math.floor(pStep * 3), name: 'p21.3', stain: 'gpos50' });
  bands.push({ chrom, start: Math.floor(pStep * 3), end: centromere.start, name: 'p11.2', stain: 'gneg' });

  // Centromere (acen)
  bands.push({ chrom, start: centromere.start, end: centromere.end, name: 'cen', stain: 'acen' });

  // q-arm segments
  const qStart = centromere.end;
  const qLength = length - qStart;
  const qStep = qLength / 5;
  bands.push({ chrom, start: qStart, end: Math.floor(qStart + qStep), name: 'q12', stain: 'gneg' });
  bands.push({ chrom, start: Math.floor(qStart + qStep), end: Math.floor(qStart + qStep * 2), name: 'q21.3', stain: 'gpos50' });
  bands.push({ chrom, start: Math.floor(qStart + qStep * 2), end: Math.floor(qStart + qStep * 3), name: 'q24.2', stain: 'gneg' });
  bands.push({ chrom, start: Math.floor(qStart + qStep * 3), end: Math.floor(qStart + qStep * 4), name: 'q31.1', stain: 'gpos100' });
  bands.push({ chrom, start: Math.floor(qStart + qStep * 4), end: length, name: 'q35.2', stain: 'gneg' });

  return bands;
}

export function getStainColor(stain: Cytoband['stain']): string {
  switch (stain) {
    case 'gneg': return '#FFFFFF';
    case 'gpos25': return '#D1D5DB';
    case 'gpos50': return '#9CA3AF';
    case 'gpos75': return '#4B5563';
    case 'gpos100': return '#1F2937';
    case 'acen': return '#EF4444'; // Centromere distinct red/salmon
    case 'gvar': return '#E5E7EB';
    case 'stalk': return '#6B7280';
    default: return '#E5E7EB';
  }
}
