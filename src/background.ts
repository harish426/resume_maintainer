chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ loggedIn: true });
});

// Open the side panel on the current tab when the extension icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
