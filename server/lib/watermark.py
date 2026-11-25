# -*- coding: utf-8 -*-
"""给 PDF 加动态水印（用户标识 + 时间），用于泄露追溯。
用法: python watermark.py <src.pdf> <dst.pdf> "<text>"
注意：pymupdf 的 insert_text 只接受 0/90/180/270 的旋转角，这里用水平排布的重复浅色水印。
"""
import sys
import pymupdf


def main():
    src, dst, text = sys.argv[1], sys.argv[2], sys.argv[3]
    doc = pymupdf.open(src)
    for page in doc:
        rect = page.rect
        for row, y in enumerate((0.22, 0.42, 0.62, 0.82)):
            for col, x in enumerate((0.06, 0.36, 0.66)):
                page.insert_text(
                    (rect.width * x, rect.height * y),
                    text,
                    fontsize=7.5,
                    color=(0.66, 0.66, 0.66),
                    overlay=True,
                    fill_opacity=0.20,
                )
        page.insert_text(
            (rect.width * 0.06, rect.height - 9),
            f"Licensed copy - {text}",
            fontsize=6,
            color=(0.55, 0.55, 0.55),
            overlay=True,
            fill_opacity=0.55,
        )
    doc.save(dst, garbage=3, deflate=True)
    doc.close()


if __name__ == '__main__':
    main()