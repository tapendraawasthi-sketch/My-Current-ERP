# ADR 0019: R3N5 Target-Span and Physical Lock Authority

- **Status:** Accepted
- **Date:** 2026-07-18
- **Phase:** MAI-07R3N5

## Decision

Evaluation targets are identified by immutable raw Unicode code-point intervals
with source/surface digests. Surface-string lookup is not evaluation authority.
Canonical and independent audit scoring must agree per case and on complete
metric/gate semantics.

The RC semantic hash binds the lock body's meaning. Attempt and chain raw-hash
fields bind the physical `LOCKED_NOT_RUN` file SHA-256. These hashes must not be
interchanged.

## Consequences

- Missing, ambiguous, coercive, stale, or wrong-runtime target evidence fails closed.
- Support splits require explicit expected-behavior success, not only applicable core gates.
- The R3N5 pack is a distinct non-default version even though resource bytes remain unchanged.
- R3N5 passing does not imply independent review, linguist approval, production approval,
  parent MAI-07 completion, or MAI-08 authorization.

