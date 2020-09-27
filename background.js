chrome.runtime.onInstalled.addListener(function () {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "dialpad.com" },
          }),
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()],
      },
    ]);
  });
});

async function getUserData(url, headers) {
  const response = await fetch(url + "?replay", {
    headers: { ...headers, "request-timestamp": Date.now() },
    referrer: "https://dialpad.com/accounts",
    referrerPolicy: "no-referrer-when-downgrade",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed user data fetch (${response.status})`);
  }

  return await response.json();
}

// listen for real (user-created) XHR for user data
chrome.webRequest.onBeforeSendHeaders.addListener(
  async function (details) {
    // bail when we catch our own replay
    var match = details.url.match(
      /^https?:\/\/dialpad.com\/api\/user\/([^/?]+)$/
    );
    if (match) {
      console.log("onBeforeSendHeaders", details);
    } else {
      console.log("No match for XHR to URL: " + details.url);
      return;
    }

    // ensure we have headers
    const requestHeaders = details.requestHeaders;
    if (!requestHeaders) {
      throw new Error("No request headers captured in XHR call to " + details.url);
    }

    // clone headers from initial request
    const headers = {};
    requestHeaders.forEach((obj) => {
      headers[obj.name] = obj.value;
    });

    // repeat this XHR request to get the full response body (the user data)
    const allUserData = await getUserData(details.url, headers);
    console.log("Found user data: ", allUserData);

    // trim down the user data we push into local storage
    const { id, call_center_count, display_name, group_details, image_url, primary_email } = allUserData;
    const call_center_ids = group_details.map(group => group.id);
    const userData = { id, call_center_count, call_center_ids, display_name, image_url, primary_email };

    // store data locally for content script to use
    const data = { userData, headers };
    console.log('Setting local storage', data);
    chrome.storage.local.set(data);
  },
  { urls: ["https://dialpad.com/api/user/*"] },
  ["requestHeaders"]
);
