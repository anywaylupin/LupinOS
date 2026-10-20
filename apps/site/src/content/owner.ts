// Owner content. The OS, /plain and the SEO routes all read from here.
// Swap the placeholders for real content; nothing else needs to change.

export type Project = {
  slug: string;
  title: string;
  year: string;
  summary: string;
  body: string[];
  stack: string[];
  links: { label: string; href: string }[];
};

export const owner = {
  name: "Lupin",
  role: "Frontend developer",
  email: "hello@example.com",
  location: "City, Country",
  bio: [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  ],
  links: [
    { label: "GitHub", href: "https://github.com/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/" },
  ],
  resume: {
    file: "/resume.pdf",
    experience: [
      { role: "Role title", org: "Company name", when: "20XX to 20XX", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      { role: "Role title", org: "Company name", when: "20XX to 20XX", text: "Sed do eiusmod tempor incididunt ut labore et dolore." },
      { role: "Role title", org: "Company name", when: "20XX to 20XX", text: "Ut enim ad minim veniam, quis nostrud exercitation." },
    ],
    education: [{ role: "Degree name", org: "University name", when: "20XX to 20XX", text: "Lorem ipsum dolor sit amet." }],
    skills: ["TypeScript", "React", "Astro", "CSS", "Node", "Postgres"],
  },
};

const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

const stacks = [
  ["React", "TypeScript"],
  ["Astro", "CSS"],
  ["Node", "Postgres"],
  ["Canvas", "WebGL"],
];

export const projects: Project[] = ["01", "02", "03", "04"].map((n, i) => ({
  slug: `project-${n}`,
  title: `Project ${n}`,
  year: "20XX",
  summary: lorem,
  body: [lorem, lorem, lorem],
  stack: stacks[i],
  links: [
    { label: "Live", href: "https://example.com/" },
    { label: "Source", href: "https://github.com/" },
  ],
}));
