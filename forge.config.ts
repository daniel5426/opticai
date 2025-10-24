import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { PublisherGithub } from "@electron-forge/publisher-github";

const config: ForgeConfig = {
  packagerConfig: {
    asar: false, // Disable ASAR to test if it's causing performance issues
    name: "Prysm",
    executableName: "prysm",
    appBundleId: "com.prysm.app",
    icon: "./images/prysm-logo", // Will use .ico on Windows, .icns on macOS
    extraResource: [
      ".env.production"
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: "Prysm",
      setupExe: "Prysm-Setup.exe",
      // Remove icon for now - Windows installer will work without it
      // setupIcon: "./images/prysm-logo.png",
    }),
    new MakerZIP({}, ["darwin"]),
    // DMG disabled due to Apple Silicon compatibility issues
    // new MakerDMG({
    //   name: "OpticAI",
    //   icon: "./images/prysm-logo.png",
    //   format: "ULFO"
    // }, ["darwin"]),
    new MakerRpm({
      options: {
        name: "prysm",
        productName: "Prysm",
      }
    }),
    new MakerDeb({
      options: {
        name: "prysm",
        productName: "Prysm",
      }
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: "daniel5426",  // Replace with your GitHub username
        name: "opticai",  // Replace with your repository name
      },
      prerelease: false,
      draft: true,  // Creates as draft initially for review
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),

    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      // Disabled ASAR-related fuses since ASAR is disabled
      // [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      // [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
