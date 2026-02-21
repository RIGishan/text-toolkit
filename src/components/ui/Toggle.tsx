export function Toggle({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-800">
      <span className={disabled ? "opacity-60" : ""}>{label}</span>
      <span
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full border",
          checked ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-slate-200",
          disabled ? "opacity-60" : ""
        ].join(" ")}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onChange(!checked);
        }}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled ? "true" : "false"}
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition",
            checked ? "translate-x-5" : "translate-x-1"
          ].join(" ")}
        />
      </span>
    </label>
  );
}
