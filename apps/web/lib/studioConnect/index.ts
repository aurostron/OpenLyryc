/**
 * OpenLyryc Studio Connect: the page half of the direct-audio bridge to the
 * companion browser extension. The extension is maintained separately.
 */
export { BRIDGE_PROTOCOL, EVENTS_PORT, type BridgeEvent, type YtAuthState } from './bridge';
export type { Bridge, DetectedExtension } from './client';
export {
  getBridge,
  getStudioConnect,
  rescanStudioConnect,
  setStudioConnect,
  STUDIO_CONNECT_CHROMIUM_EXTENSION_ID,
} from './session';
export { ytAuthSnapshot, ensureYtAuth, refreshYtAuth, subscribeYtAuth, adoptYtAuth } from './auth';
export { trackLog } from './trackLog';
