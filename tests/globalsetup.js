import Zemu from "../src";

const catchExit = async () => {
  process.on("SIGINT", () => {
    Zemu.stopAllEmuContainers(function () {
      process.exit();
    });
  });
};

module.exports = async () => {
  await catchExit();
  await Zemu.stopAllEmuContainers();
};
