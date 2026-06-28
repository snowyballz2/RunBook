---
title: Install Proxmox
subtitle: Flash the installer, put Proxmox on the NVMe, fix the repos, and turn on IOMMU
collection: My Build
order: 3
accent: emerald
---

This is the bare-metal install of **Proxmox VE** — the hypervisor that hosts everything else in this build. By the end you will have Proxmox running on the **500 GB NVMe (Non-Volatile Memory Express) drive**, reachable from your desk over the LAN (local area network), patched against the free repo, and with **IOMMU (Input/Output Memory Management Unit)** enabled on the kernel so the LSI 9300-8i HBA (host bus adapter) can be isolated for passthrough later.

> [!NOTE]
> Do the hardware and BIOS prep before this. By now the BIOS should be updated, **Intel VT-d (Intel Virtualization Technology for Directed I/O)** and **Intel Virtualization (VMX)** should be enabled, the bottom `PCIEX4_3` slot should be forced to x4, and the 1080 Ti and 9300-8i should be seated in their slots. The three IronWolf disks can be connected too — Proxmox will leave them alone here.

## Make the installer USB

### Download the Proxmox VE ISO
Do this on your everyday Mac — the server has no operating system yet, so the download and the USB-writing both happen on another computer. Get the ISO from [proxmox.com/en/downloads](https://www.proxmox.com/en/downloads) — click **Proxmox Virtual Environment**, then the top entry, the **Proxmox VE 9.2 ISO Installer**. It is free, needs no account, and is about 1.7 GB.

> [!DETAILS] Verify the download (optional but smart)
> Hash the file and compare it against the SHA256 checksum shown next to the download link. A match means the file arrived intact and untampered. On macOS — the household is all-Apple, so this is the line you will use:
>
> ```bash
> shasum -a 256 proxmox-ve_9.2-1.iso
> ```
>
> For the 9.2-1 ISO the expected value is `4e88fe416df9b527624a175f24c9aa07c714d3332afb1ee3dbf3879573ef2c6c`.

### Flash the ISO to a USB stick
Write the ISO to a USB stick of 4 GB or larger with **balenaEtcher**, which runs on macOS and handles the Proxmox ISO with no special settings.

> [!WARNING]
> Flashing erases everything on the stick. Confirm you have selected the USB drive, not an internal disk.

1. Download Etcher from [etcher.balena.io](https://etcher.balena.io/) and install it.
2. Insert a USB stick of 4 GB or more.
3. Click **Flash from file** and pick the Proxmox ISO.
4. Click **Select target** and pick the USB stick — check the size matches.
5. Click **Flash** and wait. Etcher validates the write afterwards; let it finish.

## Install Proxmox to the NVMe

### Boot the installer
This part happens on a keyboard and monitor plugged into the server itself — there is nothing to reach remotely yet. It is temporary: once the install is done, the box runs headless and you do everything from your Mac's browser.

Plug the server into the router with an **Ethernet cable** first — Proxmox cannot use Wi-Fi for management out of the box. Power on and tap **`F8`** right away to get the ASUS one-time boot menu, then pick the USB stick. If the menu lists it twice, choose the **UEFI:** entry.

> [!TIP]
> If the stick refuses to boot, disable **Secure Boot** in the BIOS and try again. Proxmox has been signed for Secure Boot since version 8.1, but on some ASUS boards it still gets in the way, and turning it off is the documented fallback.

### Run the graphical installer
At the boot menu pick **Install Proxmox VE (Graphical)** and follow the prompts. Three answers are worth deciding before you start — the **target disk**, a **static IP address** on your LAN, and the **root password** — so record them here as you go.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The static address you set during install. Every page in this build starts from this number — pin it with a DHCP (Dynamic Host Configuration Protocol) reservation on the router so it never moves.

> [!INPUT] proxmox-hostname | Server hostname (FQDN) | pve.home.arpa

> [!DETAILS] How to pick the hostname
> The installer wants a **fully qualified domain name** — a name for the machine, a dot, and a domain, like `pve.home.arpa`. Both halves are your choice:
>
> - **The first part** — `pve` is just a convention (short for *Proxmox Virtual Environment*). Call it anything: `server`, `homelab`, `vault`. Lowercase letters, digits, and hyphens; keep it short, because it becomes the node name you see everywhere in the UI. Renaming a Proxmox node later is genuinely annoying, so pick something you are happy with now.
> - **The domain part** — `home.arpa` is the domain officially reserved for home networks (RFC 8375), so it can never clash with the real internet — that is why it is the safe default. Avoid two things: `.local` (reserved for **mDNS (multicast DNS)** per RFC 6762 — macOS hands those lookups to Bonjour, so on this all-Apple household they resolve unreliably) and any real domain you do not own. Accepting the `pve.home.arpa` default is fine.

> [!INPUT] proxmox-user | Proxmox web UI username | | root
> Not a choice — Proxmox is Linux underneath, and `root` is its built-in administrator account.

> [!SECRET] proxmox-root-password | Proxmox root password
> Set during install — 8 characters minimum, longer is better. Record it in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build), but write it here too so this checklist stands on its own.

> [!DETAILS] Every prompt the installer shows, in order
> 1. **EULA** — read or skim, click I agree.
> 2. **Target disk** — select the **500 GB NVMe**. The install **wipes this whole drive**, so be certain you already copied its Windows files off (the prep step before you began). This drive holds the Proxmox OS and, later, the Frigate cache; the three IronWolf 4 TB spinners stay untouched here. Leave the **Options** filesystem at the default (ext4 on LVM) — this is a single boot drive, not a mirror.
> 3. **Country, time zone, keyboard layout** — usually auto-detected; confirm and move on.
> 4. **Password, confirm, email address** — the root password above, plus an email for system notifications.
> 5. **Management network** — pick the **wired interface**, enter the **hostname** you chose, the **static IP** you picked for the server, and your router's address in both the **Gateway** and **DNS (Domain Name System) server** fields.
> 6. **Summary** — review, click Install, and the box reboots itself when done. As the reboot starts, unplug the USB stick so it does not boot back into the installer.

> [!DETAILS] Picking the static IP — what you find and what you pick
> The installer wants three numbers. Two you **find** (facts about your network), one you **pick** (a fresh address for the server):
>
> - **Gateway** — *found*. It is your router's address. On macOS, read it from `netstat -nr | grep default` (the `en0` line) or System Settings → Wi-Fi → Details → Router. Usually something like `192.168.1.1`.
> - **DNS server** — enter the router's address again, or `1.1.1.1` for Cloudflare.
> - **IP address** — *picked by you*. Keep the first three numbers the same as the router and change the last. Pick a number **below** the router's DHCP range (often `.100` and up) so it is never handed to another device — `192.168.1.50/24` is a fine choice. The `/24` just means a standard home network. The other safe method is a **DHCP reservation** (sometimes called a *static lease*): on the router's LAN/DHCP page, permanently assign your chosen number to the server so the router never gives it to anything else.
>
> Can't get into the router at all? Pick a high number like `.250` and ping it first — if nothing answers, it is almost certainly free.

### Log in to the web UI for the first time
Proxmox has no desktop of its own — you administer it from a browser. From your Mac on the same LAN, browse to:

```bash
https://your-ip:8006
```

The browser will warn about the certificate before the login screen — that is expected. Proxmox generates its own self-signed certificate, so the browser cannot vouch for it. Click **Advanced**, then **Proceed**. Log in as **`root`** with the realm left on **Linux PAM standard authentication** and the password you set during install. A "No valid subscription" popup appears on every login — click **OK**; the next step removes it.

## Post-install: switch to the no-subscription repo

A fresh install points at Proxmox's paid *enterprise* package repo, so updates error until you switch to the free one. Open the host shell (**Datacenter → your node → Shell**) and run the community post-install helper — it switches repos **and** removes the "No valid subscription" popup, then offers a full update.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/tools/pve/post-pve-install.sh)"
```

> [!DANGER]
> Only pipe a script straight into a root shell when you trust the source and have read it. This one is widely used and open, but make that judgement yourself.

> [!DETAILS] How to check a script yourself before running it
> Piping `curl` to `bash` runs whatever the server sends at that exact moment. The safer habit costs one minute — download, read, then run the copy you read:
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

> [!DETAILS] What the script changes — answer yes to all of these for this build
> - Disables the enterprise package repo (which errors without a paid subscription).
> - Enables the free no-subscription repo so updates work.
> - Corrects the apt source lists for your Proxmox VE version.
> - Removes the "No valid subscription" login popup and keeps it removed after updates.
> - May offer to disable the High-Availability services — accepting is fine on a single box like this; they only matter in a multi-node cluster.
> - Optionally runs a full update and reboots — let it.

> [!DETAILS] Prefer no script? Do the same by hand
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
> Either way, finish by updating from the node's Shell:
>
> ```bash
> apt update && apt full-upgrade -y
> ```
>
> The trade-off: done by hand the "No valid subscription" popup stays. It is purely cosmetic — click OK and everything works.

## Enable IOMMU on the kernel command line

The BIOS already has **VT-d + VMX** on and the `PCIEX4_3` slot at x4. The last piece is on the host: add `intel_iommu=on` to the kernel command line so the 9300-8i HBA can be isolated into its own group and passed through to the TrueNAS VM (virtual machine) later. The 1080 Ti is **not** affected — it stays on the host to be shared into LXCs (Linux Containers).

This build installed Proxmox on **ext4 on LVM** (the default chosen earlier), which boots with **GRUB** — so the kernel command line lives in `/etc/default/grub`. From the host shell:

```bash
# Add the flags inside the quotes on the GRUB_CMDLINE_LINUX_DEFAULT line:
nano /etc/default/grub          # ...="quiet intel_iommu=on iommu=pt"

# Apply the change and reboot:
update-grub
reboot
```

> [!NOTE]
> Not sure which bootloader you have? Run `proxmox-boot-tool status`. The GRUB steps above match this build's ext4-on-LVM install. If you instead installed on **ZFS root**, Proxmox boots with systemd-boot — add the same `intel_iommu=on iommu=pt` to `/etc/kernel/cmdline`, then run `proxmox-boot-tool refresh` and reboot.

After the reboot, confirm IOMMU came up and that the HBA landed in a clean group:

```bash
# Should print DMAR / IOMMU enabled lines:
dmesg | grep -e DMAR -e IOMMU

# List the groups; check the 9300-8i sits in a group of its own:
lspci -nn | grep -i -e LSI -e SAS -e Broadcom
find /sys/kernel/iommu_groups/ -type l
```

> [!TIP]
> The HBA wants its **own clean IOMMU group**. It is in the bottom chipset-attached `PCIEX4_3` slot precisely so it lands alone — if it shares a group with devices you care about, passthrough drags them along or fails. The slot plan was chosen to avoid this; the check above just proves it.

> [!WARNING]
> Add IOMMU only — do **not** blacklist or VFIO-bind the 1080 Ti here. That card stays on the host so its NVIDIA driver can be shared into Frigate, Ollama, and faster-whisper. Only the HBA gets passed through, and that happens once the TrueNAS VM is built.

> [!NOTE]
> With Proxmox installed, patched, and IOMMU live, the host is ready. Next comes storage: build the TrueNAS VM, pass the 9300-8i through, and create the ZFS (Zettabyte File System) mirror on the two IronWolf disks.
