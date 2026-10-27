import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "AmzSphere Operations",
  description: "Amazon seller operations workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-canvas">
        <Providers>
          <div className="min-h-screen">
            <div className="md:flex">
              <aside className="hidden md:flex flex-col w-[240px] shrink-0 border-r border-[#1F2937]">
                <Sidebar />
              </aside>
              <main className="flex-1 min-w-0 overflow-y-auto px-4 md:px-10 py-6 md:py-10 bg-canvas">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
