import cac from "cac";
import { CONFIG } from "./constants.ts";
import { startTunnel } from "./tun.ts";
import { getAddresses } from "./utils.ts";

const cli = cac();

cli
  .command("run <address>, <port>", "Run the SOCKS5 tunnel (IPv4 address or presets: gateway, local)")
  .option("--show-logs [show-logs]", "Show tun2socks logs", { default: false })
  .option("--exclude", "IPv4 or CIDR to exclude from the tunnel (192.168.0.0/16,...)")
  .option("--exclude6", "IPv6 to exclude from the tunnel")
  .action((address, port, options) => {
    CONFIG.port = port;
    CONFIG.showLogs = options.showLogs;
    CONFIG.excludedAddresses.push(...getAddresses(options.exclude));
    CONFIG.excludedIPv6Addresses.push(...getAddresses(options.exclude6))
    if (address === "local") {
      CONFIG.address = "127.0.0.1";
    } else if (address !== "gateway") {
      CONFIG.address = address;
    }

    startTunnel();
  });

cli.help();

cli.version("1.2.0");

try {
  cli.parse();
  if (!cli.matchedCommand && cli.rawArgs.length <= 2) {
    cli.outputHelp();
  }
} catch (e: any) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
