// Native init: runs the Google Mobile Ads SDK once when this module is imported.
import mobileAds from "react-native-google-mobile-ads";

mobileAds()
  .initialize()
  .then((adapterStatuses: unknown) => {
    console.log("[AdMob] SDK initialised", adapterStatuses);
  })
  .catch((e: unknown) => console.log("[AdMob] init failed:", e));

export {};
