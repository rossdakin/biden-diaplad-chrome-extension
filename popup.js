async function addToCallCenter(userId, groupId, add) {
  const url = `https://dialpad.com/api/operator/${userId}?group_id=${groupId}`;
  const body = add ? '{"add":true,"skill_level":100}' : '{"remove":true}';

  const response = await fetch(url, {
    headers: { ...popup.headers, "request-timestamp": Date.now() },
    referrer: "https://dialpad.com/accounts",
    referrerPolicy: "no-referrer-when-downgrade",
    body,
    method: "PATCH",
    mode: "cors",
    credentials: "include",
  });

  document.getElementById(groupId);
}

async function assignToAllCallCenters(userId) {
  const groupIds = ["agxzfnViZXItdm9pY2VyFwsSCkNhbGxDZW50ZXIYgIC09PSyywgM"];

  const promises = groupIds.map((groupId) =>
    addToCallCenter(userId, groupId, true)
  );

  return await Promise.all(promises);
}

Vue.component("callcenter-item", {
  props: ["cc", "isMember", "isThinking"],
  template: `
  <li>
    <input type="checkbox" class="checkbox" v-bind:id="cc.id" v-bind:disabled="isThinking" />
    <span class="membership" v-bind:class="{ active: isMember }">&check;</span>
    <label v-bind:for="cc.id" v-bind:style="{ fontWeight: isMember ? 'bold' : 'normal' }">{{ cc.display_name }}</label>
  </li>
  `,
});

Vue.component("spinner", {
  props: ["size"],
  template: `
    <div class="spinner" v-bind:style="{ width: (size * 3.89) + 'px' }">
      <div class="bounce1" v-bind:style="{ width: size + 'px', height: size + 'px' }"></div>
      <div class="bounce2" v-bind:style="{ width: size + 'px', height: size + 'px' }"></div>
      <div class="bounce3" v-bind:style="{ width: size + 'px', height: size + 'px' }"></div>
    </div>
  `,
});

const assign = async function () {
  this.isThinking = true;

  // await assignToAllCallCenters(this.userId);

  // this.isThinking = false;
};

const isMember = function (callCenter) {
  console.log('this: ', this);
  console.log('callCenter: ', callCenter);
  return this.userData.call_center_ids.includes(callCenter.id);
};

const app = new Vue({
  el: "#app",
  data: {
    userData: {},
    headers: [],
    callCenters: [],
    isThinking: false,
  },
  methods: {
    assign,
    isMember,
  },
});

async function xhr(url, method = "GET", body = null) {
  const response = await fetch(url, {
    headers: { ...app.headers, "request-timestamp": Date.now() },
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

async function init() {
  chrome.storage.local.get(["userData", "headers"], async (value) => {
    console.log("Stored value: ", value);
    const { userData, headers } = value;

    app.headers = headers;
    app.userData = userData;
    app.callCenters = (await xhr("https://dialpad.com/api/group")).sort(
      function (a, b) {
        if (a.display_name < b.display_name) {
          return -1;
        }
        if (a.display_name > b.display_name) {
          return 1;
        }
        return 0;
      }
    );
  });
}

init();
