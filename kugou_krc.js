#!/usr/bin/env node
import { spawn } from 'child_process';
import { createWriteStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

async function searchLyrics(artist, title, duration = 0) {
  const url = "http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword="
    + encodeURIComponent(artist + "-" + title)
    + (duration > 0 ? ("&duration=" + Math.round(duration) * 1000) : "")
    + "&hash=";

  console.log(`搜索: ${artist} - ${title}`);
  const data = await fetchJson(url);

  const candidates = data.candidates || [];
  const results = [];

  for (const item of candidates) {
    if (item.id === null || item.accesskey === null) continue;
    results.push({
      id: item.id,
      key: item.accesskey,
      title: item.song || "",
      artist: item.singer || "",
    });
  }

  return results;
}

async function downloadKrc(id, key) {
  const url = "http://lyrics.kugou.com/download?ver=1&client=pc&id="
    + id + "&accesskey=" + key
    + "&fmt=krc&charset=utf8";

  const data = await fetchJson(url);

  if (!data.content) {
    throw new Error("No content in response");
  }

  return Buffer.from(data.content, 'base64');
}

function xorKRC(rawData) {
  const dataView = new Uint8Array(rawData);
  const magicBytes = [0x6b, 0x72, 0x63, 0x31];

  if (dataView.length < magicBytes.length) return null;

  for (let i = 0; i < magicBytes.length; ++i) {
    if (dataView[i] !== magicBytes[i]) return null;
  }

  const decryptedData = new Uint8Array(dataView.length - magicBytes.length);
  const encKey = [0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69];
  const hdrOffset = magicBytes.length;

  for (let i = hdrOffset; i < dataView.length; ++i) {
    const x = dataView[i];
    const y = encKey[(i - hdrOffset) % encKey.length];
    decryptedData[i - hdrOffset] = x ^ y;
  }

  return decryptedData;
}

function formatTime(time) {
  const t = Math.abs(time / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 100);

  const zpad = (n) => n.toString().padStart(2, '0');
  return (h ? zpad(h) + ":" : "") + zpad(m) + ":" + zpad(s) + "." + zpad(ms);
}

function krc2lrc(krcText) {
  let lyricText = "";
  let translateLyricContent = [];
  let translateIndex = 0;

  const metaRegex = /^\[(\S+):(\S+)\]$/;
  const timestampsRegex = /^\[(\d+),(\d+)\]/;
  const timestamps2Regex = /<(\d+),(\d+),(\d+)>([^<]*)/g;

  const lines = krcText.split(/[\r\n]/);

  for (const line of lines) {
    let matches;

    if ((matches = metaRegex.exec(line))) {
      if (matches[1] === 'language') {
        try {
          const langObj = JSON.parse(Buffer.from(matches[2], 'base64').toString());
          const contentArrayObj = langObj['content'] || [];
          if (contentArrayObj.length > 0 && contentArrayObj[0].type === 1) {
            translateLyricContent = contentArrayObj[0].lyricContent || [];
          }
        } catch (e) {}
        continue;
      }
      lyricText += matches[0] + "\r\n";
    } else if ((matches = timestampsRegex.exec(line))) {
      let lyricLine = "";
      const startTime = parseInt(matches[1]);
      const duration = parseInt(matches[2]);
      lyricLine = "[" + formatTime(startTime) + "]";

      let subMatches;
      timestamps2Regex.lastIndex = 0;
      while ((subMatches = timestamps2Regex.exec(line))) {
        const offset = parseInt(subMatches[1]);
        const subWord = subMatches[4];
        lyricLine += "<" + formatTime(startTime + offset) + ">" + subWord;
      }
      lyricLine += "<" + formatTime(startTime + duration) + ">";

      if (translateLyricContent.length > translateIndex) {
        lyricLine += "\r\n";
        lyricLine += "[" + formatTime(startTime) + "]" + translateLyricContent[translateIndex];
        ++translateIndex;
      }

      lyricText += lyricLine + "\r\n";
    }
  }

  return lyricText;
}

function parseKrc(krcBuffer) {
  const decryptedData = xorKRC(krcBuffer);
  if (!decryptedData) {
    throw new Error("Invalid KRC file format");
  }

  const decompressed = zlib.inflateSync(Buffer.from(decryptedData));
  const krcText = decompressed.toString('utf-8');

  return krc2lrc(krcText);
}

async function searchAndDownload(artist, title, outputFile, duration = 0, downloadAll = false) {
  const candidates = await searchLyrics(artist, title, duration);

  if (candidates.length === 0) {
    console.log("未找到歌词");
    return false;
  }

  console.log(`找到 ${candidates.length} 个歌词版本:`);
  candidates.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.artist} - ${c.title}`);
  });

  if (downloadAll) {
    console.log("\n下载所有版本...");
    const fs = await import('fs');
    
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      console.log(`\n[${i + 1}/${candidates.length}] ${c.artist} - ${c.title}`);
      
      try {
        const krcBuffer = await downloadKrc(c.id, c.key);
        console.log(`  KRC文件大小: ${krcBuffer.length} 字节`);
        
        const lrcText = parseKrc(krcBuffer);
        
        const safeArtist = c.artist.replace(/[\\/:*?"<>|]/g, '_');
        const safeTitle = c.title.replace(/[\\/:*?"<>|]/g, '_');
        const lrcFile = outputFile 
          ? outputFile.replace(/\.lrc$/i, `_v${i + 1}.krc`)
          : `${safeArtist} - ${safeTitle}_v${i + 1}.krc`;
        
        fs.writeFileSync(lrcFile, lrcText, 'utf-8');
        console.log(`  已保存: ${lrcFile}`);
      } catch (error) {
        console.log(`  下载失败: ${error.message}`);
      }
    }
  } else {
    const best = candidates[0];
    console.log(`\n下载: ${best.artist} - ${best.title}`);

    const krcBuffer = await downloadKrc(best.id, best.key);
    console.log(`KRC文件大小: ${krcBuffer.length} 字节`);

    const lrcText = parseKrc(krcBuffer);

    if (outputFile) {
      const fs = await import('fs');
      fs.writeFileSync(outputFile, lrcText, 'utf-8');
      console.log(`已保存: ${outputFile}`);
    } else {
      console.log("\n===== LRC歌词 =====\n");
      console.log(lrcText);
    }
  }

  return true;
}

program
  .name('kugou-krc')
  .description('从酷狗音乐搜索下载KRC格式歌词')
  .argument('<artist>', '歌手名')
  .argument('<title>', '歌曲名')
  .argument('[output]', '输出LRC文件路径（可选，不指定则打印到屏幕）')
  .option('-d, --duration <seconds>', '歌曲时长（秒）', '0')
  .option('-a, --all', '下载所有版本的歌词', false)
  .action(async (artist, title, output, options) => {
    const duration = parseInt(options.duration) || 0;
    const downloadAll = options.all;

    try {
      await searchAndDownload(artist, title, output, duration, downloadAll);
    } catch (error) {
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
