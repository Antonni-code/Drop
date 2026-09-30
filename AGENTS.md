# Drop working rules

- Keep this a lightweight local clipboard extension. Never add accounts or upload clips implicitly.
- Keep private keys, license keys and API secrets out of source, builds and logs.
- Only the background service writes persistent extension data. Validate messages and enforce entitlements there.
- Preserve saved clips during failed operations, imports, upgrades and license downgrade.
- Keep untrusted text out of HTML and executable code. No remote executable code or broad host permissions.
- Use the owner’s phase format: `Build (Completed) : Drop - <accomplishment>` or `Improve (Completed) : Drop - <accomplishment>`. Keep the accomplishment concise. No co-author trailers or assistant names in commit messages.
- Run `npm run check` for substantive changes and browser verification for interactions.
- Mark unconfigured or unpublished services honestly. Do not replace config placeholders with guesses.

- Use a branch for each phase. Merge only after its required checks pass.
