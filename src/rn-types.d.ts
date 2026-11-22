// The small part of React Native this package uses, so that it typechecks without the
// whole framework. Your app supplies the real one.
import type { ComponentType, ReactNode } from "react";
export const View: ComponentType<{ style?: unknown; children?: ReactNode }>;
export const Text: ComponentType<{ style?: unknown; children?: ReactNode; selectable?: boolean; accessibilityLabel?: string }>;
export const Pressable: ComponentType<{ onPress?: () => void; disabled?: boolean; accessibilityRole?: string; style?: unknown; children?: ReactNode }>;
export const TextInput: ComponentType<{ value?: string; onChangeText?: (s: string) => void; keyboardType?: string; autoComplete?: string; autoCorrect?: boolean; autoCapitalize?: string; spellCheck?: boolean; contextMenuHidden?: boolean; textContentType?: string; importantForAutofill?: string; accessibilityLabel?: string; style?: unknown }>;
export const AppState: { addEventListener(type: "change", fn: (state: string) => void): { remove(): void } };
