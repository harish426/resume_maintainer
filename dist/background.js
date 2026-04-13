chrome.runtime.onInstalled.addListener(()=>{chrome.storage.local.set({loggedIn:!0})});chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:!0}).catch(e=>console.error(e));
