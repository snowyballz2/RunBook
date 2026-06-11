---
title: Install Proxmox
subtitle: Bare-metal install and first boot
collection: Proxmox Home Server
order: 2
accent: spruce
---

> [!NOTE]
> Do the *Prep & BIOS* guide first — this one assumes your files are saved off the machine, virtualization is enabled, and you know which drive Proxmox gets.

### Download the Proxmox VE ISO
Get the ISO from [proxmox.com/en/downloads](https://www.proxmox.com/en/downloads) — click **Proxmox Virtual Environment**, then the top item, **Proxmox VE 9.2 ISO Installer**. It is free, needs no account, and is about 1.7 GB.

> [!DETAILS] Verify the download (optional but smart)
> Hash the file and compare it against the SHA256 shown next to the download link. A match means the file arrived intact and untampered.
>
> ```bash
> # macOS
> shasum -a 256 proxmox-ve_9.2-1.iso
>
> # Linux
> sha256sum proxmox-ve_9.2-1.iso
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
Plug the machine into your router with an **Ethernet cable** first — Proxmox cannot use Wi-Fi for management out of the box. Then boot from the stick, pick **Install Proxmox VE (Graphical)**, and follow the prompts. The answers worth thinking about beforehand are the hostname, a **static IP** on your LAN, and the root password — record them here as you decide; you will need the IP constantly.

> [!INPUT] proxmox-ip | Proxmox server IP | 192.168.1.50
> The static address you pick in the expandable below. Every guide that follows starts from this number.

> [!INPUT] proxmox-hostname | Server hostname (FQDN) | pve.home.arpa

> [!INPUT] proxmox-user | Proxmox web UI username | | root
> Not a choice — Proxmox is Linux underneath, and `root` is its built-in administrator account.

> [!SECRET] proxmox-root-password | Proxmox web UI password
> Set during install — 8 characters minimum, longer is better.

```bash
# After install, reach the web UI from another machine on the LAN:
https://your-ip:8006
```

> [!NOTE]
> Proxmox has no desktop of its own. You administer everything from a browser at that address.

> [!DETAILS] How to boot from the USB stick
> This happens on a **keyboard and monitor plugged into the server itself** — there is nothing to connect to remotely yet. (It's temporary: once the install is done, the server runs headless and you do everything from your other computer's browser.)
>
> Right after powering on, tap the one-time boot menu key — commonly `F8` (ASUS), `F11` (MSI, ASRock), `F12` (Gigabyte, Dell, Lenovo), or `Esc` then `F9` (HP). If none of those work, enter the BIOS and put the USB stick first in the boot order.
>
> If the menu lists the stick twice, pick the entry starting with **UEFI:**.
>
> Stick refuses to boot no matter what? Disable **Secure Boot** in the BIOS and try again. Proxmox has been properly signed for Secure Boot since version 8.1, but on some boards it still gets in the way, and turning it off is the documented fallback.

> [!DETAILS] Every prompt the installer shows, in order
> 1. **EULA** — read or skim, click I agree.
> 2. **Target disk** — the drive Proxmox will erase and install onto (the one you decided on in the *Prep & BIOS* guide). The **Options** button picks the filesystem; the default (ext4 on LVM) is right for a single drive. With two identical drives you could pick **ZFS RAID1** instead to mirror the whole system — nice, but strictly optional.
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
> Proxmox generates its own (self-signed) certificate, so your browser cannot vouch for it and shows a full-page warning. Click **Advanced**, then **Proceed** (wording varies by browser). On your own LAN, connecting to a server you just installed, this is fine — for now. A later guide in this collection gives every service a real certificate and retires the warning for good.

> [!DETAILS] Your first login
> - **User name:** `root` — not a name you chose. Proxmox is Linux underneath, and `root` is Linux's built-in administrator account, like "Administrator" on Windows. The password you set during install was root's password.
> - **Password:** the one you set during install
> - **Realm:** leave it on **Linux PAM standard authentication** — it just means "check this login against the system account"
>
> A popup saying "No valid subscription" appears on every login. It is normal for the free version — click OK; the next step deals with it.
>
> Before moving on, make sure the root password and the server's IP are saved — in the fields back in *Run the installer*, in your password manager, or both. Every guide that follows starts from those two facts.

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
> - May offer to disable the High-Availability services — accepting is fine on a single machine like this; they only matter when several Proxmox servers work as a cluster
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
