import { $ } from "bun";
import { checkInstances } from "./utils.ts";
import { CONFIG } from "./constants.ts";
import { cleanup } from "./utils.ts";

if (process.getuid?.() !== 0) {
  console.log("This program must be run as root.");
  process.exit(1);
}

const { exitCode } = await $`ip route | grep -q "^default"`.nothrow().quiet();
if (exitCode === 1) {
  console.log("No default route detected: not connected to any network.");
  process.exit(1);
}

const STATUS = {
  tunnelProcess: null as Bun.Subprocess | null,
  isTunnelUp: false,
};

await checkInstances();

async function startTunnel() {
  if (STATUS.isTunnelUp) return;
  await cleanup()
  console.log("Starting tunnel...");

  if (!CONFIG.gatewayIp) {
    console.log("No gateway IP found: not connected to any network.");
    return;
  }

  try {
    await $`ip tuntap add mode tun dev tun0`.nothrow().quiet();
    await $`ip addr add 198.18.0.1/24 dev tun0`.nothrow();
    await $`ip link set dev tun0 up`.nothrow().quiet();

    await $`ip route add default dev tun0 table 200`
    await $`ip rule add to ${CONFIG.gatewayIp} lookup main pref 10`;
    await $`ip rule add from all lookup main suppress_prefixlength 0 pref 15`;
    await $`ip rule add from all lookup 200 pref 32000`;

    await $`sysctl -w net.ipv4.conf.all.rp_filter=0`.quiet();

    STATUS.tunnelProcess = Bun.spawn(
      [
        CONFIG.tun2socksPath,
        "--loglevel",
        (CONFIG.showLogs ? "info" : "error"),
        "--device",
        "tun://tun0",
        "--interface",
        CONFIG.mainInterface,
        "--proxy",
        `socks5://${CONFIG.gatewayIp}:${CONFIG.port}`,
      ],
    );

    STATUS.isTunnelUp = true;
    console.log("Tunnel started successfully");
  } catch (err) {
    console.log("Failed to start tunnel:", err);
    await cleanup();
  }
}

process.on("SIGINT", async () => {
  await cleanup();
});
process.on("SIGTERM", async () => {
  await cleanup();
});

await startTunnel();
