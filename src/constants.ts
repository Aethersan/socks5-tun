import { getUserHome } from "./utils.ts";
import { $ } from "bun";

const gatewayIp = await $`ip route | awk '/default/ {print $3; exit}'`
  .text()
  .then((r) => r.trim());

const mainInterface = await $`ip route | grep default | awk '{print $5; exit}'`
  .quiet()
  .text()
  .then((r) => r.trim());

export const CONFIG = {
  mainInterface: process.env.MAIN_INTERFACE ?? mainInterface,
  gatewayIp: process.env.GATEWAY_IP ?? gatewayIp,
  port: process.env.PORT ?? 2080,
  tunDevice: process.env.TUN_DEVICE ?? "tun0",
  tunIp: process.env.TUN_IP ?? "198.18.0.1",
  tun2socksPath: process.env.TUN2SOCKS_PATH ?? `${getUserHome()}/bin/tun2socks`,
  lockFilePath: "/tmp/socks5-tun.lock",
  backupRoutes: "/tmp/vpn-backup-routes",
  showLogs: process.env.SHOW_LOGS?.toLowerCase() === "true",
};
