#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class LRCParser {
    constructor(lrcFile) {
        this.lrcFile = lrcFile;
        this.lyrics = [];
        this.isKRC = lrcFile.toLowerCase().endsWith('.krc');
        this.isLXLRC = lrcFile.toLowerCase().endsWith('.lxlrc');
        this.isEnhancedLRC = false;
        this._parse();
    }

    _parse() {
        const content = readFileSync(this.lrcFile, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // LXLRC 格式解析
            if (this.isLXLRC) {
                const lxlrcRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]((?:<\d+,\d+>[^<]*)+)/;
                const lxlrcMatch = lxlrcRegex.exec(trimmedLine);

                if (lxlrcMatch) {
                    const [, minutes, seconds, milliseconds, charText] = lxlrcMatch;
                    const lineTimeMs = parseInt(minutes) * 60000 + parseInt(seconds) * 1000 + parseInt(milliseconds.padEnd(3, '0').slice(0, 3));

                    const chars = [];
                    const charRegex = /<(\d+),(\d+)>([^<]*)/g;
                    let charMatch;

                    while ((charMatch = charRegex.exec(charText)) !== null) {
                        const [, offset, duration, char] = charMatch;
                        const charOffsetMs = parseInt(offset);
                        const charDurationMs = parseInt(duration);
                        
                        if (char.trim()) {
                            chars.push({
                                char: char,
                                startTime: lineTimeMs + charOffsetMs,
                                endTime: lineTimeMs + charOffsetMs + charDurationMs
                            });
                        }
                    }

                    this.lyrics.push({
                        time: lineTimeMs,
                        text: chars.map(c => c.char).join(''),
                        chars: chars
                    });
                }
                continue;
            }

            // 增强LRC格式解析 (后缀名是.lrc但内容是逐字歌词)
            const enhancedLRCRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]((?:<\d{2}:\d{2}\.\d{3}>[^<]*)+)/;
            const enhancedLRCMatch = enhancedLRCRegex.exec(trimmedLine);

            if (enhancedLRCMatch) {
                this.isEnhancedLRC = true;
                const [, minutes, seconds, milliseconds, charText] = enhancedLRCMatch;
                const lineTimeMs = parseInt(minutes) * 60000 + parseInt(seconds) * 1000 + parseInt(milliseconds.padEnd(3, '0').slice(0, 3));

                const chars = [];
                const charRegex = /<(\d{2}):(\d{2})\.(\d{3})>([^<]*)/g;
                let charMatch;
                const charTimes = [];

                // 先提取所有字的时间
                while ((charMatch = charRegex.exec(charText)) !== null) {
                    const [, cMin, cSec, cMs, char] = charMatch;
                    const charTimeMs = parseInt(cMin) * 60000 + parseInt(cSec) * 1000 + parseInt(cMs.padEnd(3, '0').slice(0, 3));
                    charTimes.push({
                        time: charTimeMs,
                        char: char
                    });
                }

                // 然后根据时间计算每个字的开始和结束时间
                for (let i = 0; i < charTimes.length; i++) {
                    const current = charTimes[i];
                    const next = charTimes[i + 1];

                    if (current.char.trim()) {
                        chars.push({
                            char: current.char,
                            startTime: lineTimeMs + current.time,
                            endTime: next ? lineTimeMs + next.time : lineTimeMs + current.time + 500
                        });
                    }
                }

                this.lyrics.push({
                    time: lineTimeMs,
                    text: chars.map(c => c.char).join(''),
                    chars: chars
                });
                continue;
            }

            // KRC 格式解析
            if (this.isKRC) {
                const krcRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]((?:<\d{2}:\d{2}\.\d{2}>[^<]*)+)/;
                const krcMatch = krcRegex.exec(trimmedLine);
                const [, minutes, seconds, milliseconds, charText] = krcMatch;
                const lineTimeMs = parseInt(minutes) * 60000 + parseInt(seconds) * 1000 + parseInt(milliseconds.padEnd(3, '0').slice(0, 3));

                const chars = [];
                const charRegex = /<(\d{2}):(\d{2})\.(\d{2})>([^<]*)/g;
                let charMatch;
                let lastEndTime = lineTimeMs;

                while ((charMatch = charRegex.exec(charText)) !== null) {
                    const [, cMin, cSec, cMs, char] = charMatch;
                    const charTimeMs = parseInt(cMin) * 60000 + parseInt(cSec) * 1000 + parseInt(cMs.padEnd(3, '0').slice(0, 3));
                    
                    if (char.trim()) {
                        chars.push({
                            char: char,
                            startTime: lastEndTime,
                            endTime: charTimeMs
                        });
                    }

                    lastEndTime = charTimeMs;
                }

                this.lyrics.push({
                    time: lineTimeMs,
                    text: chars.map(c => c.char).join(''),
                    chars: chars
                });
            } else {
                // 普通 LRC 格式解析
                const lrcRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
                let match;

                while ((match = lrcRegex.exec(trimmedLine)) !== null) {
                    const [, minutes, seconds, milliseconds, text] = match;
                    const timeMs = parseInt(minutes) * 60000 + parseInt(seconds) * 1000 + parseInt(milliseconds.padEnd(3, '0').slice(0, 3));

                    this.lyrics.push({
                        time: timeMs,
                        text: text.trim(),
                        chars: null
                    });
                }
            }
        }

        this.lyrics.sort((a, b) => a.time - b.time);
    }

    getLyrics() {
        return this.lyrics;
    }

    getDuration() {
        if (this.lyrics.length === 0) return 0;
        return this.lyrics[this.lyrics.length - 1].time + 5000;
    }

    isKRCFormat() {
        return this.isKRC;
    }

    isLXLRCFormat() {
        return this.isLXLRC;
    }

    isEnhancedLRCFormat() {
        return this.isEnhancedLRC;
    }
}

class KaraokeMVGenerator {
    constructor(mp3File, lrcFile, picFile, outputFile, audio2File = null) {
        this.mp3File = mp3File;
        this.lrcFile = lrcFile;
        this.picFile = picFile;
        this.outputFile = outputFile;
        this.audio2File = audio2File;
        this.parser = new LRCParser(lrcFile);
        this.tempDir = resolve(join(__dirname, 'temp'));
        
        if (!existsSync(this.tempDir)) {
            mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async _getAudioDuration() {
        return new Promise((resolve, reject) => {
            const cmd = spawn('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                this.mp3File
            ]);
            
            let stdout = '';
            let stderr = '';
            
            cmd.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            cmd.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            cmd.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`ffprobe failed: ${stderr}`));
                } else {
                    resolve(parseFloat(stdout.trim()));
                }
            });
        });
    }

    _createKaraokeASS() {
        const karaokeFile = join(this.tempDir, 'karaoke.ass');
        
        const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke_left, SimHei, 56, &H0000FFFF, &H00FFFFFF, &H00000000, &H80000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 2, 1, 10, 10, 50, 1
Style: Preview_left, SimHei, 56, &H00FFFFFF, &H0000FFFF, &H00000000, &H80000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 2, 1, 10, 10, 50, 1
Style: Karaoke_right, SimHei, 56, &H0000FFFF, &H00FFFFFF, &H00000000, &H80000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 2, 3, 10, 10, 50, 1
Style: Preview_right, SimHei, 56, &H00FFFFFF, &H0000FFFF, &H00000000, &H80000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 2, 3, 10, 10, 50, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        const lyrics = this.parser.getLyrics();
        const isKRC = this.parser.isKRCFormat();
        const isLXLRC = this.parser.isLXLRCFormat();
        const isEnhancedLRC = this.parser.isEnhancedLRCFormat();
        let dialogueContent = '';

        for (let i = 0; i < lyrics.length; i += 2) {
            const currentLyric = lyrics[i];
            const nextLyric = i + 1 < lyrics.length ? lyrics[i + 1] : null;
            const nextTriLyric = i + 2 < lyrics.length ? lyrics[i + 2] : null;
            const nextFourLyric = i + 3 < lyrics.length ? lyrics[i + 3] : null;

            const startTime = currentLyric.time / 1000;

            let nextPairStartTime;
            if (i + 2 < lyrics.length) {
                nextPairStartTime = lyrics[i + 2].time / 1000;
            } else if (i + 1 < lyrics.length) {
                nextPairStartTime = lyrics[i + 1].time / 1000 + 5;
            } else {
                nextPairStartTime = startTime + 5;
            }

            // 第一句
            if (currentLyric.text.trim()) {
                const escapedText = this._escapeText(currentLyric.text);
                const startStr = this._formatTime(startTime);
                const endStr = this._formatTime(nextLyric ? nextLyric.time / 1000 : nextPairStartTime);
                const posStr = '{\\pos(250,780)}';

                dialogueContent += `Dialogue: 0,${startStr},${endStr},Preview_left,,0,0,0,,${posStr}${escapedText}\n`;

                const lyricEndTime = nextLyric ? nextLyric.time / 1000 : nextPairStartTime;
                const karaokeText = (isKRC || isLXLRC || isEnhancedLRC) && currentLyric.chars 
                    ? this._createKaraokeTextKRC(currentLyric.chars, startTime)
                    : this._createKaraokeText(currentLyric.text, startTime, lyricEndTime);
                const karaokeStartStr = this._formatTime(startTime);
                const karaokeEndStr = this._formatTime(lyricEndTime);
                dialogueContent += `Dialogue: 0,${karaokeStartStr},${karaokeEndStr},Karaoke_left,,0,0,0,,${posStr}${karaokeText}\n`;
            }

            // 第二句
            if (nextLyric && nextLyric.text.trim()) {
                const escapedText = this._escapeText(nextLyric.text);
                const startStr = this._formatTime(i == 0 ? startTime : nextLyric.time / 1000);  // 第一对歌词的第二句从第一句开始时间开始，之后的第二句从第二句开始时间开始
                const endStr = this._formatTime(nextPairStartTime);
                const posStr = '{\\pos(1660,880)}';

                dialogueContent += `Dialogue: 0,${startStr},${endStr},Preview_right,,0,0,0,,${posStr}${escapedText}\n`;

                const lyricEndTime = nextLyric.time / 1000;
                const karaokeText = (isKRC || isLXLRC || isEnhancedLRC) && nextLyric.chars 
                    ? this._createKaraokeTextKRC(nextLyric.chars, nextLyric.time / 1000)
                    : this._createKaraokeText(nextLyric.text, nextLyric.time / 1000, nextPairStartTime);
                const karaokeStartStr = this._formatTime(nextLyric.time / 1000);
                const karaokeEndStr = this._formatTime(nextPairStartTime);
                dialogueContent += `Dialogue: 0,${karaokeStartStr},${karaokeEndStr},Karaoke_right,,0,0,0,,${posStr}${karaokeText}\n`;
            }

            // 第三句（如果存在）
            if (nextTriLyric && nextTriLyric.text.trim()) {
                const escapedText = this._escapeText(nextTriLyric.text);
                // preivew在第一句消失时就出现，karaoke不处理
                const startStr = this._formatTime(nextLyric.time / 1000);
                const endStr = this._formatTime(nextTriLyric.time / 1000);
                const posStr = '{\\pos(250,780)}';

                dialogueContent += `Dialogue: 0,${startStr},${endStr},Preview_left,,0,0,0,,${posStr}${escapedText}\n`;
            }

            // 第四句（如果存在）
            if (nextFourLyric && nextFourLyric.text.trim()) {
                const escapedText = this._escapeText(nextFourLyric.text);
                // preivew在第二句消失时就出现，karaoke不处理
                const startStr = this._formatTime(nextPairStartTime);
                const endStr = this._formatTime(nextFourLyric.time / 1000);
                const posStr = '{\\pos(1660,880)}';

                dialogueContent += `Dialogue: 0,${startStr},${endStr},Preview_right,,0,0,0,,${posStr}${escapedText}\n`;
            }

        }

        writeFileSync(karaokeFile, assContent + dialogueContent, 'utf8');
        return karaokeFile;
    }

  _escapeText(text) {
    return text.replace(/\\\\/g, '\\\\\\\\').replace(/{/g, '\\\\{').replace(/}/g, '\\\\}');
  }

  _createKaraokeText(text, startTime, endTime) {
    const duration = endTime - startTime;
    const charCount = text.length;
    const charDuration = charCount > 0 ? duration / charCount : duration;

    let karaokeText = '';
    for (const char of text) {
      const charCs = Math.floor(charDuration * 100);
      const escapedChar = char.replace(/\\\\/g, '\\\\\\\\').replace(/{/g, '\\\\{').replace(/}/g, '\\\\}');
      karaokeText += `{\\\\K${charCs}}${escapedChar}`;
    }

    return karaokeText;
  }

  _createKaraokeTextKRC(chars, lineStartTime) {
    let karaokeText = '';
    for (const charData of chars) {
      const char = charData.char;
      const charStartTime = charData.startTime / 1000;
      const charEndTime = charData.endTime / 1000;
      const charDuration = charEndTime - charStartTime;
      const charCs = Math.floor(charDuration * 100);
      const escapedChar = char.replace(/\\\\/g, '\\\\\\\\').replace(/{/g, '\\\\{').replace(/}/g, '\\\\}');
      karaokeText += `{\\\\K${charCs}}${escapedChar}`;
    }

    return karaokeText;
  }

  _formatTime(timeSeconds) {
        const hours = Math.floor(timeSeconds / 3600);
        const minutes = Math.floor((timeSeconds % 3600) / 60);
        const seconds = Math.floor(timeSeconds % 60);
        const centiseconds = Math.floor((timeSeconds % 1) * 100);

        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }

async generate() {
    console.log(`开始生成MV: ${this.outputFile}`);

    const audioDuration = await this._getAudioDuration();
    console.log(`音频时长: ${audioDuration.toFixed(2)}秒`);

    const outputVideo = join(this.tempDir, 'output.mp4');

    await this._runFFmpeg([
      '-y',
      '-loop', '1',
      '-i', this.picFile,
      '-i', this.mp3File,
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      '-t', audioDuration.toString(),
      outputVideo
    ], '正在合成基础视频...');

    const karaokeFile = this._createKaraokeASS();
    const finalOutput = join(this.tempDir, 'final.mp4');

    const assFilter = `ass=${karaokeFile}`.replace(/\\/g, '/').replace(/:/g, '\\\\:');

    const ffmpegArgs2 = [
      '-y',
      '-i', outputVideo
    ];
    
    if (this.audio2File) {
      ffmpegArgs2.push('-i', this.audio2File);
    }

      ffmpegArgs2.push(
      '-filter_complex', `[0:v]${assFilter}[outv]`,
      '-map', '[outv]',
      '-c:v', 'libx264',
      '-tune', 'stillimage'
    );


    if (this.audio2File) {
      ffmpegArgs2.push('-map', '0:a', '-map', '1:a', '-c:a', 'copy');
    } else {
      ffmpegArgs2.push('-map', '0:a', '-c:a', 'copy');
    }

    ffmpegArgs2.push(finalOutput);

    await this._runFFmpeg(ffmpegArgs2, '正在添加歌词...');

    const fs = await import('fs');
    fs.renameSync(finalOutput, this.outputFile);

    console.log(`MV生成完成: ${this.outputFile}`);
    this._cleanup();
  }

  _runFFmpeg(args, message) {
    return new Promise((resolve, reject) => {
      console.log(message);
      const cmd = spawn('ffmpeg', args);

      let stdout = '';
      let stderr = '';

      cmd.stdout.on('data', (data) => {
          stdout += data.toString();
      });

      cmd.stderr.on('data', (data) => {
          stderr += data.toString();
      });

      cmd.on('close', (code) => {
          if (code !== 0) {
              reject(new Error(`ffmpeg failed: ${stderr}`));
          } else {
              resolve(parseFloat(stdout.trim()));
          }
      });

      cmd.on('error', reject);
    });
  }

  _cleanup() {
    if (existsSync(this.tempDir)) {
      const files = readdirSync(this.tempDir);
      for (const file of files) {
        unlinkSync(join(this.tempDir, file));
      }
      rmdirSync(this.tempDir);
    }
  }
}

program
  .name('karaoke-mv')
  .description('生成老式卡拉OK风格MV')
  .argument('<mp3>', 'MP3音频文件路径')
  .argument('<lrc>', 'LRC歌词文件路径')
  .argument('<pic>', '封面图片文件路径')
  .argument('<output>', '输出视频文件路径')
  .option('-a, --audio2 <file>', '第二音轨MP3文件路径（可选）')
  .action(async (mp3, lrc, pic, output, options) => {
    if (!existsSync(mp3)) {
      console.error(`错误: MP3文件不存在: ${mp3}`);
      process.exit(1);
    }

    if (!existsSync(lrc)) {
      console.error(`错误: LRC文件不存在: ${lrc}`);
      process.exit(1);
    }

    if (!existsSync(pic)) {
      console.error(`错误: 封面图片文件不存在: ${pic}`);
      process.exit(1);
    }

    if (options.audio2 && !existsSync(options.audio2)) {
      console.error(`错误: 第二音轨MP3文件不存在: ${options.audio2}`);
      process.exit(1);
    }

    const generator = new KaraokeMVGenerator(mp3, lrc, pic, output, options.audio2);
    await generator.generate();
  });

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  program.parse();
}

export { LRCParser, KaraokeMVGenerator };
