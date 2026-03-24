import makeWASocket, {
    useMultiFileAuthState,
    downloadContentFromMessage,
    DisconnectReason
} from "@whiskeysockets/baileys"

import fs from "fs"
import path from "path"
import P from "pino"

const DOWNLOAD_DIR = "./downloads"

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR)
}

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("auth")

    const sock = makeWASocket({
        logger: P({ level: "silent" }),
        auth: state,
        browser: ["ViewOnce Bot", "Chrome", "1.0.0"]
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) startSock()
        } else if (connection === "open") {
            console.log("✅ Bot Connected")
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return

        try {
            const viewOnce =
                msg.message?.viewOnceMessageV2?.message ||
                msg.message?.viewOnceMessage?.message

            if (!viewOnce) return

            const type = Object.keys(viewOnce)[0]
            const media = viewOnce[type]

            const stream = await downloadContentFromMessage(
                media,
                type.replace("Message", "")
            )

            let buffer = Buffer.from([])
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }

            const fileName = `${Date.now()}.${
                type.includes("image") ? "jpg" : "mp4"
            }`

            const filePath = path.join(DOWNLOAD_DIR, fileName)

            fs.writeFileSync(filePath, buffer)

            console.log("✅ View Once Saved:", filePath)

        } catch (err) {
            console.log("❌ Error downloading:", err)
        }
    })
}

startSock()
