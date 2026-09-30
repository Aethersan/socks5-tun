import { CONFIG } from "./constants";
import { $ } from "bun";
import fs from "fs";

export async function init() {
  if (process.getuid?.() !== 0) {
    console.log("This program must be run as root.");
    process.exit(1);
  }

  const { exitCode } = await $`ip route | grep "^default"`.nothrow().quiet();
  if (exitCode === 1) {
    console.log("No default route detected: not connected to any network.");
    process.exit(1);
  }

  const lockFile = Bun.file(CONFIG.lockFilePath);
  if (await lockFile.exists()) {
    const savedPid = await lockFile.text();
    try {
      process.kill(parseInt(savedPid), 0);
      console.error("Another instance is already running.");
      process.exit(1);
    } catch (err: any) {
      if (err.code === "ESRCH") {
        console.log("Process not found, removing lock file.");
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
  await $`ip rule del to ${CONFIG.gatewayIp} lookup main pref 10`
    .nothrow()
    .quiet();
  await $`ip rule del pref 15`.nothrow().quiet();

  await $`ip link set dev tun0 down`.nothrow().quiet();
  await $`ip link del dev tun0`.nothrow().quiet();

  await $`sysctl -w net.ipv4.conf.all.rp_filter=1`.quiet();

  isCleaning = false;
}
