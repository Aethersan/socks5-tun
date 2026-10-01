import { $ } from "bun";

const routes = await $`ip -j route show`.quiet().json()
const defaultRoute = routes.find((route: any) => route.dst === "default")

const address = defaultRoute.gateway
const mainInterface = defaultRoute.dev

export const CONFIG = {
  mainInterface,
  address,
  port: 2080,
  tunDevice: "tun0",
  tunIp: "198.18.0.1",
  tun2socksPath: `/usr/local/bin/tun2socks`,
  lockFilePath: "/tmp/socks5-tun.lock",
  showLogs: false,
};
