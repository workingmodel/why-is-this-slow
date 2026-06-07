// Spawned by the profiler as: node --cpu-prof launcher.js <scriptPath> <durationMs>
// Runs the user's script then exits cleanly so V8 writes the .cpuprofile.
const [,, scriptPath, durationMs] = process.argv;
setTimeout(() => process.exit(0), Number(durationMs));
require(scriptPath);
