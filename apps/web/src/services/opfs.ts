/**
 * OPFS (Origin Private File System) Storage & Air-Gapped Vault Manager
 *
 * Provides local-first, airgapped genomic data storage in the browser sandbox.
 * Prevents side-channel access-log leaks to edge/ISP by storing & slicing files locally (RFC-0002).
 */

export interface OPFSQuota {
  usage: number;
  quota: number;
  usageFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
}

export type VaultFileKind = 'vcf' | 'plasmid';

export interface VaultFileEntry {
  name: string;
  opfsPath: string;
  kind: VaultFileKind;
  size: number;
  lastModified: number;
}

export const VAULT_DIR_NAME = 'vault';
const VAULT_INDEX_FILENAME = '_vault_index.json';
const ACTIVE_VAULT_STORAGE_KEY = 'plasmid_active_vault_path';
const PLASMID_MAGIC_ASCII = 'PLASMID\x01';

export function hasPlasmidMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PLASMID_MAGIC_ASCII.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

export function sanitizeVaultFilename(rawName: string): string {
  const base = rawName.split(/[\\/]/).pop()?.normalize('NFC').trim() || 'genome.vcf';
  const cleaned = base
    .replace(/[^\p{L}\p{N}._\-() ]+/gu, '_')
    .replace(/\s+/g, '_');
  const dotIdx = cleaned.lastIndexOf('.');
  const stem = dotIdx > 0 ? cleaned.slice(0, dotIdx) : cleaned;
  const ext = dotIdx > 0 ? cleaned.slice(dotIdx) : '';

  if (
    !cleaned ||
    cleaned === '.' ||
    cleaned === '..' ||
    cleaned === VAULT_INDEX_FILENAME ||
    /^_*$/.test(stem)
  ) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < base.length; i++) {
      hash ^= base.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `genome_${hash.toString(16).padStart(8, '0')}${ext || '.vcf'}`;
  }
  return cleaned;
}

export function detectVaultFileKind(filename: string, bytes?: Uint8Array): VaultFileKind {
  if (bytes && hasPlasmidMagic(bytes)) {
    return 'plasmid';
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.plasmid')) {
    return 'plasmid';
  }
  if (lower.endsWith('.vcf') || lower.endsWith('.txt')) {
    return 'vcf';
  }
  throw new Error(
    `Unsupported file extension for "${filename}". Supported formats: .vcf, .plasmid, .txt`
  );
}

export class OPFSManager {
  private static instance: OPFSManager;
  private rootDir: FileSystemDirectoryHandle | null = null;
  private testRootOverride: FileSystemDirectoryHandle | null = null;
  private airgapEnabled: boolean = false;

  private constructor() {
    const saved =
      typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
        ? window.localStorage.getItem('plasmid_airgap_mode')
        : null;
    this.airgapEnabled = saved === 'true';
  }

  public static getInstance(): OPFSManager {
    if (!OPFSManager.instance) {
      OPFSManager.instance = new OPFSManager();
    }
    return OPFSManager.instance;
  }

  public setRootHandleForTesting(handle: FileSystemDirectoryHandle | null): void {
    this.testRootOverride = handle;
    this.rootDir = handle;
  }

  public isSupported(): boolean {
    if (this.testRootOverride) return true;
    return (
      typeof navigator !== 'undefined' &&
      'storage' in navigator &&
      'getDirectory' in navigator.storage
    );
  }

  public isAirgapped(): boolean {
    return this.airgapEnabled;
  }

  public setAirgapped(enabled: boolean): void {
    this.airgapEnabled = enabled;
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem('plasmid_airgap_mode', enabled ? 'true' : 'false');
    }
  }

  public getActiveVaultPath(): string | null {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage.getItem(ACTIVE_VAULT_STORAGE_KEY);
    }
    return null;
  }

  public setActiveVaultPath(opfsPath: string | null): void {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      if (opfsPath) {
        window.localStorage.setItem(ACTIVE_VAULT_STORAGE_KEY, opfsPath);
      } else {
        window.localStorage.removeItem(ACTIVE_VAULT_STORAGE_KEY);
      }
    }
  }

  private async getRoot(): Promise<FileSystemDirectoryHandle> {
    if (this.testRootOverride) {
      return this.testRootOverride;
    }
    if (!this.rootDir) {
      if (!this.isSupported()) {
        throw new Error('OPFS is not supported in this browser environment');
      }
      this.rootDir = await navigator.storage.getDirectory();
    }
    return this.rootDir;
  }

  private async resolveParentAndName(
    filePath: string,
    createDirs: boolean = false
  ): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
    const segments = filePath
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== '.');
    if (segments.length === 0 || segments.some((s) => s === '..')) {
      throw new Error(`Invalid OPFS file path: "${filePath}"`);
    }

    let dir = await this.getRoot();
    for (let i = 0; i < segments.length - 1; i++) {
      dir = await dir.getDirectoryHandle(segments[i], { create: createDirs });
    }
    return { dir, name: segments[segments.length - 1] };
  }

  /**
   * Check if a dataset file exists in OPFS
   */
  public async hasFile(filename: string): Promise<boolean> {
    try {
      const { dir, name } = await this.resolveParentAndName(filename, false);
      await dir.getFileHandle(name);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata (size, lastModified)
   */
  public async getFileInfo(
    filename: string
  ): Promise<{ size: number; lastModified: number } | null> {
    try {
      const { dir, name } = await this.resolveParentAndName(filename, false);
      const handle = await dir.getFileHandle(name);
      const file = await handle.getFile();
      return {
        size: file.size,
        lastModified: file.lastModified || Date.now(),
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
      throw new Error(
        `Failed to fetch remote dataset: HTTP ${response.status} ${response.statusText}`
      );
    }

    const contentLength = +(response.headers.get('content-length') || 0);
    const { dir, name } = await this.resolveParentAndName(filename, true);
    const fileHandle = await dir.getFileHandle(name, { create: true });
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
   * Save an ArrayBuffer or Uint8Array directly to OPFS
   */
  public async saveBuffer(filename: string, buffer: ArrayBuffer | Uint8Array): Promise<void> {
    const { dir, name } = await this.resolveParentAndName(filename, true);
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    await writable.write(bytes as unknown as BufferSource);
    await writable.close();
  }

  /**
   * Read full file bytes from OPFS without any network call
   */
  public async readFile(filename: string): Promise<ArrayBuffer> {
    const { dir, name } = await this.resolveParentAndName(filename, false);
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return await file.arrayBuffer();
  }

  /**
   * Read exact byte slice from OPFS
   */
  public async readRange(filename: string, start: number, end: number): Promise<ArrayBuffer> {
    const { dir, name } = await this.resolveParentAndName(filename, false);
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    const slice = file.slice(start, end + 1);
    return await slice.arrayBuffer();
  }

  /**
   * Delete dataset from OPFS
   */
  public async deleteFile(filename: string): Promise<void> {
    const { dir, name } = await this.resolveParentAndName(filename, false);
    await dir.removeEntry(name);
  }

  private async readVaultIndexNames(vaultDir: FileSystemDirectoryHandle): Promise<string[]> {
    try {
      const idxHandle = await vaultDir.getFileHandle(VAULT_INDEX_FILENAME);
      const idxFile = await idxHandle.getFile();
      const text = await idxFile.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
      return [];
    } catch {
      return [];
    }
  }

  private async writeVaultIndexNames(
    vaultDir: FileSystemDirectoryHandle,
    names: string[]
  ): Promise<void> {
    const unique = Array.from(new Set(names)).filter((n) => n !== VAULT_INDEX_FILENAME);
    const idxHandle = await vaultDir.getFileHandle(VAULT_INDEX_FILENAME, { create: true });
    const writable = await idxHandle.createWritable();
    await writable.write(new TextEncoder().encode(JSON.stringify(unique)) as unknown as BufferSource);
    await writable.close();
  }

  /**
   * Save a user's personal .vcf / .txt / .plasmid file into the isolated OPFS Private Vault
   */
  public async saveVaultFile(
    rawFilename: string,
    buffer: ArrayBuffer | Uint8Array
  ): Promise<VaultFileEntry> {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.byteLength === 0) {
      throw new Error('Selected genomic file is empty (0 bytes)');
    }

    const sanitizedName = sanitizeVaultFilename(rawFilename);
    const kind = detectVaultFileKind(sanitizedName, bytes);
    const opfsPath = `${VAULT_DIR_NAME}/${sanitizedName}`;

    await this.saveBuffer(opfsPath, bytes);

    const root = await this.getRoot();
    const vaultDir = await root.getDirectoryHandle(VAULT_DIR_NAME, { create: true });
    const existingNames = await this.readVaultIndexNames(vaultDir);
    if (!existingNames.includes(sanitizedName)) {
      existingNames.push(sanitizedName);
      await this.writeVaultIndexNames(vaultDir, existingNames);
    }

    const info = await this.getFileInfo(opfsPath);
    return {
      name: sanitizedName,
      opfsPath,
      kind,
      size: info?.size ?? bytes.byteLength,
      lastModified: info?.lastModified ?? Date.now(),
    };
  }

  /**
   * List all personal genomic files currently stored in the OPFS Private Vault
   */
  public async listVaultFiles(): Promise<VaultFileEntry[]> {
    if (!this.isSupported()) return [];

    let vaultDir: FileSystemDirectoryHandle;
    try {
      const root = await this.getRoot();
      vaultDir = await root.getDirectoryHandle(VAULT_DIR_NAME, { create: false });
    } catch {
      return [];
    }

    const candidateNames = new Set<string>(await this.readVaultIndexNames(vaultDir));
    const maybeIterable = vaultDir as unknown as {
      entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    };
    if (typeof maybeIterable.entries === 'function') {
      try {
        for await (const [entryName, handle] of maybeIterable.entries()) {
          if (handle.kind === 'file' && entryName !== VAULT_INDEX_FILENAME) {
            candidateNames.add(entryName);
          }
        }
      } catch {
        // Fallback to manifest names if browser handle iterator is unavailable
      }
    }

    const entries: VaultFileEntry[] = [];
    for (const name of candidateNames) {
      if (name === VAULT_INDEX_FILENAME) continue;
      try {
        const handle = await vaultDir.getFileHandle(name);
        const file = await handle.getFile();
        const headerSlice = new Uint8Array(await file.slice(0, 8).arrayBuffer());
        const kind = detectVaultFileKind(name, headerSlice);
        entries.push({
          name,
          opfsPath: `${VAULT_DIR_NAME}/${name}`,
          kind,
          size: file.size,
          lastModified: file.lastModified || 0,
        });
      } catch {
        // Skip stale or unsupported entry
      }
    }

    entries.sort((a, b) => b.lastModified - a.lastModified || a.name.localeCompare(b.name));
    return entries;
  }

  /**
   * Delete a personal genomic file from the OPFS Private Vault
   */
  public async deleteVaultFile(filenameOrPath: string): Promise<void> {
    const cleanName = sanitizeVaultFilename(filenameOrPath);
    const opfsPath = `${VAULT_DIR_NAME}/${cleanName}`;

    const root = await this.getRoot();
    const vaultDir = await root.getDirectoryHandle(VAULT_DIR_NAME, { create: false });
    await vaultDir.removeEntry(cleanName);

    const existingNames = await this.readVaultIndexNames(vaultDir);
    const remaining = existingNames.filter((n) => n !== cleanName);
    await this.writeVaultIndexNames(vaultDir, remaining);

    if (this.getActiveVaultPath() === opfsPath) {
      this.setActiveVaultPath(null);
    }
  }

  /**
   * Get storage quota statistics
   */
  public async getQuota(): Promise<OPFSQuota | null> {
    if (
      typeof navigator !== 'undefined' &&
      'storage' in navigator &&
      'estimate' in navigator.storage
    ) {
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

  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const opfsManager = OPFSManager.getInstance();
export const opfs = opfsManager;
