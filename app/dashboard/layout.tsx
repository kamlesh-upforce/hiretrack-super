"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, UserPlus, LogOut } from "lucide-react";
import ThemeToggle from "../components/ui/ThemeToggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Add Client", path: "/dashboard/clients/create", icon: UserPlus },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-blue-600 dark:bg-blue-800 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-bold">
                License Administration
              </h1>
            </div>

            <nav className="flex flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto justify-center sm:justify-end">
              <ul className="flex flex-row items-center space-x-1 sm:space-x-2">
                {navItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <li key={item.path}>
                      <Link
                        href={item.path}
                        className={`px-3 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-900 transition-colors text-sm sm:text-base flex items-center space-x-1 ${
                          pathname === item.path
                            ? "bg-blue-700 dark:bg-blue-900 font-medium"
                            : ""
                        }`}
                      >
                        <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center space-x-2 sm:space-x-3 border-l border-blue-500 dark:border-blue-700 pl-2 sm:pl-4 ml-2 sm:ml-4">
                <ThemeToggle />
                <button
                  onClick={async () => {
                    try {
                      await fetch("/api/logout", {
                        method: "POST",
                        credentials: "include",
                      });
                      localStorage.removeItem("authToken");
                      router.push("/");
                    } catch (error) {
                      console.error("Logout failed:", error);
                    }
                  }}
                  className="px-3 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-900 transition-colors cursor-pointer text-sm sm:text-base flex items-center space-x-1"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow py-4 sm:py-6">{children}</main>
    </div>
  );
}
