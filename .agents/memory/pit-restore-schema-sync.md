---
name: PIT restore and schema sync
description: Data-safe schema synchronization after restoring an older production database snapshot
---

After a production point-in-time restore, inspect the development-to-production schema diff before recommending Publish. Do not publish if the diff proposes truncating tables to add required columns. Database-level defaults for newly required fields can allow the restored rows to survive the schema update; verify the recalculated diff shows no structural data loss. Never select the option to overwrite production data with development data.

**Why:** A restored snapshot may have older tables than the currently deployed code. Django's Python-side field defaults do not appear as database defaults in the schema diff, and adding a non-null column without a database default can cause the publish flow to propose `TRUNCATE ... CASCADE`, putting restored business records at risk.

**How to apply:** Before any post-restore publish, compare the live schema to the current models, inspect the computed publish diff, use ordinary development-side migrations for database defaults if appropriate, and recheck the diff. Do not work around this by running schema changes against production or adding startup-time migrations.

A unique-constraint warning alone is not proof that truncation is needed. When a new nullable relationship column is being added to existing rows, those rows initially have NULL values, which PostgreSQL permits in a normal unique constraint.

**Why:** The publish preflight may still offer truncation for this constraint even when its SQL contains no destructive operation and the existing rows cannot conflict.

**How to apply:** Check the column addition and current production data read-only. Keep existing data; never accept truncation merely to dismiss a uniqueness warning.