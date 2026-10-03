const { spawn } = require("node:child_process");

function spawnFile(command, args) {
  return new Promise((resolve) => {
    let output = "";
    let errorText = "";
    const child = spawn(command, args, { shell: false, windowsHide: true });
    child.stdout?.on("data", (data) => { output += data.toString(); });
    child.stderr?.on("data", (data) => { errorText += data.toString(); });
    child.on("error", (error) => resolve({ code: null, output, error: error.message }));
    child.on("close", (code) => resolve({ code, output, error: errorText.trim() }));
  });
}

module.exports = { spawnFile };
