import { createFileRoute } from "@tanstack/react-router";
import { HolidayGame } from "@/game/HolidayGame";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <HolidayGame />;
}
