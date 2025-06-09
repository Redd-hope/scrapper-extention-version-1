// background.js

// Make the event listener an async function to use await
chrome.action.onClicked.addListener(async () => {
  try {
    // Get information about all connected displays
    const displayInfo = await chrome.system.display.getInfo();

    // We'll typically use the primary display for positioning
    // You might want to add logic to pick a specific display if multiple are connected
    const primaryDisplay = displayInfo.find(display => display.isPrimary) || displayInfo[0];

    if (!primaryDisplay) {
      console.error("No display information found.");
      return;
    }

    const screenWidth = primaryDisplay.bounds.width;
    const screenHeight = primaryDisplay.bounds.height;

    const windowWidth = 1700;
    const windowHeight = 900;

    // Calculate left position to center the window horizontally on the primary screen
    const left = Math.round((screenWidth - windowWidth) / 2);
    // Calculate top position, for example, 10px from the top
    const top = 100;

    // Create the window with calculated position
    chrome.windows.create({
      url: chrome.runtime.getURL("t.html"),
      type: "popup",
      width: windowWidth,
      height: windowHeight,
      left: left,
      top: top,
      focused: true
    }, (win) => {
      if (chrome.runtime.lastError) {
        console.error("Error creating window:", chrome.runtime.lastError.message);
      } else {
        console.log("Custom window created:", win);
      }
    });

  } catch (error) {
    console.error("Error getting display info or creating window:", error);
  }
});