---
title: Proxmox + the Shared GPU + HBA
subtitle: My Build — install, IOMMU, and who gets which card
collection: My Build
order: 3
accent: spruce
---

> [!NOTE]
> This is my own execution checklist. Each step points at the general guide for the full how-to, then records my specific choice. Follow *Install Proxmox*, *Containers*, *Virtual machines*, and the *Frigate* GPU-sharing section for the actual steps.

### Install Proxmox to the NVMe
Per *Install Proxmox*: flash the ISO, boot, install. My target disk is the **500GB NVMe** — Proxmox OS plus the Frigate cache live there; the three IronWolf 4TB spinners are untouched at this stage (TrueNAS and Frigate footage claim them later).

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The static address I set during install. Every My Build page starts from this number; it's the same key the general guides use.

> [!NOTE]
> Web UI at `https://`-my-ip-`:8006`, log in as **root@pam** with the password I set during install (stored in *Install Proxmox* as `proxmox-root-password` and in Vaultwarden). Then run the post-install cleanup script to switch to the no-subscription repo.

### Enable IOMMU
Per *Prep & BIOS* I already turned on **Intel VT-d + Virtualization (VMX)** and set the **x4_3 slot to x4 mode**. On the host, finish the job: enable IOMMU so the HBA can be isolated for passthrough.

```bash
# This board is Intel — add intel_iommu to the kernel cmdline.
# Proxmox 9 boots systemd-boot on the NVMe, so edit:
nano /etc/kernel/cmdline      # append: intel_iommu=on iommu=pt
proxmox-boot-tool refresh
reboot
# After reboot, confirm IOMMU groups exist:
dmesg | grep -e DMAR -e IOMMU
```

> [!TIP]
> The HBA wants its **own clean IOMMU group**. It's in the bottom **x4_3** (chipset-attached) slot precisely so it lands in a group of its own — check with a quick `find /sys/kernel/iommu_groups/ -type l` and make sure the 9300-8i isn't sharing with anything I care about.

### Install the NVIDIA driver on the HOST — do NOT VFIO the GPU
The **1080 Ti** is shared, not passed through. Per the *Frigate* guide's *Sharing one GPU with your containers* section: install the **NVIDIA driver on the Proxmox host**, then lend the card into LXCs. Because LXCs share the host kernel, one card drives **Frigate detection + Ollama + faster-whisper** all at once — no exclusive lock.

> [!WARNING]
> Do **not** VFIO-bind or blacklist the 1080 Ti, and do not pass it to a VM. That hands the whole card to one guest and breaks the LXC sharing. The GPU stays on the host; HA (in its VM) reaches detection/voice over the LAN.

```bash
# On the HOST: keep the driver initialised when idle so the first
# detection after a quiet stretch doesn't pay a wake-up cost.
systemctl enable --now nvidia-persistenced
```

> [!NOTE]
> Share the card into each LXC with the `dev0:` syntax (Frigate, Ollama, Whisper) — the *Frigate* guide has the exact `dev0/dev1/dev2` lines. Keep the **host driver and the in-container driver at matching versions**; bump both together or the GPU "vanishes" after an update. The *Local Voice* guide reuses this same card, so doing it right here pays off twice.

> [!DETAILS] Which card runs detection, and the model
> Frigate detection runs on the 1080 Ti via the **ONNX detector on the CUDA execution provider** (Frigate 0.16+ dropped the standalone TensorRT detector). The 1080 Ti is Pascal — compute capability 6.1 — which clears Frigate's bar (CC 5.0+, driver 545+, CUDA 12.x). I'm running a **YOLOv9** model; RF-DETR runs very slowly on Pascal, so avoid it. Detector types can't be mixed.

### VFIO the 9300-8i HBA — pass it to the TrueNAS VM
The opposite policy from the GPU. Per the *TrueNAS* guide's HBA note: **VFIO-bind the whole 9300-8i** (IT mode, pre-flashed) and pass the entire card to the **TrueNAS VM**. ZFS then sees the two mirror disks as raw bare-metal drives — real SMART, full per-drive health, no silent power-loss corruption risk.

```bash
# On the HOST: find the HBA's PCI address and its vendor:device IDs.
lspci -nn | grep -i -e LSI -e SAS -e Broadcom
# Bind those IDs to vfio-pci (one clean line per the TrueNAS guide),
# then in the VM's Hardware tab: Add -> PCI Device -> the 9300-8i,
# tick "All Functions". Add the device to the TrueNAS VM only.
```

> [!WARNING]
> VFIO is for the **HBA only**. The two arrangements coexist fine: **VFIO the HBA -> TrueNAS VM**, **share the GPU across LXCs**. Keep them straight — the HBA gets locked to one VM; the GPU never does.

> [!NOTE]
> Only the **two mirror disks** belong to the HBA/TrueNAS. The **third IronWolf** (Frigate footage) stays on the host and is mounted into the Frigate LXC — it is not part of the passed-through card.

### Set guest Start/Shutdown order
Per *Virtual machines* and *Containers* (the **Options -> Start/Shutdown order** knob): the **Home Assistant OS VM must start before the Frigate LXC**. Frigate points at the Mosquitto MQTT broker that lives inside the HA VM, and VMs boot slower than LXCs — without ordering, Frigate comes up first, finds no broker, and its HA entities stay dead until a restart.

```bash
# Lower order number = starts first. From the host shell:
qm set <ha-vmid> -onboot 1 -startup order=1
pct set <frigate-ctid> -onboot 1 -startup order=2
```

> [!TIP]
> Also enable **Start at boot** on every guest so the whole stack comes back on its own after a power cut — TrueNAS, the service LXCs (AdGuard, Nextcloud, Vaultwarden, Homepage, NPM, Uptime Kuma), HA, and Frigate. Only the HA-before-Frigate ordering is load-bearing; the rest can default.
