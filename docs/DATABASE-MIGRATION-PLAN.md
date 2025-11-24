# Database Migration Plan: Index Rename
**Status**: Optional - System Operational Without Migration
**Priority**: P2 - Technical Debt
**Created**: 2025-11-19

## Background

During security hardening deployment, database model indexes were renamed to prevent conflicts:
- `stored_event.py`: All indexes prefixed with `ix_stored_event_`
- `budget_history.py`: All indexes prefixed with `ix_budget_hist_`

**Current State**: PostgreSQL database contains old index names from previous deployments. SQLAlchemy attempts to create new indexes but finds existing names, causing warnings (not errors).

**Impact**: System fully operational. Database queries work correctly. Legacy indexes provide same functionality.

## Migration Options

### Option A: Leave As-Is (RECOMMENDED)
**Pros:**
- Zero downtime
- No risk of data loss
- System working correctly
- Warnings are informational only

**Cons:**
- Technical debt in database state
- Confusion between code and database schema

**When to use**: Production system where uptime is critical

### Option B: Manual Index Rename
**Steps:**
```sql
-- Connect to PostgreSQL
psql -U mechasuite -d terminal_manager

-- Rename stored_events indexes
ALTER INDEX ix_agent_timestamp RENAME TO ix_stored_event_agent_timestamp;
ALTER INDEX ix_project_timestamp RENAME TO ix_stored_event_project_timestamp;
ALTER INDEX ix_session_timestamp RENAME TO ix_stored_event_session_timestamp;
ALTER INDEX ix_trace_timestamp RENAME TO ix_stored_event_trace_timestamp;
ALTER INDEX ix_event_type_timestamp RENAME TO ix_stored_event_event_type_timestamp;
ALTER INDEX ix_intent_timestamp RENAME TO ix_stored_event_intent_timestamp;
ALTER INDEX ix_agent_intent RENAME TO ix_stored_event_agent_intent;

-- Verify
\di ix_stored_event_*
```

**Pros:**
- Clean database state
- Matches code exactly
- Fast operation (no data movement)

**Cons:**
- Requires database access
- Brief table locks during rename
- Needs testing in staging first

**When to use**: During planned maintenance window

### Option C: Alembic Migration (FUTURE)
**Setup Alembic:**
```bash
cd terminal-manager/backend
pip install alembic
alembic init alembic
```

**Create migration:**
```python
# alembic/versions/001_rename_indexes.py
def upgrade():
    op.execute("ALTER INDEX ix_agent_timestamp RENAME TO ix_stored_event_agent_timestamp")
    # ... (repeat for all indexes)

def downgrade():
    op.execute("ALTER INDEX ix_stored_event_agent_timestamp RENAME TO ix_agent_timestamp")
    # ... (repeat for all indexes)
```

**Pros:**
- Version controlled migrations
- Repeatable across environments
- Professional database management
- Rollback capability

**Cons:**
- Initial setup overhead
- Learning curve for team
- Overkill for single rename

**When to use**: When establishing formal database versioning

## Recommendation

**For Current Deployment**: **Option A (Leave As-Is)**
- System fully operational
- No user impact
- Focus on higher priority work

**For Future Maintenance**: **Option B (Manual Rename)**
- Schedule during low-traffic window
- Test in staging environment first
- Document steps for runbook

**For Long-Term**: **Option C (Alembic)**
- Implement when adding new database-heavy features
- Establish pattern for future schema changes

## Verification After Migration

```bash
# Check index names
psql -U mechasuite -d terminal_manager -c "\di ix_*"

# Restart backend
cd terminal-manager/backend
python -m uvicorn app.main:app --reload

# Verify no warnings in logs
tail -f logs/backend.log | grep -i "index"
```

## Rollback Plan

If migration causes issues:
1. Stop backend
2. Rename indexes back to original names
3. Restart backend
4. All data preserved (indexes are metadata only)

## Notes

- Indexes are metadata structures - no data at risk
- PostgreSQL index renames are atomic operations
- Budget system working correctly with current state
- Migration can be deferred indefinitely without impact
