"use client";

import * as React from "react";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

export type ToastActionElement = React.ReactElement;

export interface ToastProps {
  id?: string;
  title?: string;
  description?: string;
  action?: ToastActionElement;
  variant?: "default" | "destructive";
  duration?: number;
}

type ToastState = {
  toasts: (ToastProps & { id: string; open: boolean })[];
};

type Action =
  | { type: "ADD_TOAST"; toast: ToastProps & { id: string } }
  | { type: "UPDATE_TOAST"; toast: Partial<ToastProps> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId: string }
  | { type: "REMOVE_TOAST"; toastId: string };

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const listeners: ((state: ToastState) => void)[] = [];
let memoryState: ToastState = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        toasts: [
          { ...action.toast, open: true },
          ...state.toasts,
        ].slice(0, TOAST_LIMIT),
      };
    case "UPDATE_TOAST":
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };
    case "DISMISS_TOAST":
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.toastId ? { ...t, open: false } : t
        ),
      };
    case "REMOVE_TOAST":
      return { toasts: state.toasts.filter((t) => t.id !== action.toastId) };
  }
}

export function toast(props: ToastProps) {
  const id = props.id ?? genId();
  dispatch({ type: "ADD_TOAST", toast: { ...props, id } });
  setTimeout(() => dispatch({ type: "DISMISS_TOAST", toastId: id }), props.duration ?? TOAST_REMOVE_DELAY);
  setTimeout(() => dispatch({ type: "REMOVE_TOAST", toastId: id }), (props.duration ?? TOAST_REMOVE_DELAY) + 500);
  return { id };
}

export function useToast() {
  const [state, setState] = React.useState(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    toasts: state.toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: "DISMISS_TOAST", toastId: id }),
  };
}
