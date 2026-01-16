from PIL import Image, ImageDraw, ImageFont

# 创建不同尺寸的图标
sizes = [16, 48, 128]
for size in sizes:
    # 创建图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制渐变背景圆
    margin = size // 32
    draw.ellipse([margin, margin, size-margin, size-margin], 
                 fill=(102, 126, 234, 255))
    
    # 绘制文字
    text_color = (255, 255, 255, 255)
    font_size = int(size * 0.6)
    
    # 尝试使用系统字体
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
    
    # 绘制"A"
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((size - text_width) // 2, (size - text_height) // 2 - size//8)
    draw.text(position, text, fill=text_color, font=font)
    
    # 保存图标
    img.save(f'icon{size}.png')
    print(f"Created icon{size}.png")

print("All icons created successfully!")