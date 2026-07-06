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

- **The TrueNAS VM** was built on the **Virtual Machines** page: the Create VM wizard with **2 cores, 8192 MB memory** (ZFS is memory-hungry — it uses RAM as cache), a **32 GB boot disk** on the NVMe, network on bridge `vmbr0`, TrueNAS Community Edition installed from the console, the administrative password set, the installer ISO ejected, and the VM's IP captured. The ISO was pulled by the server itself (**local → ISO Images → Download from URL**), never uploaded from a laptop.
- **The 9300-8i HBA** was VFIO (Virtual Function I/O)-bound on the host and the whole card attached to this VM on the **GPU Sharing & HBA Passthrough** page (**Hardware → Add → PCI Device → 9300-8i → All Functions**). There is no per-disk `serial=` plumbing on this build — passing the entire controller is the whole reason the card exists.

So this page picks up after both of those: it confirms the raw disks arrived, then builds the pool and shares. Do **not** re-create the VM or re-download the ISO.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> The address the console printed after install (captured on the Virtual Machines page). Pin it with a DHCP (Dynamic Host Configuration Protocol) reservation on the router so it never moves.

> [!INPUT] truenas-admin-user | TrueNAS admin username | | truenas_admin
> Current versions create `truenas_admin` — leave as-is unless yours differs.

> [!SECRET] truenas-admin-password | TrueNAS admin password
> Set during install — the web UI login.

> [!NOTE]
> ECC RAM is ideal for ZFS data integrity but not required at home — this board takes standard 32 GB non-ECC, and that is fine.

> [!WARNING]
> VFIO is for the HBA only. The GTX 1080 Ti is *shared* across the service containers from the host driver and must never be VFIO-bound or handed to a VM. Keep the two policies straight: the HBA locks to this one VM; the GPU never locks to anyone.

### Confirm the raw disks appear
Boot the VM and open **Storage → Disks**. You should see both **mirror Seagate IronWolf ST4000VN006 4 TB** drives by their real model and serial, each reporting genuine SMART — exactly as if TrueNAS were running on bare metal. The third (footage) IronWolf sits on a motherboard SATA port with the host, so it does not — and should not — appear here.

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
- **`backups`** — a separate dataset (also SMB preset) so the build's safety copies stay out of your file snapshots.

> [!NOTE]
> The SMB preset tunes a dataset for network sharing — case-insensitive filenames and NFSv4 ACLs. Both datasets here get exposed over the network (the `backups` dataset receives the Proxmox vzdump archives over SMB), so SMB is the right choice for both. If you ever add a dataset that stays internal and is never shared, pick the **Generic** preset instead.

## Share it

### Create the SMB user
SMB — served by Samba — is the network-drive protocol Macs speak natively, and TrueNAS requires at least one local SMB user before it will create any share. You cannot connect as root or a built-in account. Go to **Credentials → Users → Add**, fill in a Full Name, a username, and a strong password, and leave **SMB User** ticked (it is by default) — that checkbox is what makes these credentials valid for share access.

> [!INPUT] smb-user | SMB share username
> One shared household user is fine to start; add per-person users later.

> [!SECRET] smb-password | SMB share password
> The password typed on every Mac and phone that connects.

### Create the SMB shares
Go to **Shares** and click **Add** on the **Windows (SMB) Shares** widget, and add **two** shares — one per dataset. Point the first at the `tank/files` dataset and the second at `tank/backups`; each share name pre-fills from its dataset name, courtesy of the SMB preset. Save each. When TrueNAS prompts to enable or restart the **SMB service**, accept: that is what puts the shares on the network. The `files` share is for everyday household storage; the `backups` share is where the Proxmox backups land later in the build, so it must exist now.

### Connect from your Macs
The share answers at the VM's IP address. In Finder, choose **Go → Connect to Server** and enter the address, then your SMB user's credentials when asked:

```bash
# macOS — Finder > Go > Connect to Server:
smb://192.168.1.20
```

Swap in your own TrueNAS IP. This is an all-Apple household, so the `files` share showing up in every Finder sidebar is the goal.

> [!TIP]
> Make the mount stick across reboots so the share is there at every login. With the share mounted, open **System Settings → General → Login Items & Extensions → Open at Login**, click **+**, and pick the mounted `files` share. macOS re-mounts it automatically each time that Mac logs in — otherwise the share drops out of the sidebar after every restart or logout.

> [!NOTE]
> The `backups` share you just created is the landing zone for the build's safety copies — the Proxmox vzdump archives and the host-config backup point at it once the storage is up. Snapshots, scrubs, disk-health alerts, and the offsite copy to Backblaze B2 get their own steps later in this collection.
