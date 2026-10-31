#!/usr/bin/env node
"use strict";

const { expandActions, loadSessionConfig } = require("./lib/browser-session");

function validateActions(actions, errors, location) {
  (actions || []).forEach((action, index) => {
    const label = `${location}[${index}]`;
    if (!action || typeof action !== "object") {
      errors.push(`${label} must be an object.`);
      return;
    }
    if (!action.type && !action.use) {
      errors.push(`${label} must include either "type" or "use".`);
    }
    if (action.use && action.type) {
      errors.push(`${label} cannot include both "type" and "use".`);
    }
  });
}

function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    process.stderr.write("Usage: node scripts/validate-session-config.js <config.json>\n");
    process.exit(1);
  }

  const config = loadSessionConfig(configPath);
  const errors = [];

  if (!config.baseUrl) {
    errors.push("Session config must include baseUrl.");
  }

  validateActions(config.actions, errors, "actions");
  for (const [name, actions] of Object.entries(config.actionLibrary || {})) {
    validateActions(actions, errors, `actionLibrary.${name}`);
  }

  (config.routeProfiles || []).forEach((profile, index) => {
    if (!profile.match) {
      errors.push(`routeProfiles[${index}] must include a match regex string.`);
    }
    validateActions(profile.beforeAudit, errors, `routeProfiles[${index}].beforeAudit`);
    validateActions(profile.afterLogin, errors, `routeProfiles[${index}].afterLogin`);
  });

  try {
    expandActions(config.actions || [], config);
    for (const profile of config.routeProfiles || []) {
      expandActions(profile.beforeAudit || [], config);
      expandActions(profile.afterLogin || [], config);
    }
  } catch (error) {
    errors.push(error.message);
  }

  if (errors.length > 0) {
    process.stderr.write(`Invalid session config:\n- ${errors.join("\n- ")}\n`);
    process.exit(1);
  }

  process.stdout.write("Session config is valid.\n");
}

if (require.main === module) {
  main();
}
