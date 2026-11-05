Workflow verification uses synthetic records in isolated in-memory PostgreSQL; it never connects to production.

```
npm install --prefix /tmp/fieldwork-workflow-tests @electric-sql/pglite
NODE_PATH=/tmp/fieldwork-workflow-tests/node_modules node tests/fieldwork/workflow-database.cjs
node tests/fieldwork/workflow-ui.cjs
npx vitest run src/lib/fieldwork
```

The database fixture stubs the existing dispatcher and exercises the new migration itself. Checks cover assigned-manager scope, no self approval, request/reject/approve, deletion locks, tombstones, immutable dates, submitted retention, exclusion/restore and forged client metadata. Existing auth/API tests cover the original service separately.

Production migration `20261105020000_fieldwork_record_governance.sql` is awaiting explicit approval after automatic review rejected production execution. UI checks `workflowVersion` before exposing new governance controls. No production survey was deleted or excluded during development.
