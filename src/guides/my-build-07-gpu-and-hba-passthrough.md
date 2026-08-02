---
title: GPU Sharing & HBA Passthrough
subtitle: One card shared into containers, one card locked to a VM — and why they're opposite
collection: My Build
order: 7
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

First enable Debian's **non-free** and **non-free-firmware** components (the NVIDIA driver lives there). Where the Debian repo is defined depends on the Proxmox version: **Proxmox 9** (Debian 13 Trixie) uses the newer **deb822 `.sources` files** under `/etc/apt/sources.list.d/` — you edit the `Components:` line — while **Proxmox 8** (Debian 12 Bookworm) still keeps it in the legacy single-file `/etc/apt/sources.list`. Rather than guess, find which file holds the Debian entry:

```bash
# Where is the Debian repo defined? Proxmox 9: a .sources file; Proxmox 8: /etc/apt/sources.list.
grep -rl 'non-free\|Components:\|deb http' /etc/apt/sources.list /etc/apt/sources.list.d/
```

On **Proxmox 9**, open the Debian `.sources` file the `grep` pointed at (typically `/etc/apt/sources.list.d/debian.sources`) and edit its `Components:` line so it reads:

```
Components: main contrib non-free non-free-firmware
```

Then refresh and install the headers and driver from the Proxmox node shell:

```bash
apt update

# Headers matching the running Proxmox kernel, plus the driver and persistence daemon.
apt install -y proxmox-headers-$(uname -r) build-essential
apt install -y nvidia-driver nvidia-smi nvidia-persistenced

# Confirm the card is seen:
nvidia-smi
```

`nvidia-smi` should print the 1080 Ti with a driver version. **Write that version down** — it has to match the userspace driver inside each container.

> [!NOTE]
> Proxmox 8 (Debian 12) path: there the Debian repo is the one-line format in `/etc/apt/sources.list` (the `grep` above shows it there, not in a `.sources` file), and Proxmox's default entries end in `main contrib`. Append the two components — `sed -i 's/main contrib$/main contrib non-free non-free-firmware/' /etc/apt/sources.list` — then `apt update`. On Proxmox 9 there is no such `main` line to edit; the deb822 `Components:` edit above is the path.

> [!NOTE]
> If `apt install -y nvidia-driver` still cannot find the package, the non-free components are not enabled — re-check that you edited the `Components:` line in the right `.sources` file and ran `apt update`. The `nvidia-persistenced` package ships the persistence daemon's systemd unit; install it alongside the driver so the next step has a unit to enable.

> [!NOTE]
> The 1080 Ti is Pascal — compute capability 6.1 — which clears Frigate's detection bar (compute capability 5.0+, NVIDIA driver 545 or newer, CUDA 12.x). Debian's packaged `nvidia-driver` on this host is the 550 series, which clears that bar — confirm the version `nvidia-smi` printed is 545 or newer so the same card can run the ONNX/CUDA detector later. A YOLOv9 model is the right pick on this card; RF-DETR runs very slowly on Pascal, so avoid it.

### Keep the driver awake with nvidia-persistenced
Without the persistence daemon the driver de-initialises whenever nothing is actively using the card, and the first detection after an idle stretch pays a slow wake-up cost. You installed the `nvidia-persistenced` package above; now enable and start its service on the host:

```bash
systemctl enable --now nvidia-persistenced
```

If this reports `Failed to enable unit: Unit file nvidia-persistenced.service does not exist`, the package did not install — run `apt install -y nvidia-persistenced` and try again.

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
# IOMMU must be active — VT-d on in BIOS. (intel_iommu defaults to on since kernel 6.8/PVE 8.2;
# the cmdline flags you set on the Install Proxmox page are belt-and-braces, not required.)
dmesg | grep -e DMAR -e IOMMU

# Find the HBA's PCI address and its vendor:device IDs
lspci -nn | grep -i -e LSI -e SAS -e Broadcom

# Confirm the 9300-8i is alone in its IOMMU group
for g in /sys/kernel/iommu_groups/*/devices/*; do
  echo "Group $(basename $(dirname $(dirname $g))): $(lspci -nns $(basename $g))"
done | grep -i -e LSI -e SAS -e Broadcom

# The loop names the HBA's group — now list that group's folder directly
# (swap 13 for yours). It must print the HBA's address and nothing else:
ls /sys/kernel/iommu_groups/13/devices/
```

You want the HBA in a group containing only itself (or only its own functions) — and the `ls` is the command that proves it, since the loop's grep only shows the HBA's own line and would hide any neighbours sharing the group. If other devices do show up in there, passthrough either fails or drags those neighbours into the VM — recheck that the card is in the chipset-attached PCIEX4_3 slot.

> [!NOTE]
> The vendor:device IDs from `lspci -nn` (something like `[1000:0097]`) are what you bind to vfio-pci. They sit in brackets at the very end of the line — exactly the part a console cuts off when the line runs past the screen edge. If you cannot see them, re-run scoped to just the card and the line stays short: `lspci -nn -s 03:00.0` (your address from the step above). Note the pair down — the next step uses it.

### Bind the card to vfio-pci
Tell the host to claim the HBA for VFIO at boot so no host driver grabs it first. Create a modprobe entry with the IDs from the previous step, blacklist the card's native driver so it can never win the race for it, then refresh the initramfs and reboot:

```bash
# Replace 1000:0097 with your actual vendor:device IDs, and mpt3sas with
# whatever the lspci step's "Kernel modules:" line printed for your card.
echo -e "options vfio-pci ids=1000:0097\nblacklist mpt3sas" > /etc/modprobe.d/vfio.conf

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

> [!NOTE]
> The `ids=` option alone is not reliable here — both `vfio-pci` and the HBA's native driver load as modules at boot, and the native one commonly wins the race to claim the device even with `vfio-pci` loaded early via `/etc/modules`. Blacklisting the native driver outright is what actually guarantees `vfio-pci` gets it. Nothing else on this build uses `mpt3sas`, so losing it costs nothing.
>
> Still says `Kernel driver in use: mpt3sas` after the reboot? `cat /etc/modprobe.d/vfio.conf` — it must show **both** lines, the `ids=` and the `blacklist`; a `>` that overwrote instead of a `>>` that appended is the usual culprit. (`Kernel modules: mpt3sas` continuing to appear in `lspci -nnk` is fine — that line lists what *could* drive the card, not what does. And duplicate `vfio` lines in `/etc/modules` from running the setup block twice are harmless; no need to clean them up.)

### Add the HBA to the TrueNAS VM
With the card on vfio-pci, hand the **whole device** to the TrueNAS VM. In the Proxmox web interface, select the TrueNAS VM, then **Hardware → Add → PCI Device**, choose the 9300-8i, and tick **All Functions** and **PCI-Express**. Add it to the **TrueNAS VM only** — no other guest. Or, equivalently, from the host shell — this build's values are the TrueNAS VM ID (`100`) and the HBA's chipset-side bus address from the `lspci` step (`03:00.0`, entered without the `.0` function suffix so all functions pass, matching the GUI ticks; the top-slot `01:00` is the 1080 Ti — never that one):

```bash
qm set 100 -hostpci0 0000:03:00,pcie=1
```

Power-cycle the TrueNAS VM (a full stop and start, not a guest reboot). Once it boots, the two mirror disks appear under **Storage** in TrueNAS as raw drives — real SMART, real serials, ready for a mirrored ZFS pool.

> [!WARNING]
> Use disks with nothing on them you care about — ZFS claims them entirely. And only the two mirror drives belong here; the Frigate footage disk stays on the host's motherboard SATA port.

### Keep the two policies straight

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
