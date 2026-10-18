"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()} type="button">
      <Printer size={15} />
      打印
    </button>
  );
}
