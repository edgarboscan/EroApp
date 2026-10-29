import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, type, ...props }, ref) => {
    const inputId =
      id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const isNumber = type === "number";

    // Para inputs de tipo number, asegurar alineación a la izquierda
    const sanitizedClassName = isNumber
      ? className.replace(/\btext-(?:end|right|center)\b/g, "").trim()
      : className;

    const alignmentClass = isNumber ? "text-end" : "";

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 tracking-wide"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`h-10 px-3 text-sm bg-white dark:bg-neutral-800 border rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 disabled:cursor-not-allowed ${
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : "border-neutral-300 dark:border-neutral-700 focus-visible:ring-sky-500 hover:border-neutral-400 dark:hover:border-neutral-600"
          } ${alignmentClass} ${sanitizedClassName}`}
          {...props}
        />
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </span>
        )}
        {helperText && !error && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {helperText}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
