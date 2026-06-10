---
title: Make it safe to tinker
subtitle: Snapshot before every risky change
collection: Proxmox Home Server
order: 8
accent: spruce
---

### Take a snapshot before you tinker
Snapshots are instant and save you constantly. Take one before any risky change so rollback is a single click.

> [!TIP]
> Name snapshots for *what you were about to do* ("before-gpu-passthrough"), not the date. Future-you will thank present-you.

> [!DETAILS] How to take and roll back a snapshot
> - Select the VM or container in the left tree and open **Snapshots**.
> - Click **Take Snapshot**, give it a name that says what you were about to attempt, and an optional description.
> - For a running VM, the **Include RAM** checkbox also saves its memory state, so rollback returns it running exactly where it was.
> - To undo, select the snapshot in the list and click **Rollback** — everything since that snapshot is discarded.
