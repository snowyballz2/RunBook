---
title: Proxmox Home Server Build
subtitle: Bare-metal to a full local stack on the old 8700K
accent: spruce
---

## Phase 1 — Prep & BIOS

### Save anything off the PC first
Installing Proxmox wipes the drive, Windows and all. Pull any files you want to keep onto another machine or an external disk before you go further.

> [!WARNING]
> This step is irreversible. The target drive is fully erased during install.

### Set BIOS for virtualization
Enter the BIOS (usually `Del` or `F2` at boot) and turn on the virtualization features Proxmox relies on:

- Enable **VT-x** (Intel Virtualization Technology)
- Enable **VT-d** (Directed I/O)
- Enable the **integrated graphics** so the dGPU stays free for passthrough
- Turn on **C-states** for cooler, quieter idle

> [!TIP]
> VT-d is what makes USB and drive passthrough work later. Do not skip it — it is easy to forget and annoying to discover missing.

## Phase 2 — Install Proxmox

### Flash the installer
Write the Proxmox VE ISO to a USB stick with [Balena Etcher](https://etcher.balena.io/), then boot from it.

### Run the installer
Follow the prompts for target disk, hostname, root password, and a **static IP** on your LAN. Write the IP down — you will need it constantly.

```bash
# After install, reach the web UI from another machine on the LAN:
https://your-ip:8006
```

> [!NOTE]
> Proxmox has no desktop of its own. You administer everything from a browser at that address.

### Post-install cleanup
Run the excellent community post-install script to fix the package repositories and remove the subscription nag screen.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/post-pve-install.sh)"
```

> [!DANGER]
> Only pipe a script straight into a root shell when you trust the source and have read it. This one is widely used and open, but make that judgement yourself every time.

## Phase 3 — First workloads

### Create a Debian container
Use a lightweight LXC container for services that don't need a full VM. From the web UI: **Create CT**, pick the Debian template, give it 2 cores and 2 GB of RAM to start.

### Spin up a VM for anything that needs a real kernel
For Home Assistant OS, a Windows box, or anything doing GPU work, create a full VM instead and attach the ISO you uploaded to local storage.

```bash
# List your VMs and containers from the Proxmox shell:
qm list
pct list
```

### Take a snapshot before you tinker
Snapshots are instant and save you constantly. Take one before any risky change so rollback is a single click.

> [!TIP]
> Name snapshots for *what you were about to do* ("before-gpu-passthrough"), not the date. Future-you will thank present-you.
