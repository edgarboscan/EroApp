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

    const alignmentClass = isNumber ? "text-left" : "";

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[#333333] dark:text-[#E0E0E0] tracking-wide"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`h-10 px-3 text-sm bg-white dark:bg-[#1E1F21] border rounded-lg text-[#333333] dark:text-[#E0E0E0] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:bg-gray-100 dark:disabled:bg-neutral-800/60 disabled:cursor-not-allowed ${
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 focus-visible:border-[#007BFF] dark:focus-visible:border-[#3D91FF] focus-visible:ring-[#007BFF]/25 dark:focus-visible:ring-[#3D91FF]/35"
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
