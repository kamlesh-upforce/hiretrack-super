"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Add Client", path: "/dashboard/clients/create" },
    // { name: "Licenses", path: "/dashboard/licenses/create" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">License Administration</h1>
          <nav className="flex flex-row items-center">
            <ul className="flex flex-row items-center space-x-4">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`px-3 py-2 rounded hover:bg-blue-700 ${
                      pathname === item.path ? "bg-blue-700" : ""
                    }`}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  onClick={async () => {
                    try {
                      // Call logout API
                      await fetch("/api/logout", {
                        method: "POST",
                        credentials: "include",
                      });

                      // Clear localStorage token if it exists
                      localStorage.removeItem("authToken");

                      // Redirect to login page
                      router.push("/");
                    } catch (error) {
                      console.error("Logout failed:", error);
                    }
                  }}
                  className="px-3 py-2 rounded hover:bg-blue-700 cursor-pointer"
                >
                  Logout
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="flex-grow py-6">{children}</main>

      {/* <footer className="bg-gray-100 py-4">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          &copy; {new Date().getFullYear()} License Administration System
        </div>
      </footer> */}
    </div>
  );
}
