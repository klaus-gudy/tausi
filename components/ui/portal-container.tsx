"use client"

import * as React from "react"

/**
 * Where popups should portal to. A modal Radix dialog ignores clicks outside
 * its content, so popups opened inside one must render inside it.
 */
const PortalContainerContext = React.createContext<HTMLElement | null>(null)

const PortalContainerProvider = PortalContainerContext.Provider

function usePortalContainer() {
  return React.useContext(PortalContainerContext)
}

export { PortalContainerProvider, usePortalContainer }
