function alphabeticallyBy(property) {
  return function (a, b) {
    if (a[property] < b[property]) {
      return -1;
    }
    if (a[property] > b[property]) {
      return 1;
    }
    return 0;
  };
}

function difference(setA, setB) {
  let _difference = new Set(setA);
  for (let elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
}

async function xhr(url, headers, method = "GET", body = null) {
  const response = await fetch(url, {
    headers: { ...headers, "request-timestamp": Date.now() },
    referrer: "https://dialpad.com/accounts",
    referrerPolicy: "no-referrer-when-downgrade",
    body,
    method,
    mode: "cors",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed XHR ${method} to ${url} (${response.status})`);
  }

  return await response.json();
}

const timeout = (ms) => new Promise((res) => setTimeout(res, ms));

async function modifyMembership(userId, callCenterId, add, headers, delayMs) {
  await timeout(delayMs);

  const url = `https://dialpad.com/api/operator/${userId}?group_id=${callCenterId}`;
  const body = add ? { add: true, skill_level: 100 } : { remove: true };

  console.log(`Will ${add ? "add" : "remove"} ${callCenterId}`);

  return xhr(url, headers, "PATCH", JSON.stringify(body));
}

async function modifyMemberships(userId, callCenterIds, add, headers) {
  console.log(
    `Will ${add ? "add" : "remove"} ${callCenterIds.size} call centers`
  );

  const SPACING_MS = add ? 325 : 750; // rough empirical observations
  const promises = Array.from(callCenterIds).map((callCenterId, i) =>
    modifyMembership(userId, callCenterId, add, headers, i * SPACING_MS)
  );

  return Promise.all(promises);
}

async function refreshUserData(_app) {
  const url = `https://dialpad.com/api/user/${_app.userId}?replay`;
  const { display_name, group_details, primary_email } = await xhr(
    url,
    _app.headers
  );
  const call_center_ids = group_details.map((group) => group.id);
  const userData = {
    call_center_ids,
    display_name,
    primary_email,
    isLoaded: true,
  };

  _app.userData = userData;
}

async function refreshCallCenterDefs(_app) {
  const url = "https://dialpad.com/api/group";
  const callCenterDefs = await xhr(url, _app.headers);

  _app.callCenterDefs = callCenterDefs.sort(alphabeticallyBy("display_name"));
}

// load up the most recent way we had the check boxes checked
function refreshCheckedCallCenterIds(_app) {
  chrome.storage.sync.get(["checkedCallCenterIds"], (value) => {
    console.log("Stored value (sync): ", value);
    const { checkedCallCenterIds } = value;

    _app.checkedCallCenterIds = checkedCallCenterIds ?? [];
  });
}

const app = new Vue({
  el: "#app",
  data: {
    userId: null,
    userData: {
      call_center_ids: [],
      display_name: null,
      primary_email: null,
      isLoaded: false,
    },
    headers: [],
    callCenterDefs: [],
    checkedCallCenterIds: [],
    isAssigning: false,
    hasAssigned: false,
  },
  methods: {
    assign: async function () {
      this.isAssigning = true;
      this.hasAssigned = true;

      try {
        await Promise.all([
          modifyMemberships(this.userId, this.toAdd, true, this.headers),
          modifyMemberships(this.userId, this.toRemove, false, this.headers),
        ]);
      } finally {
        await refreshUserData(this);
        this.isAssigning = false;
      }
    },
    isMember: function (callCenter) {
      return this.userData.call_center_ids.includes(callCenter.id);
    },
    checkAll: function () {
      this.checkedCallCenterIds = [...this.callCenterDefs.map((cc) => cc.id)];
    },
    checkNone: function () {
      this.checkedCallCenterIds = [];
    },
    checkReset: function () {
      this.checkedCallCenterIds = [...this.userData.call_center_ids];
    },
  },
  computed: {
    have: function () {
      return new Set(this.userData.call_center_ids);
    },
    want: function () {
      return new Set(this.checkedCallCenterIds);
    },
    toAdd: function () {
      return difference(this.want, this.have);
    },
    toRemove: function () {
      return difference(this.have, this.want);
    },
    isClean: function () {
      return this.toAdd.size === 0 && this.toRemove.size === 0;
    },
  },
  watch: {
    checkedCallCenterIds: function (checkedCallCenterIds) {
      console.log("Observed checkedCallCenterIds change", checkedCallCenterIds);
      chrome.storage.sync.set({ checkedCallCenterIds });
      this.hasAssigned = false;
    },
  },
});

async function init(_app) {
  chrome.storage.local.get(["headers", "userId"], async (value) => {
    const { headers, userId } = value;

    console.log("Stored value (local): ", value);

    _app.headers = headers;
    _app.userId = userId;

    refreshUserData(_app);
    refreshCallCenterDefs(_app);
    refreshCheckedCallCenterIds(_app);
  });
}

init(app);
