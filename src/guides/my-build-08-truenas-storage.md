---
title: TrueNAS Storage
subtitle: A ZFS mirror on the passed-through HBA, plus the Frigate footage drive
collection: My Build
order: 8
accent: amber
---

TrueNAS turns the three Seagate IronWolf spinners into a proper network-storage appliance — shared folders, snapshots, and the ZFS (Zettabyte File System) filesystem guarding your data. This build does it the way iXsystems recommends: instead of plumbing disks through one at a time, the whole LSI/Broadcom 9300-8i HBA (host bus adapter) was VFIO (Virtual Function I/O)-passed to this VM (virtual machine) earlier, so ZFS sees the raw drives exactly as bare metal would — genuine SMART, full per-drive health, none of the silent power-loss corruption risk that per-disk passthrough carries.

## Wire the drives first

### Cable each drive to the right place
This wiring happened during the physical build on the **Hardware & BIOS** page — verify each drive is cabled as follows before going further, because the wiring is what makes the passthrough (recapped below) behave:

- **HBA → the bottom `PCIEX4_3` PCIe (Peripheral Component Interconnect Express) slot**, set to x4 in BIOS. That chipset-attached slot is what gives the card a clean IOMMU (Input/Output Memory Management Unit) group so it can be isolated and passed through whole.
- **SFF-8643 *forward* breakout cabling** from the HBA's internal ports, fanning out to **SATA (Serial ATA) plugs** — the fan-out cabling you connected on the Hardware & BIOS page.
- **One breakout tail → mirror disk A** (one ST4000VN006), **another tail → mirror disk B** (the second ST4000VN006). Any unused tails are spare — room to grow the pool later. Both mirror disks ride the HBA, so they belong to TrueNAS.
- **Footage disk → a motherboard SATA port, *not* the HBA.** The third ST4000VN006 is Frigate's. The whole HBA goes to this VM, so anything plugged into it vanishes from the Proxmox host — and the footage drive has to stay on a board port the host can still see, because the host is what hands that disk into the Frigate container.
- **NVMe (Non-Volatile Memory Express) → the board's M.2 slot** (Proxmox OS plus the Frigate cache — untouched by TrueNAS).
- **Power:** SATA power to each of the three 4 TB drives from the Toughpower PSU (power supply unit). The three drive plates sit at spread-out spots on the back of the tray, farther apart than one cable&apos;s connectors reach — so it takes **two** of the PSU&apos;s SATA cables (the two mirror drives daisied on one, the footage drive on the other), not a single chain.

> [!NOTE]
> All three 3.5" IronWolfs are already mounted in the Thermaltake View 71's **fixed drive trays behind the motherboard tray** — done on the Hardware & BIOS page; the removable front "pod" cages aren't required. The roughly 300 mm 1080 Ti clears the front cage area regardless.

> [!WARNING]
> All three disks get claimed entirely — the two by ZFS, the third by Frigate. Nothing you care about can be on them. That is by design here.

## Recap what is already built

### The VM and the HBA already exist
By the time you reach this page, two earlier steps in the build have done the heavy lifting — there is nothing to download and no VM to create here:

- **The TrueNAS VM** (VM 100) was built on the **Virtual Machines** page: the Create VM wizard with **q35, 1 socket / 2 cores, 8192 MiB memory with ballooning off** (ZFS is memory-hungry and wants its RAM fixed), a **32 GB boot disk** on the NVMe, network on bridge `vmbr0`, TrueNAS Community Edition installed from the console, the `truenas_admin` password set, the installer ISO ejected, and the static `.20` address set inside TrueNAS.
- **The 9300-8i HBA** was VFIO (Virtual Function I/O)-bound on the host and the whole card attached to this VM on the **GPU Sharing & HBA Passthrough** page (`qm set 100 -hostpci0 0000:03:00,pcie=1` — the GUI equivalent of All Functions + PCI-Express). There is no per-disk `serial=` plumbing on this build — passing the entire controller is the whole reason the card exists.

So this page picks up after both of those: it confirms the raw disks arrived, then builds the pool and shares. Do **not** re-create the VM or re-download the ISO.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> The static address set inside TrueNAS on the Virtual Machines page — `.20` sits in the protected `.2–.99` static zone, so it never moves.

> [!INPUT] truenas-admin-user | TrueNAS admin username | | truenas_admin
> Chosen at the installer's Authentication Method screen on the Virtual Machines page.

> [!SECRET] truenas-admin-password | TrueNAS admin password
> Set during install — the web UI login.

> [!NOTE]
> ECC RAM is ideal for ZFS data integrity but not required at home — this board takes standard 32 GB non-ECC, and that is fine.

> [!WARNING]
> VFIO is for the HBA only. The GTX 1080 Ti is *shared* across the service containers from the host driver and must never be VFIO-bound or handed to a VM. Keep the two policies straight: the HBA locks to this one VM; the GPU never locks to anyone.

### Confirm the raw disks appear
Boot the VM and open **Storage → Disks**. You should see both **mirror Seagate IronWolf ST4000VN006 4 TB** drives by their real model and serial, each reporting genuine SMART — exactly as if TrueNAS were running on bare metal. The third (footage) IronWolf sits on a motherboard SATA port with the host, so it does not — and should not — appear here.

While the serials are on screen, record them — with **which physical tray each one sits in** (the drives are identical at a glance, and the dead-disk drill on the next page keys on serial). The footage disk's serial is on the Proxmox side: node → **Disks**.

> [!INPUT] mirror-a-serial | Mirror disk A — serial + tray position

> [!INPUT] mirror-b-serial | Mirror disk B — serial + tray position

> [!INPUT] footage-serial | Footage disk — serial + tray position

> [!NOTE]
> Because the whole controller is passed through, SMART reaches TrueNAS directly. There is no "monitor from the host" blind spot like per-disk passthrough has — TrueNAS's own Drive Health Management watches these disks.

> [!DETAILS] If a disk is missing from the list
> A drive that does not appear is almost always a cabling or power miss, not a TrueNAS fault. Power the VM fully off, then check: the breakout cable is seated in the HBA port, the SATA-power lead reaches every drive, and the disk is one of the two on the HBA (the footage disk lives on a motherboard port and will *not* show here — that is correct). On the Proxmox host, `lspci -nnk | grep -A3 -i -e LSI -e SAS -e Broadcom` shows the card with `Kernel driver in use: vfio-pci`, confirming it is bound for passthrough to the VM.

## Build the pool

### Mirror two of the IronWolf disks
A pool is ZFS's big bucket: physical disks fused into one storage unit. In the TrueNAS web interface go to **Storage** and click **Create Pool** to open the wizard. Name the pool `tank` (lowercase), set **Layout → Mirror**, and select both IronWolf drives — see the next paragraph for how. End on the **Review** screen and click **Create Pool**.

The wizard can only offer the two IronWolfs on the HBA — the footage disk is invisible to this VM by design, so it can never be grabbed by mistake. Use **Manual Disk Selection** to point at the two disks by their serials, OR under **Automated Disk Selection** set **Disk Size** to **4 TB** and **Width** to **2** so the vdev takes both.

> [!WARNING]
> Confirm the **Review** screen lists exactly **two** disks before you click **Create Pool**. If a third ST4000VN006 is ever offered here, stop — that means Frigate's footage drive ended up on the HBA instead of a motherboard SATA port, and it must stay out of `tank`. Power down and recable it before building the pool.

With a mirror, one drive can die and the data survives; usable space is one disk's worth — roughly **4 TB**. The second disk holds the live copy.

> [!NOTE]
> Both mirror disks are the same model from the same batch — the one failure a mirror can't absorb is both dying together. That risk is accepted here because the irreplaceable data also goes offsite (below) and bulk data is replaceable. The spec that genuinely matters is recording technology: the ST4000VN006 is **CMR (conventional magnetic recording)**, not SMR (shingled magnetic recording), so it rebuilds a mirror cleanly.

### Keep the third IronWolf off the mirror
The **third** ST4000VN006 is **not** part of `tank`. It is the dedicated **Frigate footage drive** — camera recordings are bulk, replaceable, write-heavy data that has no business churning a mirror or eating snapshot space. That disk lives on a motherboard SATA port and is mounted directly into the Frigate container during this collection's camera work, so it does not belong to a TrueNAS pool at all. It gets **no redundancy and no offsite, by choice.**

### Add a dataset with the SMB preset
Datasets are the folders-with-superpowers inside a pool — each carries its own settings, and snapshot tasks target them individually. Go to **Datasets**, select the `tank` root dataset, click **Add Dataset**, and create:

- **`files`** — general household storage. Set **Dataset Preset → SMB (Server Message Block)** so it gets case-insensitive names and NFSv4 ACLs, the permission style SMB expects.
- **`backups`** — a separate dataset (also SMB preset) so the build's safety copies stay out of your file snapshots. **Re-select the `tank` root before clicking Add Dataset for this one** — after creating `files`, the selection stays on `files`, and Add Dataset then nests the new one *inside* it as `tank/files/backups`. If that happens: select the nested dataset, delete it (the dialog has you type its full path to confirm — it is empty, so this is safe), then create it again from the root.

> [!NOTE]
> The SMB preset tunes a dataset for network sharing — case-insensitive filenames and NFSv4 ACLs. Both datasets here get exposed over the network (the `backups` dataset receives the Proxmox vzdump archives over SMB), so SMB is the right choice for both. If you ever add a dataset that stays internal and is never shared, pick the **Generic** preset instead.

> [!NOTE]
> Two prompts pop up around dataset creation; both have one-word answers. Asked to **start/enable the SMB service** → yes, that is the service the shares need. The **"Set ACL for this dataset"** dialog → **Return to pool list**, skipping the ACL Manager: the SMB preset already applied the right default permissions, including what the SMB user created below needs to read and write. The ACL Manager is for per-person carve-outs this build does not use.

## Share it

### Create the SMB user
SMB — served by Samba — is the network-drive protocol Macs speak natively, and TrueNAS requires at least one local SMB user before it will create any share. You cannot connect as root or a built-in account. Go to **Credentials → Users → Add**: a username, a strong password, and under **Allow Access** leave **SMB Access** ticked and everything else off — this account exists purely for share logins, so it deliberately gets no web UI, shell, or SSH access (`truenas_admin` covers administration). Full Name lives under Additional Details and is optional — skip it or not, nothing uses it. Save.

> [!INPUT] smb-user | SMB share username
> One shared household user is fine to start; add per-person users later.

> [!SECRET] smb-password | SMB share password
> The password typed on every Mac, PC, and phone that connects.

> [!NOTE]
> Three accounts now exist, and the ladder is deliberate: **root** (Linux's built-in superuser — present because the OS needs it, login-disabled on modern TrueNAS, never used), **`truenas_admin`** (the administrator — web UI and `sudo`, used only to run the NAS), and this **SMB user** (shares only — no UI, no shell). The point of the separation: the one password scattered across household devices can open the file shares and *nothing else*; the password that can reconfigure the NAS never leaves the admin's hands.

### Confirm the shares the presets created
There is nothing to create here — **the SMB preset already made each dataset's share** when the dataset was created (that is also why TrueNAS asked to start the SMB service back then). So this step is a check, not a task: go to **Shares** and confirm the **Windows (SMB) Shares** widget lists **`files`** and **`backups`**, both **Enabled**, with the widget's badge reading **RUNNING**. The `files` share is everyday household storage; `backups` is where the Proxmox backups land later in the build.

Only if a share is missing — a dataset created without the preset — does the **Add** button come out: leave **Purpose** at **Default Share**, point it at the dataset, and accept any prompt to enable the SMB service.

### Connect from every computer
The share answers at the VM's address from both sides of the house — the Macs and the Windows PC alike, same SMB user either way.

**On a Mac**: in Finder, choose **Go → Connect to Server**, enter this, and give the SMB credentials when asked:

```
smb://192.168.1.20
```

**On the Windows PC**: map each share to its own drive letter — **This PC → Map network drive**, and give the **full share path**, not the bare address:

```
\\192.168.1.20\files
```

`\\192.168.1.20` alone is a *server*, not something Windows can mount; a drive letter must point at one share. Repeat for `\\192.168.1.20\backups` if you want that lettered too. Tick **Reconnect at sign-in** *and* **Connect using different credentials**, then click Finish.

Open `files` on each machine and confirm you can drop a file in.

> [!WARNING]
> On the credential prompt Windows shows next, click **More choices → Use a different account** — otherwise it aims your **Microsoft account** at TrueNAS (a sign-in/certificate picker appears) and the password is rejected, because the NAS has never heard of that account. Enter the plain SMB username with no prefix; if Windows keeps prepending the PC's name, force the local scope by typing `192.168.1.20\<smb-user>` instead. And if it fails once, Windows caches the bad attempt and replays it forever: open **Credential Manager → Windows Credentials**, delete every `192.168.1.20` entry, run `net use * /delete` in Command Prompt, and map again.

> [!TIP]
> Keep the Mac mount too: with the share mounted, open **System Settings → General → Login Items & Extensions → Open at Login**, click **+**, and pick the mounted `files` share — macOS re-mounts it at every login.

> [!NOTE]
> The `backups` share you just created is the landing zone for the build's safety copies — the Proxmox vzdump archives and the host-config backup point at it once the storage is up. Snapshots, scrubs, disk-health alerts, and the offsite copy to Backblaze B2 get their own steps later in this collection.
