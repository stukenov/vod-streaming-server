import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 antialiased`}>
        <div className="flex min-h-screen">
          <main className="flex-1 px-4 py-8 md:px-8">
            {children}
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
