/* eslint-disable @typescript-eslint/no-explicit-any */


// hooks/usePip.tsx
"use client";

import { ComponentType, useRef, useState, useCallback, useEffect } from "react";
import ReactDOM from "react-dom/client"; // Ensure this import is correct for your React setup

// Define the props your component will receive when rendered in the PiP window.
// `signal` is left as 'object' as per your request for custom implementation.
export interface PipFunctionProps {
  signal: object;
  hide: () => void; // Added hide function for the PiP component to close itself
}

// Options for configuring the Picture-in-Picture window.
interface UsePipOptions {
  width?: number;
  height?: number;
  injectStyles?: string; // CSS string to inject
  tailwindCdn?: boolean; // Whether to inject Tailwind CSS CDN
}


// Define a generic type `T` for the data stored in the space
export function usePipSpace<T extends object>(spaceName: string, initialValue: T) {
  // Use a ref to hold the current serialized value in localStorage for comparison
  // This helps prevent unnecessary writes and state updates if the value hasn't truly changed.
  const lastKnownSerializedValueRef = useRef<string | null>(null);

  const [data, setData] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const storedValue = localStorage.getItem(spaceName);
      if (storedValue) {
        lastKnownSerializedValueRef.current = storedValue; // Initialize ref with actual stored value
        try {
          return JSON.parse(storedValue) as T;
        } catch (error) {
          console.error(`usePipSpace: Error parsing localStorage data for space "${spaceName}":`, error);
          return initialValue;
        }
      }
    } catch (error) {
      console.error(`usePipSpace: Error accessing localStorage for space "${spaceName}":`, error);
    }
    return initialValue;
  });

  // --- NEW: Function to read from localStorage and update state if changed ---
  const readFromLocalStorageAndSyncState = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const storedValue = localStorage.getItem(spaceName);
      const newSerializedValue = storedValue === null ? null : storedValue;

      // Only update state if the value from localStorage is genuinely different
      // from what we currently know is stored.
      if (newSerializedValue !== lastKnownSerializedValueRef.current) {
        if (newSerializedValue) {
          try {
            const parsedNewValue = JSON.parse(newSerializedValue) as T;
            setData(parsedNewValue);
          } catch (error) {
            console.error(`usePipSpace: Error parsing polled value for "${spaceName}":`, error);
            setData(initialValue); // Fallback to initial if parsing fails
          }
        } else {
          // Item was removed or is null
          setData(initialValue);
        }
        lastKnownSerializedValueRef.current = newSerializedValue; // Update ref after processing
      }
    } catch (error) {
      console.error(`usePipSpace: Error during polling read for space "${spaceName}":`, error);
    }
  }, [spaceName, initialValue]);


  // --- Effect 1: Listen for 'storage' events from OTHER windows ---
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      // Check if the change is for *our* specific spaceName
      // and let readFromLocalStorageAndSyncState handle the actual state update
      if (event.key === spaceName) {
        readFromLocalStorageAndSyncState(); // Trigger a read and sync
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [spaceName, readFromLocalStorageAndSyncState]); // Dependency on stable readFromLocalStorageAndSyncState


  // --- Effect 2: Poll localStorage every second ---
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Perform an initial read on mount
    readFromLocalStorageAndSyncState();

    const intervalId = setInterval(() => {
      readFromLocalStorageAndSyncState();
    }, 250); // Poll every 1 second

    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [readFromLocalStorageAndSyncState]); // Dependency on stable readFromLocalStorageAndSyncState


  // --- Effect 3: Write data to localStorage when 'data' state changes in THIS window ---
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const newSerializedValue = JSON.stringify(data);
      // Only write to localStorage if the value has actually changed
      // from the last known stored value.
      if (newSerializedValue !== lastKnownSerializedValueRef.current) {
        localStorage.setItem(spaceName, newSerializedValue);
        lastKnownSerializedValueRef.current = newSerializedValue; // Update ref to reflect the new stored value
      }
    } catch (error) {
      console.error(`usePipSpace: Error writing to localStorage for space "${spaceName}":`, error);
    }
  }, [spaceName, data]); // Dependencies are spaceName and data

  // Memoize the read, write, and update functions to prevent unnecessary re-renders
  const read = useCallback((): T => {
    return data;
  }, [data]);

  const write = useCallback((newValue: T) => {
    // Only update state if the new value is actually different to avoid redundant renders
    if (JSON.stringify(newValue) !== JSON.stringify(data)) {
      setData(newValue);
    }
  }, [data]);

  const update = useCallback((partialValue: Partial<T>) => {
    setData(prevData => {
      const newData = { ...prevData, ...partialValue };
      if (JSON.stringify(newData) !== JSON.stringify(prevData)) {
          return newData;
      }
      return prevData;
    });
  }, []);

  return { data, read, write, update };
}

/**
 * A React hook to manage Picture-in-Picture mode using the Document Picture-in-Picture API.
 *
 * @param Component The React component to render inside the Picture-in-Picture window.
 * @param options Configuration options for the PiP window (width, height, custom styles).
 * @returns An object containing `show` and `hide` functions, and `isPipActive` status.
 */
export const usePip = <P extends object>(
  Component: ComponentType<P & PipFunctionProps>,
  options: UsePipOptions // Ensure options are always provided for configuration
) => {
  const { height = 150, injectStyles = "", tailwindCdn = false, width = 80 } = options;

  const pipWindowRef = useRef<Window | null>(null);
  const reactRootRef = useRef<ReactDOM.Root | null>(null);
  const [isPipActive, setIsPipActive] = useState(false);

  // Function to close the PiP window
  const hide = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setIsPipActive(false);
      reactRootRef.current = null; // Clear React root on close
    }
  }, []);

  // Function to open the PiP window
  const show = useCallback(
    async (
      componentProps?: Omit<P, keyof PipFunctionProps>,
      optionsOverride?: Partial<UsePipOptions>
    ) => {
      // Check for Document Picture-in-Picture API support
      if (!("documentPictureInPicture" in window)) {
        alert(
          "Document Picture-in-Picture API is not supported in this browser."
        );
        return;
      }

      // Close existing PiP window if already open
      if (pipWindowRef.current) {
        console.warn("PIP window is already open. Closing and reopening.");
        hide();
      }

      const effectiveWidth = optionsOverride?.width ?? width;
      const effectiveHeight = optionsOverride?.height ?? height;

      try {
        // Request a new PiP window
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: effectiveWidth,
          height: effectiveHeight,
        });

        pipWindowRef.current = pipWindow;
        setIsPipActive(true);

        // Inject custom styles into the PiP window's head
        const styleTag = pipWindow.document.createElement("style");
        styleTag.textContent = injectStyles;
        pipWindow.document.head.appendChild(styleTag);

        // Add a viewport meta tag for responsiveness
        const metaViewport = pipWindow.document.createElement('meta');
        metaViewport.name = 'viewport';
        metaViewport.content = 'width=device-width, initial-scale=1.0';
        pipWindow.document.head.appendChild(metaViewport);


        // Inject Tailwind CSS CDN if requested
        if (tailwindCdn) {
          const scriptTag = pipWindow.document.createElement("script");
          scriptTag.src = "https://cdn.tailwindcss.com";
          pipWindow.document.head.appendChild(scriptTag);
        }

        // Create a React root in the PiP window's body
        const root = ReactDOM.createRoot(pipWindow.document.body);
        reactRootRef.current = root;

        // The signal object you will implement yourself
        const customSignal: object = {}; // This is where your custom signal object will go

        // Render your component with the necessary props
        root.render(
          <Component {...(componentProps as P)} hide={hide} signal={customSignal} />
        );

        // Event listener for when the user closes the PiP window
        pipWindow.addEventListener("pagehide", () => {
          console.log("PIP window was closed by the user or system.");
          if (reactRootRef.current) {
            reactRootRef.current.unmount(); // Clean up React root
            reactRootRef.current = null;
          }
          pipWindowRef.current = null;
          setIsPipActive(false);
        });

      } catch (error) {
        console.error("Error opening Picture-in-Picture window:", error);
        setIsPipActive(false);
      }
    },
    [Component, hide, width, height, injectStyles, tailwindCdn]
  );

  // Clean up PiP window if the component using the hook unmounts
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  return { show, hide, isPipActive };
};