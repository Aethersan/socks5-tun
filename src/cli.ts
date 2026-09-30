import cac from "cac";
import { CONFIG } from "./constants.ts";
import { startTunnel } from "./tun.ts";

const cli = cac();

cli
  .command(
    "run <address>, <port>",
    "Run the SOCKS5 tunnel (address presets: gateway, local)",
  )
  .option("--show-logs [show-logs]", "Show tun2socks logs", { default: false })
  .action((address, port, options) => {
    CONFIG.port = port;
    CONFIG.showLogs = options.showLogs;
    if (address === "local") {
      CONFIG.gatewayIp = "127.0.0.1";
    } else if (address !== "gateway") {
      CONFIG.gatewayIp = address;
    }

    startTunnel();
  });

cli.help();

cli.version("1.0.0");

try {
  cli.parse();
  if (!cli.matchedCommand && cli.rawArgs.length <= 2) {
    cli.outputHelp();
  }
} catch (e: any) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
