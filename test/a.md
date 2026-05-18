import os
import base64
import json
import cv2
import requests
import numpy as np

from openai import OpenAI

import pymysql
from contextlib import closing

from mysql_logger import MYSQL_CONFIG

# 禁止代理
os.environ["HTTP_PROXY"] = ""
os.environ["HTTPS_PROXY"] = ""
os.environ["ALL_PROXY"] = ""

# 局域网直连
os.environ["NO_PROXY"] = "*"


# ==========================
# 下载图片
# ==========================
def load_image_from_url(url):

    response = requests.get(url, timeout=2)

    response.raise_for_status()

    image_array = np.frombuffer(
        response.content,
        np.uint8
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    if image is None:
        raise Exception(f"无法解码图片: {url}")

    return image


# ==========================
# 判断是否同一艘船
# ==========================
def is_same_ship(frame1, frame2):

    text = """
    你是一个专业的船舶识别专家。

    请判断两张图片中的船是否为同一艘。

    请从船的细节特征判断，只要有一处特征明显不一样就不是同一艘船。

    same=true 表示确定是同一艘船
    same=false 表示不是同一艘船或无法确定

    仅返回 JSON：

    {
      "same": true,
      "reason": ""
    }
    """

    client = OpenAI(
        # base_url='http://172.100.100.71:8000/v1/',
        # api_key='SHENLAN@2016'
        base_url = 'https://api-inference.modelscope.cn/v1/',
        api_key = '33d8be16-b67a-44de-9051-7c685ed7ef20'
    )

    frames = [frame1, frame2]

    content = [
        {
            'type': 'text',
            'text': text
        }
    ]

    for frame in frames:

        _, buffer = cv2.imencode('.jpg', frame)

        base64str = base64.b64encode(
            buffer
        ).decode('utf-8')

        content.append({
            'type': 'image_url',
            'image_url': {
                'url': f'data:image/jpeg;base64,{base64str}'
            }
        })

    response = client.chat.completions.create(
        # model='cyankiwi_Qwen3-VL-8B-Instruct-AWQ-4bit',
        model='Qwen/Qwen2.5-VL-72B-Instruct',
        messages=[
            {
                'role': 'user',
                'content': content
            }
        ],
        stream=False
    )

    text_result = response.choices[0].message.content

    print("模型原始输出：")
    print(text_result)

    # 去 markdown
    if (
        text_result.startswith("```json")
        and text_result.endswith("```")
    ):
        text_result = text_result[7:-3].strip()

    return json.loads(text_result)


# ==========================
# URL版本
# ==========================
def is_same_ship_by_url(url1, url2):

    frame1 = load_image_from_url(url1)

    frame2 = load_image_from_url(url2)

    return is_same_ship(frame1, frame2)

def draw_compare_result(frame1, frame2, result, save_path="compare_result.jpg"):

    # ==========================
    # 统一高度
    # ==========================
    h = 720

    def resize_keep(img):

        scale = h / img.shape[0]

        w = int(img.shape[1] * scale)

        return cv2.resize(img, (w, h))

    img1 = resize_keep(frame1)
    img2 = resize_keep(frame2)

    # ==========================
    # 拼接
    # ==========================
    merged = cv2.hconcat([img1, img2])

    # ==========================
    # 顶部扩展黑边
    # ==========================
    top_pad = 140

    canvas = cv2.copyMakeBorder(
        merged,
        top_pad,
        0,
        0,
        0,
        cv2.BORDER_CONSTANT,
        value=(0, 0, 0)
    )

    # ==========================
    # 文字
    # ==========================
    same = result.get("same", False)

    reason = result.get("reason", "")

    title = "SAME SHIP" if same else "DIFFERENT SHIP"

    color = (0, 255, 0) if same else (0, 0, 255)

    # 标题
    cv2.putText(
        canvas,
        title,
        (40, 60),
        cv2.FONT_HERSHEY_SIMPLEX,
        2,
        color,
        4
    )

    # 原因
    cv2.putText(
        canvas,
        reason,
        (40, 110),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 255, 255),
        2
    )

    # ==========================
    # 保存
    # ==========================
    cv2.imwrite(save_path, canvas)

    print(f"结果图已保存: {save_path}")


def get_boxs_by_id(selfId: str, parentId :str):
    sql = """
    SELECT
        SUBSTRING_INDEX(tf1.storeName, '.', 1) AS selfName,
        SUBSTRING_INDEX(tf2.storeName, '.', 1) AS parentName,
    
        tt.selfId,
        tt.parentId,
        tt.rootId,
        tt.score,
        tt.matchDate,
    
        JSON_UNQUOTE(JSON_EXTRACT(ts1.picListJson, '$[0].target.minX')) as selfMinX,
        JSON_UNQUOTE(JSON_EXTRACT(ts1.picListJson, '$[0].target.maxX')) as selfMaxX,
        JSON_UNQUOTE(JSON_EXTRACT(ts1.picListJson, '$[0].target.minY')) as selfMinY,
        JSON_UNQUOTE(JSON_EXTRACT(ts1.picListJson, '$[0].target.maxY')) as selfMaxY,
        JSON_UNQUOTE(JSON_EXTRACT(ts2.picListJson, '$[0].target.minX')) as parentMinX,
        JSON_UNQUOTE(JSON_EXTRACT(ts2.picListJson, '$[0].target.maxX')) as parentMaxX,
        JSON_UNQUOTE(JSON_EXTRACT(ts2.picListJson, '$[0].target.minY')) as parentMinY,
        JSON_UNQUOTE(JSON_EXTRACT(ts2.picListJson, '$[0].target.maxY')) as parentMaxY
    
    FROM tbl_tree tt
    
    LEFT JOIN tbl_shippassagecache ts1
    ON tt.selfId = ts1.yoloTargetId
    
    LEFT JOIN tbl_shippassagecache ts2
    ON tt.parentId = ts2.yoloTargetId
    
    LEFT JOIN tbl_frame tf1
    ON ts1.yoloTargetId = tf1.targetId
    AND ts1.frameTime = SUBSTRING_INDEX(tf1.frameTime, '.', 1)
    
    LEFT JOIN tbl_frame tf2
    ON ts2.yoloTargetId = tf2.targetId
    AND ts2.frameTime = SUBSTRING_INDEX(tf2.frameTime, '.', 1)
    
    WHERE tt.selfId = %s AND tt.parentId = %s
    
    ORDER BY tt.matchDate ASC
    """

    with closing(pymysql.connect(**MYSQL_CONFIG)) as conn:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(sql, (selfId, parentId))
            return cursor.fetchall()

# ==========================
# bbox裁剪
# ==========================
def crop_ship(
        frame,
        min_x,
        max_x,
        min_y,
        max_y,
        padding=0
):
    h, w = frame.shape[:2]

    min_x = int(float(min_x))
    max_x = int(float(max_x))
    min_y = int(float(min_y))
    max_y = int(float(max_y))

    # 扩边
    min_x -= padding
    max_x += padding
    min_y -= padding
    max_y += padding

    # 防越界
    min_x = max(0, min_x)
    min_y = max(0, min_y)

    max_x = min(w, max_x)
    max_y = min(h, max_y)

    return frame[min_y:max_y, min_x:max_x]

# ==========================
# 主函数
# ==========================
if __name__ == "__main__":

    url1 = "http://192.168.1.30:9528/upload/original_snaps/SXT11716_60_v8.jpg"
    url2 = "http://192.168.1.30:9528/upload/original_snaps/SXT11636_30_v14.jpg"

    # ==========================
    # 提取id
    # ==========================
    selfId = url1.split("original_snaps/")[1].split("_v")[0]
    parentId = url2.split("original_snaps/")[1].split("_v")[0]

    print(selfId)
    print(parentId)

    # ==========================
    # 查bbox
    # ==========================
    rows = get_boxs_by_id(
        selfId,
        parentId
    )

    if len(rows) == 0:
        raise Exception("没有查到bbox")

    row = rows[0]

    # ==========================
    # 下载原图
    # ==========================
    frame1 = load_image_from_url(url1)
    frame2 = load_image_from_url(url2)

    # ==========================
    # bbox裁剪
    # ==========================
    crop1 = crop_ship(
        frame1,
        row["selfMinX"],
        row["selfMaxX"],
        row["selfMinY"],
        row["selfMaxY"]
    )

    crop2 = crop_ship(
        frame2,
        row["parentMinX"],
        row["parentMaxX"],
        row["parentMinY"],
        row["parentMaxY"]
    )

    # ==========================
    # AI判断
    # ==========================
    result = is_same_ship(
        crop1,
        crop2
    )

    print("\n最终结果：")

    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2
        )
    )

    # ==========================
    # 保存对比图
    # ==========================
    draw_compare_result(
        crop1,
        crop2,
        result,
        "ship_compare.jpg"
    )

    draw_compare_result(
        frame1,
        frame2,
        result,
        "ship_compare_1920_1080.jpg"
    )

    # ==========================
    # 保存四张图
    # ==========================
    cv2.imwrite("frame1.jpg", frame1)
    cv2.imwrite("frame2.jpg", frame2)

    cv2.imwrite("frame1_crop.jpg", crop1)
    cv2.imwrite("frame2_crop.jpg", crop2)