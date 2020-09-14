import Zemu from "../src";

const catchExit = async () => {
  process.on("SIGINT", async () => {
    await Zemu.stopAllEmuContainers();
  });
};

module.exports = async () => {
  await catchExit();
  await Zemu.checkAndPullImage();
  await Zemu.stopAllEmuContainers();
};
