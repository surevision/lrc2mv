#!/usr/bin/env node
import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LRCParser, KaraokeMVGenerator } from './karaoke_mv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getFilesWithExtension(dir, extension) {
  return readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith(extension.toLowerCase()))
    .map(f => join(dir, f));
}

function findMatchingFile(dir, baseName, extension) {
  const candidates = [
    `${baseName}.${extension}`,
    `${baseName}.${extension.toUpperCase()}`,
  ];
  for (const candidate of candidates) {
    const fullPath = join(dir, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

async function processFolder(folderPath) {
  console.log(`处理文件夹: ${folderPath}\n`);
  
  const mp3Files = readdirSync(folderPath)
    .filter(f => f.toLowerCase().endsWith('.mp3') && !f.toLowerCase().includes('off_vocal'))
    .map(f => join(folderPath, f));

  console.log(`找到 ${mp3Files.length} 个MP3文件\n`);

  let index = 0;
  for (const mp3File of mp3Files) {
    index++;
    const baseName = basename(mp3File, '.mp3');
    
    const lrcFile = findMatchingFile(folderPath, baseName, 'lrc') 
                 || findMatchingFile(folderPath, baseName, 'krc')
                 || findMatchingFile(folderPath, baseName, 'lxlrc');
    
    let pngFile = findMatchingFile(folderPath, baseName, 'png') 
               || findMatchingFile(folderPath, baseName, 'jpg')
               || findMatchingFile(folderPath, baseName, 'jpeg');
    
    if (!pngFile) {
      const commonBg = join(__dirname, 'commonbg.png');
      if (existsSync(commonBg)) {
        pngFile = commonBg;
      }
    }
    
    const offVocalFile = join(folderPath, `${baseName}_off_vocal.mp3`);
    const hasOffVocal = existsSync(offVocalFile);

    console.log(`=== ${baseName} ===`);
    
    if (!lrcFile) {
      console.log(`  [跳过 ${index}/${mp3Files.length}] 找不到LRC歌词文件`);
      console.log('');
      continue;
    }

    if (!pngFile) {
      console.log(`  [跳过 ${index}/${mp3Files.length}] 找不到封面图片`);
      console.log('');
      continue;
    }

    const outputFile = join(folderPath, `${baseName}.mp4`);

    try {
      console.log(`  MP3: ${mp3File}`);
      console.log(`  LRC: ${lrcFile}`);
      console.log(`  封面: ${pngFile}`);
      console.log(`  输出: ${outputFile}`);
      if (hasOffVocal) {
        console.log(`  无人声: ${offVocalFile}`);
      }
      console.log(`  正在生成...`);
      
      const generator = new KaraokeMVGenerator(mp3File, lrcFile, pngFile, outputFile, hasOffVocal ? offVocalFile : null);
      await generator.generate();
      
      console.log(`  [完成 ${index}/${mp3Files.length}]\n`);
    } catch (err) {
      console.log(`  [错误 ${index}/${mp3Files.length}] ${err.message}\n`);
    }
  }

  console.log(`全部完成`);
}

if (process.argv.length < 3) {
  console.error('用法: node karaoke_mv_folder.js <folder>');
  process.exit(1);
}

const folderPath = process.argv[2];

if (!existsSync(folderPath)) {
  console.error(`错误: 文件夹不存在: ${folderPath}`);
  process.exit(1);
}

processFolder(folderPath);