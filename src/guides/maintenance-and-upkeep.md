---
title: Maintenance and Upkeep
subtitle: The small routine that keeps the server boring
collection: Proxmox Home Server
order: 16
accent: rose
---

## Stay current

### Update Proxmox before adding new toys
Select your node, open **Updates**, click **Refresh** to fetch the package list, then **Upgrade**. This works because of the free-repo switch from the *Install Proxmox* guide. Make it a habit to update *before* installing something new — if anything misbehaves afterwards, you know which change to suspect.

> [!NOTE]
> This updates the Proxmox host only. Each VM and container is its own little machine and updates from inside itself, the usual `apt update && apt full-upgrade` for Debian guests.

> [!DETAILS] Updating from the shell instead
> The same thing the Upgrade button does, from the node's **Shell**:
>
> ```bash
> apt-get update
> apt-get dist-upgrade
> ```

### Walk the guests too
Once the host is current, give each guest its turn: Debian containers get the `apt` pair above in their Console, the helper-script services update with their own one command (`update` inside the container, per the *Uptime Kuma* guide's pattern), and the appliances update from their own UIs — *Home Assistant OS* and *TrueNAS* each have an update page their guide covers. Snapshot first when an update is major (the snapshot habit from the *Containers* and *Virtual machines* guides).
