import { CONFIG } from "./constants";
import { $ } from "bun";
import fs from "fs";
import pc from "picocolors"

export async function installTun2Socks() {
  const version = "2.7.0"
  const arch = process.arch === "x64" ? "amd64" : "arm64"
  const url = `https://github.com/xjasonlyu/tun2socks/releases/download/v${version}/tun2socks-linux-${arch}.zip`
  const path = "/usr/local/bin/tun2socks"

  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTTP Error: ${response.status}`)

  await Bun.write("/tmp/tun2socks.zip", response)
  await $`unzip -o /tmp/tun2socks.zip`.nothrow()

  await $`mv /tmp/tun2socks-linux-${arch} ${path}`.nothrow()
  await $`chmod +x ${path}`.nothrow()
  await $`rm /tmp/tun2socks.zip`.nothrow().quiet()
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
  await $`ip rule del to ${CONFIG.address} lookup main pref 10`
    .nothrow()
    .quiet();
  await $`ip rule del pref 15`.nothrow().quiet();

  await $`ip link set dev tun0 down`.nothrow().quiet();
  await $`ip link del dev tun0`.nothrow().quiet();

  await $`sysctl -w net.ipv4.conf.all.rp_filter=1`.quiet();

  isCleaning = false;
}
