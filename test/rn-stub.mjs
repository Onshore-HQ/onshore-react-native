// A stand-in for react-native, for logic tests only.
import React from "react";
const h = (t) => (p) => React.createElement(t, p, p.children);
export const View = h("View");
export const Text = h("Text");
export const Pressable = h("Pressable");
export const TextInput = h("TextInput");
const subs = new Set();
export const AppState = { addEventListener: (_, f) => { subs.add(f); return { remove: () => subs.delete(f) }; }, __emit: (s) => subs.forEach((f) => f(s)) };
