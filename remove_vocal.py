#!/usr/bin/env python3
import sys
import os
import json
import subprocess
import shutil
import requests
from pathlib import Path
from urllib.parse import urlparse

API_URL = 'http://127.0.0.1:9999/api'

def get_bitrate(mp3_file):
    try:
        ffprobe_path = shutil.which('ffprobe')
        cmd = [ffprobe_path, '-v', 'error', '-select_streams', 'a:0', 
               '-show_entries', 'stream=bit_rate', '-of', 'default=noprint_wrappers=1:nokey=1', mp3_file]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        bitrate = int(result.stdout.strip())
        return bitrate if bitrate > 0 else 192000
    except:
        return 192000

def download_file(url, dest_path):
    response = requests.get(url, timeout=600)
    if response.status_code == 301 or response.status_code == 302:
        return download_file(response.headers['Location'], dest_path)
    with open(dest_path, 'wb') as f:
        f.write(response.content)

def run_ffmpeg(args):
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        cmd = [ffmpeg_path] + args
    else:
        cmd = ['ffmpeg'] + args
    print(f'arg: ffmpeg {" ".join(args)}')
    subprocess.run(cmd, check=True, stderr=subprocess.PIPE)

def remove_vocal(mp3_file):
    if not os.path.exists(mp3_file):
        print(f'错误: 文件不存在: {mp3_file}')
        return

    mp3_path = os.path.abspath(mp3_file)
    original_dir = os.path.dirname(mp3_path)
    original_name = os.path.splitext(os.path.basename(mp3_path))[0]
    output_mp3 = os.path.join(original_dir, f'{original_name}_off_vocal.mp3')
    temp_wav = os.path.join(original_dir, f'{original_name}_temp.wav')

    print(f'正在获取原始码率...')
    bitrate = get_bitrate(mp3_path)
    bitrate_kbps = round(bitrate / 1000)
    print(f'原始码率: {bitrate_kbps}kbps')

    print(f'正在上传并处理: {mp3_file}')
    
    try:
        with open(mp3_path, 'rb') as f:
            files = {'file': f}
            data = {'model': '2stems'}
            response = requests.post(API_URL, timeout=600, data=data, files=files)
            result = response.json()
        
        if result.get('code') != 0:
            print(f'API错误: {result.get("msg", "未知错误")}')
            return

        accompaniment_url = result['data'][0]
        print(f'正在下载伴奏: {accompaniment_url}')
        download_file(accompaniment_url, temp_wav)
        print(f'伴奏下载完成: {temp_wav}')

        print(f'正在转换为MP3 ({bitrate_kbps}kbps)...')
        run_ffmpeg([
            '-i', str(Path(temp_wav)),
            '-vn', '-ar', '44100', '-ac', '2', '-b:a', f'{bitrate_kbps}k',
            '-y', str(Path(output_mp3))
        ])
        os.remove(temp_wav)
        print(f'完成: {output_mp3}')

    except Exception as e:
        print(f'错误: {e}')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('用法: python remove_vocal.py <input.mp3|folder> [input2.mp3|folder2 ...]')
        sys.exit(1)

    input_args = sys.argv[1:]
    input_files = []
    
    for arg in input_args:
        if os.path.isdir(arg):
            for f in os.listdir(arg):
                if f.lower().endswith('.mp3') and 'off_vocal' not in f.lower():
                    input_files.append(os.path.join(arg, f))
        else:
            input_files.append(arg)
    
    print(f'找到 {len(input_files)} 个文件')
    for mp3_file in input_files:
        remove_vocal(mp3_file)