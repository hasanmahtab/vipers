"use client";

/**
 * A checkbox that toggles every checkbox matching `targetSelector` within
 * its closest `[data-select-all-scope]` ancestor — lets the admin mark a
 * whole team as "played" in one click instead of checking each player.
 * Plain DOM manipulation (not React state) since the target checkboxes are
 * uncontrolled form inputs.
 */
export function SelectAllCheckbox({
  targetSelector,
  label,
}: {
  targetSelector: string;
  label: string;
}) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-semibold text-neon">
      <input
        type="checkbox"
        className="h-4 w-4 accent-neon"
        onChange={(e) => {
          const scope = e.currentTarget.closest("[data-select-all-scope]");
          if (!scope) return;
          scope.querySelectorAll<HTMLInputElement>(targetSelector).forEach((checkbox) => {
            checkbox.checked = e.currentTarget.checked;
          });
        }}
      />
      {label}
    </label>
  );
}
