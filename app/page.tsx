/**
 * Home Page
 *
 * A server-rendered shell around the dashboard. The greeting — the page's
 * largest paint — and the wrapper are part of the prerendered HTML; everything
 * that depends on the user's local data lives in the client `Dashboard` and
 * fills in after hydration behind fixed-size placeholders.
 */

import type { JSX } from "react";
import GreetingHeader from "@/components/dashboard/GreetingHeader";
import Dashboard from "@/components/dashboard/Dashboard";

export default function HomePage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <GreetingHeader />
      <Dashboard />
    </div>
  );
}
