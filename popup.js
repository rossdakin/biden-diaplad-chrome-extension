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

async function modifyMembership(userId, callCenterId, add, headers) {
  const url = `https://dialpad.com/api/operator/${userId}?group_id=${callCenterId}`;
  const body = add ? { add: true, skill_level: 100 } : { remove: true };

  return xhr(url, headers, "PATCH", JSON.stringify(body));
}

async function modifyMemberships(userId, callCenterIds, add, headers) {
  console.log(
    `Will ${add ? "add" : "remove"} ${callCenterIds.size} call centers`,
    headers
  );

  const promises = Array.from(callCenterIds).map((callCenterId) =>
    modifyMembership(userId, callCenterId, add, headers)
  );

  return Promise.all(promises);
}

const app = new Vue({
  el: "#app",
  data: {
    userData: {
      id: null,
      call_center_ids: [],
      display_name: null,
      primary_email: null,
    },
    headers: [],
    callCenters: [],
    checkedCallCenterIds: [],
    isThinking: false,
  },
  methods: {
    assign: async function () {
      this.isThinking = true;

      await Promise.all([
        modifyMemberships(this.userData.id, this.toAdd, true, this.headers),
        modifyMemberships(this.userData.id, this.toRemove, false, this.headers),
      ]);

      this.isThinking = false;
    },
    isMember: function (callCenter) {
      return this.userData.call_center_ids.includes(callCenter.id);
    },
    checkAll: function () {
      this.checkedCallCenterIds = [...this.callCenters.map((cc) => cc.id)];
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
  },
  // watch: {
  //   checkedCallCenterIds: function (checkedCallCenterIds) {
  //     console.log("Observed checkedCallCenterIds change", checkedCallCenterIds);
  //     chrome.storage.sync.set({ checkedCallCenterIds });
  //   },
  // },
});

async function init(_app) {
  // load up the most recent way we had the check boxes checked
  chrome.storage.sync.get(["checkedCallCenterIds"], (value) => {
    console.log("Stored value (sync): ", value);
    const { checkedCallCenterIds } = value;

    _app.checkedCallCenterIds = checkedCallCenterIds ?? [];
  });

  // load up stuff pertaining to this user
  chrome.storage.local.get(["userData", "headers"], async (value) => {
    console.log("Stored value (local): ", value);
    const { userData, headers } = value;

    _app.headers = headers;
    _app.userData = userData;
    _app.callCenters = (
      await xhr("https://dialpad.com/api/group", headers)
    ).sort(alphabeticallyBy("display_name"));
  });
}

init(app);
