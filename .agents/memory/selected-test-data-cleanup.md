---
name: Selected test-data cleanup
description: User scope and safety decisions for exceptional Django-admin transaction cleanup
---

The user chose “Tanlangan soxta operatsiyalar”, not deleting all operations or resetting all balances. Adding the capability is not permission to run it on their existing business records.

**Why:** The user explicitly selected that narrower scope after being told that global cleanup could remove real operations.

**How to apply:** Preserve explicit selection, superuser-only access, impact preview and password confirmation. Never run cleanup against existing records merely to demonstrate the feature.

Test cleanup archives eligible operations instead of physically deleting source documents. Normal append-only protections remain in force everywhere else. Do not rewrite later real journal history to make an older fake entry removable.

**Why:** Keeping source identifiers prevents offline retries from recreating removed operations; retaining audit snapshots and rejecting downstream dependencies protects financial and stock consistency.

**How to apply:** Preserve this exception’s narrow scope during future GitHub syncs. If an operation has later activity or protected business links, block it rather than broadening cleanup silently.

For an eligible fake cash handover, remove its cash/wallet pair together and repair the daily cash snapshot, without reopening the day or undoing goods returns.

**Why:** A day close may contain unrelated real stock returns. Reopening and reconfirming it could repeat stock movements; removing just one cash leg would also break ledger consistency.

**How to apply:** Preserve the day’s closed state and non-cash history. Validate the paired journals and current cash snapshot, and reject later-dependent history rather than silently rewriting subsequent days.
