// Bidi isolation for embedded LTR content inside the RTL Arabic UI
// (rule 50-arabic-rtl-ui): English terms, code, URLs, and IDs are wrapped so they
// render left-to-right without breaking the surrounding Arabic flow.

import type { ReactNode } from "react";

export function Bidi({ children }: { children: ReactNode }) {
  return (
    <span dir="ltr" className="bidi-ltr" style={{ unicodeBidi: "isolate" }}>
      {children}
    </span>
  );
}
