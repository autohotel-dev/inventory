"use client";
import * as React from "react";
import { Button } from "./button";

type Props = React.ComponentProps<typeof Button> & {
  confirmText?: string;
};

export function ConfirmButton({ confirmText = "Are you sure?", onClick, ...props }: Props) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        // If developer passed an onClick, let them run extra logic after confirm
        const ok = window.confirm(confirmText);
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (onClick) onClick(e);
      }}
    />
  );
}
