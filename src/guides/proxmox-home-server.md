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

> [!DETAILS] What to look for before you wipe
> Work through this list — most of what matters lives in a handful of places:
>
> - **Personal files** — `C:\Users\<you>\Documents`, `Desktop`, `Downloads`, `Pictures`, `Videos`. Downloads is the one people forget.
> - **Browser bookmarks** — Chrome: `chrome://bookmarks` → three-dot menu → *Export bookmarks*. Edge: `edge://favorites` → *Export favorites*. Firefox: *Bookmarks → Manage Bookmarks → Import and Backup → Export Bookmarks to HTML*.
> - **Saved passwords** — Chrome: `chrome://settings/passwords` → *Export passwords* (saves a CSV — treat it carefully and delete it once imported elsewhere). Edge and Firefox have equivalent exports in their password settings.
> - **Game saves** — many live outside Steam's cloud. Check `Documents\My Games`, `%APPDATA%`, `%LOCALAPPDATA%`, and `C:\Program Files (x86)\Steam\userdata`.
> - **License keys** — for paid software you'd want to reinstall, dig the keys out of purchase emails or the app's About/Account screen now, while you can still open it.
> - **App data** — paste `%APPDATA%` into the File Explorer address bar (it resolves to `C:\Users\<you>\AppData\Roaming`) and skim for anything you recognise — email clients, chat history, editor configs.

> [!DETAILS] How to copy everything to an external drive
> 1. Plug in the drive and press `Win+E` to open File Explorer. The drive appears under **This PC** with its own letter (usually `D:` or `E:`).
> 2. Right-click each folder you're keeping → *Properties* to check its size, and confirm the drive has room.
> 3. Open `C:\Users\<you>`, select the folders (`Ctrl`+click for several), press `Ctrl+C`, then open the external drive and press `Ctrl+V`.
> 4. When the copy finishes, spot-check a few files actually open from the external drive.
> 5. Click the USB icon in the system tray and choose *Eject* before unplugging.

> [!DETAILS] No external drive? Other ways to get files off
> - **Cloud free tiers** — Google Drive gives 15 GB free, OneDrive 5 GB, Dropbox 2 GB. Fine for documents and photos; too small for big game folders.
> - **Copy to another PC over the network** — on the receiving PC, right-click a folder → *Properties → Sharing → Share* and grant your user write access. On the old PC, type `\\OTHER-PC-NAME` into the File Explorer address bar and copy files in. Both machines need to be on the same network.
> - **Any spare USB stick** — even a small one works if you move files in batches, prioritising the irreplaceable stuff first.

### Set BIOS for virtualization
Enter the BIOS (usually `Del` or `F2` at boot) and turn on the virtualization features Proxmox relies on:

- Enable **VT-x** (Intel Virtualization Technology)
- Enable **VT-d** (Directed I/O)
- Enable the **integrated graphics** so the dGPU stays free for passthrough
- Turn on **C-states** for cooler, quieter idle

> [!TIP]
> VT-d (IOMMU) is what makes PCIe passthrough work later — handing a GPU, a disk controller, or a whole USB controller to a VM. Enable it now; it is easy to forget and annoying to discover missing.

> [!DETAILS] How to get into the BIOS
> Power the machine off fully, power it on, and tap `Del` (or `F2` on some boards) repeatedly from the moment the screen lights up. If Windows boots too fast to catch it: hold `Shift` while clicking *Restart* in the Start menu, then go to *Troubleshoot → Advanced options → UEFI Firmware Settings → Restart* — the PC reboots straight into the BIOS.

> [!DETAILS] Where each setting lives on a Z370-era board
> The 8700K sits on a Z370 or Z390 board, so the layout is roughly:
>
> - **VT-x** — *Advanced → CPU Configuration*, listed as **Intel Virtualization Technology**. Set to Enabled.
> - **VT-d** — *Advanced → System Agent (SA) Configuration*, listed as **VT-d**. Set to Enabled.
> - **Integrated graphics** — *System Agent (SA) Configuration → Graphics Configuration*, listed as **Internal Graphics** or **iGPU Multi-Monitor**. Set to Enabled so the iGPU stays active alongside the dGPU.
> - **C-states** — under *CPU Power Management* (often inside *Advanced → CPU Configuration*), listed as **CPU C-states** or **Package C State Limit**. Set to Enabled or Auto.
>
> Vendor naming varies — ASUS, Gigabyte, and MSI shuffle these menus around, but the section names above are close on all three. Save with `F10` and confirm before exiting.

## Phase 2 — Install Proxmox

### Download the Proxmox VE ISO
Get the ISO from [proxmox.com/en/downloads](https://www.proxmox.com/en/downloads) — click **Proxmox Virtual Environment**, then the top item, **Proxmox VE 9.2 ISO Installer**. It is free, needs no account, and is about 1.7 GB.

> [!DETAILS] Verify the download (optional but smart)
> Hash the file and compare it against the SHA256 shown next to the download link. A match means the file arrived intact and untampered.
>
> ```bash
> # macOS / Linux
> shasum -a 256 proxmox-ve_9.2-1.iso
>
> # Windows (Command Prompt)
> CertUtil -hashfile proxmox-ve_9.2-1.iso SHA256
> ```
>
> For the 9.2-1 ISO the expected value is `4e88fe416df9b527624a175f24c9aa07c714d3332afb1ee3dbf3879573ef2c6c`.

### Flash the installer
Write the ISO to a USB stick (4 GB or larger) with [balenaEtcher](https://etcher.balena.io/), then keep the stick handy for the next step.

> [!WARNING]
> Flashing erases everything on the stick. Double-check you have selected the USB drive, not an internal disk.

> [!DETAILS] How to write the ISO with balenaEtcher, click by click
> Etcher is free, works on Windows, macOS, and Linux, and handles the Proxmox ISO with no special settings.
>
> 1. Download Etcher from [etcher.balena.io](https://etcher.balena.io/) and install it.
> 2. Insert a USB stick of 4 GB or more.
> 3. Click **Flash from file** and pick the Proxmox ISO.
> 4. Click **Select target** and pick your USB stick — check the size matches.
> 5. Click **Flash** and wait. Etcher validates the write afterwards; let it finish.
> 6. On Windows, Explorer may now pop up "You need to format the disk before you can use it." Click **Cancel** — the stick is fine; Windows just can't read its Linux partitions. Formatting it would destroy the installer you just made.

> [!DETAILS] On Windows: Rufus works too
> [Rufus](https://rufus.ie/) is a lighter Windows-only alternative, with one catch: the Proxmox docs say you must write in **DD mode**.
>
> 1. Pick the ISO and the stick, then click **Start**.
> 2. If asked to download a different version of GRUB, click **No**.
> 3. When the dialog offers ISO or DD mode, choose **DD** (write as a raw image). ISO mode produces a stick that will not boot the Proxmox installer.
>
> The same "format this disk?" popup can appear afterwards — Cancel it here too.

### Run the installer
Plug the machine into your router with an **Ethernet cable** first — Proxmox cannot use Wi-Fi for management out of the box. Then boot from the stick, pick **Install Proxmox VE (Graphical)**, and follow the prompts. The two answers worth thinking about beforehand are the hostname and a **static IP** on your LAN — write the IP down, you will need it constantly.

```bash
# After install, reach the web UI from another machine on the LAN:
https://your-ip:8006
```

> [!NOTE]
> Proxmox has no desktop of its own. You administer everything from a browser at that address.

> [!DETAILS] How to boot from the USB stick
> Right after powering on, tap the one-time boot menu key — commonly `F8` (ASUS), `F11` (MSI, ASRock), or `F12` (Gigabyte, Dell, Lenovo). If none of those work, enter the BIOS (`Del` or `F2`) and put the USB stick first in the boot order.
>
> If the menu lists the stick twice, pick the entry starting with **UEFI:**.

> [!DETAILS] Every prompt the installer shows, in order
> 1. **EULA** — read or skim, click I agree.
> 2. **Target disk** — the drive Proxmox will erase and install onto. The **Options** button picks the filesystem; the default (ext4 on LVM) is fine.
> 3. **Country, time zone, keyboard layout** — usually auto-detected; confirm and move on.
> 4. **Password, confirm, email address** — this is the root password (8 characters minimum, longer is better) and an email for system notifications.
> 5. **Management network** — interface, hostname (FQDN), IP address (CIDR), gateway, and DNS server. The two details blocks below cover the hostname and the IP numbers.
> 6. **Summary** — review everything, click Install, and the machine reboots on its own when done. When the reboot starts, unplug the USB stick — and if you changed the BIOS boot order earlier, set the internal drive back to first, or you will boot straight back into the installer.

> [!DETAILS] How to pick the hostname
> The installer wants a fully qualified domain name — a hostname plus a domain, like `pve.home.arpa`. The first part becomes the node name you see everywhere in the UI, so keep it short.
>
> `home.arpa` is the domain reserved for home networks by RFC 8375, which makes `pve.home.arpa` a safe default. Avoid `.local`: it is reserved for mDNS (RFC 6762), and macOS in particular hands `.local` lookups to Bonjour instead of your DNS server, so names under it resolve unreliably.

> [!DETAILS] How to choose the static IP — finding your numbers
> First find your router's IP (the gateway):
>
> ```bash
> # Windows — press Win+R, type cmd, press Enter, then
> # read the "Default Gateway" line from:
> ipconfig
>
> # macOS — read the line for en0 (a VPN can add a fake utun "default" line):
> netstat -nr | grep default
> ```
>
> On macOS you can also use System Settings → Wi-Fi → **Details** next to your network, and read the Router address.
>
> Then browse to that IP (e.g. `http://192.168.1.1`) and log in to the router — the admin username and password are usually printed on a sticker on the router itself, or in your ISP's app or paperwork. Find the DHCP range under the LAN or DHCP settings. Pick an address **outside** that range for Proxmox, or create a DHCP reservation for it inside the range — some routers only allow one or the other.
>
> Can't get into the router at all? Pick a high address like `192.168.1.250` and ping it first — if nothing answers, it is almost certainly free.
>
> Concrete example for a `192.168.1.x` network with a DHCP pool of `.100`–`.254`:
> - **IP Address (CIDR):** `192.168.1.50/24` (the `/24` is the standard home subnet mask, 255.255.255.0)
> - **Gateway:** `192.168.1.1` (your router)
> - **DNS Server:** `192.168.1.1` (the router) or `1.1.1.1`

### Log in to the web UI for the first time
From another machine on the LAN, browse to `https://your-ip:8006`. Your browser will warn about the certificate before you see a login screen — that is expected, not a sign anything went wrong.

> [!DETAILS] About the scary certificate warning
> Proxmox generates its own (self-signed) certificate, so your browser cannot vouch for it and shows a full-page warning. Click **Advanced**, then **Proceed** (wording varies by browser). On your own LAN, connecting to a server you just installed, this is fine.

> [!DETAILS] Your first login
> - **User name:** `root`
> - **Password:** the one you set during install
> - **Realm:** Linux PAM standard authentication
>
> A popup saying "No valid subscription" appears on every login. It is normal for the free version — click OK; the next step removes it.

### Post-install cleanup
Run the excellent community post-install script to fix the package repositories and remove the subscription nag screen.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/tools/pve/post-pve-install.sh)"
```

> [!DANGER]
> Only pipe a script straight into a root shell when you trust the source and have read it. This one is widely used and open, but make that judgement yourself every time.

> [!DETAILS] What the script actually changes
> Run it in the Proxmox shell (Datacenter → your node → Shell). It walks you through yes/no menus:
>
> - Disables the enterprise package repo, which errors without a paid subscription
> - Enables the free no-subscription repo so updates work
> - Corrects the apt source lists for your PVE version
> - Removes the "No valid subscription" login popup, and keeps it removed after updates
> - Optionally runs a full update and reboots
>
> Answer yes to all of those for a home server.

## Phase 3 — First workloads

### Create a Debian container
Use a lightweight LXC container for services that don't need a full VM. From the web UI: **Create CT**, pick the Debian template, give it 2 cores and 2 GB of RAM to start.

> [!DETAILS] Download a template first
> Container templates live in storage, and a fresh install has none. Grab one before you create your first CT:
>
> - In the left tree, click your node, then the **local** storage under it.
> - Open **CT Templates**, then click the **Templates** button.
> - Find **debian** with the *standard* flavour in the list and click **Download**.
>
> When the task log says `TASK OK`, the template is ready to use in the wizard.

> [!DETAILS] The Create CT wizard, screen by screen
> Click **Create CT** (top right) and walk the tabs:
>
> - **General** — leave the suggested CT ID, set a hostname (e.g. `debian-test`), and set a root password for the container.
> - **Template** — pick the Debian standard template you just downloaded.
> - **Disks** — around 8 GB is plenty to start; you can grow it later.
> - **CPU** — 2 cores.
> - **Memory** — 2048 MB.
> - **Network** — set IPv4 to **DHCP** to start. You can pin a static IP once you know the container earns its keep.
> - **Confirm** — tick **Start after created** and finish.
>
> Select the container in the tree and open **Console** to log in as `root` with the password you set.

### Spin up a VM for anything that needs a real kernel
For Home Assistant OS, a Windows box, or anything doing GPU work, create a full VM instead and attach the ISO you uploaded to local storage.

```bash
# List your VMs and containers from the Proxmox shell:
qm list
pct list
```

> [!DETAILS] Upload an ISO to Proxmox
> ISOs live in storage, same as container templates:
>
> - In the left tree, click the **local** storage under your node, then **ISO Images**.
> - Click **Upload** and pick the ISO from the machine your browser is on, or
> - Click **Download from URL** and paste a direct link so the server fetches it itself — faster for big images.
>
> Wait for the upload task to report `TASK OK` before you build the VM.

> [!DETAILS] Create VM wizard essentials
> Click **Create VM** (top right) and walk the tabs:
>
> - **General** — give it a name; leave the suggested VM ID.
> - **OS** — pick your uploaded ISO from local storage.
> - **System** — defaults are fine, but tick the **Qemu Agent** checkbox so Proxmox can see the VM's IP and shut it down cleanly.
> - **Disks** — size to suit the OS; 32 GB covers most Linux installs.
> - **CPU** — 2 cores is a sensible start.
> - **Memory** — 2048–4096 MB depending on the guest.
> - **Network** — leave it on bridge **vmbr0** so the VM sits on your LAN like any other device.
> - **Windows guests** — the VirtIO defaults make the Windows installer see no disk. Either pick **SATA** for the disk and **Intel E1000** for the network, or attach the [virtio-win drivers ISO](https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso) as a second CD drive and load drivers during setup.
>
> Confirm, start the VM, and open **Console** to run the OS installer.

> [!NOTE]
> Home Assistant OS ships as a ready-made disk image, not an installer — don't use the wizard for it. Expand below for the easy way.

> [!DETAILS] The easy way to run Home Assistant OS
> The same community-scripts project from the post-install step has a helper that downloads the official HAOS image and builds the VM for you. Run it in the Proxmox shell and accept the defaults:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/haos-vm.sh)"
> ```
>
> Same rule as before: you are piping a script into a root shell, so read it first and make that call yourself. When it finishes, Home Assistant is at `http://haos-ip:8123` after a few minutes of first-boot setup.

### Take a snapshot before you tinker
Snapshots are instant and save you constantly. Take one before any risky change so rollback is a single click.

> [!TIP]
> Name snapshots for *what you were about to do* ("before-gpu-passthrough"), not the date. Future-you will thank present-you.

> [!DETAILS] How to take and roll back a snapshot
> - Select the VM or container in the left tree and open **Snapshots**.
> - Click **Take Snapshot**, give it a name that says what you were about to attempt, and an optional description.
> - For a running VM, the **Include RAM** checkbox also saves its memory state, so rollback returns it running exactly where it was.
> - To undo, select the snapshot in the list and click **Rollback** — everything since that snapshot is discarded.
