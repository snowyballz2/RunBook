---
title: Protect Your Data
subtitle: Snapshots, the Sunday scrub, disk-health alerts, and an encrypted offsite copy
collection: My Build
order: 9
accent: azure
---

## Schedule the safety nets

### Schedule snapshots
The two IronWolf drives in the ZFS (Zettabyte File System) mirror hold the data the household cares about; this page makes it hard to lose. Start with the cheapest protection ZFS offers.

In the TrueNAS web UI:

1. Go to **Data Protection**.
2. Click **Add** on the **Periodic Snapshot Tasks** widget.

Set:

- **Dataset** → `tank/files` — the `backups` dataset holds the build's own safety copies and stays out of these snapshots, as planned when you created it
- **Schedule** and **Snapshot Lifetime** → one of the two pairs below
- **Naming Schema** → must contain `%Y`, `%m`, `%d`, `%H` and `%M`; the prefilled default qualifies, so keep it for the first task and give the second a distinct prefix such as `daily-%Y-%m-%d_%H-%M`, so each task's retention prunes only its own snapshots

Run **two** tasks against that same dataset — one frequent and short-lived, one sparse and long-lived:

- every **15 minutes**, kept **2 days**
- **daily at midnight**, kept **2 weeks**

Snapshots are nearly free in ZFS, which is why intervals that tight are normal.

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
Snapshots guard the data; S.M.A.R.T. watches the drives themselves. On current TrueNAS there is nothing to schedule — the old S.M.A.R.T. Tests service is gone, replaced by **Drive Health Management**, which polls every disk's S.M.A.R.T. data automatically (roughly every 90 minutes) and raises alerts that name the affected disk and what tripped. Check the **Disk Health** card on the **Storage** dashboard (its **View Disks** link opens the per-disk screen at `/ui/storage/disks`); active alerts land in the **Alerts** panel behind the bell icon, top right.

Because the two mirror drives reach TrueNAS through the LSI 9300-8i HBA (host bus adapter) passed through whole with VFIO (Virtual Function I/O), TrueNAS talks to the real disks and its S.M.A.R.T. data is genuine — no QEMU emulation in the way.

Deeper self-tests run from TrueNAS's own shell (**System → Shell**). First identify the two mirror drives:

```bash
lsblk -o NAME,MODEL,SERIAL
```

> [!NOTE]
> The shell signs you in as `truenas_admin`, not root, so the `smartctl` commands need their `sudo` (it asks for the `truenas_admin` password). The two mirror drives are the `ST4000VN006` rows; the `QEMU HARDDISK` row is the 32 GB virtual boot disk, which speaks no SMART and answers any self-test with `unsupported scsi opcode`, so never point a test at it.

A quick self-test finishes in under ten minutes:

```bash
sudo smartctl -t short /dev/sdb
```

The full-surface test takes hours on a 4 TB disk and slows it noticeably while it runs — keep it off scrub Sunday:

```bash
sudo smartctl -t long /dev/sdb
```

The test runs silently inside the drive's firmware — this same command is both the progress check and the verdict:

```bash
sudo smartctl -a /dev/sdb
```

While running, **"Self-test execution status"** near the top counts down ("XX% of test remaining"); when done it reads "completed without error" and a new top row appears in the **SMART Self-test log** table near the bottom — `Short offline  Completed without error`. Short tests finish in a minute or two. Two readings that look scarier than they are: the closing "only provides legacy SMART information — try 'smartctl -x'" line is informational (`-a` prints the classic pages, `-x` adds extended ones; pass/fail lives in `-a`), and Seagate's huge `Hardware_ECC_Recovered` raw number is normal bookkeeping. The columns that actually matter: `Current_Pending_Sector`, `Offline_Uncorrectable`, and `UDMA_CRC_Error_Count` — all should read **0**.

Run each against both mirror drives in turn, swapping in the IronWolfs' device names from `lsblk` (typically `sdb` and `sdc` here — the names can shift between boots, which is why `lsblk` comes first). If an IronWolf itself answers `unsupported scsi opcode`, add `-d sat` after `smartctl` — it tells the tool there is a SCSI-to-ATA translation layer between it and the disk, a known quirk behind SAS controllers.

> [!NOTE]
> The third IronWolf — Frigate's footage disk — is *not* on the HBA; it sits on a motherboard SATA (Serial ATA) port and belongs to the host. Watch its health from the Proxmox node's **Disks** view (it shows a S.M.A.R.T. column), or with the same `smartctl` calls from the **Proxmox host shell**. That disk holds replaceable camera recordings, so it never goes offsite — but a dying drive is still worth knowing about early.

### Schedule the recurring self-tests
The automatic polling reads what the drives already report; only a *self-test* makes them actually exercise the platters. Put both cadences on a schedule — a weekly short and a monthly long per drive — so they run without you. First get each drive's **stable name**: the `sdb`/`sdc` names can swap between boots, so scheduled jobs target the serial-based paths instead. In the TrueNAS shell:

```bash
ls /dev/disk/by-id/ | grep ST4000VN006
```

That prints one `ata-ST4000VN006-…_<serial>` name per drive (ignore any `-partN` entries) — the serials match the `mirror-a-serial`/`mirror-b-serial` fields. Keep those two names on screen; they get pasted into the jobs below. **The shell's job is now done** — everything else happens in the TrueNAS web UI.

In the TrueNAS UI:

1. Go to **System**.
2. Click **Advanced Settings**.
3. Find the **Cron Jobs** widget.
4. Click **Add** three times — one job per block below.

Every job takes the same answers:

- **Run As User** → `root`
- **Enabled** → ticked
- **Schedule** → **Custom**, with the five-field line given per job below
- **Hide Standard Output** → ticked, its default
- **Hide Standard Error** → unticked, its default
- **Command** → the block's exact content, with `<disk-A>`/`<disk-B>` swapped for the two names the shell just printed

The two hide toggles are what keep the weekly "testing has begun" chatter out of your inbox while letting command-level errors through. The signal that matters — a test that finds problems — arrives via the disk alert email below regardless, straight from the drive's SMART log.

**Job 1 — weekly short, both drives.** Schedule `0 3 * * 1` (Mondays 3 a.m., clear of the Sunday scrub):

```
smartctl -t short /dev/disk/by-id/<disk-A> && smartctl -t short /dev/disk/by-id/<disk-B>
```

**Job 2 — monthly long, mirror A.** Schedule `0 4 7 * *` (the 7th, 4 a.m.):

```
smartctl -t long /dev/disk/by-id/<disk-A>
```

**Job 3 — monthly long, mirror B.** Schedule `0 4 21 * *` (the 21st, 4 a.m.):

```
smartctl -t long /dev/disk/by-id/<disk-B>
```

The scheduling has two deliberate offsets. The longs are **staggered two weeks apart** so the mirror always has one full-speed member, and they run at **4 a.m., an hour after the shorts** — because when the 7th or 21st lands on a Monday, both jobs would otherwise fire at the same instant, and a second self-test command *replaces* one already running; by 4 a.m. the short finished long ago. When a long's date lands on a Sunday it can overlap the tail of the midnight scrub — both are reads, so that rare coincidence is merely slow, not harmful. Any test that fails raises the same disk alert the email step below delivers.

## Make alerts reach you

### Teach TrueNAS to send email
A NAS (network-attached storage) that notices a dying IronWolf but has no way to tell you is just a quieter failure.

> [!NOTE]
> The Email dialog enforces one prerequisite: the admin account needs an address on file, or it refuses with *"No e-mail address is set for root user or any other local administrator."*

1. In the TrueNAS UI, go to **Credentials**.
2. Click **Users**.
3. Edit **`truenas_admin`**.
4. Fill in its **Email** field with the inbox you actually read.
5. Save.
6. Go to **System**.
7. Click **General Settings**.
8. Click **Settings** on the **Email** widget:

- **Send Mail Method** → **SMTP** (Simple Mail Transfer Protocol) — the general path for this mostly-iCloud household; **GMail OAuth** / **Outlook OAuth** spare app-password wrangling if you have one of those accounts
- **Email Recipients** → the inbox you actually read
- **Send Test Mail** → click it, and only **Save** once the test actually lands

With email working, TrueNAS also sends a nightly status email that includes disk health.

> [!DETAILS] Filling in the SMTP fields
> - **From Email** → the sending address
> - **Outgoing Mail Server** → your provider's SMTP host
> - **Mail Server Port** → **587** (or **465** for implicit TLS)
> - **Security** → **TLS (STARTTLS)** for 587; **SSL (Implicit TLS)** for 465
> - **SMTP Authentication** → enabled
> - **Username** → usually the full email address
> - **Password** → for an iCloud sender, an app-specific password generated at appleid.apple.com — the account password will not authenticate

### Aim the alerts at your inbox — and test them
In the TrueNAS UI:

1. Go to **System**.
2. Click **Alert Settings**.
3. Open the **E-Mail** entry with the pencil/**Edit** icon — the one that matters.

Set:

- **Email Address** → the recipient
- **Level** → keep the default **Warning** — alerts at that level and above are sent
- **Send Test Alert** → click; save once the test arrives

The built-in categories already cover what matters here: an unhealthy pool, a pool filling up, an IronWolf running hot or failing a self-test, and any failed snapshot, scrub, replication, or cloud sync task.

> [!NOTE]
> Two rows ship by default under **Alert Services**. Ignore **SNMP Trap** — it reports to enterprise monitoring servers (Zabbix and kin) that this build does not run, and with no destination configured it sends nothing; leave it untouched.

> [!WARNING]
> The two test buttons in this phase are the whole point — one per screen: **Send Test Mail** in the Email settings dialog (proves TrueNAS can send mail at all) and **Send Test Alert** in the Alert Services entry (proves the alert engine routes through that mail setup to your recipient — a different failure point, which is why both exist). An alert chain you have never tested is the exact silent failure you set it up to prevent — press both, confirm both land. Do it now, while you are looking at the screen, not in two years when a drive is already dying.

> [!TIP]
> Want a phone buzz, not just an inbox you might miss? The **Add** button on Alert Services offers Slack, Telegram, PagerDuty, and more, each with its own **Level** and its own **Send Test Alert** — a push channel can sit alongside email rather than replacing it. The Home Assistant leak and UPS (uninterruptible power supply) automations set up later in this build will shout to the Nest speakers; this is the disk-health equivalent.

## Practice recovery

### Pull a file back from a snapshot
Snapshots are only as good as your ability to use one under pressure, so rehearse the move before you need it. macOS Finder has no built-in previous-versions browser (that is a Windows-only SMB feature), so use one of two routes.

**Server-side, in the TrueNAS UI:**

1. Go to **Datasets**.
2. Select the dataset.
3. Click **Manage Snapshots** on its **Data Protection** widget — that screen lists, holds, clones, and rolls back snapshots.

**Straight from a Mac, to grab a single file:**

1. Set the dataset's **Snapshot Directory** to **Visible**.
2. Browse the hidden `.zfs/snapshot/` folder inside the mounted SMB (Server Message Block) share.

> [!INPUT] smb-user | SMB share username

> [!SECRET] smb-password | SMB share password

> [!TIP]
> Rehearse on a sacrificial file today:
>
> 1. Drop a test file on the share.
> 2. Wait out one snapshot interval.
> 3. Delete it.
> 4. Bring it back.
>
> Recovery you have rehearsed once is calm; recovery you are attempting for the first time mid-disaster is not.

> [!DETAILS] Rolling back — and why cloning is safer
> **Rollback** rewinds the entire dataset to the snapshot, and TrueNAS's own dialog warns it destroys newer data and can cause permanent loss.
>
> Unless the whole dataset is wrecked, use **Clone to New Dataset** instead:
>
> 1. Clone to the new dataset — it appears with the snapshot's contents.
> 2. Copy out what you need.
> 3. Delete the clone.
>
> Nothing on disk is destroyed — it is the flow the official docs recommend.

### Rehearse the dead-disk drill
When a mirror IronWolf fails, the pool drops to **Degraded** — the dashboard pool widget shows it, the alert you just tested emails you, and the share keeps answering from the surviving drive. The serial-to-tray map captured on the TrueNAS Storage page is the drill's anchor:

> [!INPUT] mirror-a-serial | Mirror disk A — serial + tray position

> [!INPUT] mirror-b-serial | Mirror disk B — serial + tray position

The drill:

1. On the **Storage** dashboard, click **View VDEVs** on the pool's VDEVs widget.
2. Expand the vdev (the pool's disk group).
3. Click the failed disk (often shown as **REMOVED**).
4. Click **Offline** on its **ZFS Info** widget.
5. **Verify the serial before you pull anything** — note the failed disk's serial from its **Disk Info** widget (or the alert email).
6. From the **TrueNAS shell** (**System → Shell**), confirm `lsblk -o +MODEL,SERIAL` maps that serial to the device you are about to remove.
7. Shut the TrueNAS VM down.
8. Swap the physical drive.
9. Boot the VM back up.
10. Back in TrueNAS, click **Replace** on the disk's **Disk Info** widget.
11. Pick the new drive from **Member Disk**.
12. Click **Replace Disk**.
13. While the resilver runs, update the new drive's serial in its `mirror-…-serial` field above.
14. Update the **self-test cron jobs** too — their `/dev/disk/by-id/` path died with the old disk.

> [!WARNING]
> The passed-through HBA means the Proxmox host cannot see these disks, which is why step 6 runs from the TrueNAS shell, not Proxmox. The serial-to-tray map recorded on the TrueNAS Storage page (the `mirror-a-serial` / `mirror-b-serial` fields) tells you which bay to open. A dead-enough disk may not report anything anymore, so the bulletproof identification is **by elimination**: `lsblk` can only show the *survivor* — match its serial to the map, and the failed disk is the other tray. That works even when the dead drive cannot say a word, and it is the reason the map was recorded while both disks were healthy.
>
> The two ST4000VN006 drives are identical at a glance — pull the *healthy* one and a degraded mirror goes straight to dead. The drives sit in the View 71's fixed rear trays behind the motherboard tray, so check the label there too.

> [!NOTE]
> Because the whole HBA is passed through, there is no per-disk passthrough line to rewire when you swap the drive (steps 7–9) — TrueNAS simply sees the new drive on the controller.

The replacement must be the same 4TB capacity or larger, and TrueNAS wipes it. Replacing triggers a **resilver** — ZFS copying the survivor's data onto the newcomer — which takes a while on a full pool; the share stays online throughout, just slower.

> [!WARNING]
> Replace a failed IronWolf as soon as you can. A degraded two-way mirror has no margin left — the next failure takes the pool, and with it everything that has not yet reached the offsite copy below.

> [!DETAILS] If TrueNAS refuses partway through the drill
> Two walls a brand-new IronWolf can hit.
>
> If **Offline** fails with *"no valid replicas"*:
>
> 1. Run a **Scrub** from the **ZFS Health** widget.
> 2. Retry once it finishes.
>
> If **Replace** is refused because the new ST4000VN006 carries old partitions or data (these drives may be from the same batch or previously used), use the **Force** option in the **Replacing disk** dialog — it overrides the safety check and erases whatever is on that disk.

## Get a copy off the property

### Everything on the mirror counts
On this build the call is deliberately simple: **everything on the mirror is treated as irreplaceable.** No separate dataset to sort into, no judging photo by photo — the bulk that is *not* worth protecting (camera footage) was kept off the mirror by design, on Frigate's own disk. So the offsite target is simply `tank/files`, the household's whole file store, as-is. (The `backups` dataset stays local — its vzdump archives are rebuildable from the running system.)

### The offsite copy: a rotated USB drive
The build's offsite leg is the free one.

1. Plug an external drive into the Mac or the Windows PC.
2. Encrypt it first, so a lost drive is not a leak — Mac: Disk Utility, erase as **APFS (Encrypted)**; Windows PC: **BitLocker To Go**.
3. Record that password in your password manager.
4. Mount the `files` share (the connection saved on the TrueNAS Storage page).
5. Copy the whole share onto the drive.

Store the drive **somewhere that is not this house** — a desk at work, a relative's.

Refresh the copy on a rhythm: each Maintenance & Upkeep pass, or quarterly at worst.

Low-tech is the feature: no account, no bill, no cloud, and stored off-property it genuinely closes the fire-and-theft gap.

> [!TIP]
> Open a few files straight from the drive after each refresh — a copy you have never read back is a hope, not a backup. Same principle as the alert test buttons.

### Home Assistant's backups land here too — later
One more consumer of the `backups` share arrives soon: Home Assistant's own scheduled backups default to its VM's disk, so a dead HA VM disk would take its config and history with it. Redirecting them onto the mirror is done on the Home Assistant & Zigbee2MQTT page, once that VM exists — the share you published when you set up TrueNAS storage is already waiting for it.

### Count to 3-2-1
The scorecard is **3-2-1**: three copies of anything that matters, on at least two kinds of hardware, one of them offsite. Count honestly — the mirror is *one* copy, because redundancy inside a single pool is not a second copy, and neither are snapshots. The rotated USB drive is the second copy *and* the offsite one, on different hardware; the Proxmox guest backups scheduled later in the build (on the Proxmox Backups page) land second copies of every guest on this same NAS. For a home server, that is a respectable score — the honest caveat being that a rotated drive is only as current as its last refresh, which is exactly what the automated option below fixes if the gap ever bothers you.

> [!DETAILS] Optional, future: automate the offsite leg with Backblaze B2
> **Backblaze B2** is a cloud-storage service — roughly $7 per terabyte per month, so a few hundred gigabytes of files costs a few dollars — and TrueNAS drives it natively. It turns the offsite copy from a chore you remember into a nightly job that never forgets, encrypted with your own password before a byte leaves the house so Backblaze only ever stores ciphertext. If the USB rhythm ever lapses in practice, this is the upgrade; it needs an account (with payment details) created at backblaze.com first.
>
> **The push:**
>
> 1. Go to **Data Protection**.
> 2. Click **Add** on the **Cloud Sync Task** widget.
>
> Set:
>
> - **Credential** → the Backblaze B2 one, or **Add New** (credentials live under **Credentials → Backup Credentials → Cloud Credentials**; B2 needs an Application Key ID and its key)
> - **Direction** → **PUSH**
> - **Source** → `tank/files`
> - **Folder** (remote) → click the folder icon and pick the bucket
> - **Schedule** → nightly
> - **Transfer Mode** → **COPY** — SYNC propagates a deletion at home into the offsite copy on the next run; COPY only ever adds and updates, so deleted files linger offsite as a safety net
>
> **The encryption:** under the task's **Advanced Options**:
>
> - **Remote Encryption** → on — TrueNAS encrypts with rclone before a byte leaves
> - **Encryption Password / Encryption Salt** → set both — lose them and the offsite copy is unreadable by anyone, including you
> - **Filename Encryption** → off — current docs advise against it
>
> Record both password and salt **before the first run** — in the fields below, and in your password manager.
>
> **The drill:** an encrypted backup fails silently — a wrong password looks identical to a good backup until the day you reach for it. So once at setup and once a year, run a one-off **PULL** task:
>
> - **Credential** and **remote folder** → same as the push task
> - **Local folder** → an empty scratch dataset (`restore-test`, deleted afterward)
> - **Password / Salt** (Advanced Options) → re-entered by hand — that re-entry is the part being tested
>
> 1. Open a recovered photo.
> 2. Confirm it is the file, not scrambled bytes.
>
> The other automated route, no subscription: **Replication** (**Data Protection → Replication Tasks**) ships ZFS snapshots over SSH (Secure Shell) to a second ZFS box — ideally another TrueNAS at a relative's house — incremental after the first run, and it preserves point-in-time history a file-level copy cannot.

> [!SECRET] b2-encryption-password | Backblaze B2 remote-encryption password
> Only used if the optional B2 route above is ever taken — set before its first run.

> [!SECRET] b2-encryption-salt | Backblaze B2 remote-encryption salt
> Only used if the optional B2 route above is ever taken.
