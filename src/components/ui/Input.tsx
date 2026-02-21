import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    const { className = "", ...rest } = props;
    return (
      <input
        ref={ref}
        className={[
          "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm",
          "text-slate-900 placeholder:text-slate-400 shadow-sm",
          "focus:border-blue-500 focus:outline-none",
          className
        ].join(" ")}
        {...rest}
      />
    );
  }
);
