import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, TextInput, View } from "react-native";
import { VaultError, type FieldDescription, type RevealedValue, type SecureClient } from "./client.js";

const NUMERIC = new Set(["bvn", "nin", "ng_11_digit_id", "nuban"]);

export interface CollectFormProps {
  client: SecureClient;
  clientToken: string;
  labels?: Record<string, string>;
  submitLabel?: string;
  onTokens: (tokens: Record<string, string>) => void;
  onError?: (e: VaultError) => void;
}

/**
 * Collects values, and hands your code only tokens. Values stay in this component's state,
 * with no prop or callback to read them. **React Native runs all of an app's JavaScript in
 * one context, so this keeps a value out of your code and logs by design, and does not
 * isolate it from a hostile package in the same bundle.** The native SDKs have the same limit
 * in a smaller way, and a browser frame does not.
 */
export function CollectForm({ client, clientToken, labels = {}, submitLabel = "Continue", onTokens, onError }: CollectFormProps) {
  const [fields, setFields] = useState<FieldDescription[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const report = (e: unknown) => onError?.(e instanceof VaultError ? e : new VaultError("transport"));
  useEffect(() => {
    let live = true;
    client.describe(clientToken).then((d) => { if (live) setFields(d.fields); }, report);
    return () => { live = false; setValues({}); };
  }, [client, clientToken]);
  const submit = async () => {
    setBusy(true);
    try {
      const tokens = await client.collect(clientToken, values);
      setValues({});
      onTokens(tokens);
    } catch (e) {
      if (e instanceof VaultError && e.code === "validation_failed") setInvalid(e.fields);
      report(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      {fields.map((f) => (
        <View key={f.name}>
          <Text>{labels[f.name] ?? f.name}</Text>
          <TextInput
            accessibilityLabel={labels[f.name] ?? f.name}
            value={values[f.name] ?? ""}
            onChangeText={(s) => { setValues((v) => ({ ...v, [f.name]: s })); setInvalid((i) => i.filter((n) => n !== f.name)); }}
            keyboardType={NUMERIC.has(f.data_type) ? "number-pad" : "default"}
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            contextMenuHidden
            textContentType="none"
            importantForAutofill="no"
          />
          {invalid.includes(f.name) && <Text>Check this value</Text>}
        </View>
      ))}
      <Pressable accessibilityRole="button" disabled={busy || fields.length === 0} onPress={submit}><Text>{submitLabel}</Text></Pressable>
    </View>
  );
}

export interface RevealViewProps {
  client: SecureClient;
  clientToken: string;
  /** Seconds until the values are hidden. They also go when the app leaves the foreground. */
  hideAfter?: number;
  onError?: (e: VaultError) => void;
}

export function RevealView({ client, clientToken, hideAfter = 30, onError }: RevealViewProps) {
  const [results, setResults] = useState<RevealedValue[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    let live = true;
    client.reveal(clientToken).then((r) => {
      if (!live) return;
      setResults(r);
      timer.current = setTimeout(() => setResults([]), hideAfter * 1000);
    }, (e) => onError?.(e instanceof VaultError ? e : new VaultError("transport")));
    const sub = AppState.addEventListener("change", (s) => { if (s !== "active") setResults([]); });
    return () => { live = false; clearTimeout(timer.current); sub.remove(); setResults([]); };
  }, [client, clientToken, hideAfter]);
  return (
    <View>
      {results.map((r, i) => (r.value !== undefined
        ? <Text key={i} selectable={false}>{r.value}</Text>
        : <Text key={i}>{r.error?.code === "policy_denied" ? "You do not have access to this" : "Not available"}</Text>))}
    </View>
  );
}
