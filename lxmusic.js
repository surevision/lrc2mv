#!/usr/bin/env node
import { program } from 'commander';
import { writeFileSync } from 'fs';

async function downloadLxMusicLyric() {
  try {
    const response = await fetch('http://127.0.0.1:23330/lyric-all');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.lxlyric) {
      throw new Error('未找到歌词数据');
    }
    
    return data.lxlyric;
  } catch (error) {
    throw new Error(`下载歌词失败: ${error.message}`);
  }
}

async function saveLyric(lyricText, outputFile) {
  try {
    writeFileSync(outputFile, lyricText, 'utf-8');
    console.log(`歌词已保存到: ${outputFile}`);
  } catch (error) {
    throw new Error(`保存歌词失败: ${error.message}`);
  }
}

program
  .name('lxmusic')
  .description('从洛雪音乐下载当前播放歌曲的歌词')
  .argument('[output]', '输出文件路径（默认: current.lxlrc）', 'current.lxlrc')
  .action(async (output) => {
    try {
      console.log('正在下载歌词...');
      const lyricText = await downloadLxMusicLyric();
      
      console.log('歌词下载成功');
      console.log(`歌词长度: ${lyricText.length} 字符`);
      console.log(`歌词行数: ${lyricText.split('\n').length} 行`);
      
      await saveLyric(lyricText, output);
      
      console.log('\n歌词预览:');
      const lines = lyricText.split('\n');
      const previewLines = lines.slice(0, 10);
      console.log(previewLines.join('\n'));
      
      if (lines.length > 10) {
        console.log(`... (共 ${lines.length} 行)`);
      }
    } catch (error) {
      console.error(`错误: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
