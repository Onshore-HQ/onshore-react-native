// Renders the components against a stand-in for react-native. This shows their logic; it
// says nothing about how they look or behave on a device.
import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { register } from "node:module";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const stub = new URL("./rn-stub.mjs", import.meta.url).href;
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n) { return s === "react-native" ? { url: ${JSON.stringify(stub)}, shortCircuit: true } : n(s, c); }`), import.meta.url);

const React = (await import("react")).default;
const renderer = (await import("react-test-renderer")).default;
const { AppState } = await import("react-native");
const { CollectForm, RevealView, VaultError } = await import("../dist/index.js");
const act = renderer.act;
const SECRET = "22333444558";
const fake = (over = {}) => ({ describe: async () => ({ kind: "collect", tokens: 0, fields: [{ name: "bvn", data_type: "bvn" }] }), collect: async () => ({ bvn: "tok_bvn_x" }), reveal: async () => [{ value: SECRET }], ...over });
const mount = async (el) => { let t; await act(async () => { t = renderer.create(el); }); return t; };
const texts = (t) => JSON.stringify(t.toJSON());

test("the input turns off autofill, suggestions and the copy menu", async () => {
  const t = await mount(React.createElement(CollectForm, { client: fake(), clientToken: "c", onTokens() {} }));
  const p = t.root.findByType("TextInput").props;
  assert.equal(p.keyboardType, "number-pad");
  for (const [k, v] of Object.entries({ autoComplete: "off", autoCorrect: false, spellCheck: false, contextMenuHidden: true, importantForAutofill: "no", textContentType: "none" })) assert.equal(p[k], v, k);
});

test("the app gets tokens, and the typed value is cleared", async () => {
  let sent, got;
  const client = fake({ collect: async (_t, v) => { sent = v; return { bvn: "tok_bvn_x" }; } });
  const t = await mount(React.createElement(CollectForm, { client, clientToken: "c", onTokens: (x) => { got = x; } }));
  await act(async () => t.root.findByType("TextInput").props.onChangeText(SECRET));
  await act(async () => t.root.findByType("Pressable").props.onPress());
  assert.deepEqual(sent, { bvn: SECRET });
  assert.deepEqual(got, { bvn: "tok_bvn_x" });
  assert.equal(t.root.findByType("TextInput").props.value, "");
  assert.ok(!texts(t).includes(SECRET));
});

test("a typo marks the field and reaches onError with no value", async () => {
  let err;
  const client = fake({ collect: async () => { throw new VaultError("validation_failed", ["bvn"], 422); } });
  const t = await mount(React.createElement(CollectForm, { client, clientToken: "c", onTokens() { assert.fail(); }, onError: (e) => { err = e; } }));
  await act(async () => t.root.findByType("TextInput").props.onChangeText("nope"));
  await act(async () => t.root.findByType("Pressable").props.onPress());
  assert.ok(texts(t).includes("Check this value"));
  assert.ok(!JSON.stringify(err).includes("nope") && !String(err).includes("nope"));
  assert.equal(t.root.findByType("TextInput").props.value, "nope", "the person can correct it");
});

test("a revealed value hides after its time, and when the app leaves the foreground", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let t = await mount(React.createElement(RevealView, { client: fake(), clientToken: "c", hideAfter: 30 }));
  assert.ok(texts(t).includes(SECRET));
  await act(async () => mock.timers.tick(30_000));
  assert.ok(!texts(t).includes(SECRET));
  mock.timers.reset();
  t = await mount(React.createElement(RevealView, { client: fake(), clientToken: "c2", hideAfter: 30 }));
  assert.ok(texts(t).includes(SECRET));
  await act(async () => AppState.__emit("background"));
  assert.ok(!texts(t).includes(SECRET));
  await act(async () => t.unmount());
});

test("a refusal shows no value", async () => {
  const t = await mount(React.createElement(RevealView, { client: fake({ reveal: async () => [{ error: { code: "policy_denied" } }] }), clientToken: "c" }));
  assert.ok(texts(t).includes("You do not have access"));
});
