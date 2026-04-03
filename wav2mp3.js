#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv.length < 4) {
  console.error('用法: node wav2mp3.js <input.wav> <output.mp3>');
  process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!existsSync(inputFile)) {
  console.error(`错误: 输入文件不存在: ${inputFile}`);
  process.exit(1);
}

const inputPath = resolve(inputFile);
const outputPath = resolve(outputFile);

console.log(`转换中: ${inputPath} -> ${outputPath}`);

const ffmpeg = spawn('ffmpeg', [
  '-i', inputPath,
  '-vn',
  '-ar', '44100',
  '-ac', '2',
  '-b:a', '192k',
  '-y',
  outputPath
]);

ffmpeg.stderr.on('data', (data) => {
  process.stderr.write(data);
});

ffmpeg.on('close', (code) => {
  if (code !== 0) {
    console.error(`FFmpeg失败，退出码: ${code}`);
    process.exit(1);
  }
  console.log(`转换完成: ${outputPath}`);
});