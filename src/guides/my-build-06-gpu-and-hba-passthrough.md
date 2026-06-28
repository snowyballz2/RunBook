---
title: GPU Sharing & HBA Passthrough
subtitle: One card shared into containers, one card locked to a VM — and why they're opposite
collection: My Build
order: 6
accent: violet
---

This is the step where two add-in cards get handled in deliberately opposite ways. The **GTX 1080 Ti** stays on the host and is *shared* into several containers at once. The **LSI/Broadcom 9300-8i HBA (host bus adapter)** gets *locked* to a single virtual machine and nothing else may touch it. Getting these two policies straight is the whole job — mix them up and either the GPU disappears from your containers or TrueNAS never sees its disks.

> [!WARNING]
> The single most important rule on this page: **VFIO (Virtual Function I/O) the HBA, share the GPU.** Do not VFIO-bind, blacklist, or pass the 1080 Ti to any VM (virtual machine). VFIO hands a whole card to one guest exclusively — correct for the disk controller, fatal for a GPU that three containers need to share.

## Share the GPU into containers

### Why the GPU is shared, not passed through
LXCs (Linux Containers) share the host's kernel, so a GPU lent into them is **not** locked to one container the way a VM would claim it. The same 1080 Ti can drive **Frigate object detection (ONNX (Open Neural Network Exchange) on CUDA (NVIDIA's GPU compute platform))**, an **Ollama LLM (large language model)** container, and a **faster-whisper STT (speech-to-text)** container — all at the same time, with no exclusive lock to fight over. The Home Assistant VM doesn't need the card directly; it reaches detection and voice over the LAN.

Because of this, the driver lives on the **Proxmox host**, which owns the hardware, and each container borrows it.

### Install the NVIDIA driver on the host
Do this on the **host**, not inside any container, and install it from Debian's package archive — never a `.run` installer downloaded from nvidia.com. The packaged driver builds its kernel module through **DKMS (Dynamic Kernel Module Support)** against the headers you install below and rebuilds itself automatically on every kernel update; a `.run` installer does not, and it silently breaks the card after the next Proxmox upgrade (exactly the "GPU vanished after an update" failure this page warns about). The server pulls everything over its own network connection — nothing to download on another PC.

First enable Debian's **non-free** and **non-free-firmware** components (the NVIDIA driver lives there), then install the headers and the driver from the Proxmox node shell:

```bash
# Enable non-free / non-free-firmware so the NVIDIA packages are visible.
# Append them to each Debian line in the apt sources, then refresh.
sed -i 's/ main$/ main contrib non-free non-free-firmware/' /etc/apt/sources.list
apt update

# Headers matching the running Proxmox kernel, plus the driver and persistence daemon.
apt install -y pve-headers-$(uname -r) build-essential
apt install -y nvidia-driver nvidia-smi nvidia-persistenced

# Confirm the card is seen:
nvidia-smi
```

`nvidia-smi` should print the 1080 Ti with a driver version. **Write that version down** — it has to match the userspace driver inside each container.

> [!NOTE]
> If `apt install -y nvidia-driver` cannot find the package, the non-free components are not enabled — re-check that line was added to your apt sources (Proxmox uses `.sources` files under `/etc/apt/sources.list.d/` on newer releases; add `non-free non-free-firmware` to the `Components:` line there if `/etc/apt/sources.list` has no Debian entry to edit). The `nvidia-persistenced` package ships the persistence daemon's systemd unit; install it alongside the driver so the next step has a unit to enable.

> [!NOTE]
> The 1080 Ti is Pascal — compute capability 6.1 — which clears Frigate's detection bar (compute capability 5.0+, NVIDIA driver 545 or newer, CUDA 12.x). Install a 545+ driver so the same card can run the ONNX/CUDA detector later. A YOLOv9 model is the right pick on this card; RF-DETR runs very slowly on Pascal, so avoid it.

### Keep the driver awake with nvidia-persistenced
Without the persistence daemon the driver de-initialises whenever nothing is actively using the card, and the first detection after an idle stretch pays a slow wake-up cost. You installed the `nvidia-persistenced` package above; now enable and start its service on the host:

```bash
systemctl enable --now nvidia-persistenced
```

If this reports `Unit nvidia-persistenced.service not found`, the package did not install — run `apt install -y nvidia-persistenced` and try again.

### The dev0: lending recipe (applied when each container is built)
The host now owns a working driver. Each container that needs the card borrows it by adding three device lines to **its own** config file — but **none of those containers exist yet at this stage**. You will apply this recipe as you create each one later in the build:

- **Frigate** — on the Cameras, Doorbell & Frigate page.
- **Ollama** and **faster-whisper** — on the Voice page.

So there is nothing to edit right now. Keep this recipe; you will come back to it. When each container is built, edit its config file on the host (`/etc/pve/lxc/<ctid>.conf`, where `<ctid>` is that container's ID) and add the same three NVIDIA device nodes, using Proxmox 8.1+'s `dev0:` device syntax rather than hand-writing `lxc.cgroup2` lines — the newer syntax is what Proxmox officially supports and it survives upgrades:

```ini
dev0: /dev/nvidia0,gid=44
dev1: /dev/nvidiactl,gid=44
dev2: /dev/nvidia-uvm,gid=44
```

Restart that container after editing its config. Inside it, `nvidia-smi` should then show the same card the host sees.

> [!TIP]
> The `gid=44` maps the device nodes to the `video` group inside the container so a non-root service can reach the card. If a container's user is in a different group, set the GID to match — but `44` is the common case on Debian-based containers.

### Match the driver version on both sides
Each container ships its **own userspace NVIDIA driver**, and a mismatch against the host's kernel module is the classic cause of "the GPU vanished after an update." The in-container driver must be the **same version** you noted from the host's `nvidia-smi`.

When you bump the host driver, bump every container's driver to match in the same maintenance window — never one without the others.

> [!WARNING]
> Resist the urge to "tidy up" by passing the GPU to a VM with VFIO. The moment the card is VFIO-bound the host kernel can no longer touch it, every `dev0:` share goes dead, and Frigate, Ollama, and Whisper all lose detection at once. The GPU stays on the host. Always.

## Pass the HBA through to the TrueNAS VM

### Why the HBA is passed through, not shared
The opposite policy, for the opposite reason. ZFS (Zettabyte File System) wants the **raw disks**, exactly as bare metal would present them — genuine SMART data, full per-drive health, and none of the silent power-loss corruption risk that per-disk passthrough carries when the host loses power mid-write. The clean way to deliver that is full **PCIe (Peripheral Component Interconnect Express) passthrough of the whole 9300-8i** to the TrueNAS VM.

The card is already the right tool: a 9300-8i in **IT mode (Initiator-Target mode)**, bought pre-flashed, hands the disks straight through instead of hiding them behind RAID logic. Only the **two mirror disks** belong to it. The third IronWolf (Frigate footage) sits on a motherboard SATA (Serial ATA) port and is not part of the passed-through card.

### Confirm the HBA sits in a clean IOMMU group
Passthrough needs the card isolated in its own **IOMMU (Input/Output Memory Management Unit)** group. The HBA is in the bottom **PCIEX4_3 chipset-attached slot** (set to x4 in BIOS) precisely so it lands in a group by itself. Verify before binding anything:

```bash
# IOMMU must be active (VT-d enabled in BIOS, intel_iommu=on on the cmdline)
dmesg | grep -e DMAR -e IOMMU

# Find the HBA's PCI address and its vendor:device IDs
lspci -nn | grep -i -e LSI -e SAS -e Broadcom

# Confirm the 9300-8i is alone in its IOMMU group
for g in /sys/kernel/iommu_groups/*/devices/*; do
  echo "Group $(basename $(dirname $(dirname $g))): $(lspci -nns $(basename $g))"
done | grep -i -e LSI -e SAS -e Broadcom
```

You want the HBA in a group containing only itself (or only its own functions). If it shares a group with devices you care about, passthrough either fails or drags those neighbours into the VM — recheck that it's in the chipset-attached PCIEX4_3 slot.

> [!NOTE]
> The vendor:device IDs from `lspci -nn` (something like `[1000:0097]`) are what you bind to vfio-pci. Note them down — the next step uses them.

### Bind the card to vfio-pci
Tell the host to claim the HBA for VFIO at boot so no host driver grabs it first. Create a modprobe entry with the IDs from the previous step, then refresh the initramfs and reboot:

```bash
# Replace 1000:0097 with your actual vendor:device IDs
echo "options vfio-pci ids=1000:0097" > /etc/modprobe.d/vfio.conf

# Load the vfio modules early
echo -e "vfio\nvfio_iommu_type1\nvfio_pci" >> /etc/modules

update-initramfs -u -k all
reboot
```

After the reboot, confirm the card is now bound to `vfio-pci` rather than a SAS driver:

```bash
lspci -nnk | grep -A3 -i -e LSI -e SAS -e Broadcom
# "Kernel driver in use: vfio-pci" is the line you want.
```

### Add the HBA to the TrueNAS VM
With the card on vfio-pci, hand the **whole device** to the TrueNAS VM. In the Proxmox web interface, select the TrueNAS VM, then **Hardware → Add → PCI Device**, choose the 9300-8i, and tick **All Functions**. Add it to the **TrueNAS VM only** — no other guest.

```bash
# Equivalent from the host shell. Use the HBA's PCI address captured by the
# lspci step above (a chipset-side bus, e.g. 0000:02:00.0) — NOT 0000:01:00.0,
# which on this board is the top x16 slot where the 1080 Ti lives.
qm set <truenas-vmid> -hostpci0 <hba-pci-address>,pcie=1
```

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> The address TrueNAS prints on its console. Pin it with a DHCP (Dynamic Host Configuration Protocol) reservation so it never moves.

Power-cycle the TrueNAS VM (a full stop and start, not a guest reboot). Once it boots, the two mirror disks appear under **Storage** in TrueNAS as raw drives — real SMART, real serials, ready for a mirrored ZFS pool.

> [!WARNING]
> Use disks with nothing on them you care about — ZFS claims them entirely. And only the two mirror drives belong here; the Frigate footage disk stays on the host's motherboard SATA port.

## Keep the two policies straight

The whole point of this page in one table — they coexist perfectly, but only if each card gets its own policy:

| Card | Policy | Where the driver lives | Who uses it |
|---|---|---|---|
| GTX 1080 Ti | **Shared** (`dev0:` into LXCs) | Proxmox host | Frigate, Ollama, faster-whisper — all at once |
| 9300-8i HBA | **VFIO passthrough** (locked to one VM) | Inside TrueNAS | TrueNAS VM only |

> [!DETAILS] The failure modes, so you can spot them fast
> - **Containers lost the GPU after an update** — driver version mismatch between host and container, *or* someone VFIO-bound the GPU. Check `nvidia-smi` on the host first, then inside the container; the versions must match.
> - **TrueNAS sees no disks** — the HBA didn't pass through cleanly. Confirm `Kernel driver in use: vfio-pci` on the host and that the device is added to the VM with **All Functions**. (A `duplicate serial` error is a *different* failure that belongs to per-disk passthrough — passing the whole card, as you do here, hands TrueNAS each drive's real serial, so it never arises on this build.)
> - **Passthrough fails or drags other devices in** — the HBA isn't alone in its IOMMU group. Confirm it's in the chipset-attached PCIEX4_3 slot at x4 and that VT-d is enabled in BIOS.

> [!NOTE]
> The shared-GPU setup here is reused downstream: the same card runs Frigate's ONNX/CUDA detection and the Ollama/faster-whisper voice stack. Doing it correctly now pays off across several later steps — and the only ongoing maintenance is keeping host and container driver versions matched.
