import os, io, zipfile, json
from flask import Flask, request, send_file, jsonify
from PIL import Image, ImageEnhance, ImageFilter

app = Flask(__name__)
Allowed_EXT = {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'}

def allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Allowed_EXT

@app.route('/')
def index():
    return send_file('imageprocessorUI.html')

@app.route('/process', methods=['POST'])
def process():
    files = request.files.getlist('images')
    suffix = request.form.get('suffix', '_edited')
    out_fmt = request.form.get('format', 'png').lower()
    angle = int(request.form.get('angle', 0))
    do_sharpen = request.form.get('sharpen', 'false') == 'true'
    do_gray = request.form.get('gray', 'false') == 'true'
    do_rotate = request.form.get('rotate', 'false') == 'true'

    mime_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}
    pil_fmt = {'png': 'PNG', 'jpeg': 'JPEG', 'jpg': 'JPEG', 'webp': 'WEBP'}.get(out_fmt, 'PNG')

    if not files:
        return jsonify({
            'error': 'No files provided'
       }), 400
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            if not allowed(f.filename):
                continue
            img = Image.open(f.stream)


            if do_sharpen:
                img = img.filter(ImageFilter.SHARPEN)
            if do_gray:
                img = img.convert('L')
            elif img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            if do_rotate:
                img = img.rotate(angle, expand=True)
            

            base = os.path.splitext(f.filename)[0]
            out_name = f"{base}{suffix}.{out_fmt}"

            out_buf =io.BytesIO()
            save_kwargs = {}

            if pil_fmt == 'jpeg':
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                save_kwargs['quality'] = 95
            img.save(out_buf, format=pil_fmt, **save_kwargs)
            zf.writestr(out_name, out_buf.getvalue())

    buf.seek(0)
    return send_file(buf, mimetype='application/zip',
                     as_attachment=True, download_name='processed_images.zip')

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000))) 