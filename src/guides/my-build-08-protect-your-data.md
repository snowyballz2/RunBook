---
title: Protect Your Data
subtitle: Snapshots, the Sunday scrub, disk-health alerts, and an encrypted offsite copy
collection: My Build
order: 8
accent: azure
---

## Schedule the safety nets

### Schedule snapshots
The two IronWolf drives in the ZFS (Zettabyte File System) mirror hold the data the household cares about; this page makes it hard to lose. Start with the cheapest protection ZFS offers. In the TrueNAS web UI, go to **Data Protection** and click **Add** on the **Periodic Snapshot Tasks** widget — pick your dataset, a schedule, and a **Snapshot Lifetime** (how long each one is kept). The **Naming Schema** field must include the time elements `%Y`, `%m`, `%d`, `%H` and `%M`. Snapshots are nearly free in ZFS, so intervals as tight as every 15 minutes are normal. Run two tasks on the same dataset — one frequent and short-lived, one sparse and long-lived: every 15 minutes kept for two days, plus daily at midnight kept for two weeks.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!DETAILS] What a snapshot can and cannot save you from
> A snapshot is a point-in-time picture of the dataset — delete or overwrite a file by accident and you reach back and recover it. But snapshots live in the same pool, on the same two drives: they protect against fat fingers, not against the pool itself dying.

> [!NOTE]
> Honest accounting: the mirror is not a backup. It survives one dead drive, and snapshots survive accidental deletion — neither survives fire, theft, or both IronWolfs going at once. The last phase of this page gets a copy off the property.

### Meet the Sunday scrub
The pool's other guardian is already on duty. TrueNAS generated a default **scrub task** — a routine integrity pass over the whole pool — when you created the mirror, set to run every Sunday at 12:00 AM. Nothing to configure; confirm it on the **Storage** dashboard's **Storage Health** widget, which shows the scheduled scrub and offers **Schedule** and **Configure** links.

> [!DETAILS] What a scrub actually does
> A scrub reads every block in the pool and verifies it against its checksum; on a two-way mirror, anything that fails the check is repaired from the partner drive's good copy. It is the mechanism that catches silent corruption before you do — which is exactly why it runs on a schedule instead of waiting for you to notice.

### Let the disk watchdog work
Snapshots guard the data; S.M.A.R.T. watches the drives themselves. On current TrueNAS there is nothing to schedule — the old S.M.A.R.T. Tests service is gone, replaced by **Drive Health Management**, which polls every disk's S.M.A.R.T. data automatically (roughly every 90 minutes) and raises alerts that name the affected disk and what tripped. Check the **Disk Health** card on the **Storage** dashboard; active alerts land in the **Alerts** panel behind the bell icon, top right.

Because the two mirror drives reach TrueNAS through the LSI 9300-8i HBA (host bus adapter) passed through whole with VFIO (Virtual Function I/O), TrueNAS talks to the real disks and its S.M.A.R.T. data is genuine — no QEMU emulation in the way. Deeper self-tests run from TrueNAS's own shell (**System → Shell**):

```bash
# Find the two mirror drives first (match model + serial):
lsblk -o +MODEL,SERIAL
# Quick self-test — usually under ten minutes:
smartctl -t short /dev/sda
# Full-surface test — hours on a 4TB disk, noticeable slowdown:
smartctl -t long /dev/sda
# Read the verdict:
smartctl -a /dev/sda
```

> [!NOTE]
> The third IronWolf — Frigate's footage disk — is *not* on the HBA; it sits on a motherboard SATA (Serial ATA) port and belongs to the host. Watch its health from the Proxmox node's **Disks** view (it shows a S.M.A.R.T. column), or with the same `smartctl` calls from the **Proxmox host shell**. That disk holds replaceable camera recordings, so it never goes offsite — but a dying drive is still worth knowing about early.

> [!TIP]
> Keep disk-intensive tasks apart: if you schedule a recurring LONG test, never put it on Sunday with the scrub, and pick low-usage hours. A weekly SHORT plus a monthly LONG is a sensible cadence on top of the automatic polling.

## Make alerts reach you

### Teach TrueNAS to send email
A NAS (network-attached storage) that notices a dying IronWolf but has no way to tell you is just a quieter failure. Go to **System → General Settings** and click **Settings** on the **Email** widget. Pick a **Send Mail Method** — for this all-Apple, mostly-iCloud household, **SMTP** (Simple Mail Transfer Protocol) to iCloud or any provider is the general path, while **GMail OAuth** / **Outlook OAuth** spare you app-password wrangling if you have one of those accounts. Add your address to **Email Recipients**, click **Send Test Mail**, and only **Save** once the test actually lands in the inbox you read. With email working, TrueNAS also sends a nightly status email that includes disk health.

> [!DETAILS] Filling in the SMTP fields
> **From Email** is the sending address, **Outgoing Mail Server** your provider's SMTP host, **Mail Server Port** typically 587 (or 465 for implicit TLS), **Security** set to **TLS (STARTTLS)** for port 587 or **SSL (Implicit TLS)** for 465. Enable **SMTP Authentication** and enter the **Username** (usually the full email address) and **Password**. For an iCloud sender you must generate an app-specific password at appleid.apple.com — the account password will not authenticate.

### Aim the alerts at your inbox — and test them
Go to **System → Alert Settings**. An **Email** entry already exists under **Alert Services** — open its three-dot menu, click **Edit**, enter the recipient in **Email Address**, keep **Level** at the default **Warning** (alerts at that level and above are sent), and click **Send Test Alert**. Once the test arrives, save. The built-in categories already cover what matters here: an unhealthy pool, a pool filling up, an IronWolf running hot or failing a self-test, and any failed snapshot, scrub, or cloud sync task.

> [!WARNING]
> The two test buttons in this phase are the whole point. An alert chain you have never tested is the exact silent failure you set it up to prevent — press both **Send Test** buttons, and confirm both land. Do it now, while you are looking at the screen, not in two years when a drive is already dying.

> [!TIP]
> Want a phone buzz, not just an inbox you might miss? The **Add** button on Alert Services offers Slack, Telegram, PagerDuty, and more, each with its own **Level** and its own **Send Test Alert** — a push channel can sit alongside email rather than replacing it. The Home Assistant leak and UPS (uninterruptible power supply) automations already shout to the HomePod and Nest speakers; this is the disk-health equivalent.

## Practice recovery

### Pull a file back from a snapshot
Snapshots are only as good as your ability to use one under pressure, so rehearse the move before you need it. macOS Finder has no built-in previous-versions browser (that is a Windows-only SMB feature), so use one of two routes. Server-side, go to **Datasets**, select the dataset, and click **Manage Snapshots** on its **Data Protection** widget — that screen lists, holds, clones, and rolls back snapshots. To grab a single file straight from a Mac, set the dataset's **Snapshot Directory** to **Visible**, then browse the hidden `.zfs/snapshot/` folder inside the mounted SMB (Server Message Block) share.

> [!INPUT] smb-user | SMB share username

> [!SECRET] smb-password | SMB share password

> [!TIP]
> Rehearse on a sacrificial file today: drop a test file on the share, wait out one snapshot interval, delete it, and bring it back. Recovery you have rehearsed once is calm; recovery you are attempting for the first time mid-disaster is not.

> [!DETAILS] Rolling back — and why cloning is safer
> **Rollback** rewinds the entire dataset to the snapshot, and TrueNAS's own dialog warns it destroys newer data and can cause permanent loss. Unless the whole dataset is wrecked, use **Clone to New Dataset** instead: the clone appears with the snapshot's contents, you copy out what you need, then delete the clone. Nothing on disk is destroyed — it is the flow the official docs recommend.

### Rehearse the dead-disk drill
When a mirror IronWolf fails, the pool drops to **Degraded** — the dashboard pool widget shows it, the alert you just tested emails you, and the share keeps answering from the surviving drive. The drill:

1. On the **Storage** dashboard, click **View VDEVs** on the pool's VDEVs widget. Expand the vdev (the pool's disk group), click the failed disk (often shown as **REMOVED**), and click **Offline** on its **ZFS Info** widget.
2. **Verify the serial before you pull anything.** Note the failed disk's serial from its **Disk Info** widget (or the alert email), then confirm `lsblk -o +MODEL,SERIAL` — run from the **TrueNAS shell** (System → Shell), since the passed-through HBA means the Proxmox host cannot see these disks — maps that serial to the device you are about to remove. The two ST4000VN006 drives are identical at a glance — pull the *healthy* one and a degraded mirror goes straight to dead. The drives sit in the View 71's fixed rear trays behind the motherboard tray, so check the label there too.
3. Shut the TrueNAS VM (virtual machine) down, swap the physical drive, and boot. Because the whole HBA is passed through, there is no per-disk passthrough line to rewire — TrueNAS simply sees the new drive on the controller.
4. Back in TrueNAS, click **Replace** on the disk's **Disk Info** widget, pick the new drive from **Member Disk**, and click **Replace Disk**.

The replacement must be the same 4TB capacity or larger, and TrueNAS wipes it. Replacing triggers a **resilver** — ZFS copying the survivor's data onto the newcomer — which takes a while on a full pool; the share stays online throughout, just slower.

> [!WARNING]
> Replace a failed IronWolf as soon as you can. A degraded two-way mirror has no margin left — the next failure takes the pool, and with it everything that has not yet reached the offsite copy below.

## Get a copy off the property

### Reserve offsite for the irreplaceable
The discipline that keeps the bill sane: bulk, replaceable data — the camera footage on Frigate's disk, any downloaded media — stays local-only. Offsite is reserved for the irreplaceable: family photos and documents with no other home, plus the Vaultwarden vault and the small things you cannot recreate. Keep those in a dataset of their own so the offsite job has a clean target.

### Push the irreplaceable to Backblaze B2
Go to **Data Protection** and click **Add** on the **Cloud Sync Task** widget. Pick a **Credential** for Backblaze B2 or click **Add New** (credentials live under **Credentials → Backup Credentials → Cloud Credentials**; B2 needs an Application Key ID and its key). Set **Direction** to **PUSH**, point the source at the irreplaceable dataset, click the folder icon on the remote **Folder** field to pick the bucket, choose a **Transfer Mode**, and give it a schedule — nightly is plenty.

> [!DETAILS] SYNC or COPY, and the monthly bill
> **SYNC** makes the bucket match the source — tidy, but a deletion at home propagates offsite on the next run. **COPY** only ever adds and updates, so deleted files linger as a safety net at the cost of slow clutter. For irreplaceable data, COPY's paranoia is the right default; the snapshots from the first phase remain your fast undo either way. Backblaze B2 runs around $6–7 per terabyte per month, so a few hundred gigabytes of photos and documents costs a few dollars — check current pricing, but it stays small as long as the footage never goes up.

### Encrypt it before it leaves the house
Make the copy private so Backblaze only ever stores ciphertext. Under the task's **Advanced Options**, turn on **Remote Encryption** and set an **Encryption Password** and **Encryption Salt** — TrueNAS encrypts with rclone before the bytes leave the NAS. Use the field values below for these, and put the *same* two values in Vaultwarden as the source of truth.

> [!SECRET] b2-encryption-password | Backblaze B2 remote-encryption password

> [!SECRET] b2-encryption-salt | Backblaze B2 remote-encryption salt

> [!WARNING]
> Put the encryption password and salt in Vaultwarden now, before the first run. Lose them and the offsite copy is unreadable by anyone, including you — the one way an encrypted backup fails you completely. Leave **Filename Encryption** off; current docs advise against it, and the directory structure stays visible regardless.

### Drill the offsite restore
The snapshot and dead-disk drills rehearse copies you can see. The B2 copy is the one you cannot — and the encryption you just added is a second way to fail silently: a password that does not actually unlock the data looks identical to a good backup until the afternoon you reach for it. So prove the whole leg end to end.

Use a one-off **PULL** task that never touches live data. Go to **Data Protection → Add** on the **Cloud Sync Task** widget, set **Direction** to **PULL**, pick the same **Credential** and remote **Folder** as the push, and point the local **Folder** at an empty scratch dataset (`restore-test`, deleted afterward). Under **Advanced Options**, re-enter the **Remote Encryption** password and salt — this is the part actually being tested. Run it once, then open a recovered photo and confirm it is the file, not scrambled bytes. If the password or salt is wrong, the data comes back garbled — far better to learn that today.

> [!TIP]
> Do this drill once when you set the offsite copy up, then once a year alongside the quarterly check. It is the only drill that also tests the encryption secret in Vaultwarden — which is exactly the value most likely to have rotted by the time it matters.

### Count to 3-2-1
The scorecard is **3-2-1**: three copies of anything that matters, on at least two kinds of hardware, one of them offsite. Count honestly — the mirror is *one* copy, because redundancy inside a single pool is not a second copy, and neither are snapshots. The B2 Cloud Sync task gives the irreplaceable files their second copy, which is also the offsite one, and the scheduled Proxmox guest backups land second copies of every guest on this same NAS. For a home server, that is a respectable score, and you now know exactly where the gaps are.
