import { $ } from "bun";

const routes = await $`ip -j route show`.quiet().json();
const defaultRoute = routes.find((route: any) => route.dst === "default");

const address = defaultRoute?.gateway;
const mainInterface = defaultRoute?.dev;

interface ConfigType {
  mainInterface: string;
  address: string;
  port: number;
  tun2socksPath: string;
  lockFilePath: string;
  showLogs: boolean;
  excludedAddresses: string[];
  excludedIPv6Addresses: string[]
}

export const CONFIG: ConfigType = {
  mainInterface,
  address,
  port: 2080,
  tun2socksPath: `/usr/local/bin/tun2socks`,
  lockFilePath: "/tmp/socks5-tun.lock",
  showLogs: false,
  excludedAddresses: [
    "127.0.0.0/8",
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "169.254.0.0/16",
    "224.0.0.0/4"
  ],
  excludedIPv6Addresses: [
    "::1/128",
    "fc00::/7",
    "fe80::/10",
    "ff00::/8",
  ],
};
