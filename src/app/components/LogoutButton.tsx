import { LogOut } from "lucide-react";

export function LogoutButton({ className, nextPath = "/login" }: { className?: string; nextPath?: string }) {
  return (
    <form action={`/api/logout?next=${encodeURIComponent(nextPath)}`} method="post">
      <button
        className={
          className ??
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        }
        type="submit"
      >
        <LogOut size={16} />
        退出登录
      </button>
    </form>
  );
}
