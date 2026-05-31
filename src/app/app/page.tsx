import { redirect } from "next/navigation";
import { surfaceHref } from "@/lib/surfaceLinks";

export default function CustomerAppAliasPage() {
  redirect(surfaceHref("customer", "/login"));
}
