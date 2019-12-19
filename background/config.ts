const isMobile = !browser.windows;

export interface Config {
  /**
   * Enable announcing of user IP to the swarm
   */
  announceEnabled: boolean;
  /**
   * Enable webrtc discovery
   */
  wrtcEnabled: boolean;
  /**
   * Enable uploading data to peers
   */
  uploadEnabled: boolean;
}

export const DEFAULT_CONFIG: Config = {
  announceEnabled: false,
  wrtcEnabled: isMobile,
  uploadEnabled: false,
};

let configListeners = [];

export async function getConfig(): Promise<Config> {
  const config = Object.assign(
    {},
    DEFAULT_CONFIG,
    await browser.storage.local.get(Object.keys(DEFAULT_CONFIG)),
  );
  return config;
}

export async function setConfig(conf: Config) {
  await browser.storage.local.set({ ...conf });
  configListeners.forEach((listener) => listener(conf));
}

export function onConfigChanged(listener: (config: Config) => void) {
  configListeners.push(listener);
}
