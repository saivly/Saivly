"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useT } from "@/app/i18n-provider";

/**
 * The app's one dropdown. Replaces native <select>, whose open menu is
 * drawn by the operating system and can't be styled.
 *
 * - Closed, it looks like every other input (same border, radius, focus).
 * - Open, it's a themed panel: hover/keyboard highlight, a check on the
 *   selected option, optional group headings, and a search box for long
 *   lists (`searchable`). It opens upwards when there's no room below.
 * - Keyboard: ↑/↓, Home/End, Enter/Space, Escape, Tab, and type-to-jump.
 * - Forms: pass `name` and the value is submitted via a hidden input.
 *   Works controlled (`value` + `onChange`) or uncontrolled (`defaultValue`).
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Shown before the label, in the menu and (when selected) the trigger — e.g. a flag. */
  icon?: ReactNode;
  /** What the closed trigger shows instead of `label` (e.g. "+31" for a dial code). */
  selectedLabel?: ReactNode;
  disabled?: boolean;
};

export type SelectGroup = { label: string; options: SelectOption[] };

type Props = {
  options: SelectOption[] | SelectGroup[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Called when the menu closes (after a pick or a dismiss) — use it to mark the field touched. */
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  searchable?: boolean;
  /** Leading icon on the trigger, shown whatever is selected (e.g. a calendar). */
  icon?: ReactNode;
  "aria-label"?: string;
  id?: string;
  /** Extra classes for the trigger button. */
  className?: string;
  /** Extra classes for the menu panel (e.g. a min width wider than the trigger). */
  menuClassName?: string;
};

export const selectTriggerClasses =
  "flex w-full items-center gap-2 rounded-lg border border-db-input bg-panel px-3 py-2.5 text-left text-base text-ink outline-none transition-colors hover:border-muted/60 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60 aria-expanded:border-accent aria-[invalid=true]:border-danger sm:text-sm";

const MENU_MAX_HEIGHT = 288; // px — keep in sync with max-h-72 below

function isGrouped(options: SelectOption[] | SelectGroup[]): options is SelectGroup[] {
  return options.length > 0 && "options" in options[0];
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={`ml-auto h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M5.5 7.5L10 12l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.5 13.5L17 17" strokeLinecap="round" />
    </svg>
  );
}

/** Case- and accent-insensitive ("Curaçao" matches "curacao"). */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function Select({
  options,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onBlur,
  name,
  placeholder,
  disabled,
  invalid,
  searchable,
  icon,
  "aria-label": ariaLabel,
  id,
  className = "",
  menuClassName = "",
}: Props) {
  const { t } = useT();
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const [innerValue, setInnerValue] = useState(defaultValue);
  const value = controlledValue ?? innerValue;

  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", timer: 0 });

  const groups: SelectGroup[] = useMemo(
    () => (isGrouped(options) ? options : [{ label: "", options }]),
    [options]
  );
  const allOptions = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const selected = allOptions.find((o) => o.value === value) ?? null;

  // What the open menu lists, after the search filter.
  const visibleGroups = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => normalize(o.label).includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);
  const visibleOptions = useMemo(() => visibleGroups.flatMap((g) => g.options), [visibleGroups]);

  function openMenu() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setOpenUp(below < MENU_MAX_HEIGHT + 24 && rect.top > below);
    }
    setQuery("");
    setActiveIndex(Math.max(0, allOptions.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function closeMenu(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
    onBlur?.();
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    if (controlledValue === undefined) setInnerValue(option.value);
    if (option.value !== value) onChange?.(option.value);
    closeMenu();
  }

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // closeMenu only reads props/refs that are stable for an open menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus the search box (or the list) when opening.
  useEffect(() => {
    if (!open) return;
    if (searchable) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [open, searchable]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  // A new search starts at the first match.
  useEffect(() => {
    if (open) setActiveIndex(visibleOptions.length > 0 ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function move(from: number, step: 1 | -1): number {
    const n = visibleOptions.length;
    for (let i = 1; i <= n; i++) {
      const next = (from + step * i + n) % n;
      if (!visibleOptions[next].disabled) return next;
    }
    return from;
  }

  function onMenuKeyDown(e: ReactKeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => move(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => move(i < 0 ? 0 : i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(move(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(move(0, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (visibleOptions[activeIndex]) choose(visibleOptions[activeIndex]);
        break;
      case " ":
        if (searchable) break; // a space is part of the search text
        e.preventDefault();
        if (visibleOptions[activeIndex]) choose(visibleOptions[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        closeMenu();
        break;
      case "Tab":
        closeMenu(false);
        break;
      default:
        // Type-to-jump for lists without a search box.
        if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          const ta = typeahead.current;
          window.clearTimeout(ta.timer);
          ta.text += normalize(e.key);
          ta.timer = window.setTimeout(() => (ta.text = ""), 600);
          const match = visibleOptions.findIndex((o) => !o.disabled && normalize(o.label).startsWith(ta.text));
          if (match >= 0) setActiveIndex(match);
        }
    }
  }

  function onTriggerKeyDown(e: ReactKeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  }

  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;
  let index = -1;

  return (
    <div ref={rootRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`${selectTriggerClasses} ${className}`}
      >
        {icon}
        {selected?.icon}
        <span className={`min-w-0 truncate ${selected ? "" : "text-muted"}`}>
          {selected ? (selected.selectedLabel ?? selected.label) : (placeholder ?? t("Select…"))}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          // Most dropdowns sit inside a <label>. A click inside the menu would
          // otherwise be forwarded by that label to the trigger button —
          // reopening the menu right after a pick. Only cancelling the click
          // (preventDefault) stops the label doing that; stopPropagation
          // alone doesn't.
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute left-0 z-50 w-full min-w-[12rem] overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-[0_16px_40px_-12px_rgba(15,27,45,.28)] ${
            openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${menuClassName}`}
        >
          {searchable && (
            <label className="mb-1 flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-muted focus-within:border-accent">
              <SearchIcon />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onMenuKeyDown}
                placeholder={t("Search…")}
                aria-label={t("Search…")}
                aria-controls={listId}
                aria-activedescendant={activeId}
                className="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted sm:text-sm"
              />
            </label>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-activedescendant={searchable ? undefined : activeId}
            onKeyDown={searchable ? undefined : onMenuKeyDown}
            className="max-h-72 overflow-y-auto overscroll-contain outline-none"
          >
            {visibleOptions.length === 0 && (
              <li className="px-2.5 py-3 text-center text-sm text-muted">{t("No matches")}</li>
            )}
            {visibleGroups.map((group) => (
              <li key={group.label || "options"} role="presentation">
                {group.label && (
                  <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                    {group.label}
                  </div>
                )}
                <ul role="group" aria-label={group.label || undefined}>
                  {group.options.map((option) => {
                    index++;
                    const i = index;
                    const isSelected = option.value === value;
                    const isActive = i === activeIndex;
                    return (
                      <li
                        key={option.value}
                        id={`${listId}-${i}`}
                        data-index={i}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={option.disabled || undefined}
                        onMouseEnter={() => !option.disabled && setActiveIndex(i)}
                        onMouseDown={(e) => e.preventDefault()} // keep focus inside the menu
                        onClick={() => choose(option)}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                          option.disabled
                            ? "cursor-not-allowed text-muted opacity-50"
                            : isActive
                              ? "bg-accent-soft text-ink"
                              : "text-ink"
                        } ${isSelected ? "font-medium" : ""}`}
                      >
                        {option.icon}
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {isSelected && (
                          <span className="text-accent">
                            <CheckIcon />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
