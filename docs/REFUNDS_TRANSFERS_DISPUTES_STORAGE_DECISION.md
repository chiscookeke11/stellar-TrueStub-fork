# Storage decision: refunds, ownership transfers, and disputes

- **Status:** Accepted
- **Date:** 2026-11-20
- **Decision owner:** TrueStub backend maintainers
- **Related implementation work:** upstream issues #512 (refunds), #515 (disputes), and #517 (ownership transfers)

## Context

The refund, ownership-transfer, and dispute services currently keep operational records in process-local `Map` instances. These records are backend-internal: no browser client or external consumer needs to query them through GraphQL. Losing them on a process restart or allowing separate replicas to maintain divergent copies is especially serious because they represent money in flight, contested escrow, and idempotency state.

The project already uses PostgreSQL migrations managed by `node-pg-migrate` for backend-owned tables. Hasura exposes application data that the frontend needs through GraphQL, and the backend uses its Hasura client for privileged operations on Hasura-managed application tables.

## Options considered

### A. Store these records through Hasura / HasuraService

**Advantages**
- Reuses an existing backend integration and GraphQL client.
- Can make records available to Hasura permissions and GraphQL consumers if that becomes a requirement.
- Keeps access patterns consistent with existing Hasura-managed application data.

**Disadvantages**
- Adds GraphQL operations and Hasura metadata/permissions for data that is private to backend services.
- Couples internal transaction coordination and locking semantics to a GraphQL layer.
- Makes database-specific concurrency guarantees (unique inserts, row locks, transactions) less direct and less obvious at the service boundary.

### B. Use direct PostgreSQL access from the backend

Use the existing `DATABASE_URL`, `pg` driver, and `node-pg-migrate` migration workflow. The services own repository-local SQL migrations and issue parameterized SQL through a small backend repository/store abstraction.

**Advantages**
- Direct access to PostgreSQL transactions, unique constraints, row-level locks, and advisory locks needed for idempotency and state transitions.
- No Hasura metadata or GraphQL schema is required for private operational records.
- Migrations, schema ownership, tests, and service code remain in the backend repository.
- Avoids exposing internal operational tables through an API surface that no consumer needs.

**Disadvantages**
- Requires maintaining a small direct-SQL repository layer and its connection lifecycle.
- These records will not automatically be queryable through Hasura; any future consumer requirement must be explicitly designed.

## Decision

**Choose option B: direct PostgreSQL access via `DATABASE_URL` and `node-pg-migrate`.**

Refund claims, ownership transfers, and disputes are internal backend coordination data. They require database-native atomicity and concurrency control, not GraphQL access. The backend should own their schemas and persistence implementations directly.

Hasura remains the GraphQL layer for user-facing application data such as users, listings, ratings, and escrow views. Do not add these three operational stores to Hasura merely for consistency.

## Implementation requirements

1. **Refund claims**
   - Persist claim state and retry metadata in PostgreSQL.
   - Enforce a unique idempotency key at the database level.
   - Claim acquisition must be atomic across multiple backend instances.
   - Preserve the existing refund execution and retry semantics.

2. **Disputes**
   - Persist dispute identity, escrow ID, participants, reason, state, timestamps, and resolution data.
   - Persist state transitions atomically and retain the existing state-machine rules.
   - Support the existing history, metrics, and SLA queries without falling back to process-local state.

3. **Ownership transfers**
   - Persist transfer state and participants with a unique transfer ID.
   - Use a transaction with row-level locking or a PostgreSQL advisory lock for cross-instance transition safety.
   - Remove the in-process lock map once database concurrency control is in place.

4. **Operational safeguards**
   - Add reversible migrations and run the repository's migration order and rollback CI checks.
   - Add PostgreSQL-backed tests proving state survives service recreation and concurrent service instances cannot claim or transition the same record twice.
   - Keep SQL parameterized; never interpolate user-provided values into SQL.
   - Do not silently dual-write to the old in-memory maps during cutover.

## Consequences

The implementation issues #512, #515, and #517 should follow this decision and use the same direct-Postgres approach. If a future product requirement needs these records exposed through GraphQL, add a deliberate Hasura tracking/permissions layer over the PostgreSQL tables without changing the backend persistence owner.

This decision resolves the datastore choice only. It does not itself migrate data or make the current in-memory services durable.
