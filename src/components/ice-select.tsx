"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type IceSelectOption = {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Optional heading rendered above the option inside the panel. */
  group?: string;
  /** Disabled options stay visible but cannot be picked with pointer or keyboard. */
  disabled?: boolean;
};

type IceSelectProps = {
  /** Visible field label, also used as the accessible name. */
  label: string;
  value: string;
  options: readonly IceSelectOption[];
  onChange: (value: string) => void;
  /** Fallback leading icon when the selected option has no icon of its own. */
  icon?: LucideIcon;
  disabled?: boolean;
  /** Render the label for assistive technology only. */
  hideLabel?: boolean;
  /** Expose and style the field as invalid. */
  invalid?: boolean;
  /** Optional DOM id for the trigger, useful with an external <label htmlFor>. */
  id?: string;
  className?: string;
};

const PANEL_GAP = 6;
const PANEL_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;
/** Above dialogs (z-50) so a portalled panel is never buried. */
const PANEL_Z_INDEX = 80;

type PanelPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * ICE 2.0 select-only combobox.
 *
 * Deliberately avoids a native <select>: the option list is rendered in a
 * portal so it can follow the portal's green-and-white design language without
 * being clipped by cards, dialogs or scroll containers. Focus stays on the
 * trigger while aria-activedescendant tracks the highlighted option.
 */
export function IceSelect({
  label,
  value,
  options,
  onChange,
  icon,
  disabled = false,
  hideLabel = false,
  invalid = false,
  id,
  className,
}: IceSelectProps) {
  const baseId = useId();
  const rootId = id ?? baseId;
  const labelId = `${rootId}-label`;
  const triggerId = id ?? `${baseId}-trigger`;
  const listboxId = `${rootId}-listbox`;
  const optionId = (index: number) => `${rootId}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadRef = useRef({ query: "", timestamp: 0 });

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const TriggerIcon = selectedOption?.icon ?? icon;

  const isEnabled = useCallback(
    (index: number) => index >= 0 && index < options.length && !options[index]?.disabled,
    [options],
  );

  const firstEnabledIndex = useCallback(
    () => options.findIndex((option) => !option.disabled),
    [options],
  );

  const lastEnabledIndex = useCallback(() => {
    for (let index = options.length - 1; index >= 0; index -= 1) {
      if (!options[index].disabled) return index;
    }
    return -1;
  }, [options]);

  // Move from `from` in `delta` direction, skipping disabled options.
  const stepIndex = useCallback(
    (from: number, delta: number) => {
      if (options.length === 0) return -1;
      if (from < 0) return delta > 0 ? firstEnabledIndex() : lastEnabledIndex();
      let index = from;
      for (let count = 0; count < options.length; count += 1) {
        index = (index + delta + options.length) % options.length;
        if (isEnabled(index)) return index;
      }
      return -1;
    },
    [firstEnabledIndex, isEnabled, lastEnabledIndex, options.length],
  );

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - PANEL_GAP - VIEWPORT_MARGIN;
    const openUp = spaceBelow < Math.min(PANEL_MAX_HEIGHT, 220) && spaceAbove > spaceBelow;

    setPanelPosition({
      left: rect.left,
      width: rect.width,
      ...(openUp
        ? { bottom: viewportHeight - rect.top + PANEL_GAP }
        : { top: rect.bottom + PANEL_GAP }),
      maxHeight: Math.max(140, Math.min(PANEL_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow)),
    });
  }, []);

  const closeMenu = useCallback((returnFocus = false) => {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(
    (index = selectedIndex) => {
      if (disabled) return;
      positionPanel();
      setActiveIndex(isEnabled(index) ? index : firstEnabledIndex());
      setOpen(true);
    },
    [disabled, firstEnabledIndex, isEnabled, positionPanel, selectedIndex],
  );

  const selectOption = useCallback(
    (option: IceSelectOption | undefined) => {
      if (!option || option.disabled) return;
      onChange(option.value);
      closeMenu(true);
    },
    [closeMenu, onChange],
  );

  // Close when the pointer goes down outside both the trigger and the
  // portalled panel, without changing the current selection.
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeMenu, open]);

  // Keep the panel anchored to the trigger through scroll and resize.
  useEffect(() => {
    if (!open) return;

    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open, positionPanel]);

  // Keep the keyboard-highlighted option visible inside the scrollable panel.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex, open]);

  const handleTypeahead = (key: string) => {
    const now = Date.now();
    const previous = typeaheadRef.current;
    const query = now - previous.timestamp > 700 ? key : previous.query + key;
    typeaheadRef.current = { query, timestamp: now };

    const matches = (option: IceSelectOption) =>
      !option.disabled && option.label.toLowerCase().startsWith(query.toLowerCase());

    const matchFromCurrent = options.findIndex(
      (option, index) => index > activeIndex && matches(option),
    );
    const match = matchFromCurrent >= 0
      ? matchFromCurrent
      : options.findIndex(matches);

    if (match < 0) return;
    if (open) {
      setActiveIndex(match);
    } else {
      openMenu(match);
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (open) setActiveIndex((index) => stepIndex(index, 1));
        else openMenu(selectedIndex);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) setActiveIndex((index) => stepIndex(index, -1));
        else openMenu(selectedIndex);
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(firstEnabledIndex());
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(lastEnabledIndex());
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) selectOption(options[activeIndex] ?? selectedOption);
        else openMenu(selectedIndex);
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          closeMenu(true);
        }
        break;
      case "Tab":
        if (open) closeMenu();
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          handleTypeahead(event.key);
        }
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative flex min-w-0 flex-col gap-1.5", open && "z-30", className)}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) closeMenu();
      }}
    >
      <span
        id={labelId}
        className={
          hideLabel
            ? "sr-only"
            : "text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
        }
      >
        {label}
      </span>

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={labelId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "group flex h-11 w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 text-left text-sm text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none",
          invalid
            ? "border-[#c0392b] focus-visible:border-[#c0392b] focus-visible:shadow-[0_0_0_3px_rgba(192,57,43,0.16)]"
            : open
              ? "border-[var(--primary)] shadow-[0_0_0_3px_rgba(8,116,67,0.14)]"
              : "border-[var(--border)] hover:border-[#c2d8cb] hover:bg-[#fcfefd] focus-visible:border-[var(--primary)] focus-visible:shadow-[0_0_0_3px_rgba(8,116,67,0.18)]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {TriggerIcon ? (
          <TriggerIcon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors duration-150 motion-reduce:transition-none",
              open ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] group-hover:text-[var(--primary)]",
            )}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        ) : null}

        <span className="min-w-0 flex-1 truncate">{selectedOption?.label ?? value}</span>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-180 text-[var(--primary)]",
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open && panelPosition
        ? createPortal(
            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              aria-labelledby={labelId}
              style={{
                position: "fixed",
                left: panelPosition.left,
                width: panelPosition.width,
                top: panelPosition.top,
                bottom: panelPosition.bottom,
                maxHeight: panelPosition.maxHeight,
                zIndex: PANEL_Z_INDEX,
              }}
              className="ice-select-panel overflow-y-auto overscroll-contain rounded-[14px] border border-[var(--border)] bg-white p-1.5 shadow-[0_18px_45px_-12px_rgba(17,24,39,0.24),0_4px_14px_-5px_rgba(17,24,39,0.14)]"
            >
              {options.map((option, index) => {
                const OptionIcon = option.icon;
                const selected = option.value === value;
                const active = index === activeIndex;
                const showGroup = option.group && option.group !== options[index - 1]?.group;

                return (
                  <Fragment key={option.value}>
                    {showGroup ? (
                      <div
                        role="presentation"
                        className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
                      >
                        {option.group}
                      </div>
                    ) : null}

                    <div
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      id={optionId(index)}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={option.disabled || undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => {
                        if (!option.disabled) setActiveIndex(index);
                      }}
                      onClick={() => selectOption(option)}
                      className={cn(
                        "flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-100 motion-reduce:transition-none",
                        option.disabled
                          ? "cursor-not-allowed text-[var(--muted-foreground)] opacity-60"
                          : "cursor-pointer",
                        !option.disabled && (selected
                          ? active
                            ? "bg-[#dcefe4] font-medium text-[var(--primary)]"
                            : "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
                          : active
                            ? "bg-[var(--muted)] text-[var(--foreground)]"
                            : "text-[var(--foreground)]"),
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        {OptionIcon ? (
                          <OptionIcon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              selected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
                            )}
                            strokeWidth={1.9}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="truncate">{option.label}</span>
                      </span>

                      {selected && !option.disabled ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" strokeWidth={2.4} aria-hidden="true" />
                      ) : null}
                    </div>
                  </Fragment>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
