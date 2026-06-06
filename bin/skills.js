#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const SKILLS_DIR = path.join(__dirname, "..", "skills");
const DEST_DIR = path.join(os.homedir(), ".claude", "skills");

const available = fs
  .readdirSync(SKILLS_DIR)
  .filter((d) => fs.existsSync(path.join(SKILLS_DIR, d, "SKILL.md")));

function list() {
  console.log("Available skills:");
  available.forEach((s) => console.log(`  ${s}`));
}

function add(names) {
  if (names.length === 0) {
    console.error("Usage: skills add <skill-name> [skill-name...] | all");
    process.exit(1);
  }

  const targets = names[0] === "all" ? available : names;
  const invalid = targets.filter((n) => !available.includes(n));
  if (invalid.length > 0) {
    console.error(`Unknown skills: ${invalid.join(", ")}`);
    console.error(`Run 'skills list' to see available skills.`);
    process.exit(1);
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });

  for (const name of targets) {
    const dest = path.join(DEST_DIR, name);
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(
      path.join(SKILLS_DIR, name, "SKILL.md"),
      path.join(dest, "SKILL.md")
    );
    console.log(`Installed: ${name}`);
  }
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "list") {
  list();
} else if (cmd === "add") {
  add(args);
} else {
  console.log("Usage:");
  console.log("  skills list              List available skills");
  console.log("  skills add <name...>     Install one or more skills");
  console.log("  skills add all           Install all skills");
}
