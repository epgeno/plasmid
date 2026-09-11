## 🎯 Summary of Changes

<!-- Provide a concise description of what this PR does and why it is needed. -->

### Type of Change
- [ ] `feat`: New feature or capability
- [ ] `fix`: Bug fix
- [ ] `docs`: Documentation or RFC updates
- [ ] `perf`: Performance optimization
- [ ] `refactor`: Code cleanup or internal restructuring
- [ ] `test`: Unit / integration / fuzz test addition
- [ ] `chore`: Toolchain, dependency, or CI update

---

## 🔬 Testing & Verification

<!-- List the exact commands executed and the outcome. -->

- [ ] `cargo check --workspace` passed
- [ ] `cargo test --workspace` passed (Unit & integration tests)
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` clean
- [ ] `cargo fmt --all -- --check` clean
- [ ] `pnpm --filter plasmid-web build` passed (if touching `apps/web`)

```bash
# Output or test summary
```

---

## 🛡️ Privacy & Security Gate

- [ ] **Zero-Network Air-Gap**: Verified that no private user genetic sequence data is transmitted via P2P swarm, analytics, or HTTP headers.
- [ ] **Cryptographic Integrity**: Any modified data containers adhere to BEP 52 16KB SHA-256 Merkle root verification.
- [ ] **Sanitization**: No internal server IPs, credentials, or personal local file paths are included.
- [ ] **RFC Alignment**: Any binary layout changes reference an accepted RFC in `docs/rfc/`.
