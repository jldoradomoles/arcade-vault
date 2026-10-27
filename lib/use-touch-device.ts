"use client";

import { useSyncExternalStore } from "react";

const NOOP_SUBSCRIBE = () => () => {};

function getSnapshot(): boolean {
  return matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useTouchDevice(): boolean {
  return useSyncExternalStore(NOOP_SUBSCRIBE, getSnapshot, getServerSnapshot);
}
