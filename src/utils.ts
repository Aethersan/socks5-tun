import { $ } from "bun";

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
