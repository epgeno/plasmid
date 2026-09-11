# Contributing to Plasmid

Thank you for your interest in contributing to **Plasmid** (`epgeno/plasmid`), the decentralized genomic wiki and streaming engine!

---

## 🛠️ Prerequisites & Toolchain

Plasmid is structured as a unified monorepo containing Rust workspace crates and modern web applications.

* **Rust**: `1.80.0+` (Edition 2024 / 2021)
  ```bash
  rustup update stable
  rustup component add clippy rustfmt
  ```
* **Node.js**: `v20.0.0+` & **pnpm**: `v9.0.0+`
  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  ```
* **WebAssembly (for client-side decoders)**:
  ```bash
  rustup target add wasm32-unknown-unknown
  cargo install -q wasm-pack
  ```

---

## 📁 Repository Layout

```text
.
├── crates/
│   ├── plasmid-format/    # RFC-0001: 16KB Merkle single-container archive spec
│   ├── plasmid-core/      # noodles-based Range Slicing coordinator & VCF parser
│   └── plasmid-swarm/     # BitTorrent v2 BEP 52 WebRTC chunk exchange & Byzantine defense
├── apps/
│   ├── web/               # React 19 + Vite 6 official web client (plasmid.wiki)
│   └── cli/               # (Planned) Local headless seeding daemon
├── docs/
│   └── rfc/               # Binary formats & security RFCs
└── assets/
    └── brand/             # Official vector SVG marks & branding assets
```

---

## 🧪 Development Workflow

### 1. Rust Workspace Testing
Ensure all unit, integration, and property tests pass:
```bash
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
```

### 2. Frontend Development & Verification
```bash
cd apps/web
pnpm install
pnpm build
pnpm preview
```

---

## 📜 Commit Message Conventions

We strictly follow [Conventional Commits (v1.0.0)](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short summary in imperative mood>

[optional body]

[optional footer(s)]
```

### Allowed Types
* `feat`: A new feature or capability.
* `fix`: A bug fix.
* `docs`: Documentation, RFCs, or guides only.
* `style`: Formatting, missing semicolons, white-space changes.
* `refactor`: Code changes that neither fix a bug nor add a feature.
* `perf`: Performance improvements.
* `test`: Adding or correcting tests.
* `chore`: Build scripts, dependency updates, CI workflows.

### Scopes
* `format`, `core`, `swarm`, `web`, `cli`, `rfc`, `deps`, `brand`

*Example:* `feat(format): implement 2-level clustered leaf index for WGS`

---

## 📑 The RFC Process

Any breaking change to the `.plasmid` binary container format, index structure, or cryptographic proof schema must begin with an RFC:

1. Copy `docs/rfc/0001-container-spec.md` as a structural template.
2. Submit a PR titled `rfc: <title>` into `docs/rfc/`.
3. The proposal undergoes architectural review and adversarial red-teaming before code implementation begins.

---

## ✅ Pull Request Checklist

Before submitting a Pull Request:
- [ ] Code compiles cleanly (`cargo check --workspace`).
- [ ] All tests pass without failure (`cargo test --workspace`).
- [ ] Linter & formatter clean (`cargo clippy`, `cargo fmt`).
- [ ] Web application builds cleanly without warnings (`pnpm build`).
- [ ] PR contains no leaked credentials, private genome files, or internal hostnames.
- [ ] RFC reference is cited if altering binary container schemas.
