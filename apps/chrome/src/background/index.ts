// Service worker: owns the WebSocket connection to the core and routes messages to content ports.
// Never logs field text or issue contents.
import { loadSettings, onSettingsChanged } from "../shared/extension-settings";
import { contentPortName, StatusRequest, type StatusResponse } from "../shared/port-messages";
import { ContentPortHub } from "./content-port.hub";
import { CoreConnection } from "./core-connection.client";

let hub: ContentPortHub | undefined;

const connection = new CoreConnection({
  onMessage: (message) => hub?.fromCore(message),
  onStatus: (status) => hub?.setStatus(status),
});
hub = new ContentPortHub((message) => connection.send(message));

// Listeners are registered synchronously so the worker wakes for them after being stopped.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== contentPortName || port.sender?.id !== chrome.runtime.id) return;
  hub?.attach(port);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !StatusRequest.safeParse(message).success) return;
  const check = hub?.checkModel;
  const response: StatusResponse = { status: connection.status, ...(check ? { check } : {}) };
  sendResponse(response);
});

onSettingsChanged((settings) => connection.configure(settings));
void loadSettings().then((settings) => connection.configure(settings));
