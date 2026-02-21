import type { TextareaHTMLAttributes } from "react";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      className={[
        "w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm",
        "text-slate-900 placeholder:text-slate-400 shadow-sm",
        "focus:border-blue-500 focus:outline-none",
        className
      ].join(" ")}
      {...rest}
    />
  );
}
