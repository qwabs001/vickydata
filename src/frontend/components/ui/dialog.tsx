import * as React from "react";
import { cn } from "./utils";

export function Dialog({
  open,
  onClose,
  children,
  mobileBottomSheet
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  mobileBottomSheet?: boolean;
}) {
  const [render, setRender] = React.useState(open);
  const [visible, setVisible] = React.useState(open);
  const lastOverflow = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const timeout = setTimeout(() => setRender(false), 320);
    return () => clearTimeout(timeout);
  }, [open]);

  React.useEffect(() => {
    if (!render) {
      if (lastOverflow.current !== null) {
        document.body.style.overflow = lastOverflow.current;
        lastOverflow.current = null;
      }
      return;
    }
    if (lastOverflow.current === null) {
      lastOverflow.current = document.body.style.overflow;
    }
    document.body.style.overflow = "hidden";
    return () => {
      if (lastOverflow.current !== null) {
        document.body.style.overflow = lastOverflow.current;
        lastOverflow.current = null;
      }
    };
  }, [render]);

  React.useEffect(() => {
    if (!render) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [render, onClose]);

  if (!render) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex min-h-full justify-center",
          mobileBottomSheet ? "items-end p-0 md:items-center md:p-4" : "items-center p-4"
        )}
      >
        <div
          className={cn(
            "w-full bg-white shadow-xl",
            mobileBottomSheet
              ? cn(
                  "rounded-t-3xl md:rounded-2xl md:max-w-[500px] max-h-[90vh] overflow-y-auto md:overflow-visible transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  visible
                    ? "translate-y-0 md:translate-y-0 md:opacity-100"
                    : "translate-y-full md:translate-y-4 md:opacity-0",
                  "md:transition-all md:duration-300 md:ease-out md:shadow-xl"
                )
              : cn(
                  "max-w-[500px] rounded-2xl transition-all duration-300 ease-out",
                  visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                )
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
