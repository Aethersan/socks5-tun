import { $ } from "bun";
import { init } from "./utils.ts";
import { CONFIG } from "./constants.ts";
import { cleanup } from "./utils.ts";
import pc from "picocolors";

export async function startTunnel() {
  await init();
  await cleanup();

  console.log(pc.gray("Starting tunnel..."));
  try {
    await $`ip tuntap add mode tun dev tun0`.nothrow().quiet();
    await $`ip addr add 198.18.0.1/24 dev tun0`.nothrow();
    await $`ip link set dev tun0 up`.nothrow().quiet();

    await $`ip route add default dev tun0 table 200`;
    await $`ip rule add to ${CONFIG.gatewayIp} lookup main pref 10`;
    await $`ip rule add from all lookup main suppress_prefixlength 0 pref 15`;
    await $`ip rule add from all lookup 200 pref 32000`;

    await $`sysctl -w net.ipv4.conf.all.rp_filter=0`.quiet();

    const tun2socksArgs = [
      CONFIG.tun2socksPath,
      "--loglevel",
      CONFIG.showLogs ? "info" : "error",
      "--device",
      "tun://tun0",
      "--proxy",
      `socks5://${CONFIG.gatewayIp}:${CONFIG.port}`,
    ];

    if (CONFIG.gatewayIp !== "127.0.0.1") {
      tun2socksArgs.push("--interface", CONFIG.mainInterface);
    }

    Bun.spawn(tun2socksArgs);

    console.log(pc.green("Tunnel started successfully"));
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.log(pc.red("Error: tun2socks not found"));
    } else {
      console.log(pc.red("Failed to start tunnel:\n"), err);
    }
    await cleanup();
  }
}
