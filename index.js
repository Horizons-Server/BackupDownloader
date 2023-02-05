import axios from "axios";
import { config } from "dotenv";
import fs from "fs";
import { Readable } from "stream";
import { finished } from "stream/promises";

config();

if (!fs.existsSync("downloads")) fs.mkdirSync("downloads");
scheduleDownload();

function scheduleDownload() {
    if (!fs.existsSync("downloads/minecraft.tar.gz")) return downloadMinecraftBackup();

    const modifiedTime = new Date(fs.statSync("downloads/minecraft.tar.gz").ctime).getTime();
    if (modifiedTime + parseInt(process.env.INTERVAL) > Date.now()) setTimeout(downloadMinecraftBackup, modifiedTime + parseInt(process.env.INTERVAL) - Date.now());
    else downloadMinecraftBackup();
}

async function downloadMinecraftBackup() {
    const index = (await axios.get(process.env.BACKUPS_URL)).data;

    let files = [];
    // Iterate through file and find links to files
    for (const line of index.split("\n")) {
        if (line.startsWith("<a href=")) {
            files.push({ name: line.split("\"")[1], time: Date.parse(line.split(" ").filter(s => s.trim() != "")[2]) })
        }
    }

    let latestFile;
    let latestFileTime;

    for (const file of files) {
        if (!latestFile || file.time > latestFileTime) {
            latestFile = file.name;
            latestFileTime = file.time;
        }
    }

    // Now let's download it
    log("Beginning download of " + latestFile);

    const stream = fs.createWriteStream("downloads/minecraft.tar.gz");
    const { body } = await fetch(process.env.BACKUPS_URL + "/" + latestFile);
    await finished(Readable.fromWeb(body).pipe(stream));

    log("Finished download of " + latestFile);
    scheduleDownload();
}

function log(message) {
    console.log(new Date().toUTCString() + " > " + message);
    axios.post(process.env.WEBHOOK_URL, {
        content: message
    });
}