"use client";

import { createContext, useContext, type RefObject } from "react";
import type { CRTPortraitHandle } from "@/components/CRTPortrait";

const PortraitContext = createContext<RefObject<CRTPortraitHandle | null> | null>(null);

export const PortraitProvider = PortraitContext.Provider;

export function usePortrait() {
  return useContext(PortraitContext);
}
