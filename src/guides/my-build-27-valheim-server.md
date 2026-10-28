---
title: Valheim Server
subtitle: An optional game server on the rack — one container, and a clear choice between Tailscale sharing and a router port-forward for how friends get in
collection: My Build
order: 27
accent: violet
---

A Valheim dedicated server is a small, headless Linux program: it wants a fast core or two, about 3 GB of RAM at idle, a few gigabytes of disk, and two UDP ports. The i7-8700K boosts to 4.7 GHz on a single core, which is exactly what the game rewards, and the 32 GB of RAM has the room once TrueNAS and Home Assistant have taken their 8 GB each. It runs as one more unprivileged container, built by the community Docker helper, so the nightly backup job already covers it.

Everything on this page is optional. Skip it and nothing else in the build changes.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host the container lives on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach the node Shell and the container's Console.

> [!DETAILS] Instructions to send a friend
> Two ready-to-send messages, one per option. Copy the block, paste it into a text to the friend, and send the address and the password in a separate message — the address is the tailnet one from Option A or the public one from Option B, both recorded on this page.
>
> **Joining over Tailscale (Option A):**
>
> ```text
> Joining my Valheim server (Steam on a Windows PC only). One-time setup, 5 minutes:
>
> 1. Install Tailscale from tailscale.com/download/windows. Say Yes if Windows asks to allow changes.
> 2. Right-click the Tailscale icon in the tray (next to the clock; click the ^ arrow if hidden) → Log in. Sign in with Google, Microsoft, Apple or GitHub. Free plan.
> 3. Open the invite link I'm sending you → Accept. "valheim" appears in your Tailscale list.
> 4. Keep Tailscale on while you play.
>
> To join:
> 5. Valheim → Join Game → Join IP → the address I send you plus :2456 (e.g. 100.64.0.5:2456) → Connect.
> 6. Enter the password I send you (case-sensitive).
>
> Keep Valheim updated or it says "Incompatible version". First join takes a minute. Can't connect? Check Tailscale is on and "valheim" is in its list, then text me.
> ```
>
> **Joining by address (Option B):**
>
> ```text
> Joining my Valheim server (Steam on a Windows PC only). Nothing to install:
>
> 1. Valheim → Join Game → Join IP → the address I send you plus :2456 (e.g. 203.0.113.10:2456) → Connect.
> 2. Enter the password I send you (case-sensitive).
>
> Keep Valheim updated or it says "Incompatible version". First join takes a minute. It's only open tonight — if it won't connect another day, ask me to open it.
> ```
>
> Two things on your side that the messages rely on: the invite link comes from the *Share it with a friend* steps under Option A, where **Reusable link** lets one link serve several friends and an unused link expires after 30 days; and a friend who already has a Tailscale account accepts the share from it — any account works, it does not have to match the email you invited.

## Pick how friends get in
One decision shapes a prompt in the next section, so make it first.

> [!NOTE]
> **Option A — Tailscale.** The container joins your tailnet and you *share* that one machine with each friend's Tailscale account. Nothing on the router opens, it works from anywhere, and the Remote Access page's rule — no router port-forwards, ever — stays intact. Each friend needs a free Tailscale account and the app on their gaming PC.
>
> **Option B — a port-forward.** The router sends UDP 2456 and 2457 from the internet to the container. Anyone with your public address and the server password can join, with nothing to install. It is the common way Valheim servers are run, and it is the first inbound door this build opens.
>
> Build the container the same way for both; the two options are separate sections below. Pick one — or both, on demand: build for Option A, and for the one friend who will not install Tailscale, do Option B's router steps for that evening and delete the rule afterwards. The container needs no change, the Tailscale friends keep playing while the port is open, and the exposure lasts exactly as long as the forwarding rule exists. The container's TUN/TAP answer below only matters for Option A, so answer Yes if you might ever use it.

## Build the container

### Run the Docker helper
In **Proxmox → pve → Shell**:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/docker.sh)"
```

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used for the rest of this build. This helper builds an unprivileged Debian 13 container and installs the Docker engine in it; the game server is a Docker image that goes in afterwards.

### Choose Advanced — every dialog answered
This helper asks one question before the usual menu:

1. **Choose the container OS** → **Debian** — the Alpine choice is smaller, but every other container here is Debian, and the Maintenance walk assumes it.
2. On the **Community-Scripts Options** menu, pick **Advanced Install**.

The prompts, in order:

- **Container type** → **Unprivileged**, as offered
- **Set Root Password** → set one, recorded below
- **Container ID** → accept the offered next-free number — `109` on this build unless the Voice page's containers came first; it is the ID every command below uses
- **Hostname** → `valheim`
- **Disk size** → `32` — the game server download is about 1 GB, but the hourly world backups accumulate beside it for a week at a time, and a long-played world runs to a hundred megabytes a copy. The number is a ceiling on the thin pool, not space taken: the container uses only what it writes, so 32 costs nothing over 16 until the backups need it
- **CPU cores** → `4`
- **RAM** → `6144` — a cap, not a reservation; the server idles near 3 GB
- **Network bridge** → **`vmbr0`**
- **IPv4** → **Static (manual entry)**: **`192.168.1.62/24`**, gateway **`192.168.1.1`** — never DHCP
- **IPv6** → **Fully Disabled**
- **MTU, DNS search domain, DNS server, MAC address, VLAN** → all blank
- **Tags** → keep the offered tag
- **SSH KEY SOURCE** → **none / No keys**
- **SSH ACCESS** → **No**
- **FUSE SUPPORT** → **No**
- **TUN/TAP SUPPORT** → **Yes** — Tailscale inside the container needs the TUN device for Option A, and it is harmless for Option B, so Yes keeps both open
- **NESTING SUPPORT** → **Yes** — Docker needs it
- **GPU PASSTHROUGH** → **No**
- **Use APT Cacher-NG proxy?** → **No** — it would route package downloads through an apt-cacher-ng server, and nothing on this network runs one
- **HTTP/HTTPS proxy?** → **No** — the same question for a web proxy; the house has none, and Nginx Proxy Manager is the other direction, inbound to your services
- **Container protection?** → **No** — it sets the guest's **Protection** flag, which makes Proxmox refuse to remove or destroy the container until you clear it under **Options**. Worth a Yes on something irreplaceable; this world is backed up hourly and the container nightly, and no other guest in the build carries it
- **Device node creation?** → **No** — it adds the `mknod` feature, letting processes inside the container create device files of their own. Docker does not need it, and the one device Tailscale needs, the TUN device, is handed in by the TUN/TAP answer above
- **Specific filesystem mounts?** → **No** — it adds the `mount` feature, letting the container mount NFS or SMB shares from inside. Nothing here mounts anything: the world lives on the container's own disk, and the nightly copy to the NAS is the host's backup job reaching in from outside
- **Post install hook?** → **No** — it asks for a script of your own to run once the install finishes; the only thing to do after the container exists is the next step on this page
- **Verbose mode?** → **No** — it prints every command's output as the container builds, worth it only when a build is failing
- **Ready to create the container?** → **Yes** — the summary above it is the whole set of answers; this is the last question before the build runs
- **Expose Docker TCP socket (insecure)?** — the install's own question, after the container exists → **n**

> [!INPUT] valheim-ct-id | Valheim container ID | 109

> [!INPUT] valheim-ip | Valheim container IP | 192.168.1.62

> [!SECRET] valheim-root-password | Valheim container root password

### Find your Steam ID
The start script names one admin — the account that can force a save, and kick or ban, from the in-game console — by Steam ID, a seventeen-digit number starting `7656`. On the PC:

1. Open `store.steampowered.com/account` in a browser signed in to Steam — the **Steam ID** sits under the account name at the top of the page.

> [!INPUT] valheim-admin-id | Steam ID of the admin

### Write the server's settings
In **Proxmox → 109 (valheim) → Console**, logged in as `root`.

1. Create the two folders the server keeps its files in:

```bash
mkdir -p /root/valheim-server/config /root/valheim-server/data
```

2. Write the start script exactly as shown, placeholders and all — the password and the Steam ID go in with the next step, inside the console, because a password typed into a Mac app on the way arrives with curly quotes that break the script:

```bash
cat > /root/valheim-run.sh <<'EOF'
docker run -d \
  --name valheim-server \
  --cap-add=sys_nice \
  --stop-timeout 120 \
  --restart always \
  -p 2456-2457:2456-2457/udp \
  -v /root/valheim-server/config:/config \
  -v /root/valheim-server/data:/opt/valheim \
  -e SERVER_NAME="Kuzco" \
  -e WORLD_NAME="Kuzco" \
  -e SERVER_PASS="VALHEIM-PASS" \
  -e SERVER_PUBLIC=false \
  -e TZ=America/New_York \
  -e BACKUPS_MAX_AGE=7 \
  -e ADMINLIST_IDS="STEAM-ID" \
  -e SERVER_ARGS="-saveinterval 600" \
  -e VALHEIM_LOG_FILTER_REGEXP_Players="Got connection SteamID|Got character ZDOID from|Closing socket" \
  -e ON_VALHEIM_LOG_FILTER_REGEXP_Players="bash /config/players-notify.sh" \
  ghcr.io/community-valheim-tools/valheim-server
EOF
```

3. Open the script in the console's editor:

```bash
nano /root/valheim-run.sh
```

4. On the `SERVER_PASS` line, replace `VALHEIM-PASS` with the join password, typed there, between the straight quotes that are already in place. Valheim's rules are checked at start-up: at least **five** characters, and nothing that appears inside the server name or the world name — with both named `Kuzco`, the password cannot contain `kuzco`.
5. On the `ADMINLIST_IDS` line, replace `STEAM-ID` with the Steam ID from above.
6. Save with **Ctrl+O**, then **Enter**, and close with **Ctrl+X**.

> [!NOTE]
> `SERVER_PUBLIC=false` keeps the server out of Steam's public browser — friends join by address, which both options below provide. If a setting needs changing after the first start, the password included, *Change a setting later* near the end of the page is the way: edit this script and recreate the container. Two failures seen here on the first attempt: a four-letter password, which the server refuses at start-up, and a closing quote that had become a curly `”` on its way through a Mac app, which bash reports as `unexpected EOF while looking for matching` and which is why the password now goes in through nano.

> [!INPUT] valheim-server-name | Valheim server name | Kuzco

> [!INPUT] valheim-world-name | Valheim world name | Kuzco

> [!SECRET] valheim-password | Valheim join password
> At least five characters, and not a string that appears in the server or world name — the rule in step 4.

7. Start it:

```bash
bash /root/valheim-run.sh
```

8. Watch the first start — it downloads the server from Steam, about 1 GB:

```bash
docker logs -f valheim-server
```

9. When a line reads `Game server connected`, press **Ctrl+C** — that leaves the log view; the server keeps running.

> [!DETAILS] What the start script sets
> The lines that matter, one job each:
>
> - **The restart rule, `--restart always`** — brings the server back after a container reboot.
> - **The stop timeout, `--stop-timeout 120`** — gives it two minutes to save the world on a stop.
> - **The priority capability, `--cap-add=sys_nice`** — lets it raise its own scheduling priority.
> - **The two `-v` lines** — keep the world, its backups and the server install on the container's disk, outside the Docker image, so an image update never touches them.
> - **The backup age, `BACKUPS_MAX_AGE`** — the image writes a world backup every hour under `/root/valheim-server/config/backups`, kept for the seven days this sets.
> - **The admin list, `ADMINLIST_IDS`** — the Steam IDs, separated by spaces, whose characters can run the server's admin commands from the in-game console: `save`, `kick`, `ban`, and the switch that turns on the game's cheat commands. Yours alone is the right list; a friend on it could empty a boss fight with a typed command.
> - **The save interval, `SERVER_ARGS="-saveinterval 600"`** — the game writes the world every ten minutes instead of its default thirty, so a power cut or a stopped container costs at most ten minutes of play. Each save is a brief stutter for everyone online, which is why it is not shorter.
> - **The log-filter pair, `VALHEIM_LOG_FILTER_REGEXP_Players`** and the `ON_` line under it — hand every join and leave line in the server's log to the push script from *Get a push when someone joins or leaves*. The lines stay in the log, each followed by a `Running hook` line of the server's own, and until that script exists a join also logs that it is missing, which is harmless.
>
> Three timers run inside the container on their own, with nothing to set up. They are listed here because the Maintenance page keeps one table of every scheduled job in the build, and these belong in it:
>
> - **Five past every hour, and at every container start** — a zip of the world files as the game last saved them, kept seven days by the backup age above. A copy, not a save: it holds nothing the game has not yet written, and it is the history to reach for after a corrupted world or a wrecked base. The host's nightly backup then carries the whole container, zips included, to the NAS.
> - **Every fifteen minutes** — a check with Steam for a game update, installed only while nobody is connected.
> - **5:10 a.m. daily** — a restart of the server, again only if nobody is playing.
>
> Empty hours cost the world nothing. The server only moves the in-game clock while someone is connected, and the world itself is simulated by the connected players' games, so with nobody on nothing grows, smelts, ferments, rots or respawns — the next person in finds it exactly as the last one left it. That is also why the two idle-only timers interrupt nothing. The rest of the image's settings are documented at `github.com/community-valheim-tools/valheim-server-docker`.

### Prove it from the LAN
On a PC with Valheim installed, at home:

1. Select a character.
2. On the **Join Game** tab, click **Join IP**.
3. Enter `192.168.1.62:2456`.
4. Click **Connect**.
5. Enter the join password.

A loading screen into a fresh world means the server is running. Everything from here is about reaching it from outside.

## Option A — share it over Tailscale

> [!NOTE]
> The host already routes the whole LAN into your tailnet, but a shared machine never carries its subnet routes into the friend's tailnet — Tailscale's docs are explicit. So the container gets its own Tailscale client, and that one machine is what you share. Sharing is available on every plan and does not use your plan's user seats.

### Confirm the TUN device
The helper's **TUN/TAP SUPPORT → Yes** answer hands the container the TUN device Tailscale needs. The proof is the device itself, seen from inside the container. In **pve → Shell**:

1. Ask the container for the device:

```bash
pct exec 109 -- ls -l /dev/net/tun
```

2. A line beginning `crw-rw-rw-` with `10, 200` in it means the device is there — carry on to the next step. `No such file or directory` means the helper's answer was missed; carry on at step 3.
3. Add the two lines Tailscale's own instructions give for an unprivileged Proxmox container, and restart it — on the host, still in **pve → Shell**: `/etc/pve` exists only there, and inside the container's own console these lines answer `No such file or directory`:

```bash
echo 'lxc.cgroup2.devices.allow: c 10:200 rwm' >> /etc/pve/lxc/109.conf
echo 'lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file' >> /etc/pve/lxc/109.conf
pct reboot 109
```

4. Repeat step 1 — the device line is there now.

> [!NOTE]
> An earlier version of this step counted the word `tun` in the container's config and expected two matches. The helper writes two lines, but only the mount line contains the word — the device-permission line names it by number, `10:200` — and newer helpers write a single `dev0: /dev/net/tun` line instead, so the honest count is one either way. Seen here on the first build, which is why the step now checks the device rather than the file.

### Install Tailscale in the container
In **Proxmox → 109 (valheim) → Console** — the Remote Access page's download-read-run habit, one command at a time, because the reader swallows anything pasted after it:

1. Fetch the installer:

```bash
curl -fsSL https://tailscale.com/install.sh -o tailscale-install.sh
```

2. Read it — `q` leaves the viewer:

```bash
less tailscale-install.sh
```

3. Run it; it adds Tailscale's package source and installs the package, about a minute:

```bash
sh tailscale-install.sh
```

4. Bring it up — it prints a login link within a few seconds:

```bash
tailscale up
```

5. Open that link in a browser on the Mac and sign in with the same account the Remote Access page used — the container joins your tailnet as `valheim`, and the Console prints `Success`.
6. Back in the Console, print its tailnet address:

```bash
tailscale ip -4
```

> [!NOTE]
> Seen here on the first build: the three install commands pasted together ran the download, opened the reader, and never reached the run line, so `tailscale up` answered `command not found`. Three separate pastes, as above, is the cure.

> [!INPUT] valheim-tailscale-ip | Valheim container tailnet IP (100.x) | 100.101.102.104
> The address friends join by. It never changes, and it survives the Renumber the LAN page untouched.

### Stop its key from expiring
A shared machine that silently drops off the tailnet is a server nobody can join. On the [Machines page](https://login.tailscale.com/admin/machines) of the admin console:

1. Find the **valheim** row.
2. Open the **…** menu at the far right.
3. Select **Disable Key Expiry**.

### Share it with a friend
Still on the Machines page:

1. Find the **valheim** row.
2. Open the **…** menu.
3. Select **Share**.
4. Select the **Copy invite link** tab.
5. Turn on **Reusable link** if more than one friend will use it.
6. Click **Copy share link**.
7. Send the friend the link.
8. Send the join password separately.

What the friend does, once:

1. Install Tailscale on the gaming PC.
2. Sign in — a free personal account is enough.
3. Open the link.
4. Click **Accept** — `valheim` appears in their Tailscale machine list.
5. In Valheim, on the **Join Game** tab, click **Join IP**.
6. Enter the tailnet address recorded above, followed by `:2456`.
7. Click **Connect**.
8. Enter the join password.

> [!DETAILS] What a share does and does not give away
> The friend's tailnet sees exactly one machine: the container. Not the host, not the LAN behind it, not the subnet route — this tailnet's own policy still applies to shared users, and the build left it at the permissive default, so every port on the container is reachable, which is only the game. An unused invite link expires after 30 days. To take a share back: the **valheim** row → **Share** → the friend's entry → **Revoke invite** — they lose the machine at once.

## Option B — forward the two ports on the router

> [!WARNING]
> This is the first inbound door in the build. It is a narrow one — two UDP ports to one container, gated by the game's own password, and the router's firewall still drops everything else — but the rest of the house's security has leaned on *no* inbound doors. The container holds nothing but the game, which is why it is the only thing a hole is pointed at.

In a browser on the Mac — the steps follow Verizon's own guide for the CR1000A:

1. Browse to `http://192.168.1.1`.
2. Sign in with the router's admin password — on the sticker on the router, unless you changed it.
3. Click **Advanced**.
4. In the left pane, select **Security & Firewall**.
5. Click **Port Forwarding**.
6. Application name → `Valheim`.
7. Inbound ports → `2456` to `2457`.
8. Outbound ports → the same, `2456` to `2457`.
9. Forwarding destination address → `192.168.1.62`.
10. Protocol → **UDP**.
11. Schedule → **Always**.
12. Click **Add to list**.
13. Click **Apply Changes**.

> [!SECRET] router-admin-password | Fios router (CR1000A) admin password

Then find the address friends will use. In **Proxmox → 109 (valheim) → Console**:

```bash
curl -4 https://ifconfig.me
```

> [!INPUT] home-public-ip | Home public IP (Fios) | 203.0.113.10
> Verizon can change this address, though it rarely does. If it moves, friends need the new one — or the router's **Dynamic DNS** page, in the manual's Network Settings section, can keep a hostname pointed at it.

What the friend does:

1. In Valheim, on the **Join Game** tab, click **Join IP**.
2. Enter the public address followed by `:2456`.
3. Click **Connect**.
4. Enter the join password.

## Keep it healthy

### Add it to Uptime Kuma
At `http://192.168.1.57:3001`:

1. Click **Add New Monitor**.
2. **Monitor Type** → **Ping**.
3. **Friendly Name** → `Valheim`.
4. **Hostname** → `192.168.1.62`.
5. Click **Save**.

### See who is on
Nothing to set up: the game's own panel and the server's log already hold it. The image's status page and Steam's server browser are no help here, since both answer only for a public server, and even then leave player names blank.

From inside the game, connected to the server:

1. Press **F2** — the panel's **Players** list shows everyone connected, by character name, with each player's ID beside it. **F2** again closes it.

From **Proxmox → 109 (valheim) → Console**:

2. Ask whether anyone is on right now — the check the server itself runs before an update or its 5:10 restart, which watches the game's network traffic for three seconds:

```bash
docker exec valheim-server valheim-is-idle && echo "Nobody is on" || echo "Someone is on"
```

3. Read the comings and goings, newest last:

```bash
docker logs valheim-server 2>&1 | grep -E 'Got connection|ZDOID from|Closing socket|wrong password' | grep -v 'Running hook' | tail -40
```

> [!NOTE]
> Each line carries its time. What they mean:
>
> - **`Got connection SteamID`** — someone's game reached the server; the number after it is their Steam ID.
> - **`Got character ZDOID from`** — that player's character is in the world, under the name after it.
> - **`Closing socket`** — the Steam ID after it left.
> - **`has wrong password`** — a join that failed on the password.
>
> To put a person to a Steam ID, open `steamcommunity.com/profiles/` followed by the number in a browser — it lands on their Steam profile. The log reaches back to the server's last re-creation, so a settings change starts it afresh.

### Get a push when someone joins or leaves
The log lines above are the trigger: the two log-filter lines in the start script hand each one to a short script, which pushes **"Name joined"** or **"Name left"** to ntfy, the app that carries the Uptime Kuma alerts, using the character's name. A wrong password or a death pushes nothing.

> [!NOTE]
> These go to a topic of their own rather than the Kuma one, so game chatter never buries a house alert and either can be muted alone — and so the topic can be shared: a friend who installs ntfy and subscribes to it gets the same pushes and nothing else. The name is the only lock on an ntfy topic, which is why it comes from the password generator. Pasting the Kuma topic at step 10 instead also works, with both kinds of push in one list.

Make the topic, on the Mac and the iPhone:

1. In the Bitwarden extension on the Mac, open the **Generator** tab.
2. Set the type to **Password**.
3. Set **Length** to `32`.
4. Untick **!@#$%^&\*** — ntfy takes only letters, numbers, dashes and underscores.
5. Copy the result.
6. Add a new **Login** item named **Valheim · ntfy topic**, with the topic in its **Password** field, and save it.
7. In the ntfy app on the iPhone, tap **+** at the top right.
8. Paste the topic in **Topic name**, leave **Use another server** off, and tap **Subscribe**.

> [!SECRET] valheim-ntfy-topic | Valheim ntfy topic
> Anyone with this name can read the pushes and send fake ones — share it only with friends who should see who is on.

Then in **Proxmox → 109 (valheim) → Console**:

9. Start the prompt that saves the topic where the script reads it:

```bash
read -rp "Topic: " t && echo "$t" > /root/valheim-server/config/ntfy-topic
```

10. Paste the topic at the `Topic:` prompt and press **Enter**.
11. Write the script — paste it as-is:

```bash
cat > /root/valheim-server/config/players-notify.sh <<'EOF'
#!/bin/bash
# Run by the server's log filter with one log line on stdin;
# pushes "<character> joined" and "<character> left" to ntfy.
dir=/dev/shm/valheim-players
mkdir -p "$dir"
read -r line
case "$line" in
  *"Got connection SteamID "*)
    read -r id _ <<< "${line##*SteamID }"
    echo "${id//[^A-Za-z0-9_]/}" > "$dir/pending"
    exit 0 ;;
  *"Got character ZDOID from "*)
    [[ "$line" == *" : 0:0"* ]] && exit 0
    mv "$dir/pending" "$dir/claim.$$" 2>/dev/null || exit 0
    id=$(cat "$dir/claim.$$"); rm -f "$dir/claim.$$"
    name=${line##*ZDOID from }; name=${name%% : *}
    echo "$name" > "$dir/id-$id"
    msg="$name joined" ;;
  *"Closing socket "*)
    read -r id _ <<< "${line##*Closing socket }"
    id=${id//[^A-Za-z0-9_]/}
    [ "$(cat "$dir/pending" 2>/dev/null)" = "$id" ] && rm -f "$dir/pending"
    mv "$dir/id-$id" "$dir/gone.$$" 2>/dev/null || exit 0
    name=$(cat "$dir/gone.$$"); rm -f "$dir/gone.$$"
    msg="$name left" ;;
  *) exit 0 ;;
esac
curl -s -m 10 -o /dev/null -H "Title: Valheim" -d "$msg" "https://ntfy.sh/$(cat /config/ntfy-topic)"
EOF
```

12. Test the push without the game — three made-up log lines, which should bring **"Test joined"** and then **"Test left"** to the iPhone:

```bash
echo 'Got connection SteamID 1' | docker exec -i valheim-server bash /config/players-notify.sh
echo 'Got character ZDOID from Test : 1:1' | docker exec -i valheim-server bash /config/players-notify.sh
echo 'Closing socket 1' | docker exec -i valheim-server bash /config/players-notify.sh
```

13. Check the start script carries the two log-filter lines — `2` means it does and the server already runs with them, so skip to step 19; `0` means it was written before they joined it:

```bash
grep -c LOG_FILTER /root/valheim-run.sh
```

14. Only if it printed `0` — open the start script:

```bash
nano /root/valheim-run.sh
```

15. Add these two lines directly above the last line, the image line, `ghcr.io/community-valheim-tools/valheim-server`:

```bash
  -e VALHEIM_LOG_FILTER_REGEXP_Players="Got connection SteamID|Got character ZDOID from|Closing socket" \
  -e ON_VALHEIM_LOG_FILTER_REGEXP_Players="bash /config/players-notify.sh" \
```

16. Save with **Ctrl+O**, then **Enter**.
17. Close the editor with **Ctrl+X**.
18. Replace the running server with one built from the edited script — anyone playing drops for about a minute, and the world is untouched:

```bash
docker stop valheim-server && docker rm valheim-server && bash /root/valheim-run.sh
```

19. Prove it from the PC: join the server — a push reads your character's name and **joined**; quit to the main menu — another reads **left**.

> [!NOTE]
> How the script tells a join from a respawn: a fresh connection leaves the player's Steam ID waiting, and only the first character to enter the world after it claims it and pushes **joined** — a respawn after a death finds nothing waiting and stays quiet. The Steam ID it claimed is what later recognises the same player's **Closing socket** line as their exit. Its notes live in memory inside the server's container, so a restart starts them clean. If a real join pushes nothing while step 12 worked, run the log command in *See who is on* and compare its lines with the three made-up ones above.

### Stop and start it
Have everyone log out of the game first — *See who is on* confirms it — since a stop disconnects anyone still in, and their last seconds may not be saved. Then, in **Proxmox → 109 (valheim) → Console**, with the two commands below rather than the **Shutdown** and **Start** buttons at the top of the container's page — those stop and start the whole container, not the game server inside it:

1. Stop it — the stop is itself a save: the image hands the game the same interrupt Ctrl+C would, the game writes the world and then exits, and the two-minute stop timeout in the start script is the time it has. It prints the container's name when done:

```bash
docker stop valheim-server
```

2. See the save it made — a save is five numbered `World save` lines, and the last `World save (5/5) done` line, with its total time, is the one the stop triggered, and the proof that nothing played since the previous save was lost:

```bash
docker logs --tail 60 valheim-server 2>&1 | grep 'save (5/5)'
```

3. Start it — this returns at once, and the server takes about a minute to load the world and accept joins:

```bash
docker start valheim-server
```

4. Log back in. The last session's progress in place is the same proof from the game's side, worth seeing once before an update or a power cut makes it matter.

### If Shutdown was clicked instead
The console ends with `[EOF - dtach terminating]` and goes blank, because the container it was attached to is gone, and the game server went down with it. The world itself is safe on the container's disk; what is lost is the play since the game's last save, because a container shutdown does not hand the game the interrupt it saves on with time to use it — the first time this happened here it cost about ten minutes. With the start script's save interval, that is the most it can cost. In **Proxmox → 109 (valheim)**:

1. Click **Start** at the top of the page — the restart rule brings the game server back on its own, in about a minute.
2. Open **Console** and confirm it is up — the line for `valheim-server` should show an `Up` time:

```bash
docker ps
```

3. Log in and check the last session's progress is there.

### Force a save while playing
A stop saves on its own, so this is for the moments in between — before a fight that could go either way, or when a storm is knocking the lights. It is an admin command: the server takes it only from a character whose Steam ID is on the start script's admin list, which is you, and friends are covered by the ten-minute autosave. It runs from the game's console, which the game client only opens when it was launched with a flag. Once, on the PC, in **Steam → Library**:

1. Right-click **Valheim** → **Properties**.
2. On the **General** tab, in **Launch Options**, type `-console`, and close the window.

Then, in the game, connected to the server:

3. Press **F5** — the console opens.
4. Type `save` and press **Enter** — the console answers `Saving..` and nothing more, however long you wait; that is the server's acknowledgement, and the write itself is reported only in the server's log.
5. Read the log in **Proxmox → 109 (valheim) → Console** — a `World save (5/5) done` line stamped with the minute you typed the command is the save, and its total time, a fraction of a second on this world, is the stutter players felt:

```bash
docker logs --tail 60 valheim-server 2>&1 | grep 'save (5/5)'
```

### Change a setting later
Every setting, the join password included, is a line in the start script, handed to the server when its container is created — so a change means editing the script and recreating the container. The password is the usual reason; the steps are the same for any line. In **Proxmox → 109 (valheim) → Console**:

1. Edit the start script:

```bash
nano /root/valheim-run.sh
```

2. Change the value inside the quotes — for the password, the `-e SERVER_PASS="…"` line, keeping Valheim's rules: at least five characters, and not a string that appears inside the server name or the world name. A line added goes above the last line, the one naming the image, `ghcr.io/community-valheim-tools/valheim-server` — that line stays last and is the only one without a backslash at its end; every line above it ends in one.
3. Save with **Ctrl+O**, then **Enter**.
4. Close the editor with **Ctrl+X**.
5. Replace the running server with one built from the edited script — anyone playing drops for about a minute while it comes back, and the world is untouched, since it lives in the data folder the script mounts rather than in the container being replaced:

```bash
docker stop valheim-server && docker rm valheim-server && bash /root/valheim-run.sh
```

6. For a new password, update the Valheim join password field above and the vault item, and send friends the new one.

If step 5 answers `No such container: valheim-server`, the server was never started: the chain stops at `docker stop` because there is nothing to stop. Run the start script on its own, as in *Start it* above — `bash /root/valheim-run.sh` — which is also the right move after a first start that failed on a bad password.

### Updates
Nothing to run today — this step records how the server updates, for the Maintenance page's monthly walk, and the one command below is for the rare day the image's project page announces a release worth having.

> [!NOTE]
> Three layers update three ways. The game updates itself — the fifteen-minute Steam check in the container, applied only while nobody is connected — so a Valheim patch never strands friends on a mismatched version. The container's Debian layer updates in the Maintenance page's walk like every other guest. The server image itself changes rarely, and only matters when its project page announces a release worth having.

Let GitHub say when that day comes — it can email you for the image's releases and nothing else, with the account the Cameras page's HACS step created:

1. Open `https://github.com/community-valheim-tools/valheim-server-docker` and sign in.
2. Click **Watch**, near the top right.
3. Choose **Custom**.
4. Tick **Releases** only.
5. Click **Apply**.

Those emails go to the account's default address. To send them somewhere else — a different inbox, or the one your phone's mail app shows — GitHub routes everything from that organization to a verified address of your choice; its mobile app's push notifications never cover releases, so the phone sees them as mail:

6. If the address is new to GitHub, add it under your profile picture → **Settings** → **Emails**, and click the link GitHub mails to verify it.
7. Click the inbox icon at the top right of any GitHub page.
8. In the left sidebar, under the repositories, open the **Manage notifications** drop-down and click **Notification settings**.
9. Under **Default notifications email**, click **Custom routing**.
10. Click **Add new route**.
11. Open **Pick organization** and choose **community-valheim-tools**.
12. Select the verified address and click **Save**.

A release is worth having when its notes name a fix for something you have hit, a change the game's own updates need, or a security fix; most months bring no email, and the game stays current through the image's Steam check regardless. When one is worth it, pull the new image and rebuild the server from the same start script — the world is untouched, and anyone playing drops for about a minute:

```bash
docker pull ghcr.io/community-valheim-tools/valheim-server && docker stop valheim-server && docker rm valheim-server && bash /root/valheim-run.sh
```

> [!NOTE]
> Where the files live: the container's 32 GB disk is a slice of `local-lvm`, the **500 GB NVMe** that holds Proxmox itself and every guest's disk — so the server install, the world under `/root/valheim-server/config/worlds_local`, and the hourly zips are all on the NVMe. Neither IronWolf is involved day to day: the mirror pair only receives the nightly copy below, and the footage drive is Frigate's alone.
>
> Backups come from two directions:
>
> - **The hourly world backup, under `/root/valheim-server/config/backups`** — the image writes one every hour as a zip, kept seven days. Restoring one means stopping the server, unzipping that file, and copying the world's `.db` and `.fwl` back into `/root/valheim-server/config/worlds_local`.
> - **The nightly container backup, on the `nas-backups` share** — the Proxmox Backups page's nightly job copies the whole container, world included, there — the TrueNAS mirror of the two IronWolf drives.
>
> If the LAN is ever renumbered, the Renumber the LAN page carries this container's new address; Option B's router rule needs the new destination too, while Option A's tailnet address never changes. When nobody can join, the When Something Breaks page has the ladder.
