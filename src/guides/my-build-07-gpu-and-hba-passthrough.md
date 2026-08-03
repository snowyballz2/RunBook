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

### Prepare the driver's package sources
The driver goes on the **host**, not inside any container, and it comes from Debian's package archive — never a `.run` installer downloaded from nvidia.com. The packaged driver builds its kernel module through **DKMS (Dynamic Kernel Module Support)** against the headers you install below and rebuilds itself automatically on every kernel update; a `.run` installer does not, and it silently breaks the card after the next Proxmox upgrade (exactly the "GPU vanished after an update" failure this page warns about). The server pulls everything over its own network connection — nothing to download on another PC.

The driver lives in Debian package sections this host does not read yet: **non-free** and **non-free-firmware**. On this build's Proxmox 9, the Debian repo is defined in one file — `/etc/apt/sources.list.d/debian.sources` — and each repo entry inside it has a `Components:` line saying which sections to read. Turn the two extra sections on with one command, in the host shell — click **`pve`** in the left tree (nested under Datacenter), then **Shell** in the menu that appears; it is its own entry above the System section, and the terminal it opens is already logged in as root:

```bash
sed -i 's/^Components:.*/Components: main contrib non-free non-free-firmware/' /etc/apt/sources.list.d/debian.sources
```

That rewrites every `Components:` line in the file to `Components: main contrib non-free non-free-firmware`. There is no way to edit this from the web UI — Proxmox has no file editor — but there is a click path to *verify* it: **`pve` → Updates → Repositories** lists the Debian entries, and after the command their Components column shows `non-free non-free-firmware`. (To eyeball the file itself: `nano /etc/apt/sources.list.d/debian.sources`, Ctrl+X to leave.)

Finish this step with a refresh:

```bash
apt update
```

### Pin the kernel the driver can build against

The step nobody warns you about, hit live on this build (August 2026): **no NVIDIA driver branch compiles against the kernel-7.0 series** that current Proxmox 9.2 boots by default. Kernel 7.0 rewrote its memory-management interfaces, and every driver build dies in `VMA_LOCK_OFFSET` compile errors — a DKMS "Bad return status / exit status 10" — on all branches and all card generations, per the Proxmox forums. The stable fix: boot the **6.14 kernel series** (Proxmox 9's original GA kernel, still maintained) and pin it, so later updates cannot silently put the host back on 7.0:

```bash
apt install -y proxmox-kernel-6.14 proxmox-headers-6.14
proxmox-boot-tool kernel list
```

The list names every installed kernel. This build's 6.14 entry is `6.14.11-9-pve`; if your list shows a newer 6.14.x, pin that one instead:

```bash
proxmox-boot-tool kernel pin 6.14.11-9-pve
reboot
```

The TrueNAS VM rides every reboot on this page by itself — Start at boot, previous page. Back in the Shell afterwards, `uname -r` must print the pinned version.

> [!INPUT] pinned-kernel | Pinned Proxmox kernel | 6.14.11-9-pve
> A deliberate hold, recorded here so it is never a mystery later: newer kernels keep installing with normal updates but are not booted. When a driver that builds on kernel 7 ships (watch Debian's `nvidia-driver` changelog or the Proxmox forum's kernel threads), `proxmox-boot-tool kernel unpin` plus a reboot lifts the hold — and after any unpin, confirm `nvidia-smi` still answers before trusting the box again.

> [!NOTE]
> **If the driver was installed before the pin** (this build did it in that order, and paid for it): DKMS keeps trying to build for every kernel whose *headers* are installed, so the leftover kernel-7 headers make every `apt` run end in the same "exit status 10" even while the running 6.14 module is fine. Clear it by purging the 7.0 headers — DKMS skips kernels without headers, and the kernel itself can stay as a boot fallback — then finish the half-configured packages: `apt purge -y proxmox-headers-7.0.14-8-pve` (match the version to yours), then `dpkg --configure -a`.

### Install the driver and record the version

With the host on the pinned kernel, install the driver and persistence daemon — the first command compiles the kernel module through DKMS, so it takes a few minutes:

```bash
apt install -y build-essential nvidia-driver nvidia-smi nvidia-persistenced
```

Midway, a text dialog interrupts: **"Conflicting nouveau kernel module loaded."** Expected — nouveau is the free driver that grabbed the card at boot, and it has to let go before NVIDIA's module can load. Press Enter on **Ok**, let the install finish, then do what the dialog says:

```bash
reboot
```

Once the host is back, reopen the Shell and confirm the card is seen — before that reboot this command errors, which is nouveau still holding on, not a failed install:

```bash
nvidia-smi
```

It should print the GTX 1080 Ti with the driver version in its top line. Record that version here — it is a number three later pages depend on:

> [!INPUT] nvidia-driver-version | Host NVIDIA driver version | 550.163.01
> From the top line of the host's `nvidia-smi`. Frigate, Ollama, and faster-whisper each install an in-container userspace driver that must match this **exactly** — check this field before building any of them, and update it whenever a host upgrade bumps the driver (the Maintenance page's update pass calls that out).

> [!NOTE]
> If `apt install -y nvidia-driver` cannot find the package, the extra components did not take — open `/etc/apt/sources.list.d/debian.sources` and check its `Components:` lines end with `non-free non-free-firmware`, then run `apt update` again. The `nvidia-persistenced` package ships the persistence daemon's systemd unit; installing it alongside the driver is what gives the next step a unit to enable.

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

So there is nothing to edit right now. Keep this recipe; you will come back to it. When each container is built, edit its config file on the host (`/etc/pve/lxc/<ctid>.conf`, where `<ctid>` is that container's ID) and add the same three NVIDIA device nodes, using the `dev0:` device syntax rather than hand-writing `lxc.cgroup2` lines — `dev0:` is what Proxmox officially supports and it survives upgrades:

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

First prove IOMMU is active (the DMAR/IOMMU lines from the Install Proxmox page — VT-d on in BIOS plus the kernel flags, which are belt-and-braces since `intel_iommu` defaults on in current kernels):

```bash
dmesg | grep -e DMAR -e IOMMU
```

Then find the card's PCI address and vendor:device IDs, and the IOMMU group it landed in — on this build the card sits at **`03:00.0`**, IDs **`[1000:0097]`**, in **group 13** (all verified during the build; re-run to confirm nothing moved):

```bash
lspci -nn | grep -i -e LSI -e SAS -e Broadcom
for g in /sys/kernel/iommu_groups/*/devices/*; do
  echo "Group $(basename $(dirname $(dirname $g))): $(lspci -nns $(basename $g))"
done | grep -i -e LSI -e SAS -e Broadcom
```

The loop names the HBA's group; listing that group's folder directly must print the HBA's address and nothing else:

```bash
ls /sys/kernel/iommu_groups/13/devices/
```

You want the HBA in a group containing only itself (or only its own functions) — and the `ls` is the command that proves it, since the loop's grep only shows the HBA's own line and would hide any neighbours sharing the group. If other devices do show up in there, passthrough either fails or drags those neighbours into the VM — recheck that the card is in the chipset-attached PCIEX4_3 slot.

> [!NOTE]
> The vendor:device IDs from `lspci -nn` (something like `[1000:0097]`) are what you bind to vfio-pci. They sit in brackets at the very end of the line — exactly the part a console cuts off when the line runs past the screen edge. If you cannot see them, re-run scoped to just the card and the line stays short: `lspci -nn -s 03:00.0` (your address from the step above). Note the pair down — the next step uses it.

### Bind the card to vfio-pci
Tell the host to claim the HBA for VFIO at boot so no host driver grabs it first: a modprobe entry with the card's IDs, a blacklist of its native driver so it can never win the race for the device, the vfio modules loaded early, then a refreshed initramfs and a reboot. The values below are this build's, both verified live — `1000:0097` from the `lspci -nn` brackets, `mpt3sas` from its `Kernel modules:` line:

```bash
echo -e "options vfio-pci ids=1000:0097\nblacklist mpt3sas" > /etc/modprobe.d/vfio.conf
echo -e "vfio\nvfio_iommu_type1\nvfio_pci" >> /etc/modules
update-initramfs -u -k all
reboot
```

After the reboot, confirm the card is bound to `vfio-pci` — `Kernel driver in use: vfio-pci` is the line you want, not a SAS driver:

```bash
lspci -nnk | grep -A3 -i -e LSI -e SAS -e Broadcom
```

> [!NOTE]
> The `ids=` option alone is not reliable here — both `vfio-pci` and the HBA's native driver load as modules at boot, and the native one commonly wins the race to claim the device even with `vfio-pci` loaded early via `/etc/modules`. Blacklisting the native driver outright is what actually guarantees `vfio-pci` gets it. Nothing else on this build uses `mpt3sas`, so losing it costs nothing.
>
> Still says `Kernel driver in use: mpt3sas` after the reboot? `cat /etc/modprobe.d/vfio.conf` — it must show **both** lines, the `ids=` and the `blacklist`; a `>` that overwrote instead of a `>>` that appended is the usual culprit. (`Kernel modules: mpt3sas` continuing to appear in `lspci -nnk` is fine — that line lists what *could* drive the card, not what does. And duplicate `vfio` lines in `/etc/modules` from running the setup block twice are harmless; no need to clean them up.)

### Add the HBA to the TrueNAS VM
With the card on vfio-pci, hand the **whole device** to the TrueNAS VM. In the Proxmox web interface, select the TrueNAS VM, then **Hardware → Add → PCI Device**, choose the 9300-8i, and tick **All Functions** and **PCI-Express**. Add it to the **TrueNAS VM only** — no other guest. Or, equivalently, from the host shell — this build's values are the TrueNAS VM ID (`100`) and the HBA's chipset-side bus address from the `lspci` step (`03:00.0`, entered without the `.0` function suffix so all functions pass, matching the GUI ticks; the top-slot `01:00` is the 1080 Ti — never that one):

```bash
qm set 100 -hostpci0 0000:03:00,pcie=1,rombar=0
```

**`rombar=0` is not optional on this build.** Without it, the VM's SeaBIOS tries to run the HBA's own **MPT option ROM** at every boot, that ROM faults inside the guest (`MPT BIOS Fault 02h … Firmware Fault Code: 2667h`), and the VM parks at `Press any key to continue...` — waiting for a human forever. It boots fine when you are watching and never boots after a power cut, which is the worst possible failure shape for a machine the whole outage-recovery plan depends on. The option ROM exists only to let a machine *boot from* disks on the card; this VM boots from its own 32 GB virtual disk and TrueNAS loads the `mpt3sas` driver itself once running, so hiding the ROM costs nothing.

Power-cycle the TrueNAS VM — a full **stop and start**, not a guest reboot; the PCI device only attaches on a cold VM start. Watch this first boot in the **Console**: it should pass straight through SeaBIOS with no `Press any key` prompt. If that prompt appears, `rombar=0` did not take — re-run the command and cold-start again. Then confirm in the TrueNAS web UI: **Storage** in the left nav, then the **Disks** button in the dashboard's top-right corner. The two mirror IronWolfs should be listed by their **real model (`ST4000VN…`) and real serial numbers** — the same serials as the stickers on the drives — alongside the 32 GB QEMU boot disk. Real model and serial is the proof the passthrough is genuine; the mirrored pool gets built from them on the TrueNAS Storage page.

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
