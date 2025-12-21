import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function main() {
  try {
    execSync("lsof -ti:3001 | xargs -r kill -9", { stdio: "ignore" });
  } catch (_) {
    // best-effort
  }

  log(colors.blue, "\nStopping Anvil...\n");

  const pidFile = path.join(__dirname, ".anvil.pid");

  if (fs.existsSync(pidFile)) {
    const pid = fs.readFileSync(pidFile, "utf-8").trim();

    try {
      process.kill(parseInt(pid), "SIGTERM");
      fs.unlinkSync(pidFile);
      log(colors.green, `Stopped Anvil (PID: ${pid})`);
    } catch (error) {
      if (error.code === "ESRCH") {
        log(colors.yellow, `Process ${pid} not found (already stopped)`);
        fs.unlinkSync(pidFile);
      } else {
        log(colors.red, `Failed to stop Anvil: ${error.message}`);
      }
    }
  } else {
    log(colors.yellow, "No Anvil PID file found");
    log(colors.yellow, "Attempting to kill any anvil processes...");

    try {
      const { execSync } = await import("child_process");
      execSync("pkill -f anvil", { stdio: "ignore" });
      log(colors.green, "Stopped Anvil processes");
    } catch (error) {
      log(colors.yellow, "No anvil processes found");
    }
  }

  console.log("");
  log(colors.green, "Cleanup complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log(colors.red, "\nTeardown failed:", error.message);
    process.exit(1);
  });

