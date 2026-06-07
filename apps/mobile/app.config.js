/** @type {import("expo/config").ExpoConfig} */
const appJson = require("./app.json");

/** Projet @misterh225/fermier-pro (npx eas init) */
const EAS_PROJECT_ID = "ebb8a3e5-e17a-4a66-ae0a-f7624ab6c12a";

const projectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
  appJson.expo?.extra?.eas?.projectId?.trim() ||
  EAS_PROJECT_ID;

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo?.extra ?? {}),
      eas: {
        ...(appJson.expo?.extra?.eas ?? {}),
        ...(projectId ? { projectId } : {})
      }
    }
  }
};
