"use client";

import type { ReactNode } from "react";
import {
  FieldError,
  Input as AriaInput,
  Label,
  Text,
  TextField,
  type TextFieldProps,
} from "react-aria-components";

export type InputProps = Omit<TextFieldProps, "children" | "className"> & {
  // Always shown: a placeholder disappears as soon as the student types.
  label: ReactNode;
  description?: ReactNode;
  // Shown when isInvalid is set or validation fails.
  errorMessage?: ReactNode;
  placeholder?: string;
  className?: string;
};

export function Input({
  label,
  description,
  errorMessage,
  placeholder,
  className = "",
  ...props
}: InputProps) {
  return (
    <TextField {...props} className={`group flex flex-col gap-2 ${className}`}>
      <Label className="text-label text-text group-data-disabled:opacity-40">{label}</Label>
      <AriaInput
        placeholder={placeholder}
        className={[
          // 17px text: anything under 16px makes iOS zoom in.
          "h-13 w-full min-w-0 rounded-control border border-control-border bg-input px-4 text-body text-text placeholder:text-text-faint",
          // Any focus, not only the keyboard's: a field being typed in should always show it.
          "outline-offset-2 data-focused:outline-2 data-focused:outline-focus",
          "data-hovered:border-text-faint data-invalid:border-coral data-disabled:opacity-40",
        ].join(" ")}
      />
      {description && (
        <Text slot="description" className="text-note text-text-faint">
          {description}
        </Text>
      )}
      <FieldError className="text-note text-coral">{errorMessage}</FieldError>
    </TextField>
  );
}
