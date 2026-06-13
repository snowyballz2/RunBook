---
title: Maintenance and Upkeep
subtitle: The small routine that keeps the server boring
collection: Proxmox Home Server
order: 19
accent: rose
---

## Stay current

### Update Proxmox before adding new toys
Select your node, open **Updates**, click **Refresh** to fetch the package list, then **Upgrade**. This works because of the free-repo switch from the *Install Proxmox* guide. Make it a habit to update *before* installing something new — if anything misbehaves afterwards, you know which change to suspect.

> [!NOTE]
> This updates the Proxmox host only. Each VM and container is its own little machine and updates from inside itself, the usual `apt update && apt full-upgrade` for Debian guests. And if the host update brought a new kernel, finish with a reboot to actually run it — at a kind moment, since rebooting the host takes every guest down and back up with it.

> [!DETAILS] Updating from the shell instead
> The same thing the Upgrade button does, from the node's **Shell**:
>
> ```bash
> apt-get update
> apt-get dist-upgrade
> ```

### Walk the guests too
Once the host is current, give each guest its turn: Debian containers get the `apt` pair above in their Console, the helper-script services update with their own one command (`update` inside the container, per the *Uptime Kuma* guide's pattern), and the appliances update from their own UIs — *Home Assistant OS* has an update page its guide covers, and TrueNAS updates under **System → Update**. A couple of services insist on their own dashboard instead — type `update` in the *AdGuard Home* container and the script itself tells you it only updates from the web UI. Two rules make the walk safe: snapshot first when an update is major (the habit from the *Containers* and *Virtual machines* guides), and go one guest at a time — update, confirm it still answers, then move to the next, so a breakage always has an obvious author and a snapshot to fall back to.

> [!DETAILS] Updating every container's OS in one pass
> community-scripts ships a host-side helper that visits every container and runs its operating-system updates, with a menu to exclude any you'd rather do by hand:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/tools/pve/update-lxcs.sh)"
> ```
>
> The read-it-first habit applies as always — and so does an honest caveat: this updates the *OS packages* inside each container, not the applications. The services themselves still update through their own `update` command, one at a time.

## Make it a rhythm

### Do the monthly pass
One sitting, twenty minutes, same order every time: snapshot anything you're about to touch, update the host (reboot if a kernel arrived), walk the guests, then two glances — *Uptime Kuma* all green, and last night's run in **Datacenter → Backup** ended `TASK OK`. A recurring calendar event titled "server pass" is the entire scheduling system this needs.

### Do the quarterly deep check
Four times a year, exercise the things that only matter when they're needed. Run one practice restore from a backup archive (the *Proxmox Backups* drill — into a spare ID, delete it after). Confirm the offsite copy is actually moving: the Cloud Sync task's last runs in **Data Protection**, per the *Protect TrueNAS Data* guide. And read the disk tea leaves while you're there — latest scrub results and SMART tests, same guide's territory.

### Let the rest come to you
Everything else is event-driven, and the earlier guides already wired the events: *Uptime Kuma* notifies you when something dies, TrueNAS emails you when a disk or scrub complains, and the UPS drill from the *UPS Shutdown* guide proved a power cut handles itself. If no alert fires between passes, the server needs exactly none of your attention — that's the whole point of the build.
