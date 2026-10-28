import { $ } from "bun";
import { installTun2Socks } from "./utils.ts";
import { CONFIG } from "./constants.ts";
import fs from "fs";
import pc from "picocolors"

export async function startTunnel() {
  await init();
  await cleanup();

  console.log(pc.gray("Starting tunnel..."));
  const isLocalProxy = CONFIG.address === "127.0.0.1"
  try {
    await $`ip tuntap add mode tun dev tun0`.nothrow().quiet();
    await $`ip addr add 198.18.0.1/24 dev tun0`.nothrow();
    await $`ip -6 addr add fd42:1234:5678::1/126 dev tun0`;
    await $`ip link set dev tun0 up`.nothrow().quiet();

    await $`ip route add default dev tun0 table 200`;
    await $`ip -6 route add default dev tun0 table 200`;

    if (!isLocalProxy) {
      CONFIG.excludedAddresses.push(CONFIG.address);
    }
    for (const address of CONFIG.excludedAddresses) {
      await $`ip rule add to ${address} lookup main pref 10`;
    }
    for (const address of CONFIG.excludedIPv6Addresses) {
      await $`ip -6 rule add to ${address} lookup main pref 10`;
    }
    await $`ip rule add from all lookup main suppress_prefixlength 0 pref 15`;
    await $`ip rule add from all lookup 200 pref 32000`;
    await $`ip -6 rule add from all lookup main suppress_prefixlength 0 pref 15`;
    await $`ip -6 rule add from all lookup 200 pref 32000`;

    await $`sysctl -w net.ipv4.ip_default_ttl=65`.quiet()
    await $`sysctl -w net.ipv4.conf.all.rp_filter=0`.quiet();

    const tun2socksArgs = [
      CONFIG.tun2socksPath,
      "--loglevel",
      CONFIG.showLogs ? "info" : "error",
      "--device",
      "tun://tun0",
      "--proxy",
      `socks5://${CONFIG.address}:${CONFIG.port}`,
    ];

    if (!isLocalProxy) {
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

export async function init() {
  if (process.getuid?.() !== 0) {
    console.log(pc.red("This program must be run as root."));
    process.exit(1);
  }

  const { exitCode } = await $`ip route | grep "^default"`.nothrow().quiet();
  if (exitCode === 1) {
    console.log(pc.red("No default route detected: not connected to any network."));
    process.exit(1);
  }

  if (!Bun.which("tun2socks")) {
    console.log(pc.gray("Tun2socks not found, installing..."))
    await installTun2Socks()
  }

  const lockFile = Bun.file(CONFIG.lockFilePath);
  if (await lockFile.exists()) {
    const savedPid = await lockFile.text();
    try {
      process.kill(parseInt(savedPid), 0);
      console.error(pc.red("Another instance is already running."));
      process.exit(1);
    } catch (err: any) {
      if (err.code === "ESRCH") {
        console.log(pc.gray("Process not found, removing lock file."));
        fs.unlinkSync(CONFIG.lockFilePath);
      } else {
        console.error(err);
        process.exit(1);
      }
    }
  }

  await Bun.write(CONFIG.lockFilePath, process.pid.toString());

  const removeLockFile = () => {
    try {
      fs.unlinkSync(CONFIG.lockFilePath);
    } catch {}
  };

  process.on("exit", removeLockFile);
  process.on("SIGINT", () => {
    removeLockFile();
  });
  process.on("SIGTERM", () => {
    removeLockFile();
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception: ", err);
    removeLockFile();
  });

  process.on("SIGINT", async () => {
    await cleanup();
  });
  process.on("SIGTERM", async () => {
    await cleanup();
  });
}

let isCleaning = false;
export async function cleanup() {
  if (isCleaning) return;
  isCleaning = true;

  await $`ip rule del pref 32000`.nothrow().quiet();
  for (const address of CONFIG.excludedAddresses) {
    await $`ip rule del to ${address} lookup main pref 10`
      .nothrow()
      .quiet();
  }
  await $`ip rule del pref 15`.nothrow().quiet();

  await $`ip -6 rule del pref 32000`.nothrow().quiet();
  for (const address of CONFIG.excludedIPv6Addresses) {
    await $`ip -6 rule del to ${address} lookup main pref 10`
      .nothrow()
      .quiet();
  }
  await $`ip -6 rule del pref 15`.nothrow().quiet();

  await $`ip link set dev tun0 down`.nothrow().quiet();
  await $`ip link del dev tun0`.nothrow().quiet();

  await $`sysctl -w net.ipv4.ip_default_ttl=64`.quiet()
  await $`sysctl -w net.ipv4.conf.all.rp_filter=1`.quiet();

  isCleaning = false;
}
