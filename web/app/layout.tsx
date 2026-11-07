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
          <div className="min-h-screen md:flex">
            <Sidebar />
            <div className="flex-1 min-w-0 overflow-y-auto bg-canvas">
              <p
                role="note"
                className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 md:text-sm"
              >
                <strong>Sample data only:</strong> every integration and action is simulated; changes are temporary.
              </p>
                {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
