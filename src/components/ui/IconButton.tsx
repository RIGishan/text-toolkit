import type { ButtonHTMLAttributes } from "react";

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={[
        "inline-flex h-10 w-10 items-center justify-center rounded-xl",
        "border border-slate-200 bg-white text-slate-700 shadow-sm",
        "hover:bg-slate-50 active:bg-slate-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      ].join(" ")}
      {...rest}
    />
  );
}
