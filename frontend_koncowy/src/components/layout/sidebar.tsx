import { Link, useLocation } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { appNavigation } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
        <span className="font-semibold tracking-tight">TeamSync</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {appNavigation.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              pathname === href
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
