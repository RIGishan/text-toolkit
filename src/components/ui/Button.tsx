import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl",
        "border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900",
        "shadow-sm hover:bg-slate-50 active:bg-slate-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      ].join(" ")}
      {...rest}
    />
  );
}
