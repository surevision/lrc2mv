# Karaoke MV Generator

使用 FFmpeg 将背景图、歌词与MP3生成老式卡拉OK风格MV视频。

## 环境要求

- Node.js 18+
- Python 3（用于remove_vocal.py）
- FFmpeg 和 FFprobe（需加入PATH环境变量）

## 安装依赖

```bash
npm install
pip install requests
```

## 脚本说明

| 脚本 | 说明 |
|------|------|
| karaoke_mv.js | 单个MP3生成MV |
| karaoke_mv_folder.js | 批量文件夹生成MV |
| remove_vocal.py | 调用API去除人声 |
| wav2mp3.js | WAV转MP3 |
| lxmusic.js | LX Music歌词下载 |
| kugou_krc.js | 酷狗歌词下载 |

## 使用方法

### 单个MP3生成MV

```bash
node karaoke_mv.js <mp3> <lrc> <pic> <output>

# 包含第二音轨（伴奏）
node karaoke_mv.js song.mp3 song.lrc cover.png output.mp4 -a backing.mp3
```

### 批量文件夹生成MV

```bash
node karaoke_mv_folder.js <folder>
```

自动处理文件夹下所有不含`off_vocal`的MP3文件，匹配规则：
- 歌词：同名.lrc/.krc/.lxlrc
- 封面：同名.png/.jpg/.jpeg
- 无人声：同名_off_vocal.mp3
- 通用封面：脚本目录下的commonbg.png

### 去除人声

```bash
# 单个文件
python remove_vocal.py input.mp3

# 多个文件
python remove_vocal.py file1.mp3 file2.mp3

# 文件夹（处理所有不含off_vocal的mp3）
python remove_vocal.py folder/
```

接口需运行 https://github.com/jianchang512/vocal-separate

### WAV转MP3

```bash
node wav2mp3.js input.wav output.mp3
```

## 支持的歌词格式

### 1. 普通LRC格式
```
[00:00.00]歌词内容
[00:05.00]第二句歌词
```

### 2. 逐字歌词格式
支持 KRC (酷狗)、LXLRC (洛雪音乐)、增强LRC 三种逐字格式。

#### KRC格式 (酷狗)
```
[00:16.92]<00:00.00>歌<00:00.40>词<00:00.80>内<00:01.20>容
```

#### LXLRC格式 (洛雪音乐)
```
[00:16.92]<0,400>歌词内容
```

#### 增强LRC格式
```
[00:16.92]<00:00.000>歌<00:00.400>词<00:00.800>内<00:01.200>容
```

## 输出效果

- **Preview样式**: 白色底色文字，用于显示即将演唱的歌词
- **Karaoke样式**: 渐变填充文字（白色→黄色），逐字高亮显示

歌词显示位置：
- 左下角 (250, 780) - 第一、三句
- 右下角 (1660, 880) - 第二、四句

一次显示两句歌词，下一对歌词在当前对消失时出现。

## 项目结构

```
.
├── karaoke_mv.js          # 单个MP3生成MV
├── karaoke_mv_folder.js   # 批量文件夹生成MV
├── remove_vocal.py       # 去除人声
├── wav2mp3.js            # WAV转MP3
├── lxmusic.js           # LX Music歌词下载
├── kugou_krc.js         # 酷狗歌词下载
├── commonbg.png         # 通用背景图（可选）
├── package.json         # Node.js依赖
└── README.md           # 说明文档
```