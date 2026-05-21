import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Runs before paint to apply stored theme and avoid flash. */
export function ThemeScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var d=document.documentElement;if(t==='dark')d.classList.add('dark');else d.classList.remove('dark');}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
