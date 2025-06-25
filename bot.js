const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const axios = require('axios');
const yts = require('ytsr');
const ytdl = require('ytdl-core');
const tikly = require('tiklydown');

const { state, saveState } = useSingleFileAuthState('./session.json');

async function startSock() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!body) return;

        const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

        if (body.startsWith('.yts')) {
            const query = body.slice(4).trim();
            if (!query) return reply('🔍 Please enter search text.');
            const res = await yts(query);
            const videos = res.items.filter(v => v.type === 'video');
            if (!videos.length) return reply('❌ No results found.');
            let txt = videos.slice(0, 5).map((v, i) => `${i + 1}. ${v.title} (${v.duration})\n${v.url}`).join('\n\n');
            return reply(txt);
        }

        if (body.startsWith('.ytmp4')) {
            const url = body.slice(7).trim();
            if (!ytdl.validateURL(url)) return reply('❌ Invalid YouTube URL.');
            const info = await ytdl.getInfo(url);
            const format = ytdl.chooseFormat(info.formats, { quality: '18' });
            await sock.sendMessage(from, {
                video: { url: format.url },
                caption: info.videoDetails.title,
            }, { quoted: msg });
        }

        if (body.startsWith('.play') || body.startsWith('.song')) {
            const query = body.split(' ').slice(1).join(' ');
            if (!query) return reply('🎵 Please provide song name.');
            const res = await yts(query);
            const song = res.items.find(i => i.type === 'video');
            if (!song) return reply('❌ Song not found.');
            const stream = ytdl(song.url, { filter: 'audioonly' });
            await sock.sendMessage(from, {
                audio: { stream },
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: msg });
        }

        if (body.startsWith('.tiktok')) {
            const url = body.split(' ')[1];
            if (!url) return reply('🔗 Provide a TikTok link.');
            try {
                const data = await tikly(url);
                await sock.sendMessage(from, {
                    video: { url: data.video.noWatermark },
                    caption: data.title
                }, { quoted: msg });
            } catch (e) {
                reply('❌ Failed to download TikTok.');
            }
        }

        if (body.startsWith('.tiktoksearch')) {
            return reply('❌ TikTok search not supported in demo.');
        }
    });
}

startSock();
