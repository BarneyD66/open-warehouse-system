import { redirect } from "next/navigation";
import { defaultServiceId, servicePath } from "./data";

export default function ServicesPage() {
  redirect(servicePath(defaultServiceId));
}
