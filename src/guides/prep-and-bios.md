---
title: Prep & BIOS
subtitle: Check the hardware, save your files, and ready the firmware
collection: Proxmox Home Server
order: 1
accent: amber
---

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

> [!DETAILS] How to confirm it worked
> If Windows is still on the machine, boot back into it and press `Ctrl+Shift+Esc` for Task Manager → **Performance → CPU** — the right-hand column should read **Virtualization: Enabled**. If you've already wiped, no stress: the Proxmox installer warns loudly if hardware virtualization is missing, so you'll find out on the very next step either way.
