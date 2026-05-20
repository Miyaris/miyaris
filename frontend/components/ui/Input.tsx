import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = "", id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label htmlFor={inputId} className="block">
      {label && (
        <span className="eyebrow block mb-2">{label}</span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`block w-full border-b py-3 text-base bg-transparent focus:outline-none focus:border-brass transition-colors ${
          error ? "border-burgundy" : "border-line"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span className="block mt-2 text-xs text-burgundy">{error}</span>
      ) : hint ? (
        <span className="block mt-2 text-xs text-charcoal-300">{hint}</span>
      ) : null}
    </label>
  );
});
