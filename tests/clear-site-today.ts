// SITE_TODAY sets the day of a build (for looking at a holiday or a queue); the tests choose their own day, so a value from the shell must not reach them.
delete process.env.SITE_TODAY;
