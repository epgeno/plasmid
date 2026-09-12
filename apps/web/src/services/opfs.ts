/**
 * OPFS (Origin Private File System) Storage Manager
 * 
 * Provides local-first, airgapped genomic data storage in the browser sandbox.
 * Prevents side-channel access-log leaks to edge/ISP by slicing chunks locally (RFC-0002).
 */

export interface OPFSQuota {
  usage: number;
  quota: number;
  usageFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
}

export class OPFSManager {
  private static instance: OPFSManager;
  private rootDir: FileSystemDirectoryHandle | null = null;
  private airgapEnabled: boolean = false;

  private constructor() {
    // Check saved airgap preference
    const saved = localStorage.getItem('plasmid_airgap_mode');
    this.airgapEnabled = saved === 'true';
  }

  public static getInstance(): OPFSManager {
    if (!OPFSManager.instance) {
      OPFSManager.instance = new OPFSManager();
    }
    return OPFSManager.instance;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage;
  }

  public isAirgapped(): boolean {
    return this.airgapEnabled;
  }

  public setAirgapped(enabled: boolean): void {
    this.airgapEnabled = enabled;
    localStorage.setItem('plasmid_airgap_mode', enabled ? 'true' : 'false');
  }

  private async getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!this.rootDir) {
      if (!this.isSupported()) {
        throw new Error('OPFS is not supported in this browser environment');
      }
      this.rootDir = await navigator.storage.getDirectory();
    }
    return this.rootDir;
  }

  /**
   * Check if a dataset file exists in OPFS
   */
  public async hasFile(filename: string): Promise<boolean> {
    try {
      const root = await this.getRoot();
      await root.getFileHandle(filename);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata (size, lastModified)
   */
  public async getFileInfo(filename: string): Promise<{ size: number; lastModified: number } | null> {
    try {
      const root = await this.getRoot();
      const handle = await root.getFileHandle(filename);
      const file = await handle.getFile();
      return {
        size: file.size,
        lastModified: file.lastModified,
      };
    } catch {
      return null;
    }
  }

  /**
   * Cache a remote dataset (e.g. /api/data/demo.plasmid) into OPFS for airgap isolation
   */
  public async cacheRemoteDataset(
    filename: string,
    remoteUrl: string,
    onProgress?: (receivedBytes: number, totalBytes: number) => void
  ): Promise<number> {
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote dataset: HTTP ${response.status} ${response.statusText}`);
    }

    const contentLength = +(response.headers.get('content-length') || 0);
    const root = await this.getRoot();
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();

    if (!response.body) {
      const arrayBuffer = await response.arrayBuffer();
      await writable.write(arrayBuffer);
      await writable.close();
      if (onProgress) onProgress(arrayBuffer.byteLength, arrayBuffer.byteLength);
      return arrayBuffer.byteLength;
    }

    const reader = response.body.getReader();
    let received = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          await writable.write(value);
          received += value.length;
          if (onProgress) {
            onProgress(received, contentLength);
          }
        }
      }
      await writable.close();
      return received;
    } catch (err) {
      await writable.abort();
      throw err;
    }
  }

  /**
   * Save an ArrayBuffer directly to OPFS
   */
  public async saveBuffer(filename: string, buffer: ArrayBuffer): Promise<void> {
    const root = await this.getRoot();
    const handle = await root.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(buffer);
    await writable.close();
  }

  /**
   * Read exact byte slice from OPFS
   */
  public async readRange(filename: string, start: number, end: number): Promise<ArrayBuffer> {
    const root = await this.getRoot();
    const handle = await root.getFileHandle(filename);
    const file = await handle.getFile();
    const slice = file.slice(start, end + 1);
    return await slice.arrayBuffer();
  }

  /**
   * Delete dataset from OPFS
   */
  public async deleteFile(filename: string): Promise<void> {
    const root = await this.getRoot();
    await root.removeEntry(filename);
  }

  /**
   * Get storage quota statistics
   */
  public async getQuota(): Promise<OPFSQuota | null> {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        usage,
        quota,
        usageFormatted: this.formatBytes(usage),
        quotaFormatted: this.formatBytes(quota),
        percentUsed: Math.round(percentUsed * 10) / 10,
      };
    }
    return null;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const opfsManager = OPFSManager.getInstance();
export const opfs = opfsManager;

