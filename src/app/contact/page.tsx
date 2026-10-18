import { redirect } from "next/navigation";
import { surfaceHref } from "@/lib/surfaceLinks";

export default function ContactPage() {
  redirect(surfaceHref("customer", "/inquiry?service=trial"));
}
