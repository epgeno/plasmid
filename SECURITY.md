# Security Policy

## Security Architecture & Guarantees

Plasmid (`plasmid.wiki`) is designed from first principles around a **zero-trust, air-gapped personal genomics model**:

1. **Physical Air-Gap Isolation (`plasmid-vault`)**:
   * User WGS/WES/VCF data loaded in the browser is stored strictly within local-first storage (Origin Private File System / OPFS or IndexedDB).
   * **Private genetic sequence data NEVER enters WebRTC P2P swarm channels, WebSocket signaling, or HTTP telemetry.**
   * Outbound P2P traffic is mathematically constrained to fetching public, immutable knowledge blocks (ClinVar/ACMG/VRS).
2. **Merkle-Tree Cryptographic Integrity (BEP 52)**:
   * Every 16KB chunk in `.plasmid` containers is verified against a SHA-256 Merkle root.
   * Byzantine peers serving forged, corrupted, or tampered byte slices are immediately dropped and banned.
3. **Immutable Clinical SSOT**:
   * Clinical pathogenicity classifications (ClinVar / ACMG) are pinned immutable metadata blocks, immune to arbitrary wiki vandalism.

---

## Supported Versions

We actively maintain security patches for the latest minor and patch releases:

| Component | Supported Versions | Status |
| :--- | :--- | :--- |
| `crates/plasmid-format` | `v0.1.x` | Supported (SSOT Binary Spec) |
| `crates/plasmid-core` | `v0.1.x` | Supported (Range Slicing & Noodles) |
| `crates/plasmid-swarm` | `v0.1.x` | Supported (BEP 52 P2P Engine) |
| `apps/web` | `v0.1.x` | Supported (Official Web Viewer) |

---

## Reporting a Vulnerability

If you discover a security vulnerability, privacy leak, or cryptographic flaw in any `epgeno` project:

1. **Do NOT disclose it publicly** in public GitHub issues, pull requests, discussions, or social media.
2. Please submit a private advisory through [GitHub Security Advisories](https://github.com/epgeno/plasmid/security/advisories/new) or email `security@epgeno.org`.
3. Include:
   * A description of the vulnerability and attack vector.
   * Proof of concept (PoC) code or exact steps to reproduce.
   * Assessment of privacy or cryptographic impact.

### Response Commitments

* **Initial Acknowledgment:** Within **48 hours**.
* **Triage & Reproduction:** Within **5 business days**.
* **Remediation & Advisory Release:** Coordinated disclosure once a patch is verified and deployed.
