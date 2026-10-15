"use client";

import { useEffect } from "react";

const PHONE = "(max-width: 639px)";
const VISIBLE_ROWS = 5;

/**
 * PA-12: on phones every `table.data-table` is shown as cards (CSS in globals.css uses the
 * data-label set here) and long tables get a "Show more" button. Works for all existing tables
 * without changing each page.
 */
export function useResponsiveTables(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(PHONE);

    const enhance = () => {
      document.querySelectorAll<HTMLTableElement>("table.data-table").forEach((table) => {
        const headers = [...table.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
        table.querySelectorAll("tbody tr").forEach((tr) => {
          [...tr.children].forEach((td, i) => {
            if (headers[i] && td.getAttribute("data-label") !== headers[i]) td.setAttribute("data-label", headers[i]!);
          });
        });
        const rows = table.querySelectorAll("tbody tr").length;
        let btn = table.parentElement?.querySelector<HTMLButtonElement>(":scope > .table-show-more") ?? null;
        if (rows > VISIBLE_ROWS && mq.matches) {
          if (!table.classList.contains("table-expanded")) table.classList.add("table-collapsed");
          if (!btn && table.parentElement) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.className = "table-show-more";
            btn.addEventListener("click", () => {
              const collapsed = table.classList.toggle("table-collapsed");
              table.classList.toggle("table-expanded", !collapsed);
              btn!.textContent = collapsed ? `Show more (${table.querySelectorAll("tbody tr").length - VISIBLE_ROWS})` : "Show less";
            });
            table.parentElement.appendChild(btn);
          }
          if (btn && table.classList.contains("table-collapsed")) btn.textContent = `Show more (${rows - VISIBLE_ROWS})`;
        } else {
          table.classList.remove("table-collapsed");
          btn?.remove();
        }
      });
    };

    enhance();
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhance);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    mq.addEventListener("change", enhance);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      mq.removeEventListener("change", enhance);
    };
  }, []);
}
