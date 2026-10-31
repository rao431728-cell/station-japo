import { createCompanion,createToken } from "./server";
import { STATION_ORIGIN } from "../lib/companion-contract";
const token=createToken();
if(process.argv.slice(2).some(a=>a!=="--dev")){console.error("Only the optional --dev flag is supported.");process.exit(1);}
const app=createCompanion({token,dev:process.argv.includes("--dev")});
try{await app.listen();}catch{console.error("Could not bind 127.0.0.1:4318. Stop any previous companion before restarting.");process.exit(1);}
console.log(`Station Japo companion listening on http://127.0.0.1:4318\nAllowed website: ${STATION_ORIGIN}${process.argv.includes("--dev")?" and local preview http://localhost:5173":""}\nPaste this temporary token into Station Japo's Local Codex connection panel:\n${token}\nThe token rotates each restart. Keep this terminal open. Ctrl+C stops the companion.`);
for(const sig of ["SIGINT","SIGTERM"] as const)process.on(sig,()=>{app.stop();setTimeout(()=>process.exit(0),500).unref();});
