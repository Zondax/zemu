import Zemu from "../src";

const catchExit = async () => {
  process.on("SIGINT", () => {
    console.log("Stopping dangling containers");
    Zemu.stopAllEmuContainers();
  });
};

module.exports = async () => {
  console.log("Executing tasks before starting the test suites");

  await catchExit();
  await Zemu.checkAndPullImage();
  await Zemu.stopAllEmuContainers();
};
