// Stable cPanel launcher. Changing the configured startup file from the legacy
// app.js forces Passenger/LiteSpeed to discard any stale in-memory runtime.
require("./app.js");
