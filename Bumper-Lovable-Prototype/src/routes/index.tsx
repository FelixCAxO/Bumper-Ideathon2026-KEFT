import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bumper - Safety rails for the digital playground" },
      {
        name: "description",
        content:
          "Bumper is a digital seatbelt for Roblox, Discord, and Steam - risk-based alerts for parents, privacy for kids.",
      },
      { property: "og:title", content: "Bumper - Safety rails for the digital playground" },
      {
        property: "og:description",
        content:
          "Risk-based alerts for parents, privacy for kids. The digital seatbelt for Roblox, Discord, and Steam.",
      },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
