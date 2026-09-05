import { useEffect, useState } from "react";
import * as store from "../lib/storage";
import type { Theme } from "../lib/storage";
import { ArrowLeft, Copy, Check } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
};

/**
 * One row of the build's addressing plan.
 *
 * `credKey` ties a row to the credential field the guides record it in, so this
 * view shows what you actually set rather than what the guide assumed — the two
 * drift the moment a container lands on a different ID or address.
 */
type Row = {
  /**
   * Canonical address from the guides; the fallback when nothing is recorded.
   * Empty means the value only exists once Tailscale issues it — there is no
   * sensible default to show, so the row reads as pending instead.
   */
  ip: string;
  name: string;
  /** Proxmox guest ID, where the thing is a guest. */
  id?: string;
  /** How you reach it, with `{ip}` standing in for the resolved address. */
  reach?: string;
  /** Subdomain the Reverse Proxy page gives it. */
  proxied?: string;
  credKey?: string;
  note?: string;
};

const GUESTS: Row[] = [
  { ip: "192.168.1.50", name: "Proxmox host (pve)", reach: "https://{ip}:8006", proxied: "proxmox.", credKey: "proxmox-ip" },
  { ip: "192.168.1.20", name: "TrueNAS", id: "VM 100", reach: "http://{ip}", proxied: "nas.", credKey: "truenas-ip" },
  { ip: "192.168.1.51", name: "Home Assistant OS", id: "VM 101", reach: "http://{ip}:8123", proxied: "ha.", credKey: "ha-ip" },
  { ip: "192.168.1.52", name: "Frigate", id: "LXC 102", reach: "https://{ip}:8971", proxied: "frigate.", credKey: "frigate-ip" },
  { ip: "192.168.1.53", name: "AdGuard Home", id: "LXC 103", reach: "http://{ip}", credKey: "adguard-ip", note: "also answers DNS on 53" },
  { ip: "192.168.1.54", name: "Nginx Proxy Manager", id: "LXC 104", reach: "http://{ip}:81", credKey: "proxy-ip", note: "serves the house on 80 / 443" },
  { ip: "192.168.1.55", name: "Homepage", id: "LXC 107", reach: "http://{ip}:3000", proxied: "home.", credKey: "homepage-ip" },
  { ip: "192.168.1.56", name: "Vaultwarden", id: "LXC 106", reach: "http://{ip}:8000", proxied: "vault.", credKey: "vaultwarden-ip" },
  { ip: "192.168.1.57", name: "Uptime Kuma", id: "LXC 108", reach: "http://{ip}:3001", proxied: "status.", credKey: "kuma-ip" },
  { ip: "192.168.1.58", name: "Nextcloud (NCP)", id: "LXC 105", reach: "https://{ip}", proxied: "cloud.", credKey: "nextcloud-ip", note: "NCP panel on 4443" },
  { ip: "192.168.1.59", name: "Ollama", id: "LXC", reach: "port 11434", credKey: "ollama-ip", note: "Voice page — no web UI" },
  { ip: "192.168.1.60", name: "faster-whisper", id: "LXC", reach: "port 10300", credKey: "whisper-ip", note: "Voice page — no web UI" },
];

const TAILNET: Row[] = [
  {
    ip: "",
    name: "Proxmox host, on the tailnet",
    reach: "https://{ip}:8006",
    credKey: "pve-tailscale-ip",
    note: "the one address that does not depend on the subnet route",
  },
  {
    ip: "100.100.100.100",
    name: "MagicDNS resolver",
    note: "Tailscale's own; answers .ts.net names even when AdGuard is down",
  },
];

const DEVICES: Row[] = [
  { ip: "192.168.1.1", name: "Fios router", note: "gateway and DHCP" },
  { ip: "192.168.1.61", name: "Lutron Caséta Pro bridge", note: "static set in the Lutron app" },
  { ip: "192.168.1.70", name: "Reolink Video Doorbell", credKey: "doorbell-ip", note: "Wi-Fi" },
  { ip: "192.168.1.71", name: "Reolink RLC-510WA", credKey: "camera-ip", note: "Wi-Fi, 2nd indoor" },
  { ip: "192.168.1.72", name: "shed_turret", note: "EmpireTech PoE" },
  { ip: "192.168.1.73", name: "carport_turret", note: "EmpireTech PoE" },
  { ip: "192.168.1.74", name: "patio_turret", note: "EmpireTech PoE" },
  { ip: "192.168.1.75", name: "chimney_turret", note: "EmpireTech PoE" },
  { ip: "192.168.1.76", name: "kitchen_turret", note: "Color4K indoor PoE" },
  { ip: "192.168.1.98", name: "— not a device —", note: "dead-end gateway given to every camera so it cannot reach the internet" },
];

/** Resolve a row to the address actually in use: recorded value wins. */
function addressOf(row: Row, creds: Record<string, string>): string {
  const recorded = row.credKey ? (creds[row.credKey] ?? "").trim() : "";
  return recorded || row.ip;
}

function RowCard({
  row,
  creds,
  domain,
}: {
  row: Row;
  creds: Record<string, string>;
  domain: string;
}) {
  const ip = addressOf(row, creds);
  const pending = ip === "";
  const drifted = !pending && row.ip !== "" && ip !== row.ip;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — the address is on screen either way */
    }
  };

  return (
    <div className="rb-card flex items-center gap-3 px-3 py-2.5">
      {pending ? (
        <span className="w-[9.5rem] shrink-0 font-mono text-sm italic text-ink-faint">
          not recorded
        </span>
      ) : (
        <button
          type="button"
          onClick={copy}
          title={`Copy ${ip}`}
          aria-label={`Copy ${ip}`}
          className="group flex w-[9.5rem] shrink-0 items-center gap-1.5 text-left"
        >
          <span className="font-mono text-sm tabular-nums text-ink">{ip}</span>
          <span className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </span>
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium leading-snug text-ink">
            {row.name}
          </span>
          {row.id && (
            <span className="font-mono text-[11px] text-ink-faint">{row.id}</span>
          )}
          {drifted && (
            <span className="font-mono text-[11px] text-accent">
              guide says {row.ip}
            </span>
          )}
        </div>
        {(row.reach || row.note || row.proxied) && (
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] leading-snug text-ink-soft">
            {row.reach && !pending && (
              <span className="font-mono">{row.reach.replace("{ip}", ip)}</span>
            )}
            {row.proxied && (
              <span className="font-mono text-ink-faint">
                {row.proxied}
                {domain}
              </span>
            )}
            {row.note && <span className="text-ink-faint">{row.note}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function NetworkMapView({ theme, onToggleTheme, onBack }: Props) {
  const [creds, setCreds] = useState<Record<string, string>>(() =>
    store.getCredentials(),
  );
  useEffect(
    () => store.onCredentialsChange(() => setCreds(store.getCredentials())),
    [],
  );

  const domain = (creds["domain-name"] ?? "").trim() || "kuzco.org";
  const tailnet = (creds["tailnet-name"] ?? "").trim();

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <header className="flex items-start justify-between gap-3 py-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to library"
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold leading-none text-ink">
              Addressing Plan
            </h1>
            <p className="mt-1 font-mono text-xs text-ink-faint">
              every guest, camera and port · tap an address to copy
            </p>
          </div>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        <strong className="text-ink">.2–.99 is reserved static territory</strong>{" "}
        and the router's DHCP pool is shrunk to <code>.100–.254</code>, so
        nothing here can ever be handed to a phone. Addresses you have recorded
        in Credentials show here instead of the guide's default, flagged when the
        two differ.
      </p>

      <main className="mt-6 space-y-8">
        <section aria-label="The server and its guests">
          <h2 className="mb-1 px-1 font-display text-[1.05rem] font-semibold leading-none text-ink">
            The server and its guests
          </h2>
          <p className="mb-3 px-1 text-[13px] leading-snug text-ink-faint">
            Reachable by address always, and by name once the Reverse Proxy page
            runs.
          </p>
          <div className="space-y-2">
            {GUESTS.map((row) => (
              <RowCard key={row.ip} row={row} creds={creds} domain={domain} />
            ))}
          </div>
        </section>

        <section aria-label="Cameras and network gear">
          <h2 className="mb-1 px-1 font-display text-[1.05rem] font-semibold leading-none text-ink">
            Cameras and network gear
          </h2>
          <p className="mb-3 px-1 text-[13px] leading-snug text-ink-faint">
            The five PoE turrets ride the GS308EPP; the doorbell and RLC-510WA
            are on Wi-Fi.
          </p>
          <div className="space-y-2">
            {DEVICES.map((row) => (
              <RowCard key={row.ip} row={row} creds={creds} domain={domain} />
            ))}
          </div>
        </section>

        <section aria-label="Remote access">
          <h2 className="mb-1 px-1 font-display text-[1.05rem] font-semibold leading-none text-ink">
            Remote access — Tailscale
          </h2>
          <p className="mb-3 px-1 text-[13px] leading-snug text-ink-faint">
            Settings live only at{" "}
            <a
              href="https://login.tailscale.com/admin"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              login.tailscale.com/admin
            </a>
            {tailnet && (
              <>
                {" "}
                — this tailnet is{" "}
                <span className="font-mono text-ink-soft">{tailnet}</span>, so
                the host also answers at{" "}
                <span className="font-mono text-ink-soft">pve.{tailnet}</span>
              </>
            )}
            .
          </p>
          <div className="space-y-2">
            {TAILNET.map((row) => (
              <RowCard key={row.name} row={row} creds={creds} domain={domain} />
            ))}
          </div>
          <p className="mt-3 px-1 text-[13px] leading-relaxed text-ink-soft">
            Every <code>192.168.1.x</code> address above also works from away,
            carried by the <strong className="text-ink">subnet route</strong> the
            Proxmox host advertises — which is why nothing else on this page
            needs a second, remote address.
          </p>
        </section>

        <section aria-label="Boot order">
          <h2 className="mb-1 px-1 font-display text-[1.05rem] font-semibold leading-none text-ink">
            Boot order
          </h2>
          <p className="px-1 text-[13px] leading-relaxed text-ink-soft">
            Set on each guest's Options tab:{" "}
            <strong className="text-ink">TrueNAS 1</strong> →{" "}
            <strong className="text-ink">Home Assistant 2</strong> →{" "}
            <strong className="text-ink">Frigate 3</strong>. Storage comes up
            first and shuts down last; Frigate follows Home Assistant because it
            publishes to the MQTT broker living there. Everything unnumbered
            stops before any numbered guest.
          </p>
        </section>
      </main>
    </div>
  );
}
