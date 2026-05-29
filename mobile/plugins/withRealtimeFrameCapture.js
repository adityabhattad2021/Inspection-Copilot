const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const MODULE_FILES = [
  "RealtimeFrameCaptureModule.java",
  "RealtimeFrameCapturePackage.java",
];

function patchMainApplication(contents) {
  if (contents.includes("add(RealtimeFrameCapturePackage())")) {
    return contents;
  }

  const commentMarker =
    "              // add(MyReactNativePackage())";
  if (contents.includes(commentMarker)) {
    return contents.replace(
      commentMarker,
      `${commentMarker}\n              add(RealtimeFrameCapturePackage())`,
    );
  }

  const applyMarker = "PackageList(this).packages.apply {\n";
  if (contents.includes(applyMarker)) {
    return contents.replace(
      applyMarker,
      `${applyMarker}              add(RealtimeFrameCapturePackage())\n`,
    );
  }

  throw new Error("Could not patch MainApplication.kt with RealtimeFrameCapturePackage.");
}

function withRealtimeFrameCapture(config) {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const packageName = modConfig.android?.package;
      if (!packageName) {
        throw new Error("Android package name is required for RealtimeFrameCapture.");
      }

      const packagePath = packageName.replace(/\./g, path.sep);
      const targetDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        packagePath,
      );
      fs.mkdirSync(targetDir, { recursive: true });

      const sourceDir = path.join(
        projectRoot,
        "plugins",
        "realtime-frame-capture",
        "android",
      );
      for (const fileName of MODULE_FILES) {
        fs.copyFileSync(
          path.join(sourceDir, fileName),
          path.join(targetDir, fileName),
        );
      }

      const mainApplicationPath = path.join(targetDir, "MainApplication.kt");
      const mainApplication = fs.readFileSync(mainApplicationPath, "utf8");
      fs.writeFileSync(
        mainApplicationPath,
        patchMainApplication(mainApplication),
      );

      return modConfig;
    },
  ]);
}

module.exports = withRealtimeFrameCapture;
