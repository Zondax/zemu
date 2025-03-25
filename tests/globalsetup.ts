import Zemu from "../src";

const catchExit = async () => {
  process.on("SIGINT", () => {
    console.log("Stopping dangling containers");
    Zemu.stopAllEmuContainers();
  });
};

// Export as default for Vitest
export default async () => {
  await catchExit();
};
