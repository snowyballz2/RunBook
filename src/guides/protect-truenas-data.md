---
title: Protect TrueNAS Data
subtitle: Snapshots, disk health, and an offsite copy for the irreplaceable
collection: Proxmox Home Server
order: 13
accent: rose
---

## Schedule the safety nets

### Schedule snapshots
The NAS from the *TrueNAS* guide holds the data; this guide makes it hard to lose. Start with the cheapest protection ZFS offers: go to **Data Protection** and click **Add** on the **Periodic Snapshot Tasks** widget — pick your dataset, a schedule, and a **Snapshot Lifetime** (how long each one is kept); the **Naming Schema** field must include the time elements `%Y`, `%m`, `%d`, `%H` and `%M`. Snapshots are nearly free in ZFS, so schedules as frequent as every 15 minutes are common. A useful pattern is two tasks on the same dataset — one frequent and short-lived, one sparse and long-lived: say, every 15 minutes kept for two days, plus daily at midnight kept for two weeks.

> [!NOTE]
> This guide follows the current TrueNAS Community Edition (25.10, "Goldeye"). The previous release, 25.04, keeps a few of these controls in different places — the expandables call out the differences where they matter.

> [!DETAILS] What a snapshot can and cannot save you from
> A snapshot is a point-in-time picture of the dataset — delete or overwrite a file by accident and you can reach back and recover it. But snapshots live in the same pool, on the same disks: they protect against fat fingers, not against the pool itself dying.

> [!NOTE]
> Honest accounting: a NAS is not a backup. The mirror survives one dead drive and snapshots survive accidental deletion — neither survives fire, theft, or both drives going at once. The last phase of this guide is about getting a copy off the property.

### Meet the scrub
The pool's other guardian is already on duty: TrueNAS generated a default **scrub task** — a routine integrity pass over the whole pool — when you created it, set to run every Sunday at 12:00 AM. Nothing to configure here; confirm it on the **Storage** dashboard's **Storage Health** widget, which shows the scheduled scrub and offers **Schedule** and **Configure** links. (On 25.04 it lives as a **Scrub Tasks** widget on the **Data Protection** page instead.)

> [!DETAILS] What a scrub actually does
> A scrub reads every block in the pool and verifies it against its checksum; on a mirror, anything that fails the check is repaired from the partner disk's good copy. It is the mechanism that catches silent corruption before you do — which is exactly why it runs on a schedule instead of waiting for you to notice something wrong.

### Let the disk watchdog work
Snapshots guard the data; S.M.A.R.T. watches the disks themselves. On current TrueNAS there is nothing to schedule — the old S.M.A.R.T. Tests widget and service are gone, replaced by **Drive Health Management**, which polls every disk's S.M.A.R.T. data automatically (roughly every 90 minutes) and raises alerts that name the affected disk and what tripped. Check in on the **Disk Health** card of the **Storage** dashboard; active alerts land in the **Alerts** panel behind the bell icon, top right.

Deeper self-tests are best run from the **Proxmox host's shell** — it talks to the physical drives directly:

```bash
# Find the data disks first (match model + serial):
lsblk -o +MODEL,SERIAL
# Quick self-test — usually under ten minutes:
smartctl -t short /dev/sda
# Full-surface test — hours on large disks, noticeable slowdown:
smartctl -t long /dev/sda
# Read the verdict:
smartctl -a /dev/sda
```

> [!NOTE]
> Why the host? Per-disk passthrough has a blind spot: the VM talks to QEMU's emulated SCSI drives rather than the physical hardware, so S.M.A.R.T. data may not reach TrueNAS at all — the node's **Disks** view in Proxmox also shows a S.M.A.R.T. column at a glance. If TrueNAS's Disk Health card *does* show real data on your build, its own shell (**System → Shell**) works too, and recurring tests can be scheduled as Cron Jobs under **System → Advanced Settings**. (Whole-controller PCIe passthrough, the *TrueNAS* guide's "for later", removes this blind spot.)

> [!DETAILS] Scheduling S.M.A.R.T. tests yourself on 25.04
> The previous release makes self-tests your job, and a fresh install schedules none. Go to **Data Protection** and click **Add** on the **S.M.A.R.T. Tests** widget: select the **Disks**, a **Type** — **SHORT** is a basic pass usually under ten minutes; **LONG** scans the entire disk surface and can take hours — and a **Schedule**. Two more switches: the **S.M.A.R.T.** service under **System → Services** must be running with **Start Automatically** set, and results live at **Storage → Disks**, expand a disk's row, **S.M.A.R.T. TEST RESULTS**. A common community cadence is a weekly SHORT plus a monthly LONG; the official rule is simply to keep disk-intensive tasks apart — never the same day as the scrub, and in low-usage hours.

## Make alerts reach you

### Teach TrueNAS to send email
A NAS that notices a dying disk but has no way to tell you is just a quieter failure. Go to **System → General Settings** and click **Settings** on the **Email** widget. Pick a **Send Mail Method**: **GMail OAuth** and **Outlook OAuth** are the low-friction options — click **Log In To GMail** (or **Outlook**), **Proceed**, sign in, **Allow** — while **SMTP** covers every other provider. Add your address to **Email Recipients**, click **Send Test Mail**, and only **Save** once the test actually lands in your inbox. With email working, TrueNAS also sends a nightly status email that includes disk health.

> [!DETAILS] Filling in the SMTP fields
> **From Email** is the sending address, **Outgoing Mail Server** your provider's SMTP host, **Mail Server Port** typically 587 (or 465 for implicit TLS), **Security** set to **TLS (STARTTLS)** for port 587 or **SSL (Implicit TLS)** for 465. Enable **SMTP Authentication** and enter the **Username** (usually the full email address) and **Password** — for Gmail or Outlook accounts the OAuth methods spare you app-password wrangling, which is why they are the default suggestion.

> [!DETAILS] Where the nightly email goes on 25.04
> 25.10 introduced the **Email Recipients** list; on 25.04 the nightly system email goes to the administrator account's address instead. Set it under **Credentials → Users**, expand the admin user, **Edit**, and fill in the **Email** field.

### Aim the alerts at your inbox
Go to **System → Alert Settings**. An **Email** entry already exists under **Alert Services** — open its three-dot menu, click **Edit**, enter the recipient in **Email Address**, keep **Level** at the default **Warning** (alerts at that level and above get sent), and click **Send Test Alert**. Once the test arrives, save. The built-in alert categories already cover the things that matter here: an unhealthy pool, a pool filling up, disks running hot or failing a self-test, and failed snapshot, scrub, replication, or cloud sync tasks.

> [!TIP]
> The two test buttons in this phase are the whole point. An alert chain you have never tested is the silent failure you were trying to avoid — press both, and check the inbox you will actually read in two years.

> [!DETAILS] Adding channels beyond email
> The **Add** button on Alert Services offers a **Type** dropdown with Slack, Telegram, Mattermost, PagerDuty, OpsGenie, VictorOps, AWS SNS, SNMP Trap, and InfluxDB. Each gets its own **Level** and its own **Send Test Alert** button, so a phone-notification channel can sit alongside email rather than replacing it.

## Practice recovery

### Pull a file back from a snapshot
The easiest route is from a Windows machine: TrueNAS automatically presents a share's ZFS snapshots to SMB clients as shadow copies, so Windows' standard Previous Versions feature sees them — right-click a file or folder on the share, choose **Properties → Previous Versions**, pick a version, and **Open** or **Restore**. Snapshots are read-only, so no client can alter or delete them.

Server-side, go to **Datasets**, select the dataset, and click **Manage Snapshots** on its **Data Protection** widget. That screen lists, deletes, holds, clones, and rolls back snapshots — but it has no file browser; for contents, use the routes in the expandables.

> [!TIP]
> Rehearse on a sacrificial file today: drop a test file on the share, wait out one snapshot interval, delete the file, and bring it back through Previous Versions. Recovery you have rehearsed once is calm; recovery you are attempting for the first time mid-disaster is not.

> [!DETAILS] Browsing a snapshot's files directly
> Every dataset has a hidden `.zfs` directory at its root, where each snapshot appears as an ordinary read-only folder. To wander it over the share, edit the dataset (**Datasets → Edit** on the Dataset Details widget), open **Advanced Options**, and set **Snapshot Directory** to **Visible** — then tell Windows to show hidden files and folders. The default, Invisible, still serves shadow copies; Visible just makes the directory browsable.

> [!DETAILS] Rolling back — and why cloning is safer
> **Rollback** rewinds the entire dataset to the snapshot. TrueNAS's own dialog warns that it destroys data on the dataset, can destroy newer related snapshots, and can cause permanent data loss — and a rollback can also break configured replication tasks by putting snapshots out of order. Unless the whole dataset is wrecked, use **Clone to New Dataset** instead: the clone appears under the parent dataset with the snapshot's contents, you copy out (or temporarily share) what you need, then delete the clone. Nothing on disk is destroyed, and it is the recovery flow the official docs recommend.

### Rehearse the dead-disk drill
When a mirror disk fails, the pool drops to **Degraded** — the dashboard pool widget shows it, an alert fires (and now emails you), and the share keeps answering from the surviving disk. The drill on current TrueNAS:

1. On the **Storage** dashboard, click **View VDEVs** on the pool's VDEVs widget. Expand the vdev (the pool's disk group), click the failed disk (often shown as **REMOVED**), and click **Offline** on its **ZFS Info** widget.
2. Shut the VM down, swap the physical drive, rewire the passthrough (below), and boot.
3. Back in TrueNAS, click **Replace** on the disk's **Disk Info** widget, pick the new drive from **Member Disk**, and click **Replace Disk**.

```bash
# Proxmox host shell — drop the dead disk's passthrough entry,
# then attach the replacement. Its by-id path is new (it encodes
# model + serial); find it with: lsblk -o +MODEL,SERIAL
qm set 101 -delete scsi2
qm set 101 -scsi2 /dev/disk/by-id/ata-NEW-DISK-ID
```

The replacement must be the same capacity or larger, and TrueNAS wipes it. Replacing triggers a **resilver** — ZFS copying the survivor's data onto the newcomer, which can take a long time on a well-filled pool. As with any ZFS pool, it stays online and shares keep working during the resilver, just slower.

> [!WARNING]
> Replace a failed disk as soon as you can. A degraded mirror has no margin left — the next failure takes the pool. And if you started with a single-disk pool, there is no drill: a dead disk means recreating the pool and restoring from backups, which is exactly why the rest of this guide exists.

> [!DETAILS] When labels differ, and when TrueNAS refuses
> On 25.04 the button is **Manage Devices** on the **Topology** widget — the flow after that is the same. If **Offline** fails with "no valid replicas", run a **Scrub** from the **ZFS Health** widget and retry once it finishes. If **Replace** fails because the new disk carries old partitions or data, the **Force** option in the **Replacing disk** dialog overrides the safety check — and erases whatever is on that disk.

> [!DETAILS] Started on one disk? Upgrade it to a mirror
> The single-disk pool from the *TrueNAS* guide can grow into a real mirror without rebuilding anything. First give the VM the new disk, on the Proxmox host:
>
> ```bash
> # Find the new disk's stable ID (model + serial), then attach it:
> lsblk -o +MODEL,SERIAL
> qm set 101 -scsi3 /dev/disk/by-id/ata-NEW-DISK-ID
> ```
>
> Reboot the VM so TrueNAS sees the drive. Then: **Storage → View VDEVs**, select the pool's data VDEV, and click **Extend** on its **ZFS Info** widget — pick the new drive in the **New Disk** dropdown. ZFS attaches it and resilvers the existing data across; when it finishes, the stripe has become a two-way mirror, dead-disk drill and all. (Capacity stays at the smaller disk's size, and TrueNAS wipes the newcomer.)

## Get a copy off the property

### Make the NAS the storage hub
Point the rest of the build's safety copies at the share, so they live on different disks than the things they protect. Proxmox's scheduled guest backups: the *Proxmox Backups* guide walks through mounting the share and aiming the job at it — confirm those archives are landing and recent. Home Assistant takes one more step its own guide didn't cover: in HA, go to **Settings → System → Storage**, add the SMB share as network storage with its **Usage** set to backups, then select it in the backup settings — until then its backups sit on the VM's own disk. A dataset of their own (`backups`, in the *TrueNAS* guide's one-dataset-per-purpose habit) keeps them out of your file snapshots.

### Push the irreplaceable offsite with Cloud Sync
The discipline that keeps the bill sane: bulk, replaceable data — camera recordings (the *Frigate* guide), media — stays local-only; offsite is reserved for the irreplaceable, the photos and documents with no other home. Go to **Data Protection** and click **Add** on the **Cloud Sync Task** widget to open the wizard. Pick a **Credential** for your provider or click **Add New** (they are kept under **Credentials → Backup Credentials → Cloud Credentials**), set **Direction** to **PUSH**, point the source at the irreplaceable data, click the folder icon on the remote **Folder** field, choose a **Transfer Mode**, and give it a schedule — nightly is plenty.

Then make the copy private: under **Advanced Options**, select **Remote Encryption** and set an **Encryption Password** and **Encryption Salt**. Transfers are encrypted with rclone before they leave the NAS, so the provider only ever stores ciphertext. (A **Use Snapshot** option also appears for PUSH tasks, taking the transfer from a snapshot rather than the live filesystem.)

> [!WARNING]
> Put the encryption password and salt in your password manager now. Lose them and the offsite copy is unreadable — by anyone, including you — which is the one way an encrypted backup can fail you.

> [!DETAILS] Choosing a provider — and the monthly bill
> The provider list is long: Backblaze B2, Amazon S3, Google Cloud Storage, Google Drive, Dropbox, Microsoft OneDrive, Azure Blob, Box, pCloud, Storj, plus generic FTP, SFTP, WebDAV, and more. For pure backup storage, Backblaze B2 is the easy recommendation at roughly $7 per terabyte per month ($6.95 as of May 2026) (figures approximate — check current pricing), so a few hundred gigabytes of irreplaceable files costs a few dollars a month. Storj appears too (as Storj iX, with a streamlined TrueCloud Backup task type), but as of mid-2026 its pricing is moving to a $50 monthly minimum, which makes it a poor fit for small home backups. One more option to leave alone: **Filename Encryption** — current docs advise against it, since it caps filenames at 143 characters and still leaves the directory structure visible.

> [!DETAILS] Picking SYNC or COPY
> **SYNC** makes the destination match the source — tidy, but a deletion at home (accidental or otherwise) propagates offsite on the next run. **COPY** only ever adds and updates files at the destination, so deleted files linger there as a safety net at the cost of slowly accumulating clutter. For irreplaceable data, COPY's paranoia is a reasonable default; either way, the snapshots from the first phase remain your fast undo.

### Count to 3-2-1
The classic scorecard — the same framing TrueNAS's own backup guidance uses — is **3-2-1**: three copies of anything that matters, on at least two different kinds of hardware, one of them offsite. Count honestly: the mirror is one copy, because redundancy inside a single pool is not a second copy, and neither are snapshots. The Cloud Sync task gives your irreplaceable files a second copy that is also the offsite one, and the NAS itself holds second copies of every guest via the *Proxmox Backups* job. For a home server, that is a respectable score — and you know exactly where the gaps are.

> [!DETAILS] Replicating to a second box
> The route to a third copy — or an offsite copy without the cloud — is **replication** (**Data Protection → Replication Tasks**): TrueNAS sends ZFS snapshots of datasets to another ZFS system, ideally another TrueNAS, over SSH. The first run transfers everything; after that only incremental changes move, and because it ships snapshots themselves, the destination carries the same point-in-time history — something a file-level cloud copy does not. The classic arrangement is a small second TrueNAS box at a relative's house: two different buildings, each holding the other's irreplaceable data. The humblest variant of the same idea costs no subscription and no second box: copy the irreplaceable dataset to an external USB drive now and then, and keep that drive somewhere that isn't your house.
