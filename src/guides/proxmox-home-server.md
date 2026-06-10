---
title: Proxmox Home Server Build
subtitle: Bare-metal to a full local stack — containers, VMs, and Home Assistant
accent: spruce
---

## Phase 1 — Prep & BIOS

### Check the machine meets the requirements
Almost any 64-bit PC from the last decade can run Proxmox. You need: a CPU with virtualization support, 8 GB+ RAM to be comfortable, a drive you are willing to wipe, **wired Ethernet**, a 4 GB+ USB stick, and a second device with a browser.

> [!WARNING]
> Proxmox needs a wired network connection — Wi-Fi is effectively unsupported for its management interface. If the machine isn't near your router, sort that out first (a long cable or a powerline adapter both work).

> [!DETAILS] The requirements, decoded
> Proxmox's official *minimum* is tiny — 64-bit Intel/AMD CPU with Intel VT or AMD-V, 1 GB RAM, a hard drive, one network card. What actually matters for a pleasant home server:
>
> - **CPU** — anything 64-bit with virtualization (Intel VT-x or AMD-V). Practically every desktop CPU since ~2010 has it; it just may be switched off in the BIOS (next steps).
> - **RAM** — Proxmox itself wants ~2 GB; every container and VM you run needs its own share. 8 GB is a workable start, 16 GB+ is comfortable.
> - **Disk** — an SSD makes everything feel dramatically better than a hard drive. 128 GB+ gives you room for several VMs. The install **wipes the whole drive**.
> - **Network** — one wired Gigabit port. For PCIe passthrough later (GPU, disk controllers) the CPU/board also needs VT-d (Intel) or AMD-Vi/IOMMU — most do.
> - **Old laptops, mini PCs, ex-office desktops** (Dell OptiPlex, HP EliteDesk, Lenovo ThinkCentre) are all excellent candidates and very common Proxmox hosts.

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
Enter the BIOS and switch on the virtualization features Proxmox relies on. The names differ by platform — Intel calls them **VT-x** and **VT-d**; AMD calls them **SVM** and **IOMMU** — but the job is the same. Find your machine in the expandable sections below.

> [!TIP]
> VT-d / IOMMU is what makes PCIe passthrough work later — handing a GPU, a disk controller, or a whole USB controller to a VM. Enable it now; it is easy to forget and annoying to discover missing.

> [!DETAILS] How to get into the BIOS
> Power the machine off fully, power it on, and tap the setup key repeatedly from the moment the screen lights up:
>
> - **Custom-built PCs** (ASUS, Gigabyte, MSI boards) — `Del`, occasionally `F2`
> - **Dell** — `F2` · **HP** — `F10` · **Lenovo** — `F1`
>
> If Windows boots too fast to catch it: hold `Shift` while clicking *Restart* in the Start menu, then *Troubleshoot → Advanced options → UEFI Firmware Settings → Restart* — the PC reboots straight into the BIOS.

> [!DETAILS] Intel boards (Z370 through Z790 and similar)
> On ASUS, Gigabyte, and MSI boards with Intel CPUs:
>
> - **VT-x** — *Advanced → CPU Configuration*, listed as **Intel Virtualization Technology** (newer ASUS BIOSes call it **Intel (VMX) Virtualization Technology**). Set to Enabled.
> - **VT-d** — usually in a *different* submenu than VT-x, so don't stop after the first toggle: ASUS keeps it under *Advanced → System Agent (SA) Configuration*; Gigabyte under *Settings → Miscellaneous*; MSI under *OC → CPU Features*.
> - **Integrated graphics** — under the graphics/System Agent section, listed as **Internal Graphics** or **iGPU Multi-Monitor**. Enable it if the machine also has a discrete GPU you might pass through later.
> - **C-states** — under *CPU Power Management*. Enabled or Auto, for cooler and quieter idle.
>
> Save with `F10` and confirm before exiting.

> [!DETAILS] AMD boards (AM4 / AM5)
> The same two switches under AMD names:
>
> - **SVM Mode** (the AMD-V toggle) — ASUS: *Advanced → CPU Configuration*; Gigabyte: *Tweaker → Advanced CPU Settings*; MSI: *OC → CPU Features*. Set to Enabled.
> - **IOMMU** (the VT-d equivalent) — ASUS: *Advanced → AMD CBS → NBIO Common Options*; Gigabyte: *Settings → Miscellaneous*; MSI: near SVM in the OC menus. Set it explicitly to **Enabled** — on AMD boards, *Auto* is not the same thing and passthrough will not work with it.
>
> Two gotchas: MSI sometimes hides the CPU features until *OC Explore Mode* is set to **Expert**, and menu layouts shift between BIOS revisions — if a path above is missing, search the BIOS (many have a built-in search) for "SVM" or "IOMMU".

> [!DETAILS] Prebuilt desktops (Dell, HP, Lenovo)
> Ex-office machines make great Proxmox hosts, and their BIOSes are simpler:
>
> - **Dell OptiPlex** — `F2` into Setup → **Virtualization Support** section → enable **Virtualization** and **VT for Direct I/O**.
> - **HP EliteDesk / ProDesk** — `F10` into Setup → *Advanced → System Options* → tick **Virtualization Technology (VTx)** and **(VTd)**. On some older models it lives under the *Security* tab instead.
> - **Lenovo ThinkCentre** — `F1` into Setup → *Advanced → CPU Setup* → enable **Intel Virtualization Technology** and **Intel VT-d**.
>
> Save and exit (usually `F10`).

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
Write the ISO to a USB stick (4 GB or larger) with **one** of the two tools below — they do the same job, so pick whichever suits and skip the other. balenaEtcher is the easy default on any OS; Rufus is a Windows-only alternative.

> [!WARNING]
> Flashing erases everything on the stick. Double-check you have selected the USB drive, not an internal disk.

> [!DETAILS] Option A — balenaEtcher (Windows, macOS, Linux)
> Etcher is free and handles the Proxmox ISO with no special settings.
>
> 1. Download Etcher from [etcher.balena.io](https://etcher.balena.io/) and install it.
> 2. Insert a USB stick of 4 GB or more.
> 3. Click **Flash from file** and pick the Proxmox ISO.
> 4. Click **Select target** and pick your USB stick — check the size matches.
> 5. Click **Flash** and wait. Etcher validates the write afterwards; let it finish.
> 6. On Windows, Explorer may now pop up "You need to format the disk before you can use it." Click **Cancel** — the stick is fine; Windows just can't read its Linux partitions. Formatting it would destroy the installer you just made.

> [!DETAILS] Option B — Rufus (Windows only)
> [Rufus](https://rufus.ie/) is a lighter alternative if you'd rather not install Etcher — same result, one catch: the Proxmox docs say you must write in **DD mode**.
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
> Right after powering on, tap the one-time boot menu key — commonly `F8` (ASUS), `F11` (MSI, ASRock), `F12` (Gigabyte, Dell, Lenovo), or `Esc` then `F9` (HP). If none of those work, enter the BIOS and put the USB stick first in the boot order.
>
> If the menu lists the stick twice, pick the entry starting with **UEFI:**.

> [!DETAILS] Every prompt the installer shows, in order
> 1. **EULA** — read or skim, click I agree.
> 2. **Target disk** — the drive Proxmox will erase and install onto. The **Options** button picks the filesystem; the default (ext4 on LVM) is fine.
> 3. **Country, time zone, keyboard layout** — usually auto-detected; confirm and move on.
> 4. **Password, confirm, email address** — this is the root password (8 characters minimum, longer is better) and an email for system notifications.
> 5. **Management network** — the form your prepared answers go into: the network **interface** (pick the wired port), the **hostname** you chose, the **IP address** you picked for the server, and your router's address in both the **Gateway** and **DNS server** fields. The two blocks below walk through exactly where each number comes from.
> 6. **Summary** — review everything, click Install, and the machine reboots on its own when done. When the reboot starts, unplug the USB stick — and if you changed the BIOS boot order earlier, set the internal drive back to first, or you will boot straight back into the installer.

> [!DETAILS] How to pick the hostname
> The installer wants a fully qualified domain name — a name for the machine, a dot, and a domain, like `pve.home.arpa`. Both halves are your choice:
>
> - **The first part** — `pve` is just a convention (short for *Proxmox Virtual Environment*). Call the machine anything you like: `server`, `homelab`, `vault`. Lowercase letters, digits, and hyphens; keep it short, because it becomes the node name you see everywhere in the UI. Pick something you're happy with now — renaming a Proxmox node later is genuinely annoying.
> - **The domain part** — not required to be `home.arpa`, but it can't be empty. `home.arpa` is the domain officially reserved for home networks (RFC 8375), so it can never clash with the real internet — that's why it's the safe default. `.lan` is common and works, just unofficial. Avoid two things: `.local` (reserved for mDNS per RFC 6762 — macOS hands those lookups to Bonjour, so they resolve unreliably) and any real domain you don't own, like a made-up `.com`.
>
> Day to day you'll mostly reach the server by its IP anyway, so don't agonize over the domain half.

> [!DETAILS] The static IP — what you find and what you pick
> The installer wants three numbers. Two you **find** (they are facts about your network), one you **pick** (a brand-new address for the server):
>
> - **Gateway** — *found*. It is simply your router's address.
> - **DNS server** — *no decision needed*. Enter the router's address again (or `1.1.1.1` if you prefer Cloudflare's public DNS).
> - **IP address** — *picked by you*. An address nothing else on your network is using.
>
> **Step 1 — find the router's address:**
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
> On macOS you can also use System Settings → Wi-Fi → **Details** next to your network, and read the Router address. It is usually something like `192.168.1.1`. That one number fills both the Gateway and DNS fields.
>
> **Step 2 — pick the server's address.** Keep the first three numbers the same as the router's and change only the last one. The catch: your router automatically hands out addresses to phones and laptops as they join, from a block called the **DHCP range** (often `.100` and up). If you pick a number from that block, the router may later hand the *same* number to another device — and both will misbehave. Two safe ways around it:
>
> - **Easiest** — browse to the router's address and log in (the admin password is usually on a sticker on the router, or in your ISP's app). Find the DHCP range under the LAN or DHCP settings, and pick a number *below* it — if the range is `.100`–`.254`, something like `.50` is perfect.
> - **Alternative** — on that same router page, use **DHCP reservation** (sometimes called *static lease* or *address reservation*) to permanently assign your chosen number to the server, so the router never gives it to anything else.
>
> Can't get into the router at all? Pick a high number like `.250` and ping it first — if nothing answers, it is almost certainly free.
>
> **Worked example** for a network whose router is `192.168.1.1` with a DHCP range of `.100`–`.254`:
> - **IP Address (CIDR):** `192.168.1.50/24` (the `/24` just means "standard home network", mask 255.255.255.0)
> - **Gateway:** `192.168.1.1` (the router — found in step 1)
> - **DNS Server:** `192.168.1.1` (the router again) or `1.1.1.1`

### Log in to the web UI for the first time
From another machine on the LAN, browse to `https://your-ip:8006`. Your browser will warn about the certificate before you see a login screen — that is expected, not a sign anything went wrong.

> [!DETAILS] About the scary certificate warning
> Proxmox generates its own (self-signed) certificate, so your browser cannot vouch for it and shows a full-page warning. Click **Advanced**, then **Proceed** (wording varies by browser). On your own LAN, connecting to a server you just installed, this is fine.

> [!DETAILS] Your first login
> - **User name:** `root` — not a name you chose. Proxmox is Linux underneath, and `root` is Linux's built-in administrator account, like "Administrator" on Windows. The password you set during install was root's password.
> - **Password:** the one you set during install
> - **Realm:** leave it on **Linux PAM standard authentication** — it just means "check this login against the system account"
>
> A popup saying "No valid subscription" appears on every login. It is normal for the free version — click OK; the next step deals with it.

### Post-install cleanup
A fresh install points at Proxmox's paid *enterprise* package repo, so updates error until you switch to the free one. The community script below fixes that **and** removes the "No valid subscription" login popup. The by-hand route (last expandable) fixes updates just as well, but the popup stays — it is harmless, and clicking OK is all it ever needs.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/tools/pve/post-pve-install.sh)"
```

> [!DANGER]
> Only pipe a script straight into a root shell when you trust the source and have read it. This one is widely used and open, but make that judgement yourself every time.

> [!DETAILS] How to check a script yourself before running it
> "Piping curl to bash" runs whatever the server sends at that exact moment. The safer habit costs one minute — download, read, then run the copy you read:
>
> ```bash
> # 1. Download to a file instead of executing it:
> curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/tools/pve/post-pve-install.sh -o post-install.sh
>
> # 2. Read it (press q to quit). Skim for the URLs it contacts
> #    and anything it deletes or installs:
> less post-install.sh
>
> # 3. Run the exact copy you just read:
> bash post-install.sh
> ```
>
> This project is open source with a large, active maintainer community, but it is community-run — not official Proxmox software. The same habit applies to every other one-liner the internet hands you.

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

> [!DETAILS] Prefer no script? Do the same by hand
> The whole job is three small steps, straight from the official Proxmox docs.
>
> **Easiest: use the web UI.** Select your node → **Updates → Repositories**. Disable the two *enterprise* entries, then use **Add** to add the **No-Subscription** repository.
>
> **Or edit the files in the node's Shell.** Disable the enterprise repos by adding a line `Enabled: no` to each of these two files (open them with `nano <file>`):
>
> ```bash
> nano /etc/apt/sources.list.d/pve-enterprise.sources
> nano /etc/apt/sources.list.d/ceph.sources
> ```
>
> Then create `/etc/apt/sources.list.d/proxmox.sources` with the free repo:
>
> ```bash
> cat > /etc/apt/sources.list.d/proxmox.sources <<'EOF'
> Types: deb
> URIs: http://download.proxmox.com/debian/pve
> Suites: trixie
> Components: pve-no-subscription
> Signed-By: /usr/share/keyrings/proxmox-archive-keyring.gpg
> EOF
> ```
>
> Finally update everything:
>
> ```bash
> apt update && apt full-upgrade -y
> ```
>
> **One honest trade-off:** done this way, the "No valid subscription" login popup stays. It is purely cosmetic — click OK and everything works. Removing it means patching a Proxmox UI file that *every update overwrites*, which is exactly why the community script exists (it re-applies the patch automatically after each update). So your three options are: live with the popup (fine), run the script (gone), or buy a subscription (gone, and supports Proxmox).

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
For a Windows box, a full Linux desktop, or anything doing GPU work, create a complete virtual machine with its own kernel.

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

### Run Home Assistant OS
Home Assistant is the workload many home servers exist for. HAOS ships as a ready-made disk image — not an installer ISO — so don't use the Create VM wizard for it; use one of the two paths below.

> [!DETAILS] The quick way — community helper script
> The same community-scripts project from the post-install step has a helper that downloads the official HAOS image and builds the VM for you. Run it in the Proxmox shell and accept the defaults:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/haos-vm.sh)"
> ```
>
> Same rule as before: you are piping a script into a root shell, so read it first (the download-read-run habit from Phase 2) and make that call yourself.

> [!DETAILS] The manual way — no scripts
> Five commands in the Proxmox shell, using only official sources. Check the [HAOS releases page](https://github.com/home-assistant/operating-system/releases) for the latest version and substitute it for `17.3` below. Replace `100` with a free VM ID and `local-lvm` with your storage name if it differs.
>
> ```bash
> # 1. Download and unpack the official image:
> cd /tmp
> wget https://github.com/home-assistant/operating-system/releases/download/17.3/haos_ova-17.3.qcow2.xz
> unxz haos_ova-17.3.qcow2.xz
>
> # 2. Create the VM shell. HAOS needs UEFI boot with secure boot off,
> #    which is what the efidisk line sets up:
> qm create 100 --name haos --ostype l26 --bios ovmf \
>   --efidisk0 local-lvm:0,efitype=4m,pre-enrolled-keys=0 \
>   --cores 2 --memory 4096 --scsihw virtio-scsi-pci \
>   --net0 virtio,bridge=vmbr0 --agent enabled=1
>
> # 3. Import the image as the VM's disk and make it the boot disk:
> qm disk import 100 /tmp/haos_ova-17.3.qcow2 local-lvm --target-disk scsi0
> qm set 100 --boot order=scsi0
>
> # 4. Optional — the image defaults to 32 GB; grow it if you want room:
> qm disk resize 100 scsi0 64G
>
> # 5. Start it:
> qm start 100
> ```

> [!DETAILS] First contact with Home Assistant
> Give it a few minutes on first boot — HAOS sets itself up unattended. Then browse to `http://homeassistant.local:8123`, or find the VM's IP in Proxmox (the VM's **Summary** tab shows it, thanks to the guest agent) and use `http://that-ip:8123`. From there the onboarding wizard takes over.

### Take a snapshot before you tinker
Snapshots are instant and save you constantly. Take one before any risky change so rollback is a single click.

> [!TIP]
> Name snapshots for *what you were about to do* ("before-gpu-passthrough"), not the date. Future-you will thank present-you.

> [!DETAILS] How to take and roll back a snapshot
> - Select the VM or container in the left tree and open **Snapshots**.
> - Click **Take Snapshot**, give it a name that says what you were about to attempt, and an optional description.
> - For a running VM, the **Include RAM** checkbox also saves its memory state, so rollback returns it running exactly where it was.
> - To undo, select the snapshot in the list and click **Rollback** — everything since that snapshot is discarded.
