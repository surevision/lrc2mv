# Karaoke MV Generator

使用 FFmpeg 将背景图、歌词与MP3生成老式卡拉OK风格MV视频。

## 环境要求

- Node.js 18+
- FFmpeg 和 FFprobe (需加入PATH环境变量)

## 安装依赖

```bash
npm install
```

## 使用方法

```bash
# 基本用法
node karaoke_mv.js <mp3> <lrc> <pic> <output>

# 包含第二音轨（伴奏，可通过 https://github.com/jianchang512/vocal-separate 项目分离人声生成）
node karaoke_mv.js song.mp3 song.lrc cover.png output.mp4 -a backing.mp3
```

### 参数说明

| 参数 | 说明 |
|------|------|
| mp3 | 音频文件路径 |
| lrc | 歌词文件路径（支持多种格式） |
| pic | 封面图片路径 |
| output | 输出视频路径 |
| -a, --audio2 | 第二音轨MP3文件（可选） |

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
## 下载歌词

### 洛雪音乐

洛雪音乐开启本地开放API后通过接口获取

```bash
node lxmusic.js output.lxlrc
```

### 酷狗
```bash
node kugou_krc.js "歌手" "歌名" output.krc
```

### 增强LRC格式

可通过 https://github.com/chenmozhijin/LDDC 搜索下载

## 示例

```bash
# 生成基础MV
node karaoke_mv.js test.mp3 test.lxlrc cover.png output.mp4

# 生成带伴奏的MV
node karaoke_mv.js test.mp3 test.lxlrc cover.png output.mp4 -a backing.mp3
```

## 项目结构

```
.
├── karaoke_mv.js    # 主程序
├── lxmusic.js       # LX Music歌词下载
├── kugou_krc.js     # 酷狗歌词下载
├── package.json     # 依赖配置
```
