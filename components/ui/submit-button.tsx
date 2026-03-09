"use client";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

export function SubmitButton({ children, pendingText, ...props }: { children: React.ReactNode; pendingText?: string } & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type={props.type ?? "submit"} disabled={pending || props.disabled}>
      {pending ? pendingText ?? "Saving..." : children}
    </Button>
  );
}
